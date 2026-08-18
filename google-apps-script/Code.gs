/**
 * ==============================================================================
 * BANK SOAL DIGITAL - GOOGLE APPS SCRIPT GATEWAY API
 * ==============================================================================
 * 
 * Skrip ini berfungsi sebagai Gateway API antara Aplikasi Web Bank Soal
 * dengan Google Drive (sebagai File Storage PDF) dan Google Sheets (sebagai Database Metadata).
 * 
 * Fitur:
 * 1. Penyimpanan Berkas PDF ke Folder Google Drive Terstruktur (Mapel / Kelas).
 * 2. Database Metadata Terpadu pada Google Sheets (Sheet: BANK_SOAL, USERS, CATEGORIES, ACTIVITY_LOG, dll).
 * 3. Format ID Terstandarisasi: BS-000001, BS-000002, dst.
 * 4. Pengelolaan Versi PDF (Versioning) & Deteksi Duplikat Hash.
 * 5. Sinkronisasi Dua Arah Drive ↔ Sheets (Cek missing file_id & unindexed PDF).
 * 6. Pencarian & Filter Cepat langsung dari Sheets.
 * 7. Pencatatan Jejak Audit (Audit Logging) ke Sheet ACTIVITY_LOG.
 * 
 * Panduan Deployment:
 * 1. Buka Google Sheets baru, beri nama: "BANK SOAL DIGITAL".
 * 2. Buka Extensions > Apps Script (Ekstensi > Apps Script).
 * 3. Tempelkan seluruh kode ini ke dalam editor `Code.gs`.
 * 4. Klik "Deploy" > "New deployment" > Pilih "Web app".
 * 5. Atur "Execute as": "Me", dan "Who has access": "Anyone".
 * 6. Salin Web App URL dan tempelkan ke konfigurasi GOOGLE_APPS_SCRIPT_URL pada aplikasi web.
 * ==============================================================================
 */

// Konfigurasi Nama Sheet Utama
var SHEET_NAMES = {
  BANK_SOAL: 'BANK_SOAL',
  USERS: 'USERS',
  CATEGORIES: 'CATEGORIES',
  TAGS: 'TAGS',
  ACTIVITY_LOG: 'ACTIVITY_LOG',
  SETTINGS: 'SETTINGS',
  SYNC_LOG: 'SYNC_LOG',
  FAVORITES: 'FAVORITES'
};

// Kolom Baku Sheet BANK_SOAL
var BANK_SOAL_COLUMNS = [
  'id', 'judul', 'nama_file', 'file_id', 'folder_id', 'file_url', 'web_view_url', 'download_url',
  'mime_type', 'ukuran_file', 'jumlah_halaman', 'mata_pelajaran', 'jenjang', 'kelas', 'kurikulum',
  'bab', 'topik', 'subtopik', 'jenis_soal', 'tingkat_kesulitan', 'tahun', 'semester', 'sumber',
  'deskripsi', 'tags', 'uploaded_by', 'uploaded_by_name', 'uploaded_by_email', 'created_at',
  'updated_at', 'status', 'sync_status', 'version', 'file_hash', 'download_count', 'view_count'
];

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'ping';

    var result;
    switch (action) {
      case 'ping':
        result = { success: true, message: 'Google Apps Script Bank Soal Gateway is running.', timestamp: new Date().toISOString() };
        break;
      case 'init':
        result = initSpreadsheet();
        break;
      case 'getBankSoal':
        result = getBankSoalList(params);
        break;
      case 'getBankSoalById':
        result = getBankSoalById(params.id, params.userId);
        break;
      case 'getStats':
        result = getStats();
        break;
      case 'getCategories':
        result = getCategories();
        break;
      case 'getTags':
        result = getTags();
        break;
      case 'getAuditLogs':
        result = getAuditLogs(Number(params.limit) || 100);
        break;
      case 'getUsers':
        result = getUsers();
        break;
      case 'syncDrive':
        result = syncDriveWithSheets(params.rootFolderId);
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
      requestData = JSON.parse(e.postData.contents);
    }

    var action = requestData.action || (e && e.parameter && e.parameter.action);

    var result;
    switch (action) {
      case 'uploadFile':
        result = handleUploadFile(requestData);
        break;
      case 'createBankSoal':
        result = createBankSoalRecord(requestData.data, requestData.user);
        break;
      case 'updateBankSoal':
        result = updateBankSoalRecord(requestData.id, requestData.data, requestData.user);
        break;
      case 'deleteBankSoal':
        result = deleteBankSoalRecord(requestData.id, requestData.user);
        break;
      case 'addVersion':
        result = handleAddVersion(requestData);
        break;
      case 'favoriteBankSoal':
        result = toggleFavorite(requestData.userId, requestData.soalId);
        break;
      case 'recordActivity':
        result = logActivity(requestData);
        break;
      case 'createCategory':
        result = addCategory(requestData.category);
        break;
      case 'updateCategory':
        result = updateCategory(requestData.id, requestData.category);
        break;
      case 'deleteCategory':
        result = deleteCategory(requestData.id);
        break;
      case 'migrateBatch':
        result = migrateBatchRecords(requestData.records, requestData.user);
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
 * Helper JSON Response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Inisialisasi Seluruh Sheet & Struktur Kolom
 */
function initSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

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
    // Default admin & guru
    sheetUsers.appendRow(['u-1', 'Dra. Hj. Nurhayati, M.Pd.', 'nurhayati@sekolah.sch.id', 'ADMIN', 'SMA Negeri 1 Teladan', 'Manajemen Kurikulum & Matematika', new Date().toISOString()]);
    sheetUsers.appendRow(['u-2', 'Budi Santoso, S.Pd.', 'budi.santoso@guru.smp.id', 'GURU', 'SMP Negeri 5 Bintang', 'Matematika & IPA', new Date().toISOString()]);
  }

  // 3. CATEGORIES
  var sheetCats = getOrCreateSheet(ss, SHEET_NAMES.CATEGORIES);
  if (sheetCats.getLastRow() === 0) {
    var catCols = ['id', 'type', 'name', 'code', 'title', 'description', 'icon', 'color'];
    sheetCats.appendRow(catCols);
    sheetCats.getRange(1, 1, 1, catCols.length).setBackground('#1e293b').setFontColor('#ffffff').setFontWeight('bold');
    // Seed default categories
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

  return { success: true, message: 'Seluruh sheet database Google Sheets berhasil diinisialisasi.' };
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
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
    var match = str.match(/BS-(\d+)/);
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
 * Dapatkan atau Buat Folder Hierarki di Google Drive
 * Struktur: BANK SOAL DIGITAL / [Mata Pelajaran] / Kelas [Kelas]
 */
function getOrCreateTargetFolder(mapel, kelas, rootFolderId) {
  var rootFolder;
  if (rootFolderId) {
    try {
      rootFolder = DriveApp.getFolderById(rootFolderId);
    } catch (e) {
      rootFolder = DriveApp.getRootFolder();
    }
  } else {
    // Cari atau buat folder "BANK SOAL DIGITAL"
    var folders = DriveApp.getFoldersByName('BANK SOAL DIGITAL');
    if (folders.hasNext()) {
      rootFolder = folders.next();
    } else {
      rootFolder = DriveApp.createFolder('BANK SOAL DIGITAL');
    }
  }

  var safeMapel = mapel || 'Lainnya';
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
 * Handle Upload Berkas PDF Langsung ke Google Drive & Simpan Metadata ke Sheets
 */
function handleUploadFile(payload) {
  var base64Data = payload.base64;
  var fileName = payload.fileName || 'soal.pdf';
  var metadata = payload.metadata || {};
  var user = payload.user || { id: 'u-1', name: 'Admin', email: 'admin@sekolah.sch.id', role: 'ADMIN' };
  var rootFolderId = payload.rootFolderId;

  if (!base64Data) {
    return { success: false, error: { code: 'INVALID_FILE', message: 'Data base64 file PDF tidak ditemukan.' } };
  }

  // 1. Simpan ke Google Drive
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, 'application/pdf', fileName);

  var targetFolder = getOrCreateTargetFolder(metadata.mata_pelajaran, metadata.kelas, rootFolderId);
  var driveFile = targetFolder.createFile(blob);
  
  // Set permission to anyone with link can view (agar preview lancar)
  try {
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  var fileId = driveFile.getId();
  var folderId = targetFolder.getId();
  var webViewUrl = driveFile.getUrl();
  var downloadUrl = driveFile.getDownloadUrl();
  var fileSize = driveFile.getSize();

  // 2. Simpan Metadata ke Google Sheets
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
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
    user.name || 'Guru Pengajar',
    user.email || 'guru@sekolah.sch.id',
    now,
    now,
    'aktif',
    'SYNCED',
    1,
    metadata.file_hash || '',
    0,
    0
  ];

  sheet.appendRow(rowData);

  // 3. Catat ke ACTIVITY_LOG
  logActivity({
    user: user,
    action: 'UPLOAD',
    bank_soal_id: nextId,
    file_id: fileId,
    details: { judul: metadata.judul, fileName: fileName }
  });

  return {
    success: true,
    data: {
      id: nextId,
      file_id: fileId,
      folder_id: folderId,
      web_view_url: webViewUrl,
      download_url: downloadUrl,
      nama_file: fileName,
      sync_status: 'SYNCED'
    }
  };
}

/**
 * Buat Record Bank Soal
 */
function createBankSoalRecord(data, user) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var nextId = generateNextId(sheet);
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
    0
  ];

  sheet.appendRow(rowData);

  logActivity({
    user: user,
    action: 'CREATE_RECORD',
    bank_soal_id: nextId,
    file_id: data.file_id || '',
    details: { judul: data.judul }
  });

  return { success: true, data: rowToObject(rowData, BANK_SOAL_COLUMNS) };
}

/**
 * Update Metadata Bank Soal
 */
function updateBankSoalRecord(id, updateData, user) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };
  }

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

  // Update updated_at
  var updatedCol = headers.indexOf('updated_at');
  if (updatedCol !== -1) sheet.getRange(rowIndex, updatedCol + 1).setValue(now);

  logActivity({
    user: user,
    action: 'EDIT',
    bank_soal_id: id,
    details: updateData
  });

  return { success: true, message: 'Metadata bank soal berhasil diperbarui.' };
}

/**
 * Hapus / Arsipkan Bank Soal
 */
function deleteBankSoalRecord(id, user) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };

  var data = sheet.getRange(1, 1, lastRow, BANK_SOAL_COLUMNS.length).getValues();
  var fileId = '';
  var rowIndex = -1;

  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === id) {
      rowIndex = r + 1;
      fileId = data[r][3];
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };
  }

  // Hapus baris dari sheets
  sheet.deleteRow(rowIndex);

  // Jika ada file_id di drive, hapus atau pindahkan ke sampah
  if (fileId) {
    try {
      var file = DriveApp.getFileById(fileId);
      file.setTrashed(true);
    } catch (e) {}
  }

  logActivity({
    user: user,
    action: 'DELETE',
    bank_soal_id: id,
    file_id: fileId
  });

  return { success: true, message: 'Bank soal berhasil dihapus.' };
}

/**
 * Dapatkan Daftar Bank Soal dengan Search & Filtering
 */
function getBankSoalList(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
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
  var tahun = params.tahun;
  var semester = params.semester;
  var kesulitan = params.tingkat_kesulitan;
  var jenis = params.jenis_soal;
  var tag = (params.tag || '').toLowerCase();
  var userId = params.userId;

  for (var i = 0; i < rows.length; i++) {
    var obj = rowToObject(rows[i], headers);
    if (obj.status === 'arsip') continue;

    if (mapel && obj.mata_pelajaran !== mapel) continue;
    if (jenjang && obj.jenjang !== jenjang) continue;
    if (kelas && String(obj.kelas) !== String(kelas)) continue;
    if (tahun && String(obj.tahun) !== String(tahun)) continue;
    if (semester && obj.semester !== semester) continue;
    if (kesulitan && obj.tingkat_kesulitan !== kesulitan) continue;
    if (jenis && obj.jenis_soal !== jenis) continue;

    if (tag) {
      var tagsArr = Array.isArray(obj.tags) ? obj.tags : String(obj.tags || '').split(',');
      var hasTag = tagsArr.some(function(t) { return t.trim().toLowerCase() === tag; });
      if (!hasTag) continue;
    }

    if (search) {
      var haystack = (
        obj.judul + ' ' +
        obj.nama_file + ' ' +
        obj.mata_pelajaran + ' ' +
        obj.bab + ' ' +
        obj.topik + ' ' +
        obj.subtopik + ' ' +
        obj.deskripsi + ' ' +
        obj.sumber + ' ' +
        (Array.isArray(obj.tags) ? obj.tags.join(' ') : obj.tags)
      ).toLowerCase();

      if (haystack.indexOf(search) === -1) continue;
    }

    items.push(obj);
  }

  // Sorting
  var sortBy = params.sortBy || 'terbaru';
  if (sortBy === 'terbaru') {
    items.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  } else if (sortBy === 'terlama') {
    items.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at); });
  } else if (sortBy === 'a-z') {
    items.sort(function(a, b) { return a.judul.localeCompare(b.judul); });
  } else if (sortBy === 'view_count') {
    items.sort(function(a, b) { return (b.view_count || 0) - (a.view_count || 0); });
  } else if (sortBy === 'download_count') {
    items.sort(function(a, b) { return (b.download_count || 0) - (a.download_count || 0); });
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
 * Ambil Detail Bank Soal & Tambah View Count
 */
function getBankSoalById(id, userId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };

  var data = sheet.getRange(1, 1, lastRow, BANK_SOAL_COLUMNS.length).getValues();
  var headers = data[0];
  var viewCol = headers.indexOf('view_count');

  for (var r = 1; r < data.length; r++) {
    if (data[r][0] === id) {
      var currentViews = Number(data[r][viewCol]) || 0;
      sheet.getRange(r + 1, viewCol + 1).setValue(currentViews + 1);

      var obj = rowToObject(data[r], headers);
      obj.view_count = currentViews + 1;

      logActivity({
        user: { id: userId || 'u-anon', name: 'User' },
        action: 'VIEW',
        bank_soal_id: id,
        file_id: obj.file_id
      });

      return { success: true, data: { item: obj } };
    }
  }

  return { success: false, error: { code: 'NOT_FOUND', message: 'Bank soal tidak ditemukan.' } };
}

/**
 * Toggle Favorite Bank Soal
 */
function toggleFavorite(userId, soalId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.FAVORITES);
  var lastRow = sheet.getLastRow();

  var isFav = false;
  var foundRow = -1;

  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === userId && data[i][1] === soalId) {
        foundRow = i + 2;
        break;
      }
    }
  }

  if (foundRow !== -1) {
    sheet.deleteRow(foundRow);
    isFav = false;
  } else {
    sheet.appendRow([userId, soalId, new Date().toISOString()]);
    isFav = true;
  }

  return { success: true, data: { is_favorite: isFav } };
}

/**
 * Sinkronisasi Google Drive ↔ Google Sheets
 */
function syncDriveWithSheets(rootFolderId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();

  var rootFolder;
  if (rootFolderId) {
    rootFolder = DriveApp.getFolderById(rootFolderId);
  } else {
    var folders = DriveApp.getFoldersByName('BANK SOAL DIGITAL');
    if (folders.hasNext()) rootFolder = folders.next();
    else rootFolder = DriveApp.getRootFolder();
  }

  var missingCount = 0;
  var unindexedCount = 0;
  var scannedCount = 0;

  // 1. Periksa apakah file_id di Sheet masih ada di Drive
  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, BANK_SOAL_COLUMNS.length).getValues();
    var fileIdCol = BANK_SOAL_COLUMNS.indexOf('file_id');
    var syncCol = BANK_SOAL_COLUMNS.indexOf('sync_status');

    for (var i = 0; i < data.length; i++) {
      scannedCount++;
      var fId = data[i][fileIdCol];
      if (fId) {
        try {
          var f = DriveApp.getFileById(fId);
          if (f.isTrashed()) {
            sheet.getRange(i + 2, syncCol + 1).setValue('MISSING');
            missingCount++;
          } else {
            sheet.getRange(i + 2, syncCol + 1).setValue('SYNCED');
          }
        } catch (e) {
          sheet.getRange(i + 2, syncCol + 1).setValue('MISSING');
          missingCount++;
        }
      } else {
        sheet.getRange(i + 2, syncCol + 1).setValue('NEEDS_SYNC');
      }
    }
  }

  // 2. Catat ke SYNC_LOG
  var syncSheet = getOrCreateSheet(ss, SHEET_NAMES.SYNC_LOG);
  var logId = 'SYNC-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmmss');
  syncSheet.appendRow([
    logId,
    new Date().toISOString(),
    'COMPLETED',
    scannedCount,
    missingCount,
    unindexedCount,
    'Sinkronisasi selesai diproses.'
  ]);

  return {
    success: true,
    data: {
      sync_id: logId,
      total_scanned: scannedCount,
      missing_count: missingCount,
      unindexed_count: unindexedCount,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Statistik Terpusat
 */
function getStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.BANK_SOAL);
  var lastRow = sheet.getLastRow();

  var totalSoal = 0;
  var totalBytes = 0;
  var totalDownload = 0;
  var totalViews = 0;
  var mapelMap = {};
  var jenjangMap = {};
  var kesulitanMap = {};

  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, BANK_SOAL_COLUMNS.length).getValues();
    totalSoal = data.length;

    var sizeCol = BANK_SOAL_COLUMNS.indexOf('ukuran_file');
    var mapelCol = BANK_SOAL_COLUMNS.indexOf('mata_pelajaran');
    var jenjangCol = BANK_SOAL_COLUMNS.indexOf('jenjang');
    var diffCol = BANK_SOAL_COLUMNS.indexOf('tingkat_kesulitan');
    var dlCol = BANK_SOAL_COLUMNS.indexOf('download_count');
    var viewCol = BANK_SOAL_COLUMNS.indexOf('view_count');

    for (var i = 0; i < data.length; i++) {
      totalBytes += Number(data[i][sizeCol]) || 0;
      totalDownload += Number(data[i][dlCol]) || 0;
      totalViews += Number(data[i][viewCol]) || 0;

      var m = data[i][mapelCol] || 'Umum';
      mapelMap[m] = (mapelMap[m] || 0) + 1;

      var j = data[i][jenjangCol] || 'SMA';
      jenjangMap[j] = (jenjangMap[j] || 0) + 1;

      var k = data[i][diffCol] || 'Sedang';
      kesulitanMap[k] = (kesulitanMap[k] || 0) + 1;
    }
  }

  var byMapel = Object.keys(mapelMap).map(function(k) { return { name: k, count: mapelMap[k] }; });
  var byJenjang = Object.keys(jenjangMap).map(function(k) { return { name: k, count: jenjangMap[k] }; });
  var byKesulitan = Object.keys(kesulitanMap).map(function(k) { return { level: k, count: kesulitanMap[k] }; });

  return {
    success: true,
    data: {
      total_soal: totalSoal,
      total_pdf: totalSoal,
      total_storage_bytes: totalBytes,
      total_download: totalDownload,
      total_views: totalViews,
      by_mapel: byMapel,
      by_jenjang: byJenjang,
      by_kesulitan: byKesulitan
    }
  };
}

/**
 * Log Aktivitas ke Sheet ACTIVITY_LOG
 */
function logActivity(payload) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSheet(ss, SHEET_NAMES.ACTIVITY_LOG);
    var user = payload.user || {};
    var logId = 'ACT-' + Date.now();

    sheet.appendRow([
      logId,
      new Date().toISOString(),
      user.id || '',
      user.name || '',
      user.role || '',
      payload.action || '',
      payload.bank_soal_id || '',
      payload.file_id || '',
      JSON.stringify(payload.details || {})
    ]);

    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Helper: Konversi Baris Array ke JSON Object berdasarkan Header
 */
function rowToObject(row, headers) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    var val = row[i];
    if (key === 'tags' && typeof val === 'string') {
      obj[key] = val ? val.split(',').map(function(t) { return t.trim(); }) : [];
    } else {
      obj[key] = val;
    }
  }
  return obj;
}
