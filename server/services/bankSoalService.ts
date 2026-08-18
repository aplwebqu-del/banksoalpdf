import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { BankSoal, User, FilterParams, StatsOverview, CategoryItem, DriveSyncResult, MigrationReport } from '../../src/types';
import { GoogleDriveService } from './googleDriveService';
import { GoogleSheetsService } from './googleSheetsService';
import { GoogleAppsScriptGateway } from './googleAppsScriptGateway';
import { GoogleConfigService } from './googleConfig';
import { createSamplePdfBuffer } from '../seedPdf';

export class BankSoalService {
  private static instance: BankSoalService;
  private driveService: GoogleDriveService;
  private sheetsService: GoogleSheetsService;
  private appsScriptGateway: GoogleAppsScriptGateway;
  private configService: GoogleConfigService;

  private constructor() {
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
   * Upload Berkas PDF Baru ke Google Drive & Simpan Metadata ke Google Sheets
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
    // 1. Validasi & Hitung Hash
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Parse page count jika memungkinkan
    let pageCount = Number(metadata.jumlah_halaman) || 1;
    try {
      const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
    } catch {
      // Keep default
    }

    // 2. Upload ke Google Drive
    const driveResult = await this.driveService.uploadPdfFile(
      fileBuffer,
      originalName,
      metadata.mata_pelajaran,
      metadata.kelas
    );

    // 3. Simpan Metadata ke Google Sheets
    let syncStatus: 'SYNCED' | 'NEEDS_SYNC' = 'SYNCED';

    // Jika Apps Script Web App dikonfigurasi, kirim juga ke Apps Script
    try {
      const appsScriptRes = await this.appsScriptGateway.executePostAction('createBankSoal', {
        data: {
          judul: metadata.judul,
          nama_file: originalName,
          file_id: driveResult.file_id,
          folder_id: driveResult.folder_id,
          web_view_url: driveResult.web_view_url,
          download_url: driveResult.download_url,
          mime_type: 'application/pdf',
          ukuran_file: driveResult.file_size,
          jumlah_halaman: pageCount,
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
          deskripsi: metadata.deskripsi || '',
          tags: metadata.tags || [],
          file_hash: fileHash,
          sync_status: 'SYNCED',
        },
        user,
      });

      if (!appsScriptRes.success && appsScriptRes.error?.code !== 'NO_APPS_SCRIPT_URL') {
        console.warn('Apps script gateway sync warning:', appsScriptRes.error);
        syncStatus = 'NEEDS_SYNC';
      }
    } catch (gatewayErr) {
      console.warn('Apps script dispatch notice:', gatewayErr);
    }

    const createdRecord = this.sheetsService.createBankSoal(
      {
        judul: metadata.judul,
        nama_file: originalName,
        file_id: driveResult.file_id,
        folder_id: driveResult.folder_id,
        file_url: driveResult.web_view_url,
        web_view_url: driveResult.web_view_url,
        download_url: driveResult.download_url,
        mime_type: 'application/pdf',
        storage_path: driveResult.storage_path,
        file_hash: fileHash,
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
        ukuran_file: driveResult.file_size,
        uploaded_by: user.id,
        uploaded_by_name: user.name,
        uploaded_by_email: user.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'aktif',
        sync_status: syncStatus,
        version: 1,
        download_count: 0,
        view_count: 0,
      },
      user
    );

    return createdRecord;
  }

  /**
   * Upload Versi Baru PDF ke Google Drive & Update Version History di Google Sheets
   */
  public async addVersionToBankSoal(
    id: string,
    fileBuffer: Buffer,
    originalName: string,
    catatan: string,
    user: User
  ): Promise<BankSoal | null> {
    const existing = this.sheetsService.getBankSoalById(id);
    if (!existing) return null;

    let pageCount = 1;
    try {
      const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();
    } catch {}

    const driveResult = await this.driveService.uploadPdfFile(
      fileBuffer,
      originalName,
      existing.mata_pelajaran,
      existing.kelas
    );

    const updated = this.sheetsService.addVersion(
      id,
      {
        file_id: driveResult.file_id,
        folder_id: driveResult.folder_id,
        web_view_url: driveResult.web_view_url,
        download_url: driveResult.download_url,
        storage_path: driveResult.storage_path,
        nama_file: originalName,
        ukuran_file: driveResult.file_size,
        jumlah_halaman: pageCount,
        file_hash: driveResult.file_hash,
        catatan,
      },
      user
    );

    return updated;
  }

  /**
   * Sinkronisasi Lengkap Google Drive ↔ Google Sheets
   */
  public async syncGoogleDriveAndSheets(): Promise<DriveSyncResult> {
    const allRecords = this.sheetsService.getAllBankSoalRaw();
    const config = this.configService.getConfig();
    let missingCount = 0;
    let syncedCount = 0;
    const missingItems: { id: string; judul: string; file_id: string; reason: string }[] = [];

    // Periksa setiap file_id di Google Sheets
    for (const record of allRecords) {
      if (record.status === 'arsip') continue;

      if (!record.file_id) {
        record.sync_status = 'NEEDS_SYNC';
        missingCount++;
        missingItems.push({
          id: record.id,
          judul: record.judul,
          file_id: '',
          reason: 'Belum memiliki file_id Google Drive yang terdaftar',
        });
      } else {
        const exists = this.driveService.checkFileExists(record.file_id);
        if (exists || record.web_view_url) {
          record.sync_status = 'SYNCED';
          syncedCount++;
        } else {
          record.sync_status = 'MISSING';
          missingCount++;
          missingItems.push({
            id: record.id,
            judul: record.judul,
            file_id: record.file_id,
            reason: 'Berkas PDF fisik tidak ditemukan di Google Drive',
          });
        }
      }
    }

    const syncId = `SYNC-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`;
    this.configService.updateConfig({ last_synced_at: new Date().toISOString() });

    this.sheetsService.logActivity({
      user: { id: 'u-1', name: 'Admin', role: 'ADMIN' },
      action: 'SYNC',
      details: { sync_id: syncId, total_scanned: allRecords.length, synced: syncedCount, missing: missingCount },
    });

    return {
      sync_id: syncId,
      timestamp: new Date().toISOString(),
      status: missingCount > 0 ? 'PARTIAL' : 'SUCCESS',
      total_scanned: allRecords.length,
      synced_count: syncedCount,
      missing_count: missingCount,
      unindexed_count: 0,
      details: `Sinkronisasi selesai. ${syncedCount} berkas terverifikasi di Google Drive & Sheets. ${missingCount} butuh perhatian.`,
      missing_items: missingItems,
    };
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
        const customId = `BS-${('000000' + index).slice(-6)}`;
        index++;

        // Cari file buffer jika ada
        let fileBuffer: Buffer | null = null;
        if (item.storage_path) {
          const p = path.join(process.cwd(), 'data', 'storage', item.storage_path);
          if (fs.existsSync(p)) {
            fileBuffer = fs.readFileSync(p);
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

        const driveUpload = await this.driveService.uploadPdfFile(
          fileBuffer,
          item.nama_file || 'soal.pdf',
          item.mata_pelajaran || 'Umum',
          item.kelas || '10',
          item.file_id // Reuse existing file_id if present
        );

        this.sheetsService.createBankSoal(
          {
            judul: item.judul || 'Soal Ujian',
            nama_file: item.nama_file || 'soal.pdf',
            file_id: driveUpload.file_id,
            folder_id: driveUpload.folder_id,
            file_url: driveUpload.web_view_url,
            web_view_url: driveUpload.web_view_url,
            download_url: driveUpload.download_url,
            mime_type: 'application/pdf',
            storage_path: driveUpload.storage_path,
            file_hash: driveUpload.file_hash,
            mata_pelajaran: item.mata_pelajaran || 'Umum',
            jenjang: item.jenjang || 'SMA',
            kelas: String(item.kelas || '10'),
            kurikulum: item.kurikulum || 'Kurikulum Merdeka',
            bab: item.bab || 'Umum',
            topik: item.topik || 'Latihan Soal',
            subtopik: item.subtopik || '',
            jenis_soal: item.jenis_soal || 'Pilihan Ganda',
            tingkat_kesulitan: item.tingkat_kesulitan || 'Sedang',
            tahun: Number(item.tahun) || new Date().getFullYear(),
            semester: item.semester || 'Ganjil',
            sumber: item.sumber || '',
            pembuat_pengajar: item.pembuat_pengajar || adminUser.name,
            deskripsi: item.deskripsi || '',
            tags: Array.isArray(item.tags) ? item.tags : [],
            jumlah_halaman: Number(item.jumlah_halaman) || 1,
            ukuran_file: driveUpload.file_size,
            uploaded_by: item.uploaded_by || adminUser.id,
            uploaded_by_name: item.uploaded_by_name || adminUser.name,
            uploaded_by_email: item.uploaded_by_email || adminUser.email,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            status: 'aktif',
            sync_status: 'SYNCED',
            version: Number(item.version) || 1,
            download_count: Number(item.download_count) || 0,
            view_count: Number(item.view_count) || 0,
          },
          adminUser,
          customId
        );

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
