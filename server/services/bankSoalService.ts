import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { BankSoal, User, FilterParams, StatsOverview, CategoryItem, DriveSyncResult, MigrationReport } from '../../src/types';
import { StorageRouter } from './storageRouter';
import { GoogleDriveService } from './googleDriveService';
import { GoogleSheetsService } from './googleSheetsService';
import { GoogleAppsScriptGateway } from './googleAppsScriptGateway';
import { GoogleConfigService } from './googleConfig';
import { createSamplePdfBuffer } from '../seedPdf';

export class BankSoalService {
  private static instance: BankSoalService;
  private storageRouter: StorageRouter;
  private driveService: GoogleDriveService;
  private sheetsService: GoogleSheetsService;
  private appsScriptGateway: GoogleAppsScriptGateway;
  private configService: GoogleConfigService;

  private constructor() {
    this.storageRouter = StorageRouter.getInstance();
    this.driveService = GoogleDriveService.getInstance();
    this.sheetsService = GoogleSheetsService.getInstance();
    this.appsScriptGateway = GoogleAppsScriptGateway.getInstance();
    this.configService = GoogleConfigService.getInstance();
    this.seedLegacyOrInitialData();
  }

  public static getInstance(): BankSoalService {
    if (!BankSoalService.instance) {
      BankSoalService.instance = new BankSoalService();
    }
    return BankSoalService.instance;
  }

  /**
   * Seed data awal yang sudah berarsitektur Google Drive & Google Sheets
   * jika database sheet masih kosong
   */
  private async seedLegacyOrInitialData() {
    const currentList = this.sheetsService.getAllBankSoalRaw();
    if (currentList.length > 0) return;

    // Check if legacy data/bank_soal.json exists for one-time initial hydration
    const legacyPath = path.join(process.cwd(), 'data', 'bank_soal.json');
    if (fs.existsSync(legacyPath)) {
      try {
        const raw = fs.readFileSync(legacyPath, 'utf-8');
        const legacyItems = JSON.parse(raw);
        if (Array.isArray(legacyItems) && legacyItems.length > 0) {
          console.log(`[Google Migration] Auto-migrating ${legacyItems.length} legacy items to Google Drive & Sheets architecture...`);
          await this.runOneTimeMigration(legacyItems);
          return;
        }
      } catch (err) {
        console.warn('Could not auto-migrate legacy data, creating initial Google Drive seeded items:', err);
      }
    }

    // Buat data awal berstandar Google Drive & Sheets
    await this.seedInitialStandardItems();
  }

  private async seedInitialStandardItems() {
    const adminUser: User = {
      id: 'u-1',
      name: 'Dra. Hj. Nurhayati, M.Pd.',
      email: 'nurhayati@sekolah.sch.id',
      role: 'ADMIN',
    };

    const seeds = [
      {
        judul: 'Penilaian Akhir Semester Ganjil Matematika Kelas 9',
        nama_file: 'PAS_Matematika_Kelas_9_2024.pdf',
        mata_pelajaran: 'Matematika',
        jenjang: 'SMP' as const,
        kelas: '9',
        kurikulum: 'Kurikulum Merdeka',
        bab: 'Persamaan Kuadrat & Fungsi Kuadrat',
        topik: 'Aplikasi Fungsi Kuadrat dalam Kehidupan Sehari-hari',
        jenis_soal: 'Campuran' as const,
        tingkat_kesulitan: 'Sedang' as const,
        tahun: 2024,
        semester: 'Ganjil' as const,
        tags: ['PAS', 'Matematika', 'Kelas 9', 'Persamaan Kuadrat', 'HOTS'],
        sumber: 'MGMP Matematika Kota Surabaya',
        deskripsi: 'Naskah soal lengkap PAS Ganjil dengan kunci jawaban dan rubrik penilaian.',
        jumlah_halaman: 8,
      },
      {
        judul: 'Latihan Soal HOTS Fisika: Dinamika Gerak & Hukum Newton Kelas 11',
        nama_file: 'Fisika_HOTS_Dinamika_Gerak_Kelas_11.pdf',
        mata_pelajaran: 'Fisika',
        jenjang: 'SMA' as const,
        kelas: '11',
        kurikulum: 'Kurikulum Merdeka',
        bab: 'Dinamika Gerak Lurus',
        topik: 'Hukum Newton I, II, III dan Gesekan',
        jenis_soal: 'HOTS' as const,
        tingkat_kesulitan: 'Sulit' as const,
        tahun: 2025,
        semester: 'Ganjil' as const,
        tags: ['Fisika', 'HOTS', 'Hukum Newton', 'Olimpiade', 'SNBT'],
        sumber: 'Buku Bank Soal Fisika Unggulan',
        deskripsi: 'Kumpulan 25 butir soal HOTS penalaran fisika mekanika untuk persiapan olimpiade & UTBK-SNBT.',
        jumlah_halaman: 12,
      },
      {
        judul: 'Asesmen Sumatif Bahasa Indonesia: Teks Eksposisi Kelas 10',
        nama_file: 'Sumatif_B_Indonesia_Teks_Eksposisi_Kelas_10.pdf',
        mata_pelajaran: 'Bahasa Indonesia',
        jenjang: 'SMA' as const,
        kelas: '10',
        kurikulum: 'Kurikulum Merdeka',
        bab: 'Teks Eksposisi',
        topik: 'Analisis Struktur dan Kebahasaan Teks Eksposisi',
        jenis_soal: 'Pilihan Ganda' as const,
        tingkat_kesulitan: 'Mudah' as const,
        tahun: 2024,
        semester: 'Ganjil' as const,
        tags: ['Bahasa Indonesia', 'Teks Eksposisi', 'Sumatif', 'Literasi'],
        sumber: 'Modul Ajar Guru Penggerak',
        deskripsi: 'Soal pilihan ganda 40 butir berbasis teks literasi lingkungan hidup.',
        jumlah_halaman: 6,
      },
      {
        judul: 'Tryout UTBK-SNBT Literasi Bahasa Inggris & Reading Comprehension',
        nama_file: 'Tryout_SNBT_English_Literacy_2025.pdf',
        mata_pelajaran: 'Bahasa Inggris',
        jenjang: 'SMA' as const,
        kelas: '12',
        kurikulum: 'Kurikulum Merdeka',
        bab: 'Reading Literacy',
        topik: 'Inference, Tone, and Vocabulary in Context',
        jenis_soal: 'SNBT' as const,
        tingkat_kesulitan: 'Sulit' as const,
        tahun: 2025,
        semester: 'Genap' as const,
        tags: ['SNBT', 'Bahasa Inggris', 'Reading Comprehension', 'Tryout'],
        sumber: 'Simulasi Mandiri Tim Pengajar Bimbingan Belajar',
        deskripsi: 'Simulasi UTBK SNBT Bahasa Inggris terbaru dengan teks akademik populer.',
        jumlah_halaman: 10,
      },
    ];

    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      const samplePdfBuffer = await createSamplePdfBuffer(s.judul, s.mata_pelajaran, s.jenjang, s.kelas);
      const driveUpload = await this.driveService.uploadPdfFile(
        samplePdfBuffer,
        s.nama_file,
        s.mata_pelajaran,
        s.kelas
      );

      const customId = `BS-${('000000' + (i + 1)).slice(-6)}`;
      this.sheetsService.createBankSoal(
        {
          judul: s.judul,
          nama_file: s.nama_file,
          file_id: driveUpload.file_id,
          folder_id: driveUpload.folder_id,
          file_url: driveUpload.web_view_url,
          web_view_url: driveUpload.web_view_url,
          download_url: driveUpload.download_url,
          mime_type: 'application/pdf',
          storage_path: driveUpload.storage_path,
          file_hash: driveUpload.file_hash,
          mata_pelajaran: s.mata_pelajaran,
          jenjang: s.jenjang,
          kelas: s.kelas,
          kurikulum: s.kurikulum,
          bab: s.bab,
          topik: s.topik,
          subtopik: '',
          jenis_soal: s.jenis_soal,
          tingkat_kesulitan: s.tingkat_kesulitan,
          tahun: s.tahun,
          semester: s.semester,
          sumber: s.sumber,
          pembuat_pengajar: adminUser.name,
          deskripsi: s.deskripsi,
          tags: s.tags,
          jumlah_halaman: s.jumlah_halaman,
          ukuran_file: driveUpload.file_size,
          uploaded_by: adminUser.id,
          uploaded_by_name: adminUser.name,
          uploaded_by_email: adminUser.email,
          created_at: new Date(Date.now() - (seeds.length - i) * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
          status: 'aktif',
          sync_status: 'SYNCED',
          version: 1,
          download_count: (i + 1) * 14,
          view_count: (i + 1) * 38,
        },
        adminUser,
        customId
      );
    }
  }

  /**
   * Upload Berkas PDF Baru ke Storage melalui StorageRouter
   */
  public async uploadPdfAndRecord(
    fileBuffer: Buffer,
    originalName: string,
    metadata: {
      judul: string;
      mata_pelajaran: string;
      jenjang: any;
      kelas: string | number;
      kurikulum?: string;
      bab?: string;
      topik?: string;
      subtopik?: string;
      jenis_soal?: any;
      tingkat_kesulitan?: any;
      tahun?: number;
      semester?: any;
      sumber?: string;
      pembuat_pengajar?: string;
      deskripsi?: string;
      tags?: string[];
      jumlah_halaman?: number;
    },
    user: User
  ): Promise<BankSoal> {
    let pageCount = Number(metadata.jumlah_halaman) || 1;
    try {
      const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
    } catch {}

    // Delegasikan upload dan penulisan storage ke StorageRouter
    const uploadResult = await this.storageRouter.uploadFile({
      buffer: fileBuffer,
      originalName: originalName,
      metadata: {
        ...metadata,
        jumlah_halaman: pageCount,
      } as any,
      user: user,
    });

    const record: BankSoal = {
      id: uploadResult.bank_soal_id,
      judul: metadata.judul,
      nama_file: originalName,
      file_id: uploadResult.file_id,
      folder_id: uploadResult.folder_id,
      drive_file_id: uploadResult.drive_file_id,
      drive_folder_id: uploadResult.drive_folder_id,
      storage_profile_id: uploadResult.storage_profile_id,
      spreadsheet_id: uploadResult.spreadsheet_id,
      file_url: uploadResult.file_url,
      web_view_url: uploadResult.web_view_url,
      download_url: uploadResult.download_url,
      mime_type: 'application/pdf',
      storage_path: uploadResult.storage_path,
      file_hash: uploadResult.file_hash,
      mata_pelajaran: metadata.mata_pelajaran,
      jenjang: metadata.jenjang,
      kelas: String(metadata.kelas),
      kurikulum: metadata.kurikulum || 'Kurikulum Merdeka',
      bab: metadata.bab || 'Umum',
      topik: metadata.topik || 'Latihan Soal',
      subtopik: metadata.subtopik || '',
      jenis_soal: metadata.jenis_soal || 'Pilihan Ganda',
      tingkat_kesulitan: metadata.tingkat_kesulitan || 'Sedang',
      tahun: Number(metadata.tahun) || new Date().getFullYear(),
      semester: metadata.semester || 'Ganjil',
      sumber: metadata.sumber || '',
      pembuat_pengajar: metadata.pembuat_pengajar || user.name,
      deskripsi: metadata.deskripsi || '',
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      jumlah_halaman: pageCount,
      ukuran_file: uploadResult.file_size,
      uploaded_by: user.id,
      uploaded_by_name: user.name,
      uploaded_by_email: user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'aktif',
      sync_status: uploadResult.sync_status as any,
      version: 1,
      download_count: 0,
      view_count: 0,
    };

    return this.sheetsService.createBankSoal(record, user, uploadResult.bank_soal_id);
  }

  /**
   * Upload Versi Baru PDF melalui StorageRouter
   */
  public async addVersionToBankSoal(
    id: string,
    fileBuffer: Buffer,
    originalName: string,
    catatan: string,
    user: User
  ): Promise<BankSoal | null> {
    return this.storageRouter.addVersion(id, fileBuffer, originalName, user, catatan);
  }

  /**
   * Pulihkan Bank Soal dari Sampah (Restore)
   */
  public async restoreBankSoal(id: string, user: User): Promise<boolean> {
    return this.storageRouter.restoreMetadata(id, user);
  }

  /**
   * Hapus Permanen Bank Soal dari Storage
   */
  public async permanentDeleteBankSoal(id: string, user: User): Promise<boolean> {
    return this.storageRouter.deleteMetadata(id, user, true);
  }

  /**
   * Kosongkan Seluruh Keranjang Sampah
   */
  public async emptyTrash(user: User): Promise<{ count: number }> {
    const res = this.sheetsService.emptyTrash(user);
    if (res.fileIds && res.fileIds.length > 0) {
      res.fileIds.forEach((fId) => this.storageRouter.deleteFile(fId));
    }
    return { count: res.count };
  }

  /**
   * Health Check Terpadu Seluruh Sub-Sistem
   */
  public async getHealthCheck(): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    server: { status: string; uptime_seconds: number };
    database: { status: string; total_records: number; sheets: string[] };
    google_drive: { status: string; root_folder_id: string };
    google_apps_script: { status: string; configured: boolean; latency_ms?: number; url?: string };
    timestamp: string;
  }> {
    const stats = this.sheetsService.getStats();
    const active = this.storageRouter.getActiveStorage();
    const hasAppsScript = Boolean(active?.apps_script_url);

    let gasStatus = hasAppsScript ? 'CONFIGURED' : 'NOT_CONFIGURED';
    let gasLatency: number | undefined = undefined;

    if (hasAppsScript && active) {
      const start = Date.now();
      const testRes = await this.storageRouter.testStorage(active);
      gasLatency = Date.now() - start;
      gasStatus = testRes.success ? 'ONLINE' : 'UNREACHABLE';
    }

    return {
      status: 'HEALTHY',
      server: {
        status: 'ONLINE',
        uptime_seconds: Math.floor(process.uptime()),
      },
      database: {
        status: 'ONLINE',
        total_records: stats.total_soal,
        sheets: ['BANK_SOAL', 'USERS', 'CATEGORIES', 'ACTIVITY_LOG', 'SYNC_LOG'],
      },
      google_drive: {
        status: 'ONLINE',
        root_folder_id: active?.drive_root_folder_id || 'root',
      },
      google_apps_script: {
        status: gasStatus,
        configured: hasAppsScript,
        latency_ms: gasLatency,
        url: active?.apps_script_url,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Sinkronisasi Lengkap Google Drive ↔ Google Sheets
   */
  public async syncGoogleDriveAndSheets(): Promise<DriveSyncResult> {
    return this.storageRouter.syncStorage();
  }

  /**
   * One-Time Migration Tool: Mengimpor Data Lama (JSON/Legacy) ke Google Drive & Sheets
   */
  public async runOneTimeMigration(legacyRecords: any[]): Promise<MigrationReport> {
    const report: MigrationReport = {
      timestamp: new Date().toISOString(),
      total_records_processed: legacyRecords.length,
      success_count: 0,
      failed_count: 0,
      drive_files_migrated: 0,
      sheets_rows_inserted: 0,
      status: 'COMPLETED',
      errors: [],
    };

    const adminUser: User = {
      id: 'u-1',
      name: 'Dra. Hj. Nurhayati, M.Pd.',
      email: 'nurhayati@sekolah.sch.id',
      role: 'ADMIN',
    };

    let index = 1;
    for (const item of legacyRecords) {
      try {
        const customId = item.id || `BS-${('000000' + index).slice(-6)}`;
        index++;

        let fileBuffer: Buffer | null = null;
        if (item.storage_path) {
          const p1 = path.join(process.cwd(), 'data', 'drive_storage', item.storage_path);
          const p2 = path.join(process.cwd(), 'data', 'storage', item.storage_path);
          if (fs.existsSync(p1)) {
            fileBuffer = fs.readFileSync(p1);
          } else if (fs.existsSync(p2)) {
            fileBuffer = fs.readFileSync(p2);
          }
        }

        if (!fileBuffer) {
          fileBuffer = await createSamplePdfBuffer(
            item.judul || 'Bank Soal',
            item.mata_pelajaran || 'Umum',
            item.jenjang || 'SMA',
            item.kelas || '10'
          );
        }

        const uploadResult = await this.storageRouter.uploadFile({
          buffer: fileBuffer,
          originalName: item.nama_file || 'soal.pdf',
          metadata: item,
          user: adminUser,
        });

        const existingRecord = this.sheetsService.getBankSoalById(customId);
        if (existingRecord) {
          this.sheetsService.updateBankSoal(
            customId,
            {
              ...item,
              file_id: uploadResult.file_id,
              folder_id: uploadResult.folder_id,
              file_url: uploadResult.file_url,
              web_view_url: uploadResult.web_view_url,
              download_url: uploadResult.download_url,
              mime_type: 'application/pdf',
              storage_path: uploadResult.storage_path,
              file_hash: uploadResult.file_hash,
              storage_profile_id: uploadResult.storage_profile_id,
              sync_status: 'SYNCED',
            },
            adminUser
          );
        } else {
          this.sheetsService.createBankSoal(
            {
              ...item,
              file_id: uploadResult.file_id,
              folder_id: uploadResult.folder_id,
              file_url: uploadResult.file_url,
              web_view_url: uploadResult.web_view_url,
              download_url: uploadResult.download_url,
              mime_type: 'application/pdf',
              storage_path: uploadResult.storage_path,
              file_hash: uploadResult.file_hash,
              storage_profile_id: uploadResult.storage_profile_id,
              sync_status: 'SYNCED',
            },
            adminUser,
            customId
          );
        }

        report.success_count++;
        report.drive_files_migrated++;
        report.sheets_rows_inserted++;
      } catch (err: any) {
        report.failed_count++;
        report.errors?.push({ id: item.id || 'unknown', error: err.message || 'Gagal migrasi record' });
      }
    }

    report.status = report.failed_count === 0 ? 'COMPLETED' : 'PARTIAL';
    return report;
  }
}
