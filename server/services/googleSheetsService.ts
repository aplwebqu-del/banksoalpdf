import fs from 'fs';
import path from 'path';
import { BankSoal, User, CategoryItem, AuditLogItem, UserHistoryItem, FilterParams, StatsOverview } from '../../src/types';
import { GoogleConfigService } from './googleConfig';

export const BANK_SOAL_COLUMNS = [
  'id', 'judul', 'nama_file', 'file_id', 'folder_id', 'file_url', 'web_view_url', 'download_url',
  'mime_type', 'ukuran_file', 'jumlah_halaman', 'mata_pelajaran', 'jenjang', 'kelas', 'kurikulum',
  'bab', 'topik', 'subtopik', 'jenis_soal', 'tingkat_kesulitan', 'tahun', 'semester', 'sumber',
  'deskripsi', 'tags', 'uploaded_by', 'uploaded_by_name', 'uploaded_by_email', 'created_at',
  'updated_at', 'status', 'sync_status', 'version', 'file_hash', 'download_count', 'view_count'
];

export class GoogleSheetsService {
  private static instance: GoogleSheetsService;
  private configService: GoogleConfigService;
  private sheetsDbPath: string;

  // In-Memory Sheets Cache synced to disk/Google API
  private tableBankSoal: Map<string, BankSoal> = new Map();
  private tableUsers: Map<string, User> = new Map();
  private tableCategories: Map<string, CategoryItem> = new Map();
  private tableAuditLogs: AuditLogItem[] = [];
  private tableFavorites: Map<string, Set<string>> = new Map(); // userId -> Set<soalId>
  private tableHistory: UserHistoryItem[] = [];

  private constructor() {
    this.configService = GoogleConfigService.getInstance();
    this.sheetsDbPath = path.join(process.cwd(), 'data', 'sheets_db.json');
    this.initDatabase();
  }

  public static getInstance(): GoogleSheetsService {
    if (!GoogleSheetsService.instance) {
      GoogleSheetsService.instance = new GoogleSheetsService();
    }
    return GoogleSheetsService.instance;
  }

  private initDatabase() {
    try {
      if (fs.existsSync(this.sheetsDbPath)) {
        const raw = fs.readFileSync(this.sheetsDbPath, 'utf-8');
        const data = JSON.parse(raw);

        (data.bank_soal || []).forEach((item: BankSoal) => this.tableBankSoal.set(item.id, item));
        (data.users || []).forEach((user: User) => this.tableUsers.set(user.id, user));
        (data.categories || []).forEach((cat: CategoryItem) => this.tableCategories.set(cat.id, cat));
        this.tableAuditLogs = data.audit_logs || [];
        this.tableHistory = data.history || [];

        if (data.favorites) {
          Object.entries(data.favorites).forEach(([uid, fList]: [string, any]) => {
            this.tableFavorites.set(uid, new Set(Array.isArray(fList) ? fList : []));
          });
        }
      } else {
        this.seedInitialSheets();
      }
    } catch (err) {
      console.error('Error initializing sheets database:', err);
      this.seedInitialSheets();
    }
  }

  private persistDatabase() {
    try {
      const favObj: Record<string, string[]> = {};
      this.tableFavorites.forEach((set, uid) => {
        favObj[uid] = Array.from(set);
      });

      const payload = {
        sheet_meta: {
          spreadsheet_id: this.configService.getConfig().spreadsheet_id,
          spreadsheet_name: 'BANK SOAL DIGITAL',
          last_updated: new Date().toISOString(),
          columns: BANK_SOAL_COLUMNS,
        },
        bank_soal: Array.from(this.tableBankSoal.values()),
        users: Array.from(this.tableUsers.values()),
        categories: Array.from(this.tableCategories.values()),
        audit_logs: this.tableAuditLogs.slice(0, 1000),
        favorites: favObj,
        history: this.tableHistory.slice(0, 1000),
      };

      const dir = path.dirname(this.sheetsDbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.sheetsDbPath, JSON.stringify(payload, null, 2));
    } catch (err) {
      console.error('Error saving sheets database:', err);
    }
  }

  private seedInitialSheets() {
    // 1. Seed Users
    const users: User[] = [
      {
        id: 'u-1',
        name: 'Dra. Hj. Nurhayati, M.Pd.',
        email: 'nurhayati@sekolah.sch.id',
        role: 'ADMIN',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        school_institution: 'SMA Negeri 1 Teladan',
        subject: 'Manajemen Kurikulum & Matematika',
      },
      {
        id: 'u-2',
        name: 'Budi Santoso, S.Pd.',
        email: 'budi.santoso@guru.smp.id',
        role: 'GURU',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        school_institution: 'SMP Negeri 5 Bintang',
        subject: 'Matematika & IPA',
      },
      {
        id: 'u-3',
        name: 'Siti Rahmawati, M.Si.',
        email: 'siti.rahmawati@guru.sma.id',
        role: 'GURU',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
        school_institution: 'SMA Unggulan Cendekia',
        subject: 'Fisika & Kimia',
      },
      {
        id: 'u-4',
        name: 'Ahmad Fauzi, M.Hum.',
        email: 'ahmad.fauzi@guru.sma.id',
        role: 'GURU',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        school_institution: 'SMA Nusantara Mandiri',
        subject: 'Bahasa Indonesia & Sastra',
      },
    ];
    users.forEach((u) => this.tableUsers.set(u.id, u));

    // 2. Seed Categories
    const categories: CategoryItem[] = [
      { id: 'c-1', type: 'mata_pelajaran', name: 'Matematika', code: 'MTK', title: 'Matematika Terpadu', description: 'Aljabar, Geometri, Kalkulus, dan Statistika', icon: 'Calculator', color: 'from-blue-600 to-indigo-600' },
      { id: 'c-2', type: 'mata_pelajaran', name: 'Bahasa Indonesia', code: 'BIN', title: 'Bahasa Indonesia', description: 'Literasi, Teks Eksposisi, Cerpen, dan Tata Bahasa', icon: 'BookOpen', color: 'from-rose-600 to-pink-600' },
      { id: 'c-3', type: 'mata_pelajaran', name: 'Bahasa Inggris', code: 'BIG', title: 'Bahasa Inggris', description: 'Reading Comprehension, Grammar, TOEFL, dan AKM', icon: 'Languages', color: 'from-violet-600 to-purple-600' },
      { id: 'c-4', type: 'mata_pelajaran', name: 'IPA', code: 'IPA', title: 'Ilmu Pengetahuan Alam', description: 'Biologi dan Fisika Terpadu SMP', icon: 'FlaskConical', color: 'from-teal-600 to-emerald-600' },
      { id: 'c-5', type: 'mata_pelajaran', name: 'Fisika', code: 'FIS', title: 'Fisika', description: 'Mekanika, Listrik, Magnet, dan Termodinamika', icon: 'Atom', color: 'from-cyan-600 to-blue-600' },
      { id: 'c-6', type: 'mata_pelajaran', name: 'Kimia', code: 'KIM', title: 'Kimia', description: 'Stoikiometri, Ikatan Kimia, dan Termokimia', icon: 'Sparkles', color: 'from-purple-600 to-pink-600' },
      { id: 'c-7', type: 'mata_pelajaran', name: 'Biologi', code: 'BIO', title: 'Biologi', description: 'Sel, Genetika, Ekosistem, dan Anatomi', icon: 'Leaf', color: 'from-emerald-600 to-green-600' },
      { id: 'c-8', type: 'mata_pelajaran', name: 'IPS', code: 'IPS', title: 'Ilmu Pengetahuan Sosial', description: 'Sejarah, Geografi, dan Sosiologi SMP', icon: 'Compass', color: 'from-amber-600 to-yellow-600' },
      { id: 'c-9', type: 'jenjang', name: 'SD', code: 'SD', title: 'Sekolah Dasar', description: 'Fase A, B, C (Kelas 1 - 6)', icon: 'GraduationCap', color: 'from-emerald-600 to-teal-600' },
      { id: 'c-10', type: 'jenjang', name: 'SMP', code: 'SMP', title: 'Sekolah Menengah Pertama', description: 'Fase D (Kelas 7 - 9)', icon: 'GraduationCap', color: 'from-blue-600 to-indigo-600' },
      { id: 'c-11', type: 'jenjang', name: 'SMA', code: 'SMA', title: 'Sekolah Menengah Atas', description: 'Fase E & F (Kelas 10 - 12)', icon: 'GraduationCap', color: 'from-purple-600 to-violet-600' },
      { id: 'c-12', type: 'jenjang', name: 'SMK', code: 'SMK', title: 'Sekolah Menengah Kejuruan', description: 'Vokasi Kejuruan (Kelas 10 - 12)', icon: 'GraduationCap', color: 'from-amber-600 to-orange-600' },
    ];
    categories.forEach((c) => this.tableCategories.set(c.id, c));

    // Seed default favorites
    this.tableFavorites.set('u-1', new Set(['BS-000001', 'BS-000003']));
    this.tableFavorites.set('u-2', new Set(['BS-000002']));

    this.persistDatabase();
  }

  /**
   * Menghasilkan ID Format Standar: BS-000001, BS-000002, dst.
   */
  public generateNextId(): string {
    let maxNum = 0;
    this.tableBankSoal.forEach((item) => {
      const match = String(item.id).match(/BS-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const next = maxNum + 1;
    const padded = ('000000' + next).slice(-6);
    return `BS-${padded}`;
  }

  // --- BANK SOAL CRUD ---

  public getBankSoalList(params: FilterParams = {}, currentUserId?: string) {
    const list = Array.from(this.tableBankSoal.values());
    const favSet = currentUserId ? this.tableFavorites.get(currentUserId) || new Set() : new Set();

    let filtered = list.filter((item) => {
      if (item.status === 'arsip') return false;

      if (params.mata_pelajaran && item.mata_pelajaran !== params.mata_pelajaran) return false;
      if (params.jenjang && item.jenjang !== params.jenjang) return false;
      if (params.kelas && String(item.kelas) !== String(params.kelas)) return false;
      if (params.tahun && String(item.tahun) !== String(params.tahun)) return false;
      if (params.semester && item.semester !== params.semester) return false;
      if (params.tingkat_kesulitan && item.tingkat_kesulitan !== params.tingkat_kesulitan) return false;
      if (params.jenis_soal && item.jenis_soal !== params.jenis_soal) return false;
      if (params.kurikulum && item.kurikulum !== params.kurikulum) return false;
      if (params.uploaded_by && item.uploaded_by !== params.uploaded_by) return false;
      if (params.sync_status && item.sync_status !== params.sync_status) return false;

      if (params.is_favorite !== undefined) {
        const isFav = favSet.has(item.id);
        if (params.is_favorite && !isFav) return false;
        if (!params.is_favorite && isFav) return false;
      }

      if (params.tag) {
        const tLower = params.tag.toLowerCase();
        const hasTag = (item.tags || []).some((t) => t.toLowerCase() === tLower);
        if (!hasTag) return false;
      }

      if (params.search && params.search.trim()) {
        const q = params.search.toLowerCase().trim();
        const fullHaystack = [
          item.id,
          item.judul,
          item.nama_file,
          item.mata_pelajaran,
          item.jenjang,
          `Kelas ${item.kelas}`,
          item.bab,
          item.topik,
          item.subtopik || '',
          item.jenis_soal,
          item.tingkat_kesulitan,
          String(item.tahun),
          item.semester,
          item.sumber || '',
          item.pembuat_pengajar || '',
          item.deskripsi || '',
          item.uploaded_by_name || '',
          item.file_id,
          ...(item.tags || []),
        ]
          .join(' ')
          .toLowerCase();

        if (!fullHaystack.includes(q)) return false;
      }

      return true;
    });

    // Attach is_favorite status
    filtered = filtered.map((item) => ({
      ...item,
      is_favorite: favSet.has(item.id),
    }));

    // Sorting
    const sortBy = params.sortBy || 'terbaru';
    if (sortBy === 'terbaru') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'terlama') {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === 'a-z') {
      filtered.sort((a, b) => a.judul.localeCompare(b.judul));
    } else if (sortBy === 'z-a') {
      filtered.sort((a, b) => b.judul.localeCompare(a.judul));
    } else if (sortBy === 'view_count') {
      filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    } else if (sortBy === 'download_count') {
      filtered.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    }

    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 12;
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return {
      items: paginated,
      total,
      page,
      totalPages,
    };
  }

  public getBankSoalById(id: string, currentUserId?: string): BankSoal | null {
    const item = this.tableBankSoal.get(id);
    if (!item) return null;

    const favSet = currentUserId ? this.tableFavorites.get(currentUserId) || new Set() : new Set();
    return {
      ...item,
      is_favorite: favSet.has(item.id),
    };
  }

  public createBankSoal(data: Omit<BankSoal, 'id'>, user: User, customId?: string): BankSoal {
    const id = customId || this.generateNextId();
    const now = new Date().toISOString();

    const record: BankSoal = {
      ...data,
      id,
      created_at: data.created_at || now,
      updated_at: data.updated_at || now,
      download_count: data.download_count || 0,
      view_count: data.view_count || 0,
      version: data.version || 1,
      sync_status: data.sync_status || (data.file_id ? 'SYNCED' : 'NEEDS_SYNC'),
      status: data.status || 'aktif',
    };

    this.tableBankSoal.set(id, record);
    this.logActivity({
      user,
      action: 'UPLOAD',
      bank_soal_id: id,
      file_id: record.file_id,
      details: { judul: record.judul, nama_file: record.nama_file },
    });

    this.persistDatabase();
    return record;
  }

  public updateBankSoal(id: string, updates: Partial<BankSoal>, user: User): BankSoal | null {
    const existing = this.tableBankSoal.get(id);
    if (!existing) return null;

    if (user.role !== 'ADMIN' && existing.uploaded_by !== user.id) {
      throw new Error('Anda tidak memiliki hak akses untuk mengubah metadata bank soal ini.');
    }

    const updated: BankSoal = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
      file_id: updates.file_id || existing.file_id,
      updated_at: new Date().toISOString(),
    };

    this.tableBankSoal.set(id, updated);
    this.logActivity({
      user,
      action: 'EDIT',
      bank_soal_id: id,
      file_id: updated.file_id,
      details: updates,
    });

    this.persistDatabase();
    return updated;
  }

  public deleteBankSoal(id: string, user: User): boolean {
    const existing = this.tableBankSoal.get(id);
    if (!existing) return false;

    if (user.role !== 'ADMIN' && existing.uploaded_by !== user.id) {
      throw new Error('Hanya Administrator atau pemilik soal yang dapat menghapus bank soal ini.');
    }

    this.tableBankSoal.delete(id);

    // Remove from favorites
    this.tableFavorites.forEach((favs) => favs.delete(id));

    this.logActivity({
      user,
      action: 'DELETE',
      bank_soal_id: id,
      file_id: existing.file_id,
      details: { judul: existing.judul, file_id: existing.file_id },
    });

    this.persistDatabase();
    return true;
  }

  public addVersion(
    id: string,
    versionData: {
      file_id: string;
      folder_id: string;
      web_view_url: string;
      download_url: string;
      storage_path: string;
      nama_file: string;
      ukuran_file: number;
      jumlah_halaman: number;
      file_hash: string;
      catatan?: string;
    },
    user: User
  ): BankSoal | null {
    const existing = this.tableBankSoal.get(id);
    if (!existing) return null;

    const newVersionNum = (existing.version || 1) + 1;
    const versions = existing.versions || [];

    // Push previous version into version history
    versions.push({
      version_number: existing.version || 1,
      file_id: existing.file_id,
      folder_id: existing.folder_id,
      file_url: existing.file_url,
      web_view_url: existing.web_view_url,
      download_url: existing.download_url,
      storage_path: existing.storage_path,
      nama_file: existing.nama_file,
      ukuran_file: existing.ukuran_file,
      jumlah_halaman: existing.jumlah_halaman,
      file_hash: existing.file_hash,
      uploaded_at: existing.updated_at || existing.created_at,
      uploaded_by_name: existing.uploaded_by_name,
      uploaded_by_email: existing.uploaded_by_email,
      catatan: 'Versi terdahulu',
    });

    const updated: BankSoal = {
      ...existing,
      file_id: versionData.file_id,
      folder_id: versionData.folder_id,
      file_url: versionData.web_view_url,
      web_view_url: versionData.web_view_url,
      download_url: versionData.download_url,
      storage_path: versionData.storage_path,
      nama_file: versionData.nama_file,
      ukuran_file: versionData.ukuran_file,
      jumlah_halaman: versionData.jumlah_halaman,
      file_hash: versionData.file_hash,
      version: newVersionNum,
      versions,
      updated_at: new Date().toISOString(),
      sync_status: 'SYNCED',
    };

    this.tableBankSoal.set(id, updated);
    this.logActivity({
      user,
      action: 'VERSION_UPDATE',
      bank_soal_id: id,
      file_id: versionData.file_id,
      details: { version: newVersionNum, catatan: versionData.catatan },
    });

    this.persistDatabase();
    return updated;
  }

  public incrementView(id: string, user?: User) {
    const existing = this.tableBankSoal.get(id);
    if (existing) {
      existing.view_count = (existing.view_count || 0) + 1;
      if (user) {
        this.logHistory(user, existing, 'PREVIEW');
      }
      this.persistDatabase();
    }
  }

  public incrementDownload(id: string, user?: User): BankSoal | null {
    const existing = this.tableBankSoal.get(id);
    if (!existing) return null;

    existing.download_count = (existing.download_count || 0) + 1;
    if (user) {
      this.logActivity({
        user,
        action: 'DOWNLOAD',
        bank_soal_id: id,
        file_id: existing.file_id,
        details: { judul: existing.judul },
      });
      this.logHistory(user, existing, 'DOWNLOAD');
    }
    this.persistDatabase();
    return existing;
  }

  public toggleFavorite(userId: string, soalId: string): boolean {
    if (!this.tableFavorites.has(userId)) {
      this.tableFavorites.set(userId, new Set());
    }

    const set = this.tableFavorites.get(userId)!;
    let isFav = false;
    if (set.has(soalId)) {
      set.delete(soalId);
      isFav = false;
    } else {
      set.add(soalId);
      isFav = true;
    }

    const user = this.tableUsers.get(userId) || { id: userId, name: 'User', email: '', role: 'GURU' };
    const soal = this.tableBankSoal.get(soalId);
    if (soal) {
      this.logHistory(user, soal, 'FAVORITE');
    }

    this.persistDatabase();
    return isFav;
  }

  public checkDuplicates(hash?: string, title?: string, filename?: string) {
    const list = Array.from(this.tableBankSoal.values());
    if (hash) {
      const matchHash = list.find((item) => item.file_hash && item.file_hash === hash);
      if (matchHash) {
        return { isDuplicate: true, matchType: 'HASH', existingItem: matchHash };
      }
    }

    if (filename) {
      const cleanFn = filename.toLowerCase().trim();
      const matchFn = list.find((item) => item.nama_file.toLowerCase().trim() === cleanFn);
      if (matchFn) {
        return { isDuplicate: true, matchType: 'FILENAME', existingItem: matchFn };
      }
    }

    if (title) {
      const cleanT = title.toLowerCase().trim();
      const matchT = list.find((item) => item.judul.toLowerCase().trim() === cleanT);
      if (matchT) {
        return { isDuplicate: true, matchType: 'TITLE', existingItem: matchT };
      }
    }

    return { isDuplicate: false };
  }

  // --- STATS & AGGREGATIONS ---

  public getStats(): StatsOverview {
    const list = Array.from(this.tableBankSoal.values()).filter((i) => i.status !== 'arsip');
    let totalBytes = 0;
    let totalDownload = 0;
    let totalViews = 0;
    let syncedCount = 0;
    let needsSyncCount = 0;
    let missingCount = 0;

    const mapelMap: Record<string, number> = {};
    const jenjangMap: Record<string, number> = {};
    const kesulitanMap: Record<string, number> = {};
    const tahunMap: Record<string, number> = {};

    list.forEach((item) => {
      totalBytes += item.ukuran_file || 0;
      totalDownload += item.download_count || 0;
      totalViews += item.view_count || 0;

      if (item.sync_status === 'SYNCED') syncedCount++;
      else if (item.sync_status === 'NEEDS_SYNC') needsSyncCount++;
      else if (item.sync_status === 'MISSING') missingCount++;

      mapelMap[item.mata_pelajaran] = (mapelMap[item.mata_pelajaran] || 0) + 1;
      jenjangMap[item.jenjang] = (jenjangMap[item.jenjang] || 0) + 1;
      kesulitanMap[item.tingkat_kesulitan] = (kesulitanMap[item.tingkat_kesulitan] || 0) + 1;
      tahunMap[item.tahun] = (tahunMap[item.tahun] || 0) + 1;
    });

    const topDownloaded = [...list].sort((a, b) => (b.download_count || 0) - (a.download_count || 0)).slice(0, 5);
    const recentUploads = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

    return {
      total_soal: list.length,
      total_pdf: list.length,
      total_storage_bytes: totalBytes,
      soal_bulan_ini: list.filter((i) => {
        const d = new Date(i.created_at);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      soal_favorit: Array.from(this.tableFavorites.values()).reduce((sum, s) => sum + s.size, 0),
      total_mata_pelajaran: Object.keys(mapelMap).length,
      total_kelas: 12,
      total_download: totalDownload,
      total_views: totalViews,
      total_pengajar: this.tableUsers.size,
      synced_count: syncedCount,
      needs_sync_count: needsSyncCount,
      missing_count: missingCount,
      by_mapel: Object.entries(mapelMap).map(([name, count]) => ({ name, count })),
      by_jenjang: Object.entries(jenjangMap).map(([name, count]) => ({ name, count })),
      by_kesulitan: Object.entries(kesulitanMap).map(([level, count]) => ({ level, count })),
      by_tahun: Object.entries(tahunMap).map(([year, count]) => ({ year, count })),
      top_downloaded: topDownloaded,
      recent_uploads: recentUploads,
      storage_growth: [
        { month: 'Jan', bytes: Math.floor(totalBytes * 0.4), count: Math.floor(list.length * 0.4) },
        { month: 'Feb', bytes: Math.floor(totalBytes * 0.7), count: Math.floor(list.length * 0.7) },
        { month: 'Mar', bytes: totalBytes, count: list.length },
      ],
    };
  }

  // --- CATEGORIES ---

  public getCategories(): CategoryItem[] {
    const counts: Record<string, number> = {};
    this.tableBankSoal.forEach((item) => {
      if (item.status === 'arsip') return;
      counts[`mapel_${item.mata_pelajaran}`] = (counts[`mapel_${item.mata_pelajaran}`] || 0) + 1;
      counts[`jenjang_${item.jenjang}`] = (counts[`jenjang_${item.jenjang}`] || 0) + 1;
      counts[`jenis_${item.jenis_soal}`] = (counts[`jenis_${item.jenis_soal}`] || 0) + 1;
    });

    return Array.from(this.tableCategories.values()).map((c) => {
      let count = 0;
      if (c.type === 'mata_pelajaran') count = counts[`mapel_${c.name}`] || 0;
      else if (c.type === 'jenjang') count = counts[`jenjang_${c.name}`] || 0;
      else if (c.type === 'jenis_soal') count = counts[`jenis_${c.name}`] || 0;
      return { ...c, count };
    });
  }

  public addCategory(cat: Omit<CategoryItem, 'id'>): CategoryItem {
    const id = `cat-${Date.now()}`;
    const newCat: CategoryItem = { ...cat, id };
    this.tableCategories.set(id, newCat);
    this.persistDatabase();
    return newCat;
  }

  public updateCategory(id: string, updates: Partial<CategoryItem>): CategoryItem | null {
    const existing = this.tableCategories.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id };
    this.tableCategories.set(id, updated);
    this.persistDatabase();
    return updated;
  }

  public deleteCategory(id: string): boolean {
    const res = this.tableCategories.delete(id);
    this.persistDatabase();
    return res;
  }

  public getAllTags(): { tag: string; count: number }[] {
    const tagCount: Record<string, number> = {};
    this.tableBankSoal.forEach((item) => {
      if (item.status === 'arsip') return;
      (item.tags || []).forEach((t) => {
        const clean = t.trim();
        if (clean) tagCount[clean] = (tagCount[clean] || 0) + 1;
      });
    });

    return Object.entries(tagCount)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  // --- USERS ---

  public getUsers(): User[] {
    return Array.from(this.tableUsers.values());
  }

  public getUserById(id: string): User | null {
    return this.tableUsers.get(id) || null;
  }

  // --- AUDIT LOGS & HISTORY ---

  public logActivity(item: {
    user: User | { id?: string; name?: string; role?: string; email?: string };
    action: string;
    bank_soal_id?: string;
    file_id?: string;
    details?: any;
  }) {
    const log: AuditLogItem = {
      id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      user_id: item.user.id || 'u-anon',
      user_name: item.user.name || 'Pengguna',
      user_role: (item.user.role as any) || 'GURU',
      user_email: item.user.email || '',
      action: item.action,
      bank_soal_id: item.bank_soal_id,
      file_id: item.file_id,
      details: item.details,
    };
    this.tableAuditLogs.unshift(log);
    if (this.tableAuditLogs.length > 1000) this.tableAuditLogs.pop();
    this.persistDatabase();
  }

  public logHistory(user: User, soal: BankSoal, action: string) {
    const hist: UserHistoryItem = {
      id: `HIST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user_id: user.id,
      user_name: user.name,
      bank_soal_id: soal.id,
      bank_soal_judul: soal.judul,
      file_id: soal.file_id,
      action,
      timestamp: new Date().toISOString(),
    };
    this.tableHistory.unshift(hist);
    if (this.tableHistory.length > 1000) this.tableHistory.pop();
    this.persistDatabase();
  }

  public getAuditLogs(limit = 100): AuditLogItem[] {
    return this.tableAuditLogs.slice(0, limit);
  }

  public getUserHistory(userId: string, limit = 50): UserHistoryItem[] {
    return this.tableHistory.filter((h) => h.user_id === userId).slice(0, limit);
  }

  public getAllBankSoalRaw(): BankSoal[] {
    return Array.from(this.tableBankSoal.values());
  }
}
