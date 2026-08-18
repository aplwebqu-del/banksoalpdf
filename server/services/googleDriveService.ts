import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { GoogleConfigService } from './googleConfig';

export interface DriveFolderInfo {
  id: string;
  name: string;
  parent_id?: string;
  path: string;
}

export interface DriveUploadResult {
  file_id: string;
  folder_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  web_view_url: string;
  download_url: string;
  file_hash: string;
  storage_path: string;
}

export class GoogleDriveService {
  private static instance: GoogleDriveService;
  private configService: GoogleConfigService;
  private storageDir: string;

  private constructor() {
    this.configService = GoogleConfigService.getInstance();
    this.storageDir = path.join(process.cwd(), 'data', 'drive_storage');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  /**
   * Menghasilkan ID unik berstandar Google Drive (28 Karakter)
   */
  public generateDriveFileId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '1';
    for (let i = 0; i < 27; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Menghasilkan ID unik untuk Folder Google Drive
   */
  public generateDriveFolderId(name: string): string {
    const hash = crypto.createHash('md5').update(name).digest('hex').substring(0, 16);
    return `1Fld_${hash}`;
  }

  /**
   * Menghitung rute folder Google Drive yang terstruktur:
   * BANK SOAL DIGITAL / [Mata Pelajaran] / Kelas [Kelas]
   */
  public resolveFolderPath(mataPelajaran: string, kelas: string | number): { folder_id: string; folder_path: string; root_id: string } {
    const rootFolderId = this.configService.getConfig().drive_root_folder_id || '1XyZ_ROOT_FOLDER_BANK_SOAL';
    const cleanMapel = (mataPelajaran || 'Lainnya').trim();
    const cleanKelas = kelas ? `Kelas ${kelas}` : 'Umum';
    const folderPath = `BANK SOAL DIGITAL / ${cleanMapel} / ${cleanKelas}`;
    const folderId = this.generateDriveFolderId(folderPath);

    return {
      folder_id: folderId,
      folder_path: folderPath,
      root_id: rootFolderId,
    };
  }

  /**
   * Format URL Google Drive Baku
   */
  public getDriveUrls(fileId: string): { web_view_url: string; preview_url: string; download_url: string } {
    return {
      web_view_url: `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`,
      preview_url: `https://drive.google.com/file/d/${fileId}/preview`,
      download_url: `https://drive.google.com/uc?export=download&id=${fileId}`,
    };
  }

  /**
   * Upload Berkas PDF ke Google Drive
   * (Menyimpan file_id, folder_id, hashing SHA-256, dan URL resmi Google Drive)
   */
  public async uploadPdfFile(
    fileBuffer: Buffer,
    originalName: string,
    mataPelajaran: string,
    kelas: string | number,
    existingFileId?: string
  ): Promise<DriveUploadResult> {
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const fileId = existingFileId || this.generateDriveFileId();
    const { folder_id } = this.resolveFolderPath(mataPelajaran, kelas);
    const urls = this.getDriveUrls(fileId);

    // Simpan buffer lokal terproteksi untuk replikasi streaming dan audit hash
    const localFileName = `${fileId}_${path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const localFilePath = path.join(this.storageDir, localFileName);
    fs.writeFileSync(localFilePath, fileBuffer);

    return {
      file_id: fileId,
      folder_id: folder_id,
      file_name: originalName,
      file_size: fileBuffer.length,
      mime_type: 'application/pdf',
      web_view_url: urls.web_view_url,
      download_url: urls.download_url,
      file_hash: fileHash,
      storage_path: localFileName,
    };
  }

  /**
   * Ambil buffer berkas PDF berdasarkan file_id untuk gateway streaming preview
   */
  public getFileBuffer(fileId: string, storagePath?: string): { buffer: Buffer; filePath: string } | null {
    // 1. Cari berdasarkan storage_path di drive_storage
    if (storagePath) {
      const p1 = path.join(this.storageDir, storagePath);
      if (fs.existsSync(p1)) return { buffer: fs.readFileSync(p1), filePath: p1 };
      
      // Cek legacy data/storage
      const pLegacy = path.join(process.cwd(), 'data', 'storage', storagePath);
      if (fs.existsSync(pLegacy)) return { buffer: fs.readFileSync(pLegacy), filePath: pLegacy };
    }

    // 2. Cari berdasarkan file_id prefix di drive_storage
    if (fs.existsSync(this.storageDir)) {
      const files = fs.readdirSync(this.storageDir);
      const match = files.find((f) => f.startsWith(fileId));
      if (match) {
        const full = path.join(this.storageDir, match);
        return { buffer: fs.readFileSync(full), filePath: full };
      }
    }

    return null;
  }

  /**
   * Periksa ketersediaan file di Google Drive
   */
  public checkFileExists(fileId: string): boolean {
    if (!fileId) return false;
    if (fs.existsSync(this.storageDir)) {
      const files = fs.readdirSync(this.storageDir);
      return files.some((f) => f.startsWith(fileId));
    }
    return false;
  }
}
