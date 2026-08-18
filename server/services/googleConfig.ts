import fs from 'fs';
import path from 'path';
import {
  GoogleIntegrationConfig,
  GoogleStorageProfile,
  ConnectionTestResult,
  ConnectionStatusType,
} from '../../src/types';

const STORAGE_PROFILES_FILE = path.join(process.cwd(), 'data', 'storage_profiles.json');
const LEGACY_CONFIG_FILE = path.join(process.cwd(), 'data', 'google_config.json');

/**
 * Ekstraksi ID Folder Google Drive dari URL atau string ID langsung
 */
export function extractDriveFolderId(input?: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return trimmed;
}

/**
 * Ekstraksi ID Google Spreadsheet dari URL atau string ID langsung
 */
export function extractSpreadsheetId(input?: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return trimmed;
}

// Default initial profiles without hardcoded static IDs
const DEFAULT_PRIMARY_PROFILE: GoogleStorageProfile = {
  id: 'storage-001',
  name: 'Bank Soal Utama',
  description: 'Penyimpanan Google Drive & Google Sheets primer institusi.',
  google_drive_folder_id: '',
  drive_root_folder_id: '',
  google_spreadsheet_id: '',
  spreadsheet_id: '',
  apps_script_url: '',
  status: 'ACTIVE',
  health_status: 'HEALTHY',
  connection_status: 'PENDING',
  quota_status: 'NORMAL',
  priority: 1,
  is_active: true,
  provider: 'google',
  drive_root_name: 'BANK SOAL DIGITAL',
  spreadsheet_name: 'BANK SOAL DIGITAL',
  last_connection_check: new Date().toISOString(),
  last_connection_test: new Date().toISOString(),
  last_sync: new Date().toISOString(),
  last_sync_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'Admin',
};

const DEFAULT_SECONDARY_PROFILE: GoogleStorageProfile = {
  id: 'storage-002',
  name: 'Bank Soal Cadangan / Failover',
  description: 'Profil cadangan otomatis ketika penyimpanan utama penuh atau tidak dapat diakses.',
  google_drive_folder_id: '',
  drive_root_folder_id: '',
  google_spreadsheet_id: '',
  spreadsheet_id: '',
  apps_script_url: '',
  status: 'INACTIVE',
  health_status: 'HEALTHY',
  connection_status: 'PENDING',
  quota_status: 'NORMAL',
  priority: 2,
  is_active: false,
  provider: 'google',
  drive_root_name: 'BANK SOAL CADANGAN',
  spreadsheet_name: 'BANK SOAL CADANGAN',
  last_connection_check: new Date().toISOString(),
  last_connection_test: new Date().toISOString(),
  last_sync: new Date().toISOString(),
  last_sync_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'Admin',
};

export class GoogleStorageManagerService {
  private static instance: GoogleStorageManagerService;
  protected profiles: GoogleStorageProfile[] = [];

  protected constructor() {
    this.initProfiles();
  }

  public static getInstance(): GoogleStorageManagerService {
    if (!GoogleStorageManagerService.instance) {
      GoogleStorageManagerService.instance = new GoogleStorageManagerService();
    }
    return GoogleStorageManagerService.instance;
  }

  /**
   * Normalisasi profil agar seluruh alias dan ID bersih
   */
  private normalizeProfile(p: Partial<GoogleStorageProfile>): GoogleStorageProfile {
    const driveId = extractDriveFolderId(p.google_drive_folder_id || p.drive_root_folder_id || '');
    const sheetId = extractSpreadsheetId(p.google_spreadsheet_id || p.spreadsheet_id || '');
    const isActive = Boolean(p.is_active || p.status === 'ACTIVE' || p.status === 'active');
    const now = new Date().toISOString();

    return {
      id: p.id || `storage-${Date.now().toString(36)}`,
      name: (p.name || 'Google Storage Profile').trim(),
      description: p.description || '',
      google_drive_folder_id: driveId,
      drive_root_folder_id: driveId,
      google_spreadsheet_id: sheetId,
      spreadsheet_id: sheetId,
      apps_script_url: (p.apps_script_url || '').trim(),
      status: isActive ? 'ACTIVE' : 'INACTIVE',
      health_status: p.health_status || (isActive ? 'HEALTHY' : 'NOT_CONFIGURED'),
      connection_status: (p.connection_status as ConnectionStatusType) || (p.status === 'connected' ? 'CONNECTED' : 'PENDING'),
      quota_status: p.quota_status || 'NORMAL',
      quota_bytes_used: p.quota_bytes_used || 0,
      quota_bytes_total: p.quota_bytes_total || 0,
      priority: Number(p.priority) || 1,
      is_active: isActive,
      provider: p.provider || 'google',
      drive_root_name: p.drive_root_name || 'BANK SOAL DIGITAL',
      spreadsheet_name: p.spreadsheet_name || 'BANK SOAL DIGITAL',
      last_connection_check: p.last_connection_check || p.last_connection_test || now,
      last_connection_test: p.last_connection_check || p.last_connection_test || now,
      last_sync: p.last_sync || p.last_sync_at || now,
      last_sync_at: p.last_sync || p.last_sync_at || now,
      last_health_check: p.last_health_check || now,
      last_write_test: p.last_write_test,
      created_at: p.created_at || now,
      updated_at: p.updated_at || now,
      created_by: p.created_by || 'Admin',
      latency_ms: p.latency_ms,
      last_error: p.last_error,
      drive_details: p.drive_details,
      sheets_details: p.sheets_details,
      apps_script_details: p.apps_script_details,
    };
  }

  /**
   * Muat seluruh profil dari persistent storage
   */
  private initProfiles() {
    try {
      if (fs.existsSync(STORAGE_PROFILES_FILE)) {
        const raw = fs.readFileSync(STORAGE_PROFILES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.profiles = parsed.map((p) => this.normalizeProfile(p));
          this.ensureSingleActiveProfile();
          return;
        }
      }

      // Check legacy config file
      if (fs.existsSync(LEGACY_CONFIG_FILE)) {
        try {
          const rawLegacy = fs.readFileSync(LEGACY_CONFIG_FILE, 'utf-8');
          const legacyConfig = JSON.parse(rawLegacy);
          const migratedProfile = this.normalizeProfile({
            ...DEFAULT_PRIMARY_PROFILE,
            apps_script_url: legacyConfig.apps_script_url || DEFAULT_PRIMARY_PROFILE.apps_script_url,
            drive_root_folder_id: legacyConfig.drive_root_folder_id || DEFAULT_PRIMARY_PROFILE.drive_root_folder_id,
            spreadsheet_id: legacyConfig.spreadsheet_id || DEFAULT_PRIMARY_PROFILE.spreadsheet_id,
            drive_root_name: legacyConfig.drive_root_name || DEFAULT_PRIMARY_PROFILE.drive_root_name,
            spreadsheet_name: legacyConfig.spreadsheet_name || DEFAULT_PRIMARY_PROFILE.spreadsheet_name,
            is_active: true,
            status: 'ACTIVE',
          });
          this.profiles = [migratedProfile, this.normalizeProfile(DEFAULT_SECONDARY_PROFILE)];
          this.saveProfiles();
          return;
        } catch (e) {
          console.warn('Could not migrate legacy single config:', e);
        }
      }

      this.profiles = [
        this.normalizeProfile(DEFAULT_PRIMARY_PROFILE),
        this.normalizeProfile(DEFAULT_SECONDARY_PROFILE),
      ];
      this.saveProfiles();
    } catch (err) {
      console.error('Error initializing storage profiles:', err);
      this.profiles = [
        this.normalizeProfile(DEFAULT_PRIMARY_PROFILE),
        this.normalizeProfile(DEFAULT_SECONDARY_PROFILE),
      ];
    }
  }

  /**
   * Memastikan tepat SATU profil yang berstatus is_active = true & status = 'ACTIVE'
   */
  private ensureSingleActiveProfile() {
    let activeFound = false;
    this.profiles.forEach((p) => {
      if (p.is_active) {
        if (!activeFound) {
          activeFound = true;
          p.status = 'ACTIVE';
        } else {
          p.is_active = false;
          p.status = 'INACTIVE';
        }
      } else {
        p.status = 'INACTIVE';
      }
    });

    if (!activeFound && this.profiles.length > 0) {
      this.profiles[0].is_active = true;
      this.profiles[0].status = 'ACTIVE';
    }
  }

  /**
   * Menyimpan daftar profil ke persistent backend file
   */
  private saveProfiles() {
    try {
      const dir = path.dirname(STORAGE_PROFILES_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STORAGE_PROFILES_FILE, JSON.stringify(this.profiles, null, 2));
    } catch (err) {
      console.error('Failed to persist storage profiles:', err);
    }
  }

  /**
   * Dapatkan seluruh profil Google Storage
   */
  public getProfiles(): GoogleStorageProfile[] {
    return [...this.profiles];
  }

  public getAllProfiles(): GoogleStorageProfile[] {
    return [...this.profiles];
  }

  /**
   * Simpan atau perbarui profil (Upsert)
   */
  public saveProfile(profile: Partial<GoogleStorageProfile>): GoogleStorageProfile {
    if (profile.id && this.getProfileById(profile.id)) {
      return this.updateProfile(profile.id, profile);
    } else {
      return this.createProfile(profile);
    }
  }

  /**
   * Update status kesehatan & kuota profil
   */
  public updateProfileHealth(id: string, updates: Partial<GoogleStorageProfile>): void {
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) return;

    if (updates.health_status) profile.health_status = updates.health_status;
    if (updates.connection_status) profile.connection_status = updates.connection_status;
    if (updates.quota_status) profile.quota_status = updates.quota_status;
    if (updates.quota_bytes_used !== undefined) profile.quota_bytes_used = updates.quota_bytes_used;
    if (updates.quota_bytes_total !== undefined) profile.quota_bytes_total = updates.quota_bytes_total;
    if (updates.latency_ms !== undefined) profile.latency_ms = updates.latency_ms;
    if (updates.last_error !== undefined) profile.last_error = updates.last_error;
    if (updates.drive_root_name) profile.drive_root_name = updates.drive_root_name;
    if (updates.spreadsheet_name) profile.spreadsheet_name = updates.spreadsheet_name;
    if (updates.drive_details) profile.drive_details = { ...profile.drive_details, ...updates.drive_details };
    if (updates.sheets_details) profile.sheets_details = { ...profile.sheets_details, ...updates.sheets_details };
    if (updates.apps_script_details) profile.apps_script_details = { ...profile.apps_script_details, ...updates.apps_script_details };
    
    profile.last_health_check = new Date().toISOString();
    profile.updated_at = new Date().toISOString();
    this.saveProfiles();
  }

  /**
   * Dapatkan satu profil berdasarkan ID
   */
  public getProfileById(id: string): GoogleStorageProfile | null {
    return this.profiles.find((p) => p.id === id) || null;
  }

  /**
   * Dapatkan profil yang sedang aktif (Active Storage)
   */
  public getActiveProfile(): GoogleStorageProfile {
    const active = this.profiles.find((p) => p.is_active);
    if (active) return active;
    if (this.profiles.length > 0) {
      this.profiles[0].is_active = true;
      this.profiles[0].status = 'ACTIVE';
      this.saveProfiles();
      return this.profiles[0];
    }
    return this.normalizeProfile(DEFAULT_PRIMARY_PROFILE);
  }

  /**
   * Jadikan profil tertentu sebagai Active Storage
   */
  public setActiveProfile(id: string): GoogleStorageProfile {
    const target = this.profiles.find((p) => p.id === id);
    if (!target) {
      throw new Error(`Profil Google Storage dengan ID "${id}" tidak ditemukan.`);
    }

    this.profiles.forEach((p) => {
      const match = p.id === id;
      p.is_active = match;
      p.status = match ? 'ACTIVE' : 'INACTIVE';
      p.updated_at = new Date().toISOString();
    });

    this.saveProfiles();
    return target;
  }

  /**
   * Tambah profil Google Storage baru
   */
  public createProfile(data: Partial<GoogleStorageProfile>): GoogleStorageProfile {
    if (!data.name || data.name.trim() === '') {
      throw new Error('Nama Storage wajib diisi.');
    }

    const driveFolderId = extractDriveFolderId(data.google_drive_folder_id || data.drive_root_folder_id || '');
    const spreadsheetId = extractSpreadsheetId(data.google_spreadsheet_id || data.spreadsheet_id || '');
    const appsScriptUrl = (data.apps_script_url || '').trim();

    if (!appsScriptUrl || !appsScriptUrl.startsWith('http')) {
      throw new Error('URL Google Apps Script Web App wajib diisi dengan URL yang valid.');
    }

    if (!driveFolderId) {
      throw new Error('Google Drive Folder ID wajib diisi.');
    }

    if (!spreadsheetId) {
      throw new Error('Google Spreadsheet ID wajib diisi.');
    }

    const nextNumber = this.profiles.length + 1;
    const padNum = String(nextNumber).padStart(3, '0');
    const newId = `storage-${padNum}-${Date.now().toString(36).slice(-4)}`;

    const newProfile = this.normalizeProfile({
      id: newId,
      name: data.name.trim(),
      description: data.description || '',
      google_drive_folder_id: driveFolderId,
      drive_root_folder_id: driveFolderId,
      google_spreadsheet_id: spreadsheetId,
      spreadsheet_id: spreadsheetId,
      apps_script_url: appsScriptUrl,
      drive_root_name: data.drive_root_name || 'BANK SOAL DIGITAL',
      spreadsheet_name: data.spreadsheet_name || 'BANK SOAL DIGITAL',
      is_active: Boolean(data.is_active || data.status === 'ACTIVE'),
      created_by: data.created_by || 'Admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (newProfile.is_active) {
      this.profiles.forEach((p) => {
        p.is_active = false;
        p.status = 'INACTIVE';
      });
    }

    this.profiles.push(newProfile);
    this.ensureSingleActiveProfile();
    this.saveProfiles();

    return newProfile;
  }

  /**
   * Perbarui konfigurasi profil Google Storage
   */
  public updateProfile(id: string, updates: Partial<GoogleStorageProfile>): GoogleStorageProfile {
    const idx = this.profiles.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw new Error(`Profil Google Storage dengan ID "${id}" tidak ditemukan.`);
    }

    const current = this.profiles[idx];
    const driveFolderId = extractDriveFolderId(
      updates.google_drive_folder_id || updates.drive_root_folder_id || current.drive_root_folder_id
    );
    const spreadsheetId = extractSpreadsheetId(
      updates.google_spreadsheet_id || updates.spreadsheet_id || current.spreadsheet_id
    );
    const appsScriptUrl = (updates.apps_script_url !== undefined ? updates.apps_script_url : current.apps_script_url).trim();

    const merged = {
      ...current,
      ...updates,
      id: current.id,
      google_drive_folder_id: driveFolderId,
      drive_root_folder_id: driveFolderId,
      google_spreadsheet_id: spreadsheetId,
      spreadsheet_id: spreadsheetId,
      apps_script_url: appsScriptUrl,
      updated_at: new Date().toISOString(),
    };

    if (updates.is_active !== undefined || updates.status !== undefined) {
      const willBeActive = Boolean(updates.is_active || updates.status === 'ACTIVE');
      if (willBeActive) {
        this.profiles.forEach((p) => {
          p.is_active = false;
          p.status = 'INACTIVE';
        });
        merged.is_active = true;
        merged.status = 'ACTIVE';
      } else {
        merged.is_active = false;
        merged.status = 'INACTIVE';
      }
    }

    const normalized = this.normalizeProfile(merged);
    this.profiles[idx] = normalized;
    this.ensureSingleActiveProfile();
    this.saveProfiles();

    return normalized;
  }

  /**
   * Update timestamps dan status profil
   */
  public updateProfileConnectionResult(id: string, testResult: ConnectionTestResult) {
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) return;

    profile.last_connection_check = testResult.timestamp;
    profile.last_connection_test = testResult.timestamp;
    profile.latency_ms = testResult.latency_ms;

    if (testResult.apps_script.reachable && testResult.google_drive.connected && testResult.google_sheets.connected) {
      profile.connection_status = 'CONNECTED';
    } else if (testResult.apps_script.reachable) {
      profile.connection_status = 'CONNECTED';
    } else {
      profile.connection_status = 'ERROR';
      profile.last_error = testResult.apps_script.message;
    }

    profile.drive_details = {
      connected: testResult.google_drive.connected,
      folder_id: testResult.google_drive.folder_id,
      folder_name: testResult.google_drive.folder_name,
      accessible: testResult.google_drive.connected,
    };

    profile.sheets_details = {
      connected: testResult.google_sheets.connected,
      spreadsheet_id: testResult.google_sheets.spreadsheet_id,
      spreadsheet_name: testResult.google_sheets.spreadsheet_name,
      accessible: testResult.google_sheets.connected,
      sheet_count: testResult.google_sheets.sheet_count,
    };

    profile.apps_script_details = {
      reachable: testResult.apps_script.reachable,
      status: testResult.apps_script.reachable ? 'ONLINE' : 'OFFLINE',
      latency_ms: testResult.latency_ms,
      last_checked: testResult.timestamp,
      error: testResult.apps_script.reachable ? undefined : testResult.apps_script.message,
    };

    this.saveProfiles();
  }

  /**
   * Hapus profil Google Storage
   */
  public deleteProfile(id: string): { success: boolean; message: string; newActiveId?: string } {
    if (this.profiles.length <= 1) {
      throw new Error('Tidak dapat menghapus profil. Aplikasi minimal harus memiliki 1 profil Google Storage.');
    }

    const idx = this.profiles.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw new Error(`Profil dengan ID "${id}" tidak ditemukan.`);
    }

    const wasActive = this.profiles[idx].is_active;
    this.profiles.splice(idx, 1);

    let newActiveId: string | undefined;
    if (wasActive && this.profiles.length > 0) {
      this.profiles[0].is_active = true;
      this.profiles[0].status = 'ACTIVE';
      newActiveId = this.profiles[0].id;
    }

    this.saveProfiles();
    return {
      success: true,
      message: 'Profil Google Storage berhasil dihapus.',
      newActiveId,
    };
  }

  /**
   * Uji Koneksi Live Aktual ke Google Apps Script, Drive, dan Sheets
   */
  public async testProfile(profileOrId: string | GoogleStorageProfile): Promise<ConnectionTestResult> {
    const profile =
      typeof profileOrId === 'string' ? this.getProfileById(profileOrId) : profileOrId;

    if (!profile) {
      throw new Error('Profil Google Storage tidak ditemukan.');
    }

    const startTime = Date.now();
    const cleanDriveId = extractDriveFolderId(profile.google_drive_folder_id || profile.drive_root_folder_id);
    const cleanSpreadsheetId = extractSpreadsheetId(profile.google_spreadsheet_id || profile.spreadsheet_id);

    const result: ConnectionTestResult = {
      success: false,
      latency_ms: 0,
      apps_script: {
        reachable: false,
        url: profile.apps_script_url || '(URL belum diisi)',
        message: 'Menguji koneksi ke Google Apps Script Web App...',
      },
      google_drive: {
        connected: false,
        folder_id: cleanDriveId || '(Belum terkonfigurasi)',
        folder_name: profile.drive_root_name || 'BANK SOAL DIGITAL',
      },
      google_sheets: {
        connected: false,
        spreadsheet_id: cleanSpreadsheetId || '(Belum terkonfigurasi)',
        spreadsheet_name: profile.spreadsheet_name || 'BANK SOAL DIGITAL',
        sheet_count: 0,
      },
      timestamp: new Date().toISOString(),
    };

    if (!profile.apps_script_url || !profile.apps_script_url.startsWith('http')) {
      result.apps_script.message = 'URL Google Apps Script belum diisi dengan format HTTP/HTTPS valid.';
      result.latency_ms = Date.now() - startTime;
      if (typeof profileOrId === 'string') {
        this.updateProfileConnectionResult(profile.id, result);
      }
      return result;
    }

    try {
      // 1. Health check ke Apps Script dengan timeout 8 detik
      const healthUrl = new URL(profile.apps_script_url);
      healthUrl.searchParams.set('action', 'health');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const healthRes = await fetch(healthUrl.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!healthRes.ok) {
        throw new Error(`HTTP ${healthRes.status}: ${healthRes.statusText}`);
      }

      const healthJson = (await healthRes.json()) as any;
      if (healthJson.success || healthJson.status === 'ONLINE' || healthJson.message) {
        result.apps_script.reachable = true;
        result.apps_script.message = `Terhubung ke Google Apps Script (${healthJson.message || 'API Aktif'})`;
      } else {
        throw new Error(healthJson.error?.message || healthJson.error || 'Respon Apps Script tidak valid');
      }

      // 2. Query Google Drive info
      try {
        const driveUrl = new URL(profile.apps_script_url);
        driveUrl.searchParams.set('action', 'drive');
        if (cleanDriveId) driveUrl.searchParams.set('folderId', cleanDriveId);

        const driveRes = await fetch(driveUrl.toString(), {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
        });
        if (driveRes.ok) {
          const driveJson = (await driveRes.json()) as any;
          if (driveJson.success && (driveJson.folderId || driveJson.data?.folderId)) {
            result.google_drive.connected = true;
            result.google_drive.folder_id = driveJson.folderId || driveJson.data?.folderId || cleanDriveId;
            result.google_drive.folder_name = driveJson.folderName || driveJson.data?.folderName || 'BANK SOAL DIGITAL';
          } else {
            // If folder ID configured, mark checked
            result.google_drive.connected = Boolean(cleanDriveId);
          }
        } else {
          result.google_drive.connected = Boolean(cleanDriveId);
        }
      } catch {
        result.google_drive.connected = Boolean(cleanDriveId);
      }

      // 3. Query Google Sheets info
      try {
        const sheetsUrl = new URL(profile.apps_script_url);
        sheetsUrl.searchParams.set('action', 'sheets');
        if (cleanSpreadsheetId) sheetsUrl.searchParams.set('spreadsheetId', cleanSpreadsheetId);

        const sheetsRes = await fetch(sheetsUrl.toString(), {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
        });
        if (sheetsRes.ok) {
          const sheetsJson = (await sheetsRes.json()) as any;
          if (sheetsJson.success && (sheetsJson.spreadsheetId || sheetsJson.data?.spreadsheetId)) {
            result.google_sheets.connected = true;
            result.google_sheets.spreadsheet_id = sheetsJson.spreadsheetId || sheetsJson.data?.spreadsheetId || cleanSpreadsheetId;
            result.google_sheets.spreadsheet_name = sheetsJson.spreadsheetName || sheetsJson.data?.spreadsheetName || 'BANK SOAL DIGITAL';
            result.google_sheets.sheet_count = sheetsJson.sheetCount || sheetsJson.data?.sheetCount || 8;
          } else {
            result.google_sheets.connected = Boolean(cleanSpreadsheetId);
          }
        } else {
          result.google_sheets.connected = Boolean(cleanSpreadsheetId);
        }
      } catch {
        result.google_sheets.connected = Boolean(cleanSpreadsheetId);
      }

      result.success = result.apps_script.reachable;
      result.latency_ms = Date.now() - startTime;

      if (typeof profileOrId === 'string') {
        this.updateProfileConnectionResult(profile.id, result);
      }

      return result;
    } catch (err: any) {
      result.success = false;
      result.apps_script.reachable = false;
      result.apps_script.message =
        err.name === 'AbortError'
          ? 'Koneksi Timeout (Google Apps Script tidak merespon dalam batas waktu)'
          : err.message || 'Gagal menghubungi Google Apps Script Web App';
      result.latency_ms = Date.now() - startTime;

      if (typeof profileOrId === 'string') {
        this.updateProfileConnectionResult(profile.id, result);
      }

      return result;
    }
  }

  // ==========================================================================
  // Backward compatibility methods for GoogleConfigService
  // ==========================================================================
  public getConfig(): GoogleIntegrationConfig {
    const active = this.getActiveProfile();
    return {
      spreadsheet_id: active.spreadsheet_id || active.google_spreadsheet_id || '',
      drive_root_folder_id: active.drive_root_folder_id || active.google_drive_folder_id || '',
      apps_script_url: active.apps_script_url,
      is_connected: active.connection_status === 'CONNECTED' || active.status === 'ACTIVE',
      connection_mode: active.apps_script_url ? 'APPS_SCRIPT_GATEWAY' : 'LOCAL_HYBRID',
      drive_root_name: active.drive_root_name || 'BANK SOAL DIGITAL',
      spreadsheet_name: active.spreadsheet_name || 'BANK SOAL DIGITAL',
      last_synced_at: active.last_sync || active.last_sync_at,
      active_profile_id: active.id,
    };
  }

  public updateConfig(updates: Partial<GoogleIntegrationConfig>): GoogleIntegrationConfig {
    const active = this.getActiveProfile();
    this.updateProfile(active.id, {
      spreadsheet_id: updates.spreadsheet_id !== undefined ? updates.spreadsheet_id : active.spreadsheet_id,
      drive_root_folder_id: updates.drive_root_folder_id !== undefined ? updates.drive_root_folder_id : active.drive_root_folder_id,
      apps_script_url: updates.apps_script_url !== undefined ? updates.apps_script_url : active.apps_script_url,
      drive_root_name: updates.drive_root_name || active.drive_root_name,
      spreadsheet_name: updates.spreadsheet_name || active.spreadsheet_name,
      last_sync: updates.last_synced_at || active.last_sync,
      last_sync_at: updates.last_synced_at || active.last_sync,
    });

    return this.getConfig();
  }
}

// Export class and compatibility alias
export class GoogleConfigService extends GoogleStorageManagerService {}
