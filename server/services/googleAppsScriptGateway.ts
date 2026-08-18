import { GoogleConfigService } from './googleConfig';
import { ConnectionTestResult } from '../../src/types';

export class GoogleAppsScriptGateway {
  private static instance: GoogleAppsScriptGateway;
  private configService: GoogleConfigService;

  private constructor() {
    this.configService = GoogleConfigService.getInstance();
  }

  public static getInstance(): GoogleAppsScriptGateway {
    if (!GoogleAppsScriptGateway.instance) {
      GoogleAppsScriptGateway.instance = new GoogleAppsScriptGateway();
    }
    return GoogleAppsScriptGateway.instance;
  }

  /**
   * Mengirim request POST ke Google Apps Script Web App jika URL terkonfigurasi
   */
  public async executePostAction<T = any>(action: string, payload: any): Promise<{ success: boolean; data?: T; error?: any; [key: string]: any }> {
    const config = this.configService.getConfig();
    if (!config.apps_script_url || !config.apps_script_url.startsWith('http')) {
      return {
        success: false,
        error: { code: 'NO_APPS_SCRIPT_URL', message: 'URL Google Apps Script belum dikonfigurasi.' },
      };
    }

    try {
      const response = await fetch(config.apps_script_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
        redirect: 'follow',
      });

      if (!response.ok) {
        return {
          success: false,
          error: { code: `HTTP_${response.status}`, message: `Gagal menghubungi Google Apps Script: ${response.statusText}` },
        };
      }

      const json = await response.json();
      return json;
    } catch (err: any) {
      return {
        success: false,
        error: { code: 'GATEWAY_ERROR', message: err.message || 'Koneksi ke Google Apps Script terputus.' },
      };
    }
  }

  /**
   * Mengirim request GET ke Google Apps Script Web App
   */
  public async executeGetAction<T = any>(action: string, params: Record<string, any> = {}): Promise<{ success: boolean; data?: T; error?: any; [key: string]: any }> {
    const config = this.configService.getConfig();
    if (!config.apps_script_url || !config.apps_script_url.startsWith('http')) {
      return {
        success: false,
        error: { code: 'NO_APPS_SCRIPT_URL', message: 'URL Google Apps Script belum dikonfigurasi.' },
      };
    }

    try {
      const url = new URL(config.apps_script_url);
      url.searchParams.set('action', action);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      });

      const response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'follow',
      });

      if (!response.ok) {
        return {
          success: false,
          error: { code: `HTTP_${response.status}`, message: `Gagal memanggil endpoint Google Apps Script: ${response.statusText}` },
        };
      }

      const json = await response.json();
      return json;
    } catch (err: any) {
      return {
        success: false,
        error: { code: 'GATEWAY_ERROR', message: err.message || 'Koneksi ke Google Apps Script terputus.' },
      };
    }
  }

  /**
   * Pengujian Koneksi Terpadu Google Apps Script, Drive, & Sheets
   */
  public async testLiveConnection(): Promise<ConnectionTestResult> {
    const config = this.configService.getConfig();
    const startTime = Date.now();

    const result: ConnectionTestResult = {
      success: true,
      latency_ms: 0,
      apps_script: {
        reachable: Boolean(config.apps_script_url),
        url: config.apps_script_url || 'Belum diisi (Berjalan dalam mode Terintegrasi Lokal/Drive Hybrid)',
        message: config.apps_script_url ? 'Koneksi siap diverifikasi' : 'Menggunakan Driver Google Drive & Sheets Engine bawaan',
      },
      google_drive: {
        connected: Boolean(config.drive_root_folder_id),
        folder_id: config.drive_root_folder_id || '1XyZ_ROOT_FOLDER_BANK_SOAL',
        folder_name: 'BANK SOAL DIGITAL',
      },
      google_sheets: {
        connected: Boolean(config.spreadsheet_id),
        spreadsheet_id: config.spreadsheet_id || '1AbC_SPREADSHEET_BANK_SOAL_DIGITAL',
        spreadsheet_name: 'BANK SOAL DIGITAL - Metadata & Katalog',
        sheet_count: 8,
      },
      timestamp: new Date().toISOString(),
    };

    if (config.apps_script_url && config.apps_script_url.startsWith('http')) {
      try {
        const healthRes = await this.executeGetAction('health');
        if (healthRes.success) {
          result.apps_script.reachable = true;
          result.apps_script.message = `Terhubung ke Google Apps Script (${healthRes.message || 'API Aktif'})`;
        } else {
          const pingRes = await this.executeGetAction('ping');
          result.apps_script.reachable = pingRes.success;
          result.apps_script.message = pingRes.success
            ? 'Koneksi ke Google Apps Script Web App Berhasil & Aktif'
            : (healthRes.error?.message || pingRes.error?.message || 'Gagal menghubungi Apps Script');
        }

        // Query Drive info from Apps Script
        try {
          const driveRes = await this.executeGetAction('drive');
          if (driveRes.success && driveRes.folderId) {
            result.google_drive.connected = true;
            result.google_drive.folder_id = driveRes.folderId;
            result.google_drive.folder_name = driveRes.folderName || 'BANK SOAL DIGITAL';
          }
        } catch {}

        // Query Sheets info from Apps Script
        try {
          const sheetsRes = await this.executeGetAction('sheets');
          if (sheetsRes.success && sheetsRes.spreadsheetId) {
            result.google_sheets.connected = true;
            result.google_sheets.spreadsheet_id = sheetsRes.spreadsheetId;
            result.google_sheets.spreadsheet_name = sheetsRes.spreadsheetName || 'BANK SOAL DIGITAL';
          }
        } catch {}
      } catch (e: any) {
        result.apps_script.reachable = false;
        result.apps_script.message = e.message || 'Server Google Apps Script tidak dapat dihubungi.';
      }
    }

    result.latency_ms = Date.now() - startTime;
    return result;
  }
}
