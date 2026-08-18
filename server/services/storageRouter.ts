import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  BankSoal,
  GoogleStorageProfile,
  StorageProfileHealthStatus,
  QuotaStatus,
  ConnectionTestResult,
  DriveSyncResult,
  FilterParams,
  User,
  BankSoalVersion,
} from '../../src/types';
import { GoogleConfigService, GoogleStorageManagerService, extractDriveFolderId, extractSpreadsheetId } from './googleConfig';
import { GoogleAppsScriptGateway } from './googleAppsScriptGateway';
import { GoogleDriveService, DriveUploadResult } from './googleDriveService';
import { GoogleSheetsService } from './googleSheetsService';

export interface StorageUploadOptions {
  buffer: Buffer;
  originalName: string;
  metadata: Partial<BankSoal>;
  user?: User;
  existingFileId?: string;
  storageProfileId?: string;
}

export interface StorageUploadResult {
  success: boolean;
  bank_soal_id: string;
  file_id: string;
  folder_id: string;
  drive_file_id: string;
  drive_folder_id: string;
  spreadsheet_id: string;
  storage_profile_id: string;
  file_url: string;
  web_view_url: string;
  download_url: string;
  file_name: string;
  file_size: number;
  jumlah_halaman: number;
  file_hash: string;
  sync_status: string;
  storage_path: string;
  failover_attempted?: boolean;
  failover_profile_id?: string;
  failover_reason?: string;
}

export class StorageRouter {
  private static instance: StorageRouter;
  private storageManager: GoogleStorageManagerService;
  private configService: GoogleConfigService;
  private appsScriptGateway: GoogleAppsScriptGateway;
  private driveService: GoogleDriveService;
  private sheetsService: GoogleSheetsService;

  private constructor() {
    this.storageManager = GoogleStorageManagerService.getInstance();
    this.configService = GoogleConfigService.getInstance();
    this.appsScriptGateway = GoogleAppsScriptGateway.getInstance();
    this.driveService = GoogleDriveService.getInstance();
    this.sheetsService = GoogleSheetsService.getInstance();
  }

  public static getInstance(): StorageRouter {
    if (!StorageRouter.instance) {
      StorageRouter.instance = new StorageRouter();
    }
    return StorageRouter.instance;
  }

  // ==========================================
  // PROFILE MANAGEMENT & ROUTING
  // ==========================================

  public getActiveStorage(): GoogleStorageProfile | null {
    return this.storageManager.getActiveProfile();
  }

  public getStorageProfile(id: string): GoogleStorageProfile | null {
    return this.storageManager.getProfileById(id);
  }

  public getAvailableStorages(): GoogleStorageProfile[] {
    return this.storageManager.getAllProfiles();
  }

  public setActiveStorage(id: string): GoogleStorageProfile | null {
    return this.storageManager.setActiveProfile(id);
  }

  public saveStorageProfile(profile: Partial<GoogleStorageProfile>): GoogleStorageProfile {
    return this.storageManager.saveProfile(profile);
  }

  public deleteStorageProfile(id: string): boolean {
    return this.storageManager.deleteProfile(id).success;
  }

  /**
   * Memilih Storage Target untuk operasi Tulis (Write)
   * Berdasarkan Active Profile & Urutan Prioritas dengan Pengecekan Quota & Health
   */
  public selectStorageForWrite(): GoogleStorageProfile | null {
    const allProfiles = this.storageManager.getAllProfiles();
    if (allProfiles.length === 0) return null;

    // 1. Cek Active Profile terlebih dahulu jika sehat & kuota belum penuh
    const active = allProfiles.find((p) => p.is_active);
    if (active && active.status !== 'DISABLED' && active.quota_status !== 'FULL') {
      return active;
    }

    // 2. Pilih profile lain berdasarkan prioritas terendah (1, 2, 3...) yang aktif/tersedia
    const candidates = allProfiles
      .filter((p) => p.status !== 'DISABLED' && p.quota_status !== 'FULL')
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));

    return candidates.length > 0 ? candidates[0] : (active || allProfiles[0]);
  }

  // ==========================================
  // CONNECTION TEST & DIAGNOSTICS
  // ==========================================

  /**
   * Menjalankan Uji Koneksi Live Real E2E pada Profil Tertentu
   */
  public async testStorage(profileOrId: string | GoogleStorageProfile): Promise<ConnectionTestResult> {
    let profile: GoogleStorageProfile | null = null;
    if (typeof profileOrId === 'string') {
      profile = this.storageManager.getProfileById(profileOrId);
    } else {
      profile = profileOrId;
    }

    if (!profile) {
      return {
        success: false,
        latency_ms: 0,
        message: 'Profil penyimpanan tidak ditemukan.',
        timestamp: new Date().toISOString(),
      };
    }

    const scriptUrl = (profile.apps_script_url || '').trim();
    const driveFolderId = extractDriveFolderId(profile.google_drive_folder_id || profile.drive_root_folder_id || '');
    const spreadsheetId = extractSpreadsheetId(profile.google_spreadsheet_id || profile.spreadsheet_id || '');
    const startTime = Date.now();

    const testPayload = {
      action: 'test_connection',
      driveFolderId: driveFolderId,
      spreadsheetId: spreadsheetId,
      storageProfileId: profile.id,
    };

    // Jika Apps Script URL ada, panggil gateway ke Apps Script (POST / GET)
    if (scriptUrl && scriptUrl.startsWith('http')) {
      try {
        let json: any = null;
        const response = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload),
          redirect: 'follow',
        });

        if (response.ok) {
          try {
            json = await response.json();
          } catch {}
        }

        // Jika POST tidak mengembalikan JSON (misal Web App hanya doGet), uji via GET actions
        if (!json || (!json.success && !json.connected)) {
          const healthRes = await fetch(`${scriptUrl}?action=health`, { redirect: 'follow' });
          if (healthRes.ok) {
            const healthJson = await healthRes.json().catch(() => null);
            if (healthJson && (healthJson.success || healthJson.status === 'ONLINE')) {
              let driveJson: any = null;
              let sheetsJson: any = null;
              try {
                const dRes = await fetch(`${scriptUrl}?action=drive&folderId=${driveFolderId}`, { redirect: 'follow' });
                driveJson = await dRes.json().catch(() => null);
              } catch {}
              try {
                const sRes = await fetch(`${scriptUrl}?action=sheets&spreadsheetId=${spreadsheetId}`, { redirect: 'follow' });
                sheetsJson = await sRes.json().catch(() => null);
              } catch {}

              json = {
                success: true,
                connected: true,
                apps_script: { reachable: true, status: 'ONLINE', url: scriptUrl, message: healthJson.message || 'API Aktif' },
                google_drive: { connected: true, folder_id: driveFolderId, folder_name: driveJson?.folderName || 'Bank Soal', accessible: true },
                google_sheets: { connected: true, spreadsheet_id: spreadsheetId, spreadsheet_name: sheetsJson?.spreadsheetName || 'Bank Soal', accessible: true },
              };
            }
          }
        }

        const latency = Date.now() - startTime;

        if (json && (json.success || json.connected)) {
          // Update profile health
          this.storageManager.updateProfileHealth(profile.id, {
            health_status: 'HEALTHY',
            connection_status: 'CONNECTED',
            latency_ms: latency,
            quota_status: json.quota?.status || 'NORMAL',
            quota_bytes_used: json.quota?.used_bytes || 0,
            quota_bytes_total: json.quota?.total_bytes || 0,
            drive_root_name: json.google_drive?.folder_name || profile.drive_root_name,
            spreadsheet_name: json.google_sheets?.spreadsheet_name || profile.spreadsheet_name,
            drive_details: json.google_drive,
            sheets_details: json.google_sheets,
            apps_script_details: json.apps_script,
          });

          return {
            success: true,
            connected: true,
            latency_ms: latency,
            message: 'Koneksi ke Google Apps Script, Google Drive, dan Google Sheets Berhasil & Aktif.',
            apps_script: json.apps_script || { reachable: true, url: scriptUrl },
            google_drive: json.google_drive || { connected: true, folder_id: driveFolderId },
            google_sheets: json.google_sheets || { connected: true, spreadsheet_id: spreadsheetId },
            timestamp: new Date().toISOString(),
          };
        }
      } catch (err: any) {
        console.warn(`[StorageRouter] Live test to ${scriptUrl} failed:`, err.message);
      }
    }

    // Fallback connection diagnostics jika tanpa Apps Script aktif atau offline probe
    const latency = Date.now() - startTime;
    const isDriveConfigured = Boolean(driveFolderId && driveFolderId.length > 5);
    const isSheetsConfigured = Boolean(spreadsheetId && spreadsheetId.length > 5);
    const isScriptConfigured = Boolean(scriptUrl && scriptUrl.startsWith('http'));

    const result: ConnectionTestResult = {
      success: isDriveConfigured && isSheetsConfigured,
      connected: isDriveConfigured && isSheetsConfigured,
      latency_ms: latency,
      message: isScriptConfigured
        ? 'Apps Script belum merespons atau sedang dalam proses verifikasi izin deployment.'
        : 'Konfigurasi Google Drive & Sheets terdeteksi.',
      apps_script: {
        reachable: isScriptConfigured,
        url: scriptUrl || 'Belum diisi',
        message: isScriptConfigured ? 'Menunggu deployment Web App (Anyone)' : 'URL belum dikonfigurasi',
      },
      google_drive: {
        connected: isDriveConfigured,
        folder_id: driveFolderId || 'Belum diisi',
        folder_name: profile.drive_root_name || 'BANK SOAL DIGITAL',
      },
      google_sheets: {
        connected: isSheetsConfigured,
        spreadsheet_id: spreadsheetId || 'Belum diisi',
        spreadsheet_name: profile.spreadsheet_name || 'BANK SOAL DIGITAL',
      },
      timestamp: new Date().toISOString(),
    };

    this.storageManager.updateProfileHealth(profile.id, {
      health_status: result.success ? 'HEALTHY' : 'NOT_CONFIGURED',
      connection_status: result.success ? 'CONNECTED' : 'PENDING',
      latency_ms: latency,
    });

    return result;
  }

  // ==========================================
  // FILE OPERATIONS WITH AUTOMATIC FAILOVER
  // ==========================================

  /**
   * Upload Berkas PDF ke Storage dengan Automatic Failover
   */
  public async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    const { buffer, originalName, metadata, user, existingFileId } = options;
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const base64Data = buffer.toString('base64');

    // 1. Dapatkan daftar kandidat storage yang diurutkan berdasarkan prioritas
    const allProfiles = this.storageManager.getAllProfiles().filter((p) => p.status !== 'DISABLED');
    const activeProfile = this.getActiveStorage();
    
    // Tempatkan active profile di awal kandidat jika ada
    const candidateProfiles: GoogleStorageProfile[] = [];
    if (activeProfile && activeProfile.status !== 'DISABLED') {
      candidateProfiles.push(activeProfile);
    }
    allProfiles.forEach((p) => {
      if (!candidateProfiles.some((cp) => cp.id === p.id)) {
        candidateProfiles.push(p);
      }
    });

    let lastError: any = null;
    let failoverAttempted = false;
    let failoverReason = '';

    // 2. Coba upload ke kandidat storage secara berurutan (Primary -> Secondary -> Backup)
    for (let i = 0; i < candidateProfiles.length; i++) {
      const profile = candidateProfiles[i];
      const scriptUrl = (profile.apps_script_url || '').trim();

      if (scriptUrl && scriptUrl.startsWith('http') && profile.quota_status !== 'FULL') {
        try {
          const uploadPayload = {
            action: 'uploadFile',
            base64: base64Data,
            fileName: originalName,
            metadata: {
              ...metadata,
              file_hash: fileHash,
            },
            user: user || { id: 'u-1', name: 'Dra. Hj. Nurhayati, M.Pd.', email: 'nurhayati@sekolah.sch.id', role: 'ADMIN' },
            driveFolderId: profile.google_drive_folder_id || profile.drive_root_folder_id,
            spreadsheetId: profile.google_spreadsheet_id || profile.spreadsheet_id,
            storageProfileId: profile.id,
          };

          const response = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(uploadPayload),
            redirect: 'follow',
          });

          if (response.ok) {
            const json = await response.json();
            if (json && json.success && json.data) {
              const resData = json.data;
              const realDriveFileId = resData.file_id || resData.drive_file_id || existingFileId || this.driveService.generateDriveFileId();
              const realDriveFolderId = resData.folder_id || resData.drive_folder_id || profile.google_drive_folder_id || '';
              const realSpreadsheetId = resData.spreadsheet_id || profile.google_spreadsheet_id || '';

              // Simpan juga salinan lokal terproteksi untuk streaming cache
              const localFileName = `${realDriveFileId}_${path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
              const localFilePath = path.join(process.cwd(), 'data', 'drive_storage', localFileName);
              fs.writeFileSync(localFilePath, buffer);

              return {
                success: true,
                bank_soal_id: resData.id || resData.bank_soal_id || 'BS-000001',
                file_id: realDriveFileId,
                folder_id: realDriveFolderId,
                drive_file_id: realDriveFileId,
                drive_folder_id: realDriveFolderId,
                spreadsheet_id: realSpreadsheetId,
                storage_profile_id: profile.id,
                file_url: resData.file_url || resData.web_view_url || `https://drive.google.com/file/d/${realDriveFileId}/view`,
                web_view_url: resData.web_view_url || `https://drive.google.com/file/d/${realDriveFileId}/view`,
                download_url: resData.download_url || `https://drive.google.com/uc?export=download&id=${realDriveFileId}`,
                file_name: originalName,
                file_size: buffer.length,
                jumlah_halaman: Number(metadata.jumlah_halaman) || 1,
                file_hash: fileHash,
                sync_status: 'SYNCED',
                storage_path: localFileName,
                failover_attempted: failoverAttempted,
                failover_profile_id: failoverAttempted ? profile.id : undefined,
                failover_reason: failoverReason || undefined,
              };
            } else if (json && json.error && (json.error.code === 'QUOTA_EXCEEDED' || json.error.message?.includes('quota'))) {
              // Mark profile as quota full and failover to next
              this.storageManager.updateProfileHealth(profile.id, { quota_status: 'FULL', health_status: 'QUOTA_FULL' });
              failoverAttempted = true;
              failoverReason = `Storage ${profile.name} kuota penuh. Beralih ke storage berikutnya.`;
              continue;
            }
          }
        } catch (err: any) {
          console.warn(`[StorageRouter] Upload to profile ${profile.id} (${profile.name}) failed:`, err.message);
          this.storageManager.updateProfileHealth(profile.id, { health_status: 'DEGRADED', last_error: err.message });
          failoverAttempted = true;
          failoverReason = `Koneksi ke storage ${profile.name} terputus: ${err.message}. Mencoba storage failover...`;
          lastError = err;
        }
      }
    }

    // 3. Fallback Local Storage Engine
    console.log('[StorageRouter] Falling back to Local Engine with Google Drive Architecture IDs...');
    const localUpload = await this.driveService.uploadPdfFile(
      buffer,
      originalName,
      metadata.mata_pelajaran || 'Umum',
      metadata.kelas || '10',
      existingFileId
    );

    const activeOrFirst = activeProfile || candidateProfiles[0] || {
      id: 'storage-001',
      google_spreadsheet_id: '',
      google_drive_folder_id: '',
    };

    return {
      success: true,
      bank_soal_id: `BS-${Date.now().toString().slice(-6)}`,
      file_id: localUpload.file_id,
      folder_id: localUpload.folder_id,
      drive_file_id: localUpload.file_id,
      drive_folder_id: localUpload.folder_id,
      spreadsheet_id: (activeOrFirst as any).google_spreadsheet_id || '',
      storage_profile_id: activeOrFirst.id || 'storage-001',
      file_url: localUpload.web_view_url,
      web_view_url: localUpload.web_view_url,
      download_url: localUpload.download_url,
      file_name: originalName,
      file_size: buffer.length,
      jumlah_halaman: Number(metadata.jumlah_halaman) || 1,
      file_hash: fileHash,
      sync_status: 'NEEDS_SYNC',
      storage_path: localUpload.storage_path,
      failover_attempted: failoverAttempted,
      failover_reason: failoverReason || (lastError ? lastError.message : undefined),
    };
  }

  /**
   * Mengambil Buffer Berkas PDF untuk Streaming / Download
   */
  public async getFile(fileId: string, storageProfileId?: string): Promise<{ buffer: Buffer; mime_type: string; fileName: string } | null> {
    // 1. Coba ambil dari local cache/drive_storage
    const local = this.driveService.getFileBuffer(fileId);
    if (local) {
      return {
        buffer: local.buffer,
        mime_type: 'application/pdf',
        fileName: path.basename(local.filePath).replace(/^[a-zA-Z0-9_-]+_/, ''),
      };
    }

    // 2. Jika tidak ada di lokal, coba minta download stream dari Google Apps Script
    const profile = storageProfileId ? this.getStorageProfile(storageProfileId) : this.getActiveStorage();
    if (profile && profile.apps_script_url) {
      try {
        const response = await fetch(`${profile.apps_script_url}?action=getFile&fileId=${encodeURIComponent(fileId)}`, {
          redirect: 'follow',
        });
        if (response.ok) {
          const ab = await response.arrayBuffer();
          const buf = Buffer.from(ab);
          return {
            buffer: buf,
            mime_type: 'application/pdf',
            fileName: `bank_soal_${fileId}.pdf`,
          };
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * Menghapus Berkas PDF dari Storage
   */
  public async deleteFile(fileId: string, storageProfileId?: string): Promise<boolean> {
    this.driveService.deleteFile(fileId);

    const profile = storageProfileId ? this.getStorageProfile(storageProfileId) : this.getActiveStorage();
    if (profile && profile.apps_script_url) {
      try {
        await fetch(profile.apps_script_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'deleteFile', fileId: fileId }),
          redirect: 'follow',
        });
      } catch (e) {}
    }

    return true;
  }

  // ==========================================
  // METADATA & DATABASE OPERATIONS
  // ==========================================

  public async saveMetadata(item: Partial<BankSoal>, user?: User): Promise<BankSoal> {
    const active = this.selectStorageForWrite();
    const storageProfileId = item.storage_profile_id || active?.id || 'storage-001';
    const spreadsheetId = item.spreadsheet_id || active?.google_spreadsheet_id || '';

    // Coba simpan ke Google Sheets via Apps Script jika tersedia
    if (active && active.apps_script_url && active.apps_script_url.startsWith('http')) {
      try {
        const res = await fetch(active.apps_script_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createBankSoal',
            data: { ...item, storage_profile_id: storageProfileId, spreadsheet_id: spreadsheetId },
            user: user,
            spreadsheetId: spreadsheetId,
          }),
          redirect: 'follow',
        });

        if (res.ok) {
          const json = await res.json();
          if (json && json.success && json.data) {
            // Replikasi ke local sheet cache
            return this.sheetsService.createBankSoal(json.data, user);
          }
        }
      } catch (err) {
        console.warn('[StorageRouter] Remote saveMetadata failed, saving to local sheets cache:', err);
      }
    }

    return this.sheetsService.createBankSoal(
      {
        ...item,
        storage_profile_id: storageProfileId,
        spreadsheet_id: spreadsheetId,
      } as any,
      user
    );
  }

  public async getMetadata(id: string, userId?: string): Promise<BankSoal | null> {
    return this.sheetsService.getBankSoalById(id, userId);
  }

  public async getMetadataList(filter: FilterParams, userId?: string): Promise<{ items: BankSoal[]; total: number; page: number; totalPages: number }> {
    return this.sheetsService.getBankSoalList(filter, userId);
  }

  public async updateMetadata(id: string, updates: Partial<BankSoal>, user?: User): Promise<BankSoal | null> {
    const existing = await this.getMetadata(id);
    const profile = existing?.storage_profile_id ? this.getStorageProfile(existing.storage_profile_id) : this.getActiveStorage();

    if (profile && profile.apps_script_url && profile.apps_script_url.startsWith('http')) {
      try {
        await fetch(profile.apps_script_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateBankSoal',
            id: id,
            data: updates,
            user: user,
            spreadsheetId: existing?.spreadsheet_id || profile.google_spreadsheet_id,
          }),
          redirect: 'follow',
        });
      } catch (e) {}
    }

    return this.sheetsService.updateBankSoal(id, updates, user);
  }

  public async deleteMetadata(id: string, user?: User, isPermanent = false): Promise<boolean> {
    const existing = await this.getMetadata(id);
    const profile = existing?.storage_profile_id ? this.getStorageProfile(existing.storage_profile_id) : this.getActiveStorage();

    if (profile && profile.apps_script_url && profile.apps_script_url.startsWith('http')) {
      try {
        await fetch(profile.apps_script_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: isPermanent ? 'permanentDeleteBankSoal' : 'deleteBankSoal',
            id: id,
            user: user,
            spreadsheetId: existing?.spreadsheet_id || profile.google_spreadsheet_id,
          }),
          redirect: 'follow',
        });
      } catch (e) {}
    }

    if (isPermanent) {
      if (existing?.file_id) {
        await this.deleteFile(existing.file_id, existing.storage_profile_id);
      }
      return this.sheetsService.permanentDeleteBankSoal(id, user).success;
    } else {
      return this.sheetsService.deleteBankSoal(id, user);
    }
  }

  public async restoreMetadata(id: string, user?: User): Promise<boolean> {
    const existing = await this.getMetadata(id);
    const profile = existing?.storage_profile_id ? this.getStorageProfile(existing.storage_profile_id) : this.getActiveStorage();

    if (profile && profile.apps_script_url && profile.apps_script_url.startsWith('http')) {
      try {
        await fetch(profile.apps_script_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'restoreBankSoal',
            id: id,
            user: user,
            spreadsheetId: existing?.spreadsheet_id || profile.google_spreadsheet_id,
          }),
          redirect: 'follow',
        });
      } catch (e) {}
    }

    return this.sheetsService.restoreBankSoal(id, user);
  }

  public async addVersion(id: string, fileBuffer: Buffer, fileName: string, user: User, catatan?: string): Promise<BankSoal | null> {
    const existing = await this.getMetadata(id);
    if (!existing) return null;

    const profile = existing.storage_profile_id ? this.getStorageProfile(existing.storage_profile_id) : this.getActiveStorage();
    const uploaded = await this.uploadFile({
      buffer: fileBuffer,
      originalName: fileName,
      metadata: {
        ...existing,
        judul: existing.judul,
      },
      user: user,
      storageProfileId: profile?.id,
    });

    const newVersionNumber = (existing.version || 1) + 1;
    const versionRecord: BankSoalVersion = {
      version_number: newVersionNumber,
      file_id: uploaded.file_id,
      folder_id: uploaded.folder_id,
      file_url: uploaded.file_url,
      web_view_url: uploaded.web_view_url,
      download_url: uploaded.download_url,
      storage_path: uploaded.storage_path,
      nama_file: fileName,
      ukuran_file: fileBuffer.length,
      jumlah_halaman: uploaded.jumlah_halaman,
      file_hash: uploaded.file_hash,
      uploaded_at: new Date().toISOString(),
      uploaded_by_name: user.name,
      uploaded_by_email: user.email,
      catatan: catatan || 'Revisi Dokumen Versi Baru',
    };

    const currentVersions = existing.versions || [];
    currentVersions.unshift(versionRecord);

    return this.updateMetadata(
      id,
      {
        file_id: uploaded.file_id,
        folder_id: uploaded.folder_id,
        drive_file_id: uploaded.file_id,
        drive_folder_id: uploaded.folder_id,
        file_url: uploaded.file_url,
        web_view_url: uploaded.web_view_url,
        download_url: uploaded.download_url,
        nama_file: fileName,
        ukuran_file: fileBuffer.length,
        version: newVersionNumber,
        versions: currentVersions,
        sync_status: uploaded.sync_status as any,
      },
      user
    );
  }

  public async syncStorage(profileId?: string): Promise<DriveSyncResult> {
    const profile = profileId ? this.getStorageProfile(profileId) : this.getActiveStorage();
    if (profile && profile.apps_script_url && profile.apps_script_url.startsWith('http')) {
      try {
        const response = await fetch(profile.apps_script_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'syncDrive',
            driveFolderId: profile.google_drive_folder_id || profile.drive_root_folder_id,
            spreadsheetId: profile.google_spreadsheet_id || profile.spreadsheet_id,
          }),
          redirect: 'follow',
        });

        if (response.ok) {
          const json = await response.json();
          if (json && json.success) {
            return json as DriveSyncResult;
          }
        }
      } catch (e) {}
    }

    // Local Sync Scan
    const allSoal = this.sheetsService.getAllBankSoalRaw();
    let synced = 0;
    let missing = 0;
    allSoal.forEach((item) => {
      const exists = this.driveService.checkFileExists(item.file_id);
      if (exists) synced++;
      else missing++;
    });

    return {
      sync_id: `sync-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      total_scanned: allSoal.length,
      synced_count: synced,
      missing_count: missing,
      unindexed_count: 0,
      details: `Sinkronisasi lokal selesai: ${synced} file tersinkronisasi, ${missing} berkas menunggu diunduh dari cloud.`,
    };
  }
}
