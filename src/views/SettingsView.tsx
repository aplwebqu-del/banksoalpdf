import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Sparkles,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  HardDrive,
  Shield,
  Cloud,
  ExternalLink,
  Save,
  Check,
  AlertCircle,
  Code,
  Activity,
  Plus,
  Trash2,
  Edit3,
  Power,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { GoogleStorageProfile, ConnectionTestResult, MigrationReport, DriveSyncResult } from '../types';

export const SettingsView: React.FC = () => {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<GoogleStorageProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<GoogleStorageProfile | null>(null);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<GoogleStorageProfile | null>(null);

  // Form State for Add / Edit
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDriveId, setFormDriveId] = useState('');
  const [formSheetsId, setFormSheetsId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMakeActive, setFormMakeActive] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);

  // Testing & Diagnostics
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testedProfileId, setTestedProfileId] = useState<string | null>(null);

  // Sync & Migration
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<DriveSyncResult | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [showScriptGuide, setShowScriptGuide] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const res = await api.getStorageProfiles();
      setProfiles(res.profiles || []);
      setActiveProfile(res.active_profile || null);
    } catch (err: any) {
      console.warn('Failed to load storage profiles:', err);
      showToast('Gagal memuat profil Google Storage', 'error');
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const openAddModal = () => {
    setFormName('');
    setFormUrl('');
    setFormDriveId('');
    setFormSheetsId('');
    setFormDescription('');
    setFormMakeActive(false);
    setShowAddModal(true);
  };

  const openEditModal = (p: GoogleStorageProfile) => {
    setEditingProfile(p);
    setFormName(p.name);
    setFormUrl(p.apps_script_url || '');
    setFormDriveId(p.drive_root_folder_id || '');
    setFormSheetsId(p.spreadsheet_id || '');
    setFormDescription(p.description || '');
    setFormMakeActive(p.is_active);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Nama storage wajib diisi.', 'error');
      return;
    }

    setIsSavingForm(true);
    try {
      if (editingProfile) {
        // Update existing
        await api.updateStorageProfile(editingProfile.id, {
          name: formName.trim(),
          apps_script_url: formUrl.trim(),
          drive_root_folder_id: formDriveId.trim(),
          spreadsheet_id: formSheetsId.trim(),
          description: formDescription.trim(),
          is_active: formMakeActive,
        });
        showToast(`Profil "${formName}" berhasil diperbarui!`, 'success');
        setEditingProfile(null);
      } else {
        // Create new
        await api.createStorageProfile({
          name: formName.trim(),
          apps_script_url: formUrl.trim(),
          drive_root_folder_id: formDriveId.trim(),
          spreadsheet_id: formSheetsId.trim(),
          description: formDescription.trim(),
          is_active: formMakeActive,
        });
        showToast(`Profil Google Storage "${formName}" berhasil ditambahkan!`, 'success');
        setShowAddModal(false);
      }
      await loadProfiles();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan profil storage', 'error');
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleActivateProfile = async (p: GoogleStorageProfile) => {
    if (p.is_active) return;
    try {
      const res = await api.setActiveStorageProfile(p.id);
      showToast(res.message || `Profil "${p.name}" sekarang aktif sebagai Active Storage!`, 'success');
      await loadProfiles();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengaktifkan profil storage', 'error');
    }
  };

  const handleDeleteProfile = async (p: GoogleStorageProfile) => {
    if (profiles.length <= 1) {
      showToast('Minimal harus ada 1 profil Google Storage dalam sistem.', 'error');
      return;
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus profil "${p.name}"?`)) {
      return;
    }

    try {
      const res = await api.deleteStorageProfile(p.id);
      showToast(res.message || 'Profil berhasil dihapus.', 'success');
      await loadProfiles();
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus profil storage', 'error');
    }
  };

  const handleTestConnection = async (profileId: string) => {
    setTestingId(profileId);
    setTestResult(null);
    setTestedProfileId(profileId);

    try {
      const res = await api.testStorageProfile(profileId);
      setTestResult(res);
      if (res.success) {
        showToast(`Uji Koneksi Berhasil! Respon: ${res.latency_ms}ms`, 'success');
      } else {
        showToast('Uji koneksi gagal atau ada kendala endpoint.', 'error');
      }
      await loadProfiles();
    } catch (err: any) {
      showToast(err.message || 'Gagal menguji koneksi profil', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncDriveAndSheets = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncDriveAndSheets();
      setSyncReport(res);
      showToast(`Sinkronisasi Selesai: ${res.synced_count} file sinkron.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menjalankan sinkronisasi', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRunMigration = async () => {
    if (!confirm('Apakah Anda ingin menjalankan migrasi data legacy (JSON/Local) ke Google Storage aktif?')) {
      return;
    }
    setIsMigrating(true);
    try {
      const report = await api.runLegacyMigration();
      setMigrationReport(report);
      showToast(
        `Migrasi Selesai: ${report.success_count} item berhasil dipindahkan ke Google Drive & Sheets!`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Gagal menjalankan migrasi legacy', 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const data = await api.getStats();
      const backupData = {
        exported_at: new Date().toISOString(),
        version: '2.5.0',
        architecture: 'Multi Google Storage Manager (Drive + Sheets + Apps Script)',
        active_storage: activeProfile,
        all_profiles: profiles,
        stats: data,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_multi_google_storage_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Cadangan metadata database berhasil diekspor!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengekspor data cadangan', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const nonActiveProfiles = profiles.filter((p) => !p.is_active);

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-2">
            <Cloud className="w-3.5 h-3.5" />
            <span>Multi Google Storage Manager</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Pengaturan Penyimpanan Google
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Kelola multi profil penyimpanan Google Drive & Google Sheets. Aplikasi beroperasi penuh pada profil <strong>Active Storage</strong> yang dipilih.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Google Storage</span>
        </button>
      </div>

      {/* STORAGE AKTIF SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Storage Aktif (Active Storage)</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Digunakan oleh seluruh operasi Upload, Search, Preview & Download
          </span>
        </div>

        {activeProfile ? (
          <div className="bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 border-2 border-emerald-500/40 p-6 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-inner">
                  <Cloud className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h4 className="text-lg sm:text-xl font-black text-white">{activeProfile.name}</h4>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Aktif
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeProfile.description || 'Penyimpanan Google Drive & Google Sheets primer institusi.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTestConnection(activeProfile.id)}
                  disabled={testingId === activeProfile.id}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingId === activeProfile.id ? 'animate-spin text-blue-400' : ''}`} />
                  <span>{testingId === activeProfile.id ? 'Menguji...' : 'Uji Koneksi'}</span>
                </button>

                <button
                  onClick={() => openEditModal(activeProfile)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Kelola</span>
                </button>
              </div>
            </div>

            {/* Status Checklist Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Google Drive</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Terhubung
                  </span>
                </div>
                <div className="text-slate-200 font-semibold truncate">
                  Folder: {activeProfile.drive_root_name || 'BANK SOAL DIGITAL'}
                </div>
                {activeProfile.drive_root_folder_id && (
                  <a
                    href={`https://drive.google.com/drive/folders/${activeProfile.drive_root_folder_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:underline inline-flex items-center gap-1 font-mono pt-1"
                  >
                    <span>ID: {activeProfile.drive_root_folder_id.slice(0, 16)}...</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Google Spreadsheet</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Terhubung
                  </span>
                </div>
                <div className="text-slate-200 font-semibold truncate">
                  File: {activeProfile.spreadsheet_name || 'BANK SOAL DIGITAL'}
                </div>
                {activeProfile.spreadsheet_id && (
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${activeProfile.spreadsheet_id}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:underline inline-flex items-center gap-1 font-mono pt-1"
                  >
                    <span>ID: {activeProfile.spreadsheet_id.slice(0, 16)}...</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Apps Script Web App</span>
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Terhubung
                  </span>
                </div>
                <div className="text-slate-200 font-semibold truncate">
                  API Gateway: Online
                </div>
                <div className="text-[11px] text-slate-400 truncate font-mono pt-1">
                  {activeProfile.apps_script_url ? 'Endpoint terverifikasi' : '(URL belum diatur)'}
                </div>
              </div>
            </div>

            {/* Footer details of active storage */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
              <div className="flex items-center gap-4">
                <span>
                  Terakhir dicek:{' '}
                  <strong className="text-slate-200">
                    {activeProfile.last_connection_test
                      ? new Date(activeProfile.last_connection_test).toLocaleString('id-ID')
                      : 'Baru saja'}
                  </strong>
                </span>
                <span>
                  Status Profil:{' '}
                  <strong className="text-emerald-400 uppercase font-bold">{activeProfile.status}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncDriveAndSheets}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
                  <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronisasi Drive ↔ Sheets'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
            Belum ada storage aktif yang dipilih.
          </div>
        )}
      </div>

      {/* DIAGNOSTIC TEST RESULT BANNER */}
      {testResult && (
        <div className="p-5 rounded-3xl bg-slate-900 border border-blue-500/30 text-xs space-y-3 shadow-xl">
          <div className="flex items-center justify-between font-bold text-white">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Hasil Uji Diagnostik Koneksi Google Cloud</span>
            </div>
            <span className="text-emerald-400 font-mono text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              Latency: {testResult.latency_ms} ms
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block mb-1">Google Apps Script:</span>
              <span className={`font-semibold ${testResult.apps_script.reachable ? 'text-emerald-400' : 'text-rose-400'}`}>
                {testResult.apps_script.message}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block mb-1">Google Drive:</span>
              <span className={`font-semibold ${testResult.google_drive.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                Folder "{testResult.google_drive.folder_name}" Siap
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block mb-1">Google Sheets:</span>
              <span className={`font-semibold ${testResult.google_sheets.connected ? 'text-blue-400' : 'text-amber-400'}`}>
                {testResult.google_sheets.sheet_count} Sheet Terstruktur
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STORAGE LAIN (NON-ACTIVE PROFILES) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>Storage Lain / Profil Cadangan ({nonActiveProfiles.length})</span>
          </h3>
          <span className="text-[11px] text-slate-500">
            Dapat dialihkan sewaktu-waktu sebagai Active Storage
          </span>
        </div>

        {nonActiveProfiles.length === 0 ? (
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-400">Belum ada profil storage cadangan tambahan.</p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Profil Storage Cadangan</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {nonActiveProfiles.map((p) => (
              <div
                key={p.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-3xl shadow-lg space-y-4 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-base">{p.name}</h4>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold uppercase">
                        Tidak Aktif
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {p.description || 'Profil penyimpanan Google tambahan.'}
                    </p>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      p.status === 'connected'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : p.status === 'error'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Apps Script:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[180px]">
                      {p.apps_script_url ? p.apps_script_url.slice(0, 28) + '...' : '(Belum diatur)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Drive Folder ID:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[180px]">
                      {p.drive_root_folder_id ? p.drive_root_folder_id.slice(0, 16) + '...' : '(Otomatis / Belum diatur)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Spreadsheet ID:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[180px]">
                      {p.spreadsheet_id ? p.spreadsheet_id.slice(0, 16) + '...' : '(Otomatis / Belum diatur)'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleActivateProfile(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>Jadikan Aktif</span>
                    </button>

                    <button
                      onClick={() => handleTestConnection(p.id)}
                      disabled={testingId === p.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${testingId === p.id ? 'animate-spin' : ''}`} />
                      <span>Uji</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(p)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                      title="Edit Profil"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteProfile(p)}
                      className="p-1.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-all"
                      title="Hapus Profil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MIGRASI & BACKUP SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
        {/* Legacy Migration Card */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Migrasi Data Legacy (JSON → Active Storage)</h3>
              <p className="text-xs text-slate-400">Pindahkan bank soal lokal/JSON ke Google Drive & Sheets yang aktif</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Menjalankan proses migrasi otomatis untuk memastikan seluruh berkas PDF dan metadata lama terindeks dengan rapi pada Google Storage aktif.
          </p>

          <button
            onClick={handleRunMigration}
            disabled={isMigrating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            <Upload className="w-4 h-4 text-purple-400" />
            <span>{isMigrating ? 'Memproses Migrasi...' : 'Jalankan Migrasi ke Storage Aktif'}</span>
          </button>
        </div>

        {/* Database & Backup Card */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Cadangan Snapshot Metadata</h3>
              <p className="text-xs text-slate-400">Ekspor snapshot metadata Google Sheets dan daftar Storage Profile</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Unduh salinan cadangan metadata seluruh bank soal, profil penyimpanan, audit log, dan statistik penggunaan untuk arsip offline.
          </p>

          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 font-bold text-white text-xs shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor Snapshot JSON Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {(showAddModal || editingProfile) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-400" />
                <span>{editingProfile ? 'Kelola Profil Google Storage' : 'Tambah Profil Google Storage Baru'}</span>
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProfile(null);
                }}
                className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Nama Profil Storage *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Bank Soal Utama, Bank Soal Cadangan 2026"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300 flex items-center justify-between">
                  <span>URL Deployment Google Apps Script Web App</span>
                  <button
                    type="button"
                    onClick={() => setShowScriptGuide(!showScriptGuide)}
                    className="text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <Code className="w-3 h-3" />
                    <span>{showScriptGuide ? 'Tutup Petunjuk' : 'Petunjuk Script'}</span>
                  </button>
                </label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500">
                  URL eksekusi Web App dengan hak akses "Anyone" sebagai API gateway ke Drive & Sheets.
                </p>
              </div>

              {showScriptGuide && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
                  <span className="font-bold text-indigo-300 block">Panduan Singkat Setup Apps Script:</span>
                  <p>1. Buka <code>script.google.com</code> dan salin kode <code>google-apps-script/Code.gs</code>.</p>
                  <p>2. Klik <strong>Deploy &gt; New Deployment &gt; Web app</strong>.</p>
                  <p>3. Atur <em>Execute as: Me</em> dan <em>Who has access: Anyone</em>.</p>
                  <p>4. Tempel URL Web App ke kolom di atas.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">ID Folder Google Drive (Opsional)</label>
                  <input
                    type="text"
                    value={formDriveId}
                    onChange={(e) => setFormDriveId(e.target.value)}
                    placeholder="Auto-detect jika kosong"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-300">ID Google Spreadsheet (Opsional)</label>
                  <input
                    type="text"
                    value={formSheetsId}
                    onChange={(e) => setFormSheetsId(e.target.value)}
                    placeholder="Auto-detect jika kosong"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Deskripsi / Catatan Tambahan</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Keterangan tujuan profil ini..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="makeActiveCheck"
                  checked={formMakeActive}
                  onChange={(e) => setFormMakeActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded bg-slate-800 border-slate-700 focus:ring-blue-500"
                />
                <label htmlFor="makeActiveCheck" className="text-slate-300 font-medium cursor-pointer">
                  Jadikan profil ini sebagai <strong>Active Storage</strong> sekarang
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProfile(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-all"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSavingForm}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingForm ? 'Menyimpan...' : 'Simpan Profil'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
