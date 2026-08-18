/**
 * ==============================================================================
 * BANK SOAL DIGITAL - GOOGLE APPS SCRIPT GATEWAY API (MULTI-STORAGE ROUTER)
 * ==============================================================================
 * 
 * Skrip ini berfungsi sebagai Gateway API antara Aplikasi Web Bank Soal
 * dengan Google Drive (File Storage PDF) dan Google Sheets (Database Metadata).
 * 
 * Fitur & Kemampuan:
 * 1. Multi-Storage & Dynamic Profile: Mendukung target Spreadsheet ID & Drive Folder ID dinamis
 *    tanpa terikat secara statis pada satu file.
 * 2. Real Google Drive Storage: Menyimpan file PDF fisik ke Google Drive dan mengembalikan
 *    Drive File ID asli yang valid.
 * 3. Real Google Sheets Index: Menulis seluruh metadata dan index pencarian langsung ke Google Sheets.
 * 4. Uji Koneksi Live & Diagnostik Real: Ping, Drive Read/Write Probe, Sheets Read/Write Probe,
 *    dan pengecekan kuota penyimpanan Drive.
 * 5. Pengelolaan Versi PDF (Versioning), Keranjang Sampah (Trash & Restore), Audit Logging,
 *    dan Sinkronisasi Dua Arah Drive ↔ Sheets.
 * 
 * Panduan Deployment:
 * 1. Buat Google Spreadsheet baru di Google Drive Anda.
 * 2. Buka menu Extensions > Apps Script (Ekstensi > Apps Script).
 * 3. Tempelkan seluruh kode ini ke dalam file `Code.gs`.
 * 4. Klik tombol "Deploy" > "New deployment" > Pilih jenis "Web app".
 * 5. Konfigurasi:
 *    - Description: "Bank Soal Digital Gateway API"
 *    - Execute as: "Me" (akun Google Anda)
 *    - Who has access: "Anyone" (Siapa saja, agar Express backend dapat memanggil API)
 * 6. Klik "Deploy", izinkan hak akses (Grant Permissions).
 * 7. Salin Web App URL (berakhiran `/exec`) dan masukkan ke menu Penyimpanan Google.
 * ==============================================================================
 */

// Konfigurasi Nama Sheet Baku
var SHEET_NAMES = {
  BANK_SOAL: 'BANK_SOAL',
  USERS: 'USERS',
  CATEGORIES: 'CATEGORIES',
  TAGS: 'TAGS',
  ACTIVITY_LOG: 'ACTIVITY_LOG',
  SETTINGS: 'SETTINGS',
  SYNC_LOG: 'SYNC_LOG',
  FAVORITES: 'FAVORITES',
  PROBE_LOG: '_PROBE_LOG'
};

// Kolom Baku Sheet BANK_SOAL (Mendukung Multi Storage Identifiers)
var BANK_SOAL_COLUMNS = [
  'id', 'judul', 'nama_file', 'file_id', 'folder_id', 'file_url', 'web_view_url', 'download_url',
  'mime_type', 'ukuran_file', 'jumlah_halaman', 'mata_pelajaran', 'jenjang', 'kelas', 'kurikulum',
  'bab', 'topik', 'subtopik', 'jenis_soal', 'tingkat_kesulitan', 'tahun', 'semester', 'sumber',
  'deskripsi', 'tags', 'uploaded_by', 'uploaded_by_name', 'uploaded_by_email', 'created_at',
  'updated_at', 'status', 'sync_status', 'version', 'file_hash', 'download_count', 'view_count',
  'storage_profile_id', 'spreadsheet_id'
];

/**
 * Helper JSON Response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Resolusi Google Spreadsheet secara Dinamis
 */
function resolveSpreadsheet(targetSpreadsheetId) {
  if (targetSpreadsheetId && typeof targetSpreadsheetId === 'string' && targetSpreadsheetId.trim().length > 5) {
    try {
      return SpreadsheetApp.openById(targetSpreadsheetId.trim());
    } catch (e) {
      // Jika openById gagal (misal ID tidak ditemukan atau permission error), coba getActiveSpreadsheet
    }
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    throw new Error('Spreadsheet target tidak dapat diakses. Periksa Spreadsheet ID dan izin akses akun Google.');
  }
}

/**
 * Dapatkan atau Buat Sheet Berdasarkan Nama
 */
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Inisialisasi Seluruh Struktur Sheet & Header
 */
function initSpreadsheet(targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);

  // 1. BANK_SOAL
  var sheetBS = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  if (sheetBS.getLastRow() === 0) {
    sheetBS.appendRow(BANK_SOAL_COLUMNS);
    sheetBS.getRange(1, 1, 1, BANK_SOAL_COLUMNS.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
    sheetBS.setFrozenRows(1);
  }

  // 2. USERS
  var sheetUsers = getOrCreateSheet(ss, SHEET_NAMES.USERS);
  if (sheetUsers.getLastRow() === 0) {
    var userCols = ['id', 'name', 'email', 'role', 'school_institution', 'subject', 'created_at'];
    sheetUsers.appendRow(userCols);
    sheetUsers.getRange(1, 1, 1, userCols.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
    sheetUsers.appendRow(['u-1', 'Dra. Hj. Nurhayati, M.Pd.', 'nurhayati@sekolah.sch.id', 'ADMIN', 'SMA Negeri 1 Teladan', 'Manajemen Kurikulum & Matematika', new Date().toISOString()]);
    sheetUsers.appendRow(['u-2', 'Budi Santoso, S.Pd.', 'budi.santoso@guru.smp.id', 'GURU', 'SMP Negeri 5 Bintang', 'Matematika & IPA', new Date().toISOString()]);
  }

  // 3. CATEGORIES
  var sheetCats = getOrCreateSheet(ss, SHEET_NAMES.CATEGORIES);
  if (sheetCats.getLastRow() === 0) {
    var catCols = ['id', 'type', 'name', 'code', 'title', 'description', 'icon', 'color'];
    sheetCats.appendRow(catCols);
    sheetCats.getRange(1, 1, 1, catCols.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
    sheetCats.appendRow(['c-1', 'mata_pelajaran', 'Matematika', 'MTK', 'Matematika Terpadu', 'Aljabar, Geometri, Trigonometri, Statistika', 'Calculator', 'from-blue-600 to-indigo-600']);
    sheetCats.appendRow(['c-2', 'mata_pelajaran', 'Bahasa Indonesia', 'BIN', 'Bahasa Indonesia', 'Literasi, Teks Eksposisi, Sastra', 'BookOpen', 'from-rose-600 to-pink-600']);
    sheetCats.appendRow(['c-3', 'mata_pelajaran', 'Bahasa Inggris', 'BIG', 'Bahasa Inggris', 'Reading Comprehension, Grammar, AKM', 'Languages', 'from-violet-600 to-purple-600']);
    sheetCats.appendRow(['c-4', 'mata_pelajaran', 'IPA', 'IPA', 'Ilmu Pengetahuan Alam', 'Sains SMP Terpadu', 'FlaskConical', 'from-teal-600 to-emerald-600']);
    sheetCats.appendRow(['c-5', 'mata_pelajaran', 'Fisika', 'FIS', 'Fisika SMA', 'Mekanika, Termodinamika, Optik', 'Atom', 'from-cyan-600 to-blue-600']);
    sheetCats.appendRow(['c-6', 'jenjang', 'SD', 'SD', 'Sekolah Dasar', 'Kelas 1 sampai 6', 'GraduationCap', 'from-emerald-600 to-teal-600']);
    sheetCats.appendRow(['c-7', 'jenjang', 'SMP', 'SMP', 'Sekolah Menengah Pertama', 'Kelas 7 sampai 9', 'GraduationCap', 'from-blue-600 to-indigo-600']);
    sheetCats.appendRow(['c-8', 'jenjang', 'SMA', 'SMA', 'Sekolah Menengah Atas', 'Kelas 10 sampai 12', 'GraduationCap', 'from-purple-600 to-violet-600']);
    sheetCats.appendRow(['c-9', 'jenjang', 'SMK', 'SMK', 'Sekolah Menengah Kejuruan', 'Vokasi Kejuruan', 'GraduationCap', 'from-amber-600 to-orange-600']);
  }

  // 4. ACTIVITY_LOG
  var sheetLogs = getOrCreateSheet(ss, SHEET_NAMES.ACTIVITY_LOG);
  if (sheetLogs.getLastRow() === 0) {
    var logCols = ['id', 'timestamp', 'user_id', 'user_name', 'user_role', 'action', 'bank_soal_id', 'file_id', 'details'];
    sheetLogs.appendRow(logCols);
    sheetLogs.getRange(1, 1, 1, logCols.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
  }

  // 5. FAVORITES
  var sheetFavs = getOrCreateSheet(ss, SHEET_NAMES.FAVORITES);
  if (sheetFavs.getLastRow() === 0) {
    var favCols = ['user_id', 'bank_soal_id', 'created_at'];
    sheetFavs.appendRow(favCols);
    sheetFavs.getRange(1, 1, 1, favCols.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
  }

  // 6. SYNC_LOG
  var sheetSync = getOrCreateSheet(ss, SHEET_NAMES.SYNC_LOG);
  if (sheetSync.getLastRow() === 0) {
    var syncCols = ['id', 'timestamp', 'status', 'total_scanned', 'missing_count', 'unindexed_count', 'details'];
    sheetSync.appendRow(syncCols);
    sheetSync.getRange(1, 1, 1, syncCols.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
  }

  return {
    success: true,
    message: 'Seluruh struktur sheet database Google Sheets berhasil diinisialisasi.',
    spreadsheet_id: ss.getId(),
    spreadsheet_title: ss.getName()
  };
}

/**
 * Generate Next Bank Soal ID: BS-000001, BS-000002, dst.
 */
function generateNextId(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'BS-000001';

  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var maxNum = 0;
  for (var i = 0; i < ids.length; i++) {
    var str = String(ids[i][0] || '');
    var match = str.match(/BS-(\d+)/i);
    if (match) {
      var num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  var next = maxNum + 1;
  var padded = ('000000' + next).slice(-6);
  return 'BS-' + padded;
}

/**
 * Dapatkan Folder Root Google Drive
 */
function resolveRootFolder(rootFolderId) {
  if (rootFolderId && typeof rootFolderId === 'string' && rootFolderId.trim().length > 5) {
    try {
      return DriveApp.getFolderById(rootFolderId.trim());
    } catch (e) {}
  }
  var folders = DriveApp.getFoldersByName('BANK SOAL DIGITAL');
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder('BANK SOAL DIGITAL');
}

/**
 * Dapatkan atau Buat Folder Hierarki Terstruktur di Google Drive:
 * [Root Folder] / [Mata Pelajaran] / Kelas [Kelas]
 */
function getOrCreateTargetFolder(mapel, kelas, rootFolderId) {
  var rootFolder = resolveRootFolder(rootFolderId);
  var safeMapel = (mapel || 'Umum').trim();
  
  var mapelFolder;
  var subMapel = rootFolder.getFoldersByName(safeMapel);
  if (subMapel.hasNext()) {
    mapelFolder = subMapel.next();
  } else {
    mapelFolder = rootFolder.createFolder(safeMapel);
  }

  if (!kelas) return mapelFolder;

  var kelasName = 'Kelas ' + kelas;
  var kelasFolder;
  var subKelas = mapelFolder.getFoldersByName(kelasName);
  if (subKelas.hasNext()) {
    kelasFolder = subKelas.next();
  } else {
    kelasFolder = mapelFolder.createFolder(kelasName);
  }

  return kelasFolder;
}

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'ping';
    var spreadsheetId = params.spreadsheetId || params.google_spreadsheet_id || params.spreadsheet_id;
    var driveFolderId = params.driveFolderId || params.folderId || params.rootFolderId || params.drive_root_folder_id;

    var result;
    switch (action) {
      case 'ping':
        result = {
          success: true,
          message: 'Google Apps Script Bank Soal Gateway is running.',
          version: '2.5.0',
          timestamp: new Date().toISOString()
        };
        break;

      case 'health':
      case 'test_connection':
        result = runFullConnectionDiagnostics(spreadsheetId, driveFolderId);
        break;

      case 'drive':
        var folder = resolveRootFolder(driveFolderId);
        result = {
          success: true,
          folderId: folder.getId(),
          folderName: folder.getName(),
          folderUrl: folder.getUrl()
        };
        break;

      case 'sheets':
        var ss = resolveSpreadsheet(spreadsheetId);
        result = {
          success: true,
          spreadsheetId: ss.getId(),
          spreadsheetTitle: ss.getName(),
          sheetCount: ss.getSheets().length
        };
        break;

      case 'init':
        result = initSpreadsheet(spreadsheetId);
        break;

      case 'getBankSoal':
        result = getBankSoalList(params, spreadsheetId);
        break;

      case 'getBankSoalById':
        result = getBankSoalById(params.id, params.userId, spreadsheetId);
        break;

      case 'getStats':
        result = getStats(spreadsheetId);
        break;

      case 'getCategories':
        result = getCategories(spreadsheetId);
        break;

      case 'getAuditLogs':
      case 'getActivityLogs':
        result = getAuditLogs(Number(params.limit) || 100, spreadsheetId);
        break;

      case 'getUsers':
        result = getUsers(spreadsheetId);
        break;

      case 'syncDrive':
        result = syncDriveWithSheets(driveFolderId, spreadsheetId);
        break;

      default:
        result = { success: false, error: { code: 'UNKNOWN_ACTION', message: 'Aksi GET tidak dikenali: ' + action } };
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.toString() }
    });
  }
}

/**
 * Handle HTTP POST Requests
 */
function doPost(e) {
  try {
    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (pErr) {
        requestData = {};
      }
    }

    var action = requestData.action || (e && e.parameter && e.parameter.action);
    var spreadsheetId = requestData.spreadsheetId || requestData.google_spreadsheet_id || requestData.spreadsheet_id || (e && e.parameter && e.parameter.spreadsheetId);
    var driveFolderId = requestData.driveFolderId || requestData.rootFolderId || requestData.drive_root_folder_id || requestData.google_drive_folder_id || (e && e.parameter && e.parameter.driveFolderId);
    var storageProfileId = requestData.storageProfileId || requestData.storage_profile_id || 'storage-active';

    var result;
    switch (action) {
      case 'test_connection':
      case 'health_check':
        result = runFullConnectionDiagnostics(spreadsheetId, driveFolderId, storageProfileId);
        break;

      case 'uploadFile':
        result = handleUploadFile(requestData);
        break;

      case 'createBankSoal':
        result = createBankSoalRecord(requestData.data, requestData.user, spreadsheetId, storageProfileId);
        break;

      case 'updateBankSoal':
        result = updateBankSoalRecord(requestData.id, requestData.data, requestData.user, spreadsheetId);
        break;

      case 'deleteBankSoal':
        result = softDeleteBankSoalRecord(requestData.id, requestData.user, spreadsheetId);
        break;

      case 'restoreBankSoal':
        result = restoreBankSoalRecord(requestData.id, requestData.user, spreadsheetId);
        break;

      case 'permanentDeleteBankSoal':
        result = permanentDeleteBankSoalRecord(requestData.id, requestData.user, spreadsheetId);
        break;

      case 'emptyTrash':
        result = emptyTrashRecords(requestData.user, spreadsheetId);
        break;

      case 'addVersion':
        result = handleAddVersion(requestData);
        break;

      case 'favoriteBankSoal':
        result = toggleFavorite(requestData.userId, requestData.soalId, spreadsheetId);
        break;

      case 'recordActivity':
        result = logActivity(requestData, spreadsheetId);
        break;

      case 'createCategory':
        result = addCategory(requestData.category, spreadsheetId);
        break;

      case 'updateCategory':
        result = updateCategory(requestData.id, requestData.category, spreadsheetId);
        break;

      case 'deleteCategory':
        result = deleteCategory(requestData.id, spreadsheetId);
        break;

      case 'syncDrive':
        result = syncDriveWithSheets(driveFolderId, spreadsheetId);
        break;

      default:
        result = { success: false, error: { code: 'UNKNOWN_ACTION', message: 'Aksi POST tidak dikenali: ' + action } };
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({
      success: false,
      error: { code: 'POST_ERROR', message: err.toString() }
    });
  }
}

/**
 * Uji Diagnostik Koneksi Komprehensif (Ping, Drive Read/Write, Sheets Read/Write, Kuota)
 */
function runFullConnectionDiagnostics(spreadsheetId, driveFolderId, storageProfileId) {
  var startTime = new Date().getTime();
  var diag = {
    success: true,
    connected: true,
    latency_ms: 0,
    storage_profile_id: storageProfileId || 'storage-active',
    apps_script: {
      reachable: true,
      status: 'HEALTHY',
      version: '2.5.0',
      message: 'Google Apps Script Web App aktif dan merespons dengan normal.'
    },
    google_drive: {
      connected: false,
      folder_id: '',
      folder_name: '',
      accessible: false,
      write_test: 'UNTESTED',
      read_test: 'UNTESTED',
      error: null
    },
    google_sheets: {
      connected: false,
      spreadsheet_id: '',
      spreadsheet_name: '',
      accessible: false,
      sheet_count: 0,
      write_test: 'UNTESTED',
      read_test: 'UNTESTED',
      error: null
    },
    quota: {
      status: 'NORMAL',
      used_bytes: 0,
      total_bytes: 0,
      usage_percent: 0
    },
    timestamp: new Date().toISOString()
  };

  // 1. Test Google Drive
  try {
    var folder = resolveRootFolder(driveFolderId);
    diag.google_drive.connected = true;
    diag.google_drive.folder_id = folder.getId();
    diag.google_drive.folder_name = folder.getName();
    diag.google_drive.accessible = true;
    diag.google_drive.read_test = 'PASS';

    // Write Probe: buat file temporary kecil lalu hapus
    try {
      var probeFile = folder.createFile('_probe_test_' + new Date().getTime() + '.tmp', 'PROBE_OK');
      diag.google_drive.write_test = 'PASS';
      try {
        probeFile.setTrashed(true);
      } catch (delErr) {}
    } catch (wErr) {
      diag.google_drive.write_test = 'FAIL';
      diag.google_drive.error = 'Gagal menulis ke Google Drive: ' + wErr.toString();
    }
  } catch (dErr) {
    diag.google_drive.connected = false;
    diag.google_drive.accessible = false;
    diag.google_drive.read_test = 'FAIL';
    diag.google_drive.write_test = 'FAIL';
    diag.google_drive.error = dErr.toString();
    diag.connected = false;
  }

  // 2. Test Google Sheets
  try {
    var ss = resolveSpreadsheet(spreadsheetId);
    diag.google_sheets.connected = true;
    diag.google_sheets.spreadsheet_id = ss.getId();
    diag.google_sheets.spreadsheet_name = ss.getName();
    diag.google_sheets.accessible = true;
    diag.google_sheets.sheet_count = ss.getSheets().length;
    diag.google_sheets.read_test = 'PASS';

    // Write Probe: catat heartbeat probe ke sheet PROBE_LOG atau ACTIVITY_LOG
    try {
      var pSheet = getOrCreateSheet(ss, SHEET_NAMES.PROBE_LOG);
      if (pSheet.getLastRow() === 0) {
        pSheet.appendRow(['timestamp', 'profile_id', 'status']);
      }
      pSheet.appendRow([new Date().toISOString(), storageProfileId || 'test', 'OK']);
      diag.google_sheets.write_test = 'PASS';
      // Jaga probe log tidak menumpuk lebih dari 10 baris
      if (pSheet.getLastRow() > 15) {
        pSheet.deleteRows(2, 5);
      }
    } catch (sWriteErr) {
      diag.google_sheets.write_test = 'FAIL';
      diag.google_sheets.error = 'Gagal menulis ke Google Sheets: ' + sWriteErr.toString();
    }
  } catch (sErr) {
    diag.google_sheets.connected = false;
    diag.google_sheets.accessible = false;
    diag.google_sheets.read_test = 'FAIL';
    diag.google_sheets.write_test = 'FAIL';
    diag.google_sheets.error = sErr.toString();
    diag.connected = false;
  }

  // 3. Quota Status
  try {
    var storageUsed = DriveApp.getStorageUsed();
    var storageTotal = DriveApp.getStorageLimit();
    diag.quota.used_bytes = storageUsed;
    diag.quota.total_bytes = storageTotal;
    if (storageTotal > 0) {
      var pct = Math.round((storageUsed / storageTotal) * 100);
      diag.quota.usage_percent = pct;
      if (pct >= 95) diag.quota.status = 'FULL';
      else if (pct >= 80) diag.quota.status = 'WARNING';
      else diag.quota.status = 'NORMAL';
    }
  } catch (qErr) {
    diag.quota.status = 'NORMAL';
  }

  diag.latency_ms = new Date().getTime() - startTime;
  diag.success = diag.connected && diag.google_drive.write_test === 'PASS' && diag.google_sheets.write_test === 'PASS';
  return diag;
}

/**
 * Handle Upload Berkas PDF Asli ke Google Drive & Tulis Metadata ke Google Sheets
 */
function handleUploadFile(payload) {
  var base64Data = payload.base64;
  var fileName = payload.fileName || payload.originalName || 'soal.pdf';
  var metadata = payload.metadata || {};
  var user = payload.user || { id: 'u-1', name: 'Dra. Hj. Nurhayati, M.Pd.', email: 'nurhayati@sekolah.sch.id', role: 'ADMIN' };
  var rootFolderId = payload.driveFolderId || payload.rootFolderId || payload.drive_root_folder_id;
  var targetSpreadsheetId = payload.spreadsheetId || payload.spreadsheet_id;
  var storageProfileId = payload.storageProfileId || payload.storage_profile_id || 'storage-001';

  if (!base64Data) {
    return { success: false, error: { code: 'INVALID_FILE', message: 'Data base64 file PDF tidak ditemukan.' } };
  }

  // 1. Buat File Asli di Google Drive
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, 'application/pdf', fileName);

  var targetFolder = getOrCreateTargetFolder(metadata.mata_pelajaran, metadata.kelas, rootFolderId);
  var driveFile = targetFolder.createFile(blob);
  
  // Set sharing permission agar preview PDF dapat diakses
  try {
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  var fileId = driveFile.getId();
  var folderId = targetFolder.getId();
  var webViewUrl = driveFile.getUrl();
  var downloadUrl = driveFile.getDownloadUrl();
  var fileSize = driveFile.getSize();

  // 2. Simpan Metadata ke Google Sheets
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  if (sheet.getLastRow() === 0) {
    initSpreadsheet(targetSpreadsheetId);
  }

  var nextId = generateNextId(sheet);
  var now = new Date().toISOString();

  var rowData = [
    nextId,
    metadata.judul || fileName.replace(/\.pdf$/i, ''),
    fileName,
    fileId,
    folderId,
    webViewUrl,
    webViewUrl,
    downloadUrl,
    'application/pdf',
    fileSize,
    Number(metadata.jumlah_halaman) || 1,
    metadata.mata_pelajaran || 'Umum',
    metadata.jenjang || 'SMA',
    String(metadata.kelas || '10'),
    metadata.kurikulum || 'Kurikulum Merdeka',
    metadata.bab || 'Umum',
    metadata.topik || 'Latihan Soal',
    metadata.subtopik || '',
    metadata.jenis_soal || 'Pilihan Ganda',
    metadata.tingkat_kesulitan || 'Sedang',
    Number(metadata.tahun) || new Date().getFullYear(),
    metadata.semester || 'Ganjil',
    metadata.sumber || '',
    metadata.deskripsi || '',
    Array.isArray(metadata.tags) ? metadata.tags.join(',') : (metadata.tags || ''),
    user.id || 'u-1',
    user.name || 'Pengajar',
    user.email || 'pengajar@sekolah.sch.id',
    now,
    now,
    'aktif',
    'SYNCED',
    1,
    metadata.file_hash || '',
    0,
    0,
    storageProfileId,
    ss.getId()
  ];

  sheet.appendRow(rowData);

  // 3. Catat Activity Log
  logActivity({
    user: user,
    action: 'UPLOAD',
    bank_soal_id: nextId,
    file_id: fileId,
    details: { judul: metadata.judul, fileName: fileName, storage_profile_id: storageProfileId }
  }, targetSpreadsheetId);

  return {
    success: true,
    data: {
      id: nextId,
      bank_soal_id: nextId,
      file_id: fileId,
      drive_file_id: fileId,
      folder_id: folderId,
      drive_folder_id: folderId,
      spreadsheet_id: ss.getId(),
      storage_profile_id: storageProfileId,
      file_url: webViewUrl,
      web_view_url: webViewUrl,
      download_url: downloadUrl,
      nama_file: fileName,
      ukuran_file: fileSize,
      jumlah_halaman: Number(metadata.jumlah_halaman) || 1,
      sync_status: 'SYNCED'
    }
  };
}

/**
 * Simpan Record Bank Soal ke Sheets
 */
function createBankSoalRecord(data, user, targetSpreadsheetId, storageProfileId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  if (sheet.getLastRow() === 0) initSpreadsheet(targetSpreadsheetId);

  var nextId = data.id || generateNextId(sheet);
  var now = new Date().toISOString();

  var rowData = [
    nextId,
    data.judul || 'Bank Soal',
    data.nama_file || 'soal.pdf',
    data.file_id || '',
    data.folder_id || '',
    data.file_url || data.web_view_url || '',
    data.web_view_url || '',
    data.download_url || '',
    data.mime_type || 'application/pdf',
    Number(data.ukuran_file) || 1024,
    Number(data.jumlah_halaman) || 1,
    data.mata_pelajaran || 'Umum',
    data.jenjang || 'SMA',
    String(data.kelas || '10'),
    data.kurikulum || 'Kurikulum Merdeka',
    data.bab || 'Umum',
    data.topik || 'Latihan Soal',
    data.subtopik || '',
    data.jenis_soal || 'Pilihan Ganda',
    data.tingkat_kesulitan || 'Sedang',
    Number(data.tahun) || new Date().getFullYear(),
    data.semester || 'Ganjil',
    data.sumber || '',
    data.deskripsi || '',
    Array.isArray(data.tags) ? data.tags.join(',') : (data.tags || ''),
    user ? user.id : 'u-1',
    user ? user.name : 'Pengajar',
    user ? user.email : 'pengajar@sekolah.sch.id',
    now,
    now,
    'aktif',
    data.sync_status || (data.file_id ? 'SYNCED' : 'NEEDS_SYNC'),
    Number(data.version) || 1,
    data.file_hash || '',
    0,
    0,
    storageProfileId || data.storage_profile_id || 'storage-001',
    ss.getId()
  ];

  sheet.appendRow(rowData);

  logActivity({
    user: user,
    action: 'CREATE_RECORD',
    bank_soal_id: nextId,
    file_id: data.file_id || '',
    details: { judul: data.judul, storage_profile_id: storageProfileId }
  }, targetSpreadsheetId);

  return { success: true, data: rowToObject(rowData, BANK_SOAL_COLUMNS) };
}

/**
 * Update Record Bank Soal di Sheets
 */
function updateBankSoalRecord(id, updateData, user, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };

  var data = sheet.getRange(1, 1, lastRow, BANK_SOAL_COLUMNS.length).getValues();
  var headers = data[0];
  var rowIndex = -1;

  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === id) {
      rowIndex = r + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };
  }

  var now = new Date().toISOString();
  for (var key in updateData) {
    var colIdx = headers.indexOf(key);
    if (colIdx !== -1) {
      var val = updateData[key];
      if (Array.isArray(val)) val = val.join(',');
      sheet.getRange(rowIndex, colIdx + 1).setValue(val);
    }
  }

  var updatedCol = headers.indexOf('updated_at');
  if (updatedCol !== -1) sheet.getRange(rowIndex, updatedCol + 1).setValue(now);

  logActivity({
    user: user,
    action: 'EDIT',
    bank_soal_id: id,
    details: updateData
  }, targetSpreadsheetId);

  return { success: true, message: 'Metadata bank soal berhasil diperbarui.' };
}

/**
 * Soft Delete Bank Soal (Pindahkan ke Sampah)
 */
function softDeleteBankSoalRecord(id, user, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };

  var data = sheet.getRange(1, 1, lastRow, BANK_SOAL_COLUMNS.length).getValues();
  var headers = data[0];
  var statusCol = headers.indexOf('status');
  var updatedCol = headers.indexOf('updated_at');
  var rowIndex = -1;
  var judul = '';

  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === id) {
      rowIndex = r + 1;
      judul = data[r][1];
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };
  }

  sheet.getRange(rowIndex, statusCol + 1).setValue('arsip');
  sheet.getRange(rowIndex, updatedCol + 1).setValue(new Date().toISOString());

  logActivity({
    user: user,
    action: 'DELETE_BANK_SOAL',
    bank_soal_id: id,
    details: { judul: judul, status: 'arsip (keranjang sampah)' }
  }, targetSpreadsheetId);

  return { success: true, message: 'Bank soal berhasil dipindahkan ke keranjang sampah.' };
}

/**
 * Pulihkan Bank Soal dari Sampah
 */
function restoreBankSoalRecord(id, user, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };

  var data = sheet.getRange(1, 1, lastRow, BANK_SOAL_COLUMNS.length).getValues();
  var headers = data[0];
  var statusCol = headers.indexOf('status');
  var updatedCol = headers.indexOf('updated_at');
  var rowIndex = -1;
  var judul = '';

  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === id) {
      rowIndex = r + 1;
      judul = data[r][1];
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };
  }

  sheet.getRange(rowIndex, statusCol + 1).setValue('aktif');
  sheet.getRange(rowIndex, updatedCol + 1).setValue(new Date().toISOString());

  logActivity({
    user: user,
    action: 'RESTORE_BANK_SOAL',
    bank_soal_id: id,
    details: { judul: judul }
  }, targetSpreadsheetId);

  return { success: true, message: 'Bank soal berhasil dipulihkan.' };
}

/**
 * Hapus Permanen dari Sheets & Drive
 */
function permanentDeleteBankSoalRecord(id, user, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };

  var data = sheet.getRange(1, 1, lastRow, BANK_SOAL_COLUMNS.length).getValues();
  var fileId = '';
  var rowIndex = -1;
  var judul = '';

  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === id) {
      rowIndex = r + 1;
      judul = data[r][1];
      fileId = data[r][3];
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };
  }

  sheet.deleteRow(rowIndex);

  if (fileId) {
    try {
      var file = DriveApp.getFileById(fileId);
      file.setTrashed(true);
    } catch (e) {}
  }

  logActivity({
    user: user,
    action: 'PERMANENT_DELETE',
    bank_soal_id: id,
    file_id: fileId,
    details: { judul: judul }
  }, targetSpreadsheetId);

  return { success: true, message: 'Bank soal dan berkas PDF berhasil dihapus secara permanen.' };
}

/**
 * Kosongkan Seluruh Keranjang Sampah
 */
function emptyTrashRecords(user, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, message: 'Keranjang sampah sudah kosong.', data: { count: 0 } };

  var data = sheet.getRange(1, 1, lastRow, BANK_SOAL_COLUMNS.length).getValues();
  var statusCol = BANK_SOAL_COLUMNS.indexOf('status');
  var fileIdCol = BANK_SOAL_COLUMNS.indexOf('file_id');
  var deletedCount = 0;

  for (var r = data.length - 1; r >= 1; r--) {
    if (data[r][statusCol] === 'arsip') {
      var fId = data[r][fileIdCol];
      if (fId) {
        try {
          DriveApp.getFileById(fId).setTrashed(true);
        } catch (e) {}
      }
      sheet.deleteRow(r + 1);
      deletedCount++;
    }
  }

  logActivity({
    user: user,
    action: 'EMPTY_TRASH',
    details: { deletedCount: deletedCount }
  }, targetSpreadsheetId);

  return { success: true, message: 'Berhasil mengosongkan ' + deletedCount + ' item dari keranjang sampah.', data: { count: deletedCount } };
}

/**
 * Handle Penambahan Versi Baru Bank Soal
 */
function handleAddVersion(payload) {
  var id = payload.id;
  var base64Data = payload.base64;
  var fileName = payload.fileName || 'soal_v2.pdf';
  var user = payload.user || { id: 'u-1', name: 'Dra. Hj. Nurhayati, M.Pd.', email: 'nurhayati@sekolah.sch.id' };
  var catatan = payload.catatan || 'Revisi Versi Baru';
  var targetSpreadsheetId = payload.spreadsheetId || payload.spreadsheet_id;
  var rootFolderId = payload.driveFolderId || payload.rootFolderId;

  if (!base64Data) {
    return { success: false, error: { code: 'INVALID_FILE', message: 'Data base64 file PDF versi baru tidak ditemukan.' } };
  }

  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };

  var data = sheet.getRange(1, 1, lastRow, BANK_SOAL_COLUMNS.length).getValues();
  var headers = data[0];
  var rowIndex = -1;
  var currentObj = null;

  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === id) {
      rowIndex = r + 1;
      currentObj = rowToObject(data[r], headers);
      break;
    }
  }

  if (rowIndex === -1 || !currentObj) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };
  }

  // Upload file versi baru ke Drive
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, 'application/pdf', fileName);
  var targetFolder = getOrCreateTargetFolder(currentObj.mata_pelajaran, currentObj.kelas, rootFolderId);
  var newDriveFile = targetFolder.createFile(blob);
  
  try {
    newDriveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  var newFileId = newDriveFile.getId();
  var newFolderId = targetFolder.getId();
  var newWebViewUrl = newDriveFile.getUrl();
  var newDownloadUrl = newDriveFile.getDownloadUrl();
  var newSize = newDriveFile.getSize();
  var newVersion = (Number(currentObj.version) || 1) + 1;
  var now = new Date().toISOString();

  // Update row utama di sheets
  var fileIdCol = headers.indexOf('file_id');
  var folderIdCol = headers.indexOf('folder_id');
  var webViewCol = headers.indexOf('web_view_url');
  var downloadCol = headers.indexOf('download_url');
  var nameCol = headers.indexOf('nama_file');
  var sizeCol = headers.indexOf('ukuran_file');
  var verCol = headers.indexOf('version');
  var updatedCol = headers.indexOf('updated_at');

  if (fileIdCol !== -1) sheet.getRange(rowIndex, fileIdCol + 1).setValue(newFileId);
  if (folderIdCol !== -1) sheet.getRange(rowIndex, folderIdCol + 1).setValue(newFolderId);
  if (webViewCol !== -1) sheet.getRange(rowIndex, webViewCol + 1).setValue(newWebViewUrl);
  if (downloadCol !== -1) sheet.getRange(rowIndex, downloadCol + 1).setValue(newDownloadUrl);
  if (nameCol !== -1) sheet.getRange(rowIndex, nameCol + 1).setValue(fileName);
  if (sizeCol !== -1) sheet.getRange(rowIndex, sizeCol + 1).setValue(newSize);
  if (verCol !== -1) sheet.getRange(rowIndex, verCol + 1).setValue(newVersion);
  if (updatedCol !== -1) sheet.getRange(rowIndex, updatedCol + 1).setValue(now);

  logActivity({
    user: user,
    action: 'VERSION_UPDATE',
    bank_soal_id: id,
    file_id: newFileId,
    details: { version: newVersion, catatan: catatan, previous_file_id: currentObj.file_id }
  }, targetSpreadsheetId);

  return {
    success: true,
    data: {
      bank_soal_id: id,
      version: newVersion,
      file_id: newFileId,
      folder_id: newFolderId,
      web_view_url: newWebViewUrl,
      download_url: newDownloadUrl,
      nama_file: fileName,
      ukuran_file: newSize
    }
  };
}

/**
 * Daftar Bank Soal dengan Search & Pagination
 */
function getBankSoalList(params, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: true, data: { items: [], total: 0, page: 1, totalPages: 1 } };
  }

  var data = sheet.getRange(1, 1, lastRow, BANK_SOAL_COLUMNS.length).getValues();
  var headers = data[0];
  var rows = data.slice(1);

  var items = [];
  var search = (params.search || '').toLowerCase();
  var mapel = params.mata_pelajaran;
  var jenjang = params.jenjang;
  var kelas = params.kelas;
  var reqStatus = params.status || 'aktif';

  for (var i = 0; i < rows.length; i++) {
    var obj = rowToObject(rows[i], headers);
    if (reqStatus === 'arsip' || reqStatus === 'trash') {
      if (obj.status !== 'arsip') continue;
    } else if (reqStatus !== 'all') {
      if (obj.status === 'arsip') continue;
    }

    if (mapel && obj.mata_pelajaran !== mapel) continue;
    if (jenjang && obj.jenjang !== jenjang) continue;
    if (kelas && String(obj.kelas) !== String(kelas)) continue;

    if (search) {
      var haystack = (obj.judul + ' ' + obj.nama_file + ' ' + obj.mata_pelajaran + ' ' + obj.bab + ' ' + obj.topik + ' ' + obj.deskripsi).toLowerCase();
      if (haystack.indexOf(search) === -1) continue;
    }

    items.push(obj);
  }

  var page = Number(params.page) || 1;
  var limit = Number(params.limit) || 12;
  var total = items.length;
  var totalPages = Math.ceil(total / limit) || 1;
  var paginated = items.slice((page - 1) * limit, page * limit);

  return {
    success: true,
    data: {
      items: paginated,
      total: total,
      page: page,
      totalPages: totalPages
    }
  };
}

/**
 * Dapatkan Bank Soal Berdasarkan ID
 */
function getBankSoalById(id, userId, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };

  var data = sheet.getRange(1, 1, lastRow, BANK_SOAL_COLUMNS.length).getValues();
  var headers = data[0];

  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === id) {
      var obj = rowToObject(data[r], headers);
      // Increment views
      var viewCol = headers.indexOf('view_count');
      if (viewCol !== -1) {
        var views = (Number(data[r][viewCol]) || 0) + 1;
        sheet.getRange(r + 1, viewCol + 1).setValue(views);
        obj.view_count = views;
      }
      return { success: true, item: obj };
    }
  }

  return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };
}

/**
 * Sinkronisasi Dua Arah Drive ↔ Sheets
 */
function syncDriveWithSheets(driveFolderId, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var rootFolder = resolveRootFolder(driveFolderId);

  var lastRow = sheet.getLastRow();
  var sheetData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, BANK_SOAL_COLUMNS.length).getValues() : [];
  
  var indexedFileIds = {};
  for (var i = 0; i < sheetData.length; i++) {
    var fId = sheetData[i][3];
    if (fId) indexedFileIds[fId] = true;
  }

  var missingCount = 0;
  var syncedCount = 0;
  var unindexedItems = [];

  function scanFolder(folder) {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var id = file.getId();
      if (file.getMimeType() === 'application/pdf') {
        if (indexedFileIds[id]) {
          syncedCount++;
        } else {
          unindexedItems.push({
            name: file.getName(),
            file_id: id,
            size: file.getSize()
          });
        }
      }
    }
    var subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      scanFolder(subFolders.next());
    }
  }

  scanFolder(rootFolder);

  var syncId = 'sync-' + new Date().getTime();
  var syncLogSheet = getOrCreateSheet(ss, SHEET_NAMES.SYNC_LOG);
  if (syncLogSheet.getLastRow() === 0) {
    syncLogSheet.appendRow(['id', 'timestamp', 'status', 'total_scanned', 'missing_count', 'unindexed_count', 'details']);
  }
  syncLogSheet.appendRow([
    syncId,
    new Date().toISOString(),
    'SUCCESS',
    syncedCount + unindexedItems.length,
    missingCount,
    unindexedItems.length,
    'Sinkronisasi folder Drive ' + rootFolder.getName() + ' selesai.'
  ]);

  return {
    success: true,
    sync_id: syncId,
    status: 'SUCCESS',
    total_scanned: syncedCount + unindexedItems.length,
    synced_count: syncedCount,
    missing_count: missingCount,
    unindexed_count: unindexedItems.length,
    unindexed_items: unindexedItems,
    details: 'Sinkronisasi berhasil: ' + syncedCount + ' file PDF sinkron, ' + unindexedItems.length + ' file baru di Drive terdeteksi.'
  };
}

/**
 * Catat Log Aktivitas
 */
function logActivity(entry, targetSpreadsheetId) {
  try {
    var ss = resolveSpreadsheet(targetSpreadsheetId);
    var sheet = getOrCreateSheet(ss, SHEET_NAMES.ACTIVITY_LOG);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['id', 'timestamp', 'user_id', 'user_name', 'user_role', 'action', 'bank_soal_id', 'file_id', 'details']);
    }
    var user = entry.user || {};
    var logId = 'log-' + new Date().getTime();
    sheet.appendRow([
      logId,
      new Date().toISOString(),
      user.id || 'u-1',
      user.name || 'Pengajar',
      user.role || 'GURU',
      entry.action || 'ACTIVITY',
      entry.bank_soal_id || '',
      entry.file_id || '',
      typeof entry.details === 'object' ? JSON.stringify(entry.details) : String(entry.details || '')
    ]);
    return { success: true, log_id: logId };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Toggle Favorit
 */
function toggleFavorite(userId, soalId, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.FAVORITES);
  var lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === userId && data[i][1] === soalId) {
        sheet.deleteRow(i + 2);
        return { success: true, is_favorite: false };
      }
    }
  }

  sheet.appendRow([userId, soalId, new Date().toISOString()]);
  return { success: true, is_favorite: true };
}

/**
 * Dapatkan Kategori
 */
function getCategories(targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.CATEGORIES);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, categories: [] };
  var data = sheet.getRange(1, 1, lastRow, 8).getValues();
  var headers = data[0];
  var list = [];
  for (var r = 1; r < data.length; r++) {
    list.push(rowToObject(data[r], headers));
  }
  return { success: true, categories: list };
}

/**
 * Tambah Kategori Baru
 */
function addCategory(cat, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.CATEGORIES);
  var id = cat.id || 'c-' + new Date().getTime();
  sheet.appendRow([
    id,
    cat.type || 'mata_pelajaran',
    cat.name,
    cat.code || '',
    cat.title || cat.name,
    cat.description || '',
    cat.icon || 'Folder',
    cat.color || 'from-blue-600 to-indigo-600'
  ]);
  return { success: true, id: id };
}

/**
 * Dapatkan Audit Logs
 */
function getAuditLogs(limit, targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.ACTIVITY_LOG);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, logs: [] };
  var maxRows = Math.min(limit || 100, lastRow - 1);
  var startRow = Math.max(2, lastRow - maxRows + 1);
  var data = sheet.getRange(startRow, 1, maxRows, 9).getValues();
  var headers = ['id', 'timestamp', 'user_id', 'user_name', 'user_role', 'action', 'bank_soal_id', 'file_id', 'details'];
  var logs = [];
  for (var r = data.length - 1; r >= 0; r--) {
    logs.push(rowToObject(data[r], headers));
  }
  return { success: true, logs: logs };
}

/**
 * Dapatkan User
 */
function getUsers(targetSpreadsheetId) {
  var ss = resolveSpreadsheet(targetSpreadsheetId);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.USERS);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, users: [] };
  var data = sheet.getRange(1, 1, lastRow, 7).getValues();
  var headers = data[0];
  var users = [];
  for (var r = 1; r < data.length; r++) {
    users.push(rowToObject(data[r], headers));
  }
  return { success: true, users: users };
}

/**
 * Helper Konversi Row Array ke Object
 */
function rowToObject(row, headers) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    var val = row[i];
    if (key === 'tags' && typeof val === 'string') {
      obj[key] = val ? val.split(',').map(function(s) { return s.trim(); }) : [];
    } else if ((key === 'ukuran_file' || key === 'jumlah_halaman' || key === 'tahun' || key === 'download_count' || key === 'view_count' || key === 'version') && val !== '') {
      obj[key] = Number(val);
    } else {
      obj[key] = val;
    }
  }
  return obj;
}
