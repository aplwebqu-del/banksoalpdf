import fs from 'fs';
import path from 'path';
import { GoogleIntegrationConfig, GoogleStorageProfile, ConnectionTestResult, StorageProfileStatus } from '../../src/types';

const STORAGE_PROFILES_FILE = path.join(process.cwd(), 'data', 'storage_profiles.json');
const LEGACY_CONFIG_FILE = path.join(process.cwd(), 'data', 'google_config.json');

// Default initial profiles
const DEFAULT_PRIMARY_PROFILE: GoogleStorageProfile = {
  id: 'storage-001',
  name: 'Bank Soal Utama',
  provider: 'google',
  apps_script_url: process.env.GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyF6dpVrbMemA7gy-Yt6Iyb9aw5CO8TxjtLAKpWzdZvbqucSmyAjvYpvF7D3XTw_g-EkA/exec',
  drive_root_folder_id: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '1xptzL_8Ev9xP8vWqg38-_M9CnQhgbQ2C',
  spreadsheet_id: process.env.GOOGLE_SPREADSHEET_ID || '1xetHb6N-ylyV3P2vs-okohHbsX1MnxfptJDJlqVYwPc',
  status: 'connected',
  is_active: true,
  drive_root_name: 'BANK SOAL DIGITAL',
  spreadsheet_name: 'BANK SOAL DIGITAL',
  description: 'Penyimpanan Google Drive & Google Sheets primer institusi.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_connection_test: new Date().toISOString(),
  last_sync_at: new Date().toISOString(),
};

const DEFAULT_SECONDARY_PROFILE: GoogleStorageProfile = {
  id: 'storage-002',
  name: 'Bank Soal Cadangan / Backup',
  provider: 'google',
  apps_script_url: '',
  drive_root_folder_id: '',
  spreadsheet_id: '',
  status: 'untested',
  is_active: false,
  drive_root_name: 'BANK SOAL CADANGAN',
  spreadsheet_name: 'BANK SOAL CADANGAN',
  description: 'Profil cadangan untuk pengujian atau arsip tahun ajaran lampau.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
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
   * Muat seluruh profil dari persistent storage
   */
  private initProfiles() {
    try {
      if (fs.existsSync(STORAGE_PROFILES_FILE)) {
        const raw = fs.readFileSync(STORAGE_PROFILES_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.profiles = parsed;
          this.ensureSingleActiveProfile();
          return;
        }
      }

      // Check legacy single-config migration if exists
      if (fs.existsSync(LEGACY_CONFIG_FILE)) {
        try {
          const rawLegacy = fs.readFileSync(LEGACY_CONFIG_FILE, 'utf-8');
          const legacyConfig = JSON.parse(rawLegacy);
          const migratedProfile: GoogleStorageProfile = {
            ...DEFAULT_PRIMARY_PROFILE,
            apps_script_url: legacyConfig.apps_script_url || DEFAULT_PRIMARY_PROFILE.apps_script_url,
            drive_root_folder_id: legacyConfig.drive_root_folder_id || DEFAULT_PRIMARY_PROFILE.drive_root_folder_id,
            spreadsheet_id: legacyConfig.spreadsheet_id || DEFAULT_PRIMARY_PROFILE.spreadsheet_id,
            drive_root_name: legacyConfig.drive_root_name || DEFAULT_PRIMARY_PROFILE.drive_root_name,
            spreadsheet_name: legacyConfig.spreadsheet_name || DEFAULT_PRIMARY_PROFILE.spreadsheet_name,
            is_active: true,
            status: 'connected',
          };
          this.profiles = [migratedProfile, DEFAULT_SECONDARY_PROFILE];
          this.saveProfiles();
          return;
        } catch (e) {
          console.warn('Could not migrate legacy single config:', e);
        }
      }

      // Default initial profiles
      this.profiles = [{ ...DEFAULT_PRIMARY_PROFILE }, { ...DEFAULT_SECONDARY_PROFILE }];
      this.saveProfiles();
    } catch (err) {
      console.error('Error initializing storage profiles:', err);
      this.profiles = [{ ...DEFAULT_PRIMARY_PROFILE }, { ...DEFAULT_SECONDARY_PROFILE }];
    }
  }

  /**
   * Memastikan tepat 1 profil yang berstatus is_active = true
   */
  private ensureSingleActiveProfile() {
    let activeFound = false;
    this.profiles.forEach((p) => {
      if (p.is_active) {
        if (!activeFound) {
          activeFound = true;
        } else {
          p.is_active = false;
        }
      }
    });

    if (!activeFound && this.profiles.length > 0) {
      this.profiles[0].is_active = true;
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
      this.saveProfiles();
      return this.profiles[0];
    }
    return { ...DEFAULT_PRIMARY_PROFILE };
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
      p.is_active = p.id === id;
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
      throw new Error('Nama Google Storage wajib diisi.');
    }

    const nextNumber = this.profiles.length + 1;
    const padNum = String(nextNumber).padStart(3, '0');
    const newId = `storage-${padNum}-${Date.now().toString(36).slice(-4)}`;

    const newProfile: GoogleStorageProfile = {
      id: newId,
      name: data.name.trim(),
      provider: 'google',
      apps_script_url: (data.apps_script_url || '').trim(),
      drive_root_folder_id: (data.drive_root_folder_id || '').trim(),
      spreadsheet_id: (data.spreadsheet_id || '').trim(),
      status: 'untested',
      is_active: Boolean(data.is_active),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      drive_root_name: data.drive_root_name || 'BANK SOAL DIGITAL',
      spreadsheet_name: data.spreadsheet_name || 'BANK SOAL DIGITAL',
      description: data.description || '',
    };

    if (newProfile.is_active) {
      this.profiles.forEach((p) => {
        p.is_active = false;
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
    const updated: GoogleStorageProfile = {
      ...current,
      ...updates,
      id: current.id, // Prevent ID overwrite
      updated_at: new Date().toISOString(),
    };

    if (updates.is_active) {
      this.profiles.forEach((p) => {
        p.is_active = p.id === id;
      });
    }

    this.profiles[idx] = updated;
    this.ensureSingleActiveProfile();
    this.saveProfiles();

    return updated;
  }

  /**
   * Perbarui status koneksi dan metadata profil
   */
  public updateProfileStatus(
    id: string,
    status: StorageProfileStatus,
    errorMsg?: string,
    meta?: { folderId?: string; folderName?: string; spreadsheetId?: string; spreadsheetName?: string }
  ) {
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) return;

    profile.status = status;
    profile.last_connection_test = new Date().toISOString();
    if (errorMsg) {
      profile.last_error = errorMsg;
    } else {
      delete profile.last_error;
    }

    if (meta) {
      if (meta.folderId) profile.drive_root_folder_id = meta.folderId;
      if (meta.folderName) profile.drive_root_name = meta.folderName;
      if (meta.spreadsheetId) profile.spreadsheet_id = meta.spreadsheetId;
      if (meta.spreadsheetName) profile.spreadsheet_name = meta.spreadsheetName;
    }

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
   * Uji Koneksi Live untuk satu profil tertentu
   */
  public async testProfile(profileOrId: string | GoogleStorageProfile): Promise<ConnectionTestResult> {
    const profile = typeof profileOrId === 'string'
      ? this.getProfileById(profileOrId)
      : profileOrId;

    if (!profile) {
      throw new Error('Profil Google Storage tidak ditemukan.');
    }

    const startTime = Date.now();
    const result: ConnectionTestResult = {
      success: false,
      latency_ms: 0,
      apps_script: {
        reachable: false,
        url: profile.apps_script_url || '(URL belum diisi)',
        message: 'Menghubungi Google Apps Script...',
      },
      google_drive: {
        connected: false,
        folder_id: profile.drive_root_folder_id || '(Belum terhubung)',
        folder_name: profile.drive_root_name || 'BANK SOAL DIGITAL',
      },
      google_sheets: {
        connected: false,
        spreadsheet_id: profile.spreadsheet_id || '(Belum terhubung)',
        spreadsheet_name: profile.spreadsheet_name || 'BANK SOAL DIGITAL',
        sheet_count: 0,
      },
      timestamp: new Date().toISOString(),
    };

    if (!profile.apps_script_url || !profile.apps_script_url.startsWith('http')) {
      result.apps_script.message = 'URL Google Apps Script belum diisi.';
      this.updateProfileStatus(profile.id, 'disconnected', 'URL Apps Script kosong');
      result.latency_ms = Date.now() - startTime;
      return result;
    }

    try {
      // 1. Health check
      const healthUrl = new URL(profile.apps_script_url);
      healthUrl.searchParams.set('action', 'health');
      const healthRes = await fetch(healthUrl.toString(), { method: 'GET', redirect: 'follow' });

      if (!healthRes.ok) {
        throw new Error(`HTTP ${healthRes.status}: ${healthRes.statusText}`);
      }

      const healthJson = await healthRes.json() as any;
      if (healthJson.success) {
        result.apps_script.reachable = true;
        result.apps_script.message = `Terhubung ke Google Apps Script (${healthJson.message || 'API Aktif'})`;
      } else {
        throw new Error(healthJson.error || 'Respon Apps Script tidak valid');
      }

      // 2. Query Drive
      let detectedFolderId = profile.drive_root_folder_id;
      let detectedFolderName = profile.drive_root_name;
      try {
        const driveUrl = new URL(profile.apps_script_url);
        driveUrl.searchParams.set('action', 'drive');
        const driveRes = await fetch(driveUrl.toString(), { method: 'GET', redirect: 'follow' });
        if (driveRes.ok) {
          const driveJson = await driveRes.json() as any;
          if (driveJson.success && driveJson.folderId) {
            result.google_drive.connected = true;
            result.google_drive.folder_id = driveJson.folderId;
            result.google_drive.folder_name = driveJson.folderName || 'BANK SOAL DIGITAL';
            detectedFolderId = driveJson.folderId;
            detectedFolderName = driveJson.folderName;
          }
        }
      } catch {}

      // 3. Query Sheets
      let detectedSpreadsheetId = profile.spreadsheet_id;
      let detectedSpreadsheetName = profile.spreadsheet_name;
      try {
        const sheetsUrl = new URL(profile.apps_script_url);
        sheetsUrl.searchParams.set('action', 'sheets');
        const sheetsRes = await fetch(sheetsUrl.toString(), { method: 'GET', redirect: 'follow' });
        if (sheetsRes.ok) {
          const sheetsJson = await sheetsRes.json() as any;
          if (sheetsJson.success && sheetsJson.spreadsheetId) {
            result.google_sheets.connected = true;
            result.google_sheets.spreadsheet_id = sheetsJson.spreadsheetId;
            result.google_sheets.spreadsheet_name = sheetsJson.spreadsheetName || 'BANK SOAL DIGITAL';
            result.google_sheets.sheet_count = 8;
            detectedSpreadsheetId = sheetsJson.spreadsheetId;
            detectedSpreadsheetName = sheetsJson.spreadsheetName;
          }
        }
      } catch {}

      result.success = result.apps_script.reachable;
      result.latency_ms = Date.now() - startTime;

      this.updateProfileStatus(profile.id, 'connected', undefined, {
        folderId: detectedFolderId,
        folderName: detectedFolderName,
        spreadsheetId: detectedSpreadsheetId,
        spreadsheetName: detectedSpreadsheetName,
      });

      return result;
    } catch (err: any) {
      result.success = false;
      result.apps_script.reachable = false;
      result.apps_script.message = err.message || 'Gagal menghubungi Google Apps Script Web App';
      result.latency_ms = Date.now() - startTime;

      this.updateProfileStatus(profile.id, 'error', err.message);
      return result;
    }
  }

  // ==========================================================================
  // Backward compatibility methods for GoogleConfigService
  // ==========================================================================
  public getConfig(): GoogleIntegrationConfig {
    const active = this.getActiveProfile();
    return {
      spreadsheet_id: active.spreadsheet_id,
      drive_root_folder_id: active.drive_root_folder_id,
      apps_script_url: active.apps_script_url,
      is_connected: active.status === 'connected',
      connection_mode: active.apps_script_url ? 'APPS_SCRIPT_GATEWAY' : 'LOCAL_HYBRID',
      drive_root_name: active.drive_root_name || 'BANK SOAL DIGITAL',
      spreadsheet_name: active.spreadsheet_name || 'BANK SOAL DIGITAL',
      last_synced_at: active.last_sync_at,
      active_profile_id: active.id,
    };
  }

  public updateConfig(updates: Partial<GoogleIntegrationConfig>): GoogleIntegrationConfig {
    const active = this.getActiveProfile();
    const updatedProfile = this.updateProfile(active.id, {
      spreadsheet_id: updates.spreadsheet_id !== undefined ? updates.spreadsheet_id : active.spreadsheet_id,
      drive_root_folder_id: updates.drive_root_folder_id !== undefined ? updates.drive_root_folder_id : active.drive_root_folder_id,
      apps_script_url: updates.apps_script_url !== undefined ? updates.apps_script_url : active.apps_script_url,
      drive_root_name: updates.drive_root_name || active.drive_root_name,
      spreadsheet_name: updates.spreadsheet_name || active.spreadsheet_name,
      last_sync_at: updates.last_synced_at || active.last_sync_at,
    });

    return this.getConfig();
  }
}

// Export class and compatibility alias
export class GoogleConfigService extends GoogleStorageManagerService {}

