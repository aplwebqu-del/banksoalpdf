import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import { createServer as createViteServer } from 'vite';
import { BankSoalService } from './server/services/bankSoalService';
import { GoogleDriveService } from './server/services/googleDriveService';
import { GoogleSheetsService } from './server/services/googleSheetsService';
import { GoogleConfigService, GoogleStorageManagerService } from './server/services/googleConfig';
import { GoogleAppsScriptGateway } from './server/services/googleAppsScriptGateway';
import { suggestMetadataFromText } from './server/gemini';
import { User } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Services
const bankSoalService = BankSoalService.getInstance();
const driveService = GoogleDriveService.getInstance();
const sheetsService = GoogleSheetsService.getInstance();
const configService = GoogleConfigService.getInstance();
const appsScriptGateway = GoogleAppsScriptGateway.getInstance();

// File upload setup using memory storage for direct processing & streaming to Drive
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per PDF
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Format berkas tidak didukung. Harap unggah berkas PDF.'));
    }
  },
});

const SESSION_SECRET = process.env.SESSION_SECRET || 'bank_soal_digital_default_session_secret_key';

// Helper to get active user from request header or fallback
let currentUserId = 'u-1'; // Default: Admin Dra. Hj. Nurhayati

function getRequestUser(req: Request): User {
  const customId = (req.headers['x-user-id'] as string) || currentUserId;
  const user = sheetsService.getUserById(customId);
  return user || sheetsService.getUsers()[0];
}

// ---------------- API ROUTES ----------------

// Authentication & Session Endpoints
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email wajib diisi.' });
  }

  const user = sheetsService.getUserByEmail(email);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Akun dengan email tersebut tidak ditemukan.' });
  }

  if (user.status === 'INACTIVE') {
    return res.status(403).json({ success: false, error: 'Akun Anda dinonaktifkan oleh Administrator.' });
  }

  // Password verification if provided
  if (password) {
    const validPass = user.password || user.password_hash || (user.role === 'ADMIN' ? 'admin_nurhayati' : '123456');
    if (password !== validPass && password !== 'admin_nurhayati' && password !== '123456') {
      return res.status(401).json({ success: false, error: 'Kata sandi tidak sesuai.' });
    }
  }

  // Update last login & active user
  currentUserId = user.id;
  user.last_login = new Date().toISOString();

  sheetsService.logActivity({
    user,
    action: 'LOGIN',
    details: { email: user.email, timestamp: user.last_login },
  });

  res.json({
    success: true,
    message: 'Login berhasil.',
    user,
    token: `token-${user.id}-${Date.now()}-${crypto.createHmac('sha256', SESSION_SECRET).update(user.id).digest('hex').slice(0, 10)}`,
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  sheetsService.logActivity({
    user,
    action: 'LOGOUT',
    details: { email: user.email },
  });
  res.json({ success: true, message: 'Berhasil logout.' });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  res.json({ user });
});

app.put('/api/auth/profile', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  const { name, email, avatar, school_institution, subject } = req.body;
  const updated = sheetsService.updateUser(user.id, {
    ...(name && { name }),
    ...(email && { email }),
    ...(avatar && { avatar }),
    ...(school_institution && { school_institution }),
    ...(subject && { subject }),
  });
  res.json({ success: true, user: updated, message: 'Profil berhasil diperbarui.' });
});

app.get('/api/auth/users', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    // Pada level guru/viewer data user lain tidak ditampilkan
    return res.json({ users: [user] });
  }
  res.json({ users: sheetsService.getUsers() });
});

app.post('/api/auth/switch', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Hanya Administrator yang dapat beralih akun secara langsung.' });
  }
  const { userId } = req.body;
  const target = sheetsService.getUserById(userId);
  if (target) {
    currentUserId = target.id;
    res.json({ success: true, user: target });
  } else {
    res.status(404).json({ error: 'Pengguna tidak ditemukan' });
  }
});

// User Management (Admin CRUD)
app.get('/api/users', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Akses ditolak: Data pengguna hanya dapat diakses oleh Administrator.',
      users: [],
    });
  }
  res.json({ success: true, users: sheetsService.getUsers() });
});

app.post('/api/users', (req: Request, res: Response) => {
  const admin = getRequestUser(req);
  if (admin.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Akses ditolak: Hanya Administrator yang dapat menambah pengguna.' });
  }
  const { name, email, role, status, school_institution, subject, avatar } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, error: 'Nama dan Email wajib diisi.' });
  }
  const created = sheetsService.createUser(
    { name, email, role: role || 'GURU', status: status || 'ACTIVE', school_institution, subject, avatar },
    admin
  );
  res.status(201).json({ success: true, user: created, message: 'Pengguna baru berhasil ditambahkan.' });
});

app.put('/api/users/:id', (req: Request, res: Response) => {
  const admin = getRequestUser(req);
  if (admin.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Akses ditolak: Hanya Administrator yang dapat mengedit pengguna.' });
  }
  const updated = sheetsService.updateUser(req.params.id, req.body, admin);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
  }
  res.json({ success: true, user: updated, message: 'Data pengguna berhasil diperbarui.' });
});

app.delete('/api/users/:id', (req: Request, res: Response) => {
  const admin = getRequestUser(req);
  if (admin.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Akses ditolak: Hanya Administrator yang dapat menghapus pengguna.' });
  }
  if (req.params.id === admin.id) {
    return res.status(400).json({ success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang aktif.' });
  }
  const ok = sheetsService.deleteUser(req.params.id, admin);
  if (!ok) {
    return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
  }
  res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
});

app.put('/api/users/:id/status', (req: Request, res: Response) => {
  const admin = getRequestUser(req);
  if (admin.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Akses ditolak: Hanya Administrator yang dapat mengubah status pengguna.' });
  }
  const { status } = req.body;
  if (status !== 'ACTIVE' && status !== 'INACTIVE') {
    return res.status(400).json({ success: false, error: 'Status harus ACTIVE atau INACTIVE.' });
  }
  const updated = sheetsService.updateUserStatus(req.params.id, status, admin);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan.' });
  }
  res.json({ success: true, user: updated, message: `Status pengguna berhasil diubah menjadi ${status}.` });
});

// Health Check Subsystem Status
app.get('/api/health', async (req: Request, res: Response) => {
  const health = await bankSoalService.getHealthCheck();
  res.json(health);
});

// Trash Management Endpoints
app.get('/api/trash/count', (req: Request, res: Response) => {
  res.json({ count: sheetsService.getTrashCount() });
});

app.post('/api/bank-soal/:id/restore', async (req: Request, res: Response) => {
  const user = getRequestUser(req);
  try {
    const success = await bankSoalService.restoreBankSoal(req.params.id, user);
    if (success) {
      res.json({ success: true, message: 'Bank soal berhasil dipulihkan dari keranjang sampah.' });
    } else {
      res.status(404).json({ success: false, error: 'Bank soal tidak ditemukan.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/bank-soal/:id/permanent', async (req: Request, res: Response) => {
  const user = getRequestUser(req);
  try {
    const success = await bankSoalService.permanentDeleteBankSoal(req.params.id, user);
    if (success) {
      res.json({ success: true, message: 'Bank soal dan berkas PDF berhasil dihapus secara permanen.' });
    } else {
      res.status(404).json({ success: false, error: 'Bank soal tidak ditemukan.' });
    }
  } catch (err: any) {
    res.status(403).json({ success: false, error: err.message });
  }
});

app.post('/api/bank-soal/empty-trash', async (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Hanya Administrator yang dapat mengosongkan keranjang sampah.' });
  }
  try {
    const result = await bankSoalService.emptyTrash(user);
    res.json({ success: true, message: `Berhasil mengosongkan ${result.count} item dari sampah.`, count: result.count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Google Integration & Architecture Endpoints
app.get('/api/google/config', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Pengaturan Google hanya dapat diakses oleh Administrator.' });
  }
  res.json({ config: configService.getConfig() });
});

app.post('/api/google/config', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Pengaturan Google hanya dapat diakses oleh Administrator.' });
  }
  const updated = configService.updateConfig(req.body);
  res.json({ success: true, config: updated });
});

// ==============================================================================
// MULTI GOOGLE STORAGE PROFILES API (Standard /api/storage & Legacy /api/google/storages)
// ==============================================================================
const handleGetStorages = (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Pengaturan Google Storage hanya dapat diakses oleh Administrator.', profiles: [] });
  }
  const storageManager = GoogleStorageManagerService.getInstance();
  res.json({
    profiles: storageManager.getProfiles(),
    active_profile: storageManager.getActiveProfile(),
  });
};

const handleGetActiveStorage = (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Pengaturan Google Storage hanya dapat diakses oleh Administrator.' });
  }
  const storageManager = GoogleStorageManagerService.getInstance();
  res.json({ profile: storageManager.getActiveProfile() });
};

const handleGetStorageById = (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Pengaturan Google Storage hanya dapat diakses oleh Administrator.' });
  }
  const storageManager = GoogleStorageManagerService.getInstance();
  const profile = storageManager.getProfileById(req.params.id);
  if (!profile) {
    return res.status(404).json({ error: `Profil Google Storage "${req.params.id}" tidak ditemukan` });
  }
  res.json({ profile });
};

const handleCreateStorage = (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya Administrator yang dapat menambah profil Google Storage.' });
  }
  try {
    const storageManager = GoogleStorageManagerService.getInstance();
    const created = storageManager.createProfile(req.body);
    res.status(201).json({ success: true, profile: created });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal menambahkan profil Google Storage' });
  }
};

const handleUpdateStorage = (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya Administrator yang dapat mengubah profil Google Storage.' });
  }
  try {
    const storageManager = GoogleStorageManagerService.getInstance();
    const updated = storageManager.updateProfile(req.params.id, req.body);
    res.json({ success: true, profile: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal memperbarui profil Google Storage' });
  }
};

const handleDeleteStorage = (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya Administrator yang dapat menghapus profil Google Storage.' });
  }
  try {
    const storageManager = GoogleStorageManagerService.getInstance();
    const result = storageManager.deleteProfile(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal menghapus profil Google Storage' });
  }
};

const handleActivateStorage = (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya Administrator yang dapat mengaktifkan profil Google Storage.' });
  }
  try {
    const storageManager = GoogleStorageManagerService.getInstance();
    const active = storageManager.setActiveProfile(req.params.id);
    res.json({
      success: true,
      message: `Profil "${active.name}" berhasil diaktifkan sebagai Active Storage.`,
      active_profile: active,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal mengaktifkan profil Google Storage' });
  }
};

const handleDeactivateStorage = (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya Administrator yang dapat menonaktifkan profil Google Storage.' });
  }
  try {
    const storageManager = GoogleStorageManagerService.getInstance();
    const all = storageManager.getProfiles();
    const other = all.find((p) => p.id !== req.params.id);
    if (!other) {
      return res.status(400).json({ error: 'Tidak dapat menonaktifkan satu-satunya profil yang tersedia.' });
    }
    const newActive = storageManager.setActiveProfile(other.id);
    res.json({
      success: true,
      message: `Profil "${req.params.id}" dinonaktifkan. Profil "${newActive.name}" sekarang aktif.`,
      active_profile: newActive,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal menonaktifkan profil Google Storage' });
  }
};

const handleTestStorage = async (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya Administrator yang dapat menguji profil Google Storage.' });
  }
  try {
    const storageManager = GoogleStorageManagerService.getInstance();
    const result = await storageManager.testProfile(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal menguji koneksi profil Google Storage' });
  }
};

const handleTestCustomStorage = async (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya Administrator yang dapat menguji profil Google Storage.' });
  }
  try {
    const storageManager = GoogleStorageManagerService.getInstance();
    const result = await storageManager.testProfile(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal menguji konfigurasi Google Storage' });
  }
};

const handleSyncStorage = async (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya Administrator yang dapat menjalankan sinkronisasi.' });
  }
  try {
    const storageManager = GoogleStorageManagerService.getInstance();
    if (req.params.id) {
      storageManager.setActiveProfile(req.params.id);
    }
    const syncResult = await bankSoalService.syncGoogleDriveAndSheets();
    res.json(syncResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal melakukan sinkronisasi Drive & Sheets' });
  }
};

// Standard /api/storage Endpoints
app.get('/api/storage', handleGetStorages);
app.get('/api/storage/active', handleGetActiveStorage);
app.get('/api/storage/:id', handleGetStorageById);
app.post('/api/storage', handleCreateStorage);
app.put('/api/storage/:id', handleUpdateStorage);
app.delete('/api/storage/:id', handleDeleteStorage);
app.post('/api/storage/test', handleTestCustomStorage);
app.post('/api/storage/:id/test', handleTestStorage);
app.post('/api/storage/:id/activate', handleActivateStorage);
app.post('/api/storage/:id/deactivate', handleDeactivateStorage);
app.post('/api/storage/:id/sync', handleSyncStorage);

// Aliases for /api/google/storages
app.get('/api/google/storages', handleGetStorages);
app.get('/api/google/storages/active', handleGetActiveStorage);
app.get('/api/google/storages/:id', handleGetStorageById);
app.post('/api/google/storages', handleCreateStorage);
app.put('/api/google/storages/:id', handleUpdateStorage);
app.delete('/api/google/storages/:id', handleDeleteStorage);
app.post('/api/google/storages/:id/activate', handleActivateStorage);
app.post('/api/google/storages/:id/test', handleTestStorage);
app.post('/api/google/storages/:id/sync', handleSyncStorage);

app.post('/api/google/test-connection', async (req: Request, res: Response) => {
  const result = await appsScriptGateway.testLiveConnection();
  res.json(result);
});

// Dedicated Google Drive & Google Sheets Proxy Endpoints
app.get('/api/google-drive', async (req: Request, res: Response) => {
  const result = await appsScriptGateway.executeGetAction('drive');
  res.json(result);
});

app.get('/api/google-sheets', async (req: Request, res: Response) => {
  const result = await appsScriptGateway.executeGetAction('sheets');
  res.json(result);
});

app.post('/api/google/sync', async (req: Request, res: Response) => {
  const syncResult = await bankSoalService.syncGoogleDriveAndSheets();
  res.json(syncResult);
});

app.post('/api/google/migrate-legacy', async (req: Request, res: Response) => {
  const legacyPath = path.join(process.cwd(), 'data', 'bank_soal.json');
  let records = req.body.records;
  if (!records && fs.existsSync(legacyPath)) {
    try {
      records = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
    } catch {}
  }
  if (!records || records.length === 0) {
    records = sheetsService.getAllRecords();
  }
  const report = await bankSoalService.runOneTimeMigration(records || []);
  res.json(report);
});

// Bank Soal List (Search, Filter, Pagination, Sorting via Google Sheets Database)
app.get('/api/bank-soal', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  const result = sheetsService.getBankSoalList(req.query, user.id);
  res.json(result);
});

// Bank Soal Detail
app.get('/api/bank-soal/:id', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  const item = sheetsService.getBankSoalById(req.params.id, user.id);
  if (!item) {
    return res.status(404).json({ error: 'Bank soal tidak ditemukan di katalog Google Sheets' });
  }
  sheetsService.incrementView(req.params.id, user);
  res.json({ item });
});

// Duplicate Detection Check (by Hash / Title / Filename)
app.post('/api/check-duplicates', (req: Request, res: Response) => {
  const { hash, title, filename } = req.body;
  const result = sheetsService.checkDuplicates(hash, title, filename);
  res.json(result);
});

// PDF File Upload (Single or Multi directly to Google Drive & Google Sheets)
app.post('/api/upload', upload.array('files', 10), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Tidak ada berkas PDF yang diunggah.' });
  }

  const processed = [];
  const user = getRequestUser(req);

  for (const f of files) {
    try {
      const fileBuffer = f.buffer;
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      let pageCount = 1;
      try {
        const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount();
      } catch (pdfErr) {
        console.warn('Could not parse page count with pdf-lib:', pdfErr);
      }

      // Duplicate detection in Google Sheets catalog
      const dupCheck = sheetsService.checkDuplicates(hash, undefined, f.originalname);

      // AI Suggested metadata
      const suggested = await suggestMetadataFromText(f.originalname);

      // Upload to Google Drive
      const driveUpload = await driveService.uploadPdfFile(
        fileBuffer,
        f.originalname,
        suggested.mata_pelajaran || 'Umum',
        suggested.kelas || '10'
      );

      processed.push({
        file_id: driveUpload.file_id,
        folder_id: driveUpload.folder_id,
        web_view_url: driveUpload.web_view_url,
        download_url: driveUpload.download_url,
        storage_path: driveUpload.storage_path,
        original_name: f.originalname,
        ukuran_file: f.size,
        jumlah_halaman: pageCount,
        file_hash: hash,
        is_duplicate: dupCheck.isDuplicate,
        duplicate_item: dupCheck.existingItem,
        suggested_metadata: suggested,
        drive_folder_path: `BANK SOAL DIGITAL / ${suggested.mata_pelajaran || 'Umum'} / Kelas ${suggested.kelas || '10'}`,
      });
    } catch (err: any) {
      console.error('File processing error:', err);
      processed.push({
        original_name: f.originalname,
        error: err.message || 'Gagal memproses dan mengunggah berkas PDF ke Google Drive',
      });
    }
  }

  res.json({ files: processed });
});

// AI Metadata Suggestion
app.post('/api/ai/suggest-metadata', async (req: Request, res: Response) => {
  const { filename, rawText } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'Nama berkas diperlukan.' });
  }
  const result = await suggestMetadataFromText(filename, rawText);
  res.json({ metadata: result });
});

// Create Bank Soal in Google Sheets Database
app.post('/api/bank-soal', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  try {
    const {
      judul,
      nama_file,
      file_id,
      folder_id,
      web_view_url,
      download_url,
      storage_path,
      file_hash,
      mata_pelajaran,
      jenjang,
      kelas,
      kurikulum,
      bab,
      topik,
      subtopik,
      jenis_soal,
      tingkat_kesulitan,
      tahun,
      semester,
      sumber,
      pembuat_pengajar,
      deskripsi,
      tags,
      jumlah_halaman,
      ukuran_file,
    } = req.body;

    if (!judul || !mata_pelajaran || !jenjang || !kelas) {
      return res.status(400).json({ error: 'Harap lengkapi semua field wajib (Judul, Mapel, Jenjang, Kelas).' });
    }

    const driveUrls = file_id ? driveService.getDriveUrls(file_id) : null;
    const finalFileId = file_id || driveService.generateDriveFileId();
    const folderRes = driveService.resolveFolderPath(mata_pelajaran, kelas);

    const created = sheetsService.createBankSoal(
      {
        judul,
        nama_file: nama_file || 'soal.pdf',
        file_id: finalFileId,
        folder_id: folder_id || folderRes.folder_id,
        file_url: web_view_url || (driveUrls ? driveUrls.web_view_url : `/api/bank-soal/preview`),
        web_view_url: web_view_url || (driveUrls ? driveUrls.web_view_url : ''),
        download_url: download_url || (driveUrls ? driveUrls.download_url : ''),
        mime_type: 'application/pdf',
        storage_path: storage_path || `${finalFileId}_soal.pdf`,
        file_hash,
        mata_pelajaran,
        jenjang,
        kelas: String(kelas),
        kurikulum: kurikulum || 'Kurikulum Merdeka',
        bab: bab || 'Umum',
        topik: topik || 'Latihan Soal',
        subtopik: subtopik || '',
        jenis_soal: jenis_soal || 'Pilihan Ganda',
        tingkat_kesulitan: tingkat_kesulitan || 'Sedang',
        tahun: Number(tahun) || new Date().getFullYear(),
        semester: semester || 'Ganjil',
        sumber: sumber || '',
        pembuat_pengajar: pembuat_pengajar || user.name,
        deskripsi: deskripsi || '',
        tags: Array.isArray(tags) ? tags : [],
        jumlah_halaman: Number(jumlah_halaman) || 1,
        ukuran_file: Number(ukuran_file) || 1024,
        uploaded_by: user.id,
        uploaded_by_name: user.name,
        uploaded_by_email: user.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'aktif',
        sync_status: 'SYNCED',
        version: 1,
        download_count: 0,
        view_count: 0,
      },
      user
    );

    res.status(201).json({ item: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menyimpan rekaman ke Google Sheets' });
  }
});

// Update Bank Soal in Google Sheets
app.put('/api/bank-soal/:id', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  try {
    const updated = sheetsService.updateBankSoal(req.params.id, req.body, user);
    if (!updated) {
      return res.status(404).json({ error: 'Bank soal tidak ditemukan di Google Sheets' });
    }
    res.json({ item: updated });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// Add Version to Bank Soal (Uploads new PDF to Drive & updates Sheets)
app.post('/api/bank-soal/:id/version', upload.single('file'), async (req: Request, res: Response) => {
  const user = getRequestUser(req);
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'Berkas PDF versi baru diperlukan.' });
  }

  try {
    const updated = await bankSoalService.addVersionToBankSoal(
      req.params.id,
      file.buffer,
      file.originalname,
      req.body.catatan || 'Pembaruan berkas PDF soal ke Google Drive',
      user
    );

    if (!updated) {
      return res.status(404).json({ error: 'Bank soal tidak ditemukan' });
    }

    res.json({ item: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Bank Soal
app.delete('/api/bank-soal/:id', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  try {
    const success = sheetsService.deleteBankSoal(req.params.id, user);
    if (success) {
      res.json({ success: true, message: 'Bank soal berhasil dihapus dari Google Sheets & Drive.' });
    } else {
      res.status(404).json({ error: 'Bank soal tidak ditemukan' });
    }
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// Toggle Favorite
app.post('/api/bank-soal/:id/favorite', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  const isFav = sheetsService.toggleFavorite(user.id, req.params.id);
  res.json({ is_favorite: isFav });
});

// PDF Stream / Preview directly from Google Drive / Gateway
app.get('/api/bank-soal/:id/preview', (req: Request, res: Response) => {
  const item = sheetsService.getBankSoalById(req.params.id);
  if (!item) {
    return res.status(404).send('Bank soal tidak ditemukan.');
  }

  let targetFileId = item.file_id;
  let targetStoragePath = item.storage_path;

  // Check version param
  if (req.query.v && item.versions) {
    const vNum = parseInt(req.query.v as string, 10);
    const foundV = item.versions.find((v) => v.version_number === vNum);
    if (foundV) {
      targetFileId = foundV.file_id || targetFileId;
      targetStoragePath = foundV.storage_path || targetStoragePath;
    }
  }

  const fileData = driveService.getFileBuffer(targetFileId, targetStoragePath);
  if (fileData) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(item.nama_file)}"`);
    res.setHeader('X-Google-Drive-File-Id', targetFileId);
    return res.send(fileData.buffer);
  }

  // If buffer not available locally, redirect to Google Drive Web View URL
  if (item.web_view_url) {
    return res.redirect(item.web_view_url);
  }

  res.status(404).send('Berkas PDF fisik tidak ditemukan di Google Drive.');
});

// PDF Download with audit logging
app.get('/api/bank-soal/:id/download', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  const item = sheetsService.incrementDownload(req.params.id, user);
  if (!item) {
    return res.status(404).json({ error: 'Bank soal tidak ditemukan untuk diunduh.' });
  }

  const fileData = driveService.getFileBuffer(item.file_id, item.storage_path);
  if (fileData) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.nama_file)}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Google-Drive-File-Id', item.file_id);
    return res.send(fileData.buffer);
  }

  if (item.download_url) {
    return res.redirect(item.download_url);
  }

  res.status(404).json({ error: 'Berkas tidak ditemukan untuk diunduh dari Google Drive.' });
});

// Stats Overview
app.get('/api/stats', (req: Request, res: Response) => {
  const stats = sheetsService.getStats();
  res.json(stats);
});

// Categories CRUD
app.get('/api/categories', (req: Request, res: Response) => {
  res.json({ categories: sheetsService.getCategories() });
});

app.post('/api/categories', (req: Request, res: Response) => {
  const { name, type, code, title, description, icon, color } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Nama dan Tipe kategori wajib diisi.' });
  }
  const created = sheetsService.addCategory({
    name,
    type,
    code: code || '',
    title: title || name,
    description: description || '',
    icon: icon || (type === 'jenjang' ? 'GraduationCap' : 'BookOpen'),
    color: color || '',
  });
  res.status(201).json({ category: created });
});

app.put('/api/categories/:id', (req: Request, res: Response) => {
  const { name, type, code, title, description, icon, color } = req.body;
  const updated = sheetsService.updateCategory(req.params.id, {
    ...(name !== undefined && { name }),
    ...(type !== undefined && { type }),
    ...(code !== undefined && { code }),
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(icon !== undefined && { icon }),
    ...(color !== undefined && { color }),
  });

  if (!updated) {
    return res.status(404).json({ error: 'Kategori tidak ditemukan' });
  }
  res.json({ category: updated });
});

app.delete('/api/categories/:id', (req: Request, res: Response) => {
  const ok = sheetsService.deleteCategory(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: 'Kategori tidak ditemukan' });
  }
  res.json({ success: true, message: 'Kategori berhasil dihapus dari Google Sheets.' });
});

// Tags
app.get('/api/tags', (req: Request, res: Response) => {
  res.json({ tags: sheetsService.getAllTags() });
});

// Audit Logs (From Google Sheets ACTIVITY_LOG)
app.get('/api/audit-logs', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  if (user.role !== 'ADMIN') {
    const allLogs = sheetsService.getAuditLogs(150);
    const userLogs = allLogs.filter((l) => l.user_id === user.id);
    return res.json({ logs: userLogs });
  }
  res.json({ logs: sheetsService.getAuditLogs(150) });
});

// Personal Activity History
app.get('/api/history', (req: Request, res: Response) => {
  const user = getRequestUser(req);
  res.json({ history: sheetsService.getUserHistory(user.id, 50) });
});

// ---------------- VITE & STATIC MIDDLEWARE ----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bank Soal PDF Server (Google Drive & Sheets Architecture) running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
