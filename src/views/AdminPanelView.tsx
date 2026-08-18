import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  HardDrive,
  FolderTree,
  FileText,
  Activity,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  Pencil,
  Search,
  BookOpen,
  GraduationCap,
  Cloud,
  ExternalLink,
  AlertTriangle,
  Play,
  Database,
} from 'lucide-react';
import { User, AuditLogItem, StatsOverview, CategoryItem, DriveSyncResult, GoogleIntegrationConfig } from '../types';
import { api } from '../lib/api';
import { formatBytes, formatDate } from '../lib/utils';
import { useToast } from '../components/Toast';
import { CategoryCrudModal } from '../components/CategoryCrudModal';

interface AdminPanelViewProps {
  currentUser: User;
  onSwitchUser: (user: User) => void;
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  currentUser,
  onSwitchUser,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'storage' | 'audit' | 'categories' | 'drive_sync'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [googleConfig, setGoogleConfig] = useState<GoogleIntegrationConfig | null>(null);
  const [syncResult, setSyncResult] = useState<DriveSyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Category Filtering & CRUD
  const [catFilterType, setCatFilterType] = useState<string>('all');
  const [catSearchQuery, setCatSearchQuery] = useState<string>('');
  const [isCatModalOpen, setIsCatModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [defaultCatType, setDefaultCatType] = useState<'mata_pelajaran' | 'jenjang' | 'jenis_soal'>('mata_pelajaran');

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await api.getUsers();
        setUsers(res.users);
      } else if (activeTab === 'audit') {
        const res = await api.getAuditLogs();
        setAuditLogs(res.logs);
      } else if (activeTab === 'storage') {
        const res = await api.getStats();
        setStats(res);
      } else if (activeTab === 'categories') {
        const res = await api.getCategories();
        setCategories(res.categories);
      } else if (activeTab === 'drive_sync') {
        const cfgRes = await api.getGoogleConfig();
        const statRes = await api.getStats();
        setGoogleConfig(cfgRes.config);
        setStats(statRes);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data administrator', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRunSync = async () => {
    setIsSyncing(true);
    try {
      const res = await api.syncGoogleDrive();
      setSyncResult(res);
      const statRes = await api.getStats();
      setStats(statRes);
      showToast(res.details, res.status === 'SUCCESS' ? 'success' : 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menjalankan sinkronisasi', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenAddCategory = (type: 'mata_pelajaran' | 'jenjang' | 'jenis_soal' = 'mata_pelajaran') => {
    setEditingCategory(null);
    setDefaultCatType(type);
    setIsCatModalOpen(true);
  };

  const handleOpenEditCategory = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setDefaultCatType((cat.type as any) || 'mata_pelajaran');
    setIsCatModalOpen(true);
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus kategori "${name}"?`)) return;
    try {
      await api.deleteCategory(id);
      showToast(`Kategori "${name}" berhasil dihapus.`, 'success');
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus kategori', 'error');
    }
  };

  const handleCategorySaved = (saved: CategoryItem, isNew: boolean) => {
    if (isNew) {
      setCategories((prev) => [...prev, saved]);
    } else {
      setCategories((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    }
  };

  const filteredAdminCategories = categories.filter((c) => {
    if (catFilterType !== 'all' && c.type !== catFilterType) return false;
    if (!catSearchQuery.trim()) return true;
    const q = catSearchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-rose-400" />
            <h2 className="text-xl font-bold text-white">Panel Administrasi & Manajemen Sistem</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pengaturan pengajar, master kategori, sinkronisasi Google Drive & Sheets, dan jejak audit.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'users' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Pengajar & Akun
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'categories' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Master Kategori
          </button>
          <button
            onClick={() => setActiveTab('drive_sync')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'drive_sync' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Sinkronisasi Drive & Sheets
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'storage' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Kapasitas Storage
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'audit' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Audit Log
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Memuat data panel admin...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: USERS & ROLES */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  return (
                    <div
                      key={u.id}
                      className={`p-5 rounded-2xl border bg-slate-900 flex flex-col justify-between ${
                        isCurrent ? 'border-blue-500/80 shadow-md ring-1 ring-blue-500/20' : 'border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-white">
                            {u.name.charAt(0)}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === 'ADMIN'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>
                        <div className="mt-3">
                          <h4 className="font-bold text-white text-sm">{u.name}</h4>
                          <p className="text-xs text-slate-400">{u.email}</p>
                          <p className="text-xs text-slate-500 mt-1">{u.school_institution}</p>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                        {isCurrent ? (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Sedang Digunakan</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              onSwitchUser(u);
                              showToast(`Beralih ke akun "${u.name}" (${u.role})`, 'info');
                            }}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
                          >
                            Gunakan Akun Ini
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: MASTER CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'Semua Tipe' },
                    { id: 'mata_pelajaran', label: 'Mata Pelajaran' },
                    { id: 'jenjang', label: 'Jenjang Pendidikan' },
                    { id: 'jenis_soal', label: 'Jenis / Format Soal' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setCatFilterType(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        catFilterType === tab.id
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari kategori..."
                      value={catSearchQuery}
                      onChange={(e) => setCatSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    onClick={() => handleOpenAddCategory('mata_pelajaran')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition-all shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Kategori</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAdminCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {cat.type.replace('_', ' ')}
                        </span>
                        {cat.code && (
                          <span className="text-[11px] font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                            {cat.code}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-white text-base mt-2">{cat.name}</h4>
                      {cat.description && (
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-medium">
                        {cat.count !== undefined ? `${cat.count} Bank Soal` : '0 Soal'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditCategory(cat)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Edit Kategori"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Hapus Kategori"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE DRIVE & SHEETS SYNCHRONIZATION */}
          {activeTab === 'drive_sync' && (
            <div className="space-y-6">
              {/* Sync Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Total Terindeks Sheets</span>
                    <Database className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-white mt-2">{stats?.total_soal || 0}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Baris rekaman metadata di Google Sheets</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400">Terverifikasi di Drive</span>
                    <Cloud className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-400 mt-2">
                    {stats?.synced_count ?? stats?.total_soal ?? 0}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">Berkas PDF valid & memiliki file_id</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400">Butuh Sinkronisasi</span>
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-amber-400 mt-2">{stats?.needs_sync_count ?? 0}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Antrean upload / metadata belum lengkap</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-400">Berkas Hilang / Rusak</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold text-rose-400 mt-2">{stats?.missing_count ?? 0}</div>
                  <p className="text-[11px] text-slate-500 mt-1">File ID tidak ditemukan di Google Drive</p>
                </div>
              </div>

              {/* Action Banner */}
              <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/30 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <RefreshCw className={`w-5 h-5 text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Sinkronisasi Otomatis Google Drive ↔ Google Sheets</span>
                  </h3>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    Memindai seluruh baris pada sheet <code>BANK_SOAL</code>, memverifikasi ketersediaan berkas fisik di Google Drive, mencocokkan SHA-256 hash, dan memperbarui status sinkronisasi.
                  </p>
                </div>

                <button
                  onClick={handleRunSync}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 shrink-0"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{isSyncing ? 'Memindai & Menyinkronkan...' : 'Jalankan Sinkronisasi Sekarang'}</span>
                </button>
              </div>

              {/* Sync Result Report */}
              {syncResult && (
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white text-sm">Laporan Hasil Sinkronisasi ({syncResult.sync_id})</h4>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        syncResult.status === 'SUCCESS'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      Status: {syncResult.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">{syncResult.details}</p>

                  {syncResult.missing_items && syncResult.missing_items.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-semibold text-rose-400">Daftar Berkas Perlu Perhatian:</div>
                      <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-slate-800 text-slate-400 text-[11px]">
                            <tr>
                              <th className="p-3">ID Soal</th>
                              <th className="p-3">Judul Dokumen</th>
                              <th className="p-3">File ID Google Drive</th>
                              <th className="p-3">Keterangan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {syncResult.missing_items.map((m) => (
                              <tr key={m.id} className="text-slate-300 hover:bg-slate-800/40">
                                <td className="p-3 font-mono font-bold text-blue-400">{m.id}</td>
                                <td className="p-3 font-medium text-white">{m.judul}</td>
                                <td className="p-3 font-mono text-[11px] text-slate-400">{m.file_id || '-'}</td>
                                <td className="p-3 text-rose-300 text-[11px]">{m.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: STORAGE MONITORING */}
          {activeTab === 'storage' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-xs text-slate-400 font-semibold">Total Ukuran PDF di Drive</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {formatBytes(stats.total_storage_bytes)}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">{stats.total_pdf} dokumen tersimpan</div>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-xs text-slate-400 font-semibold">Total Unduhan Soal</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.total_download}x</div>
                  <div className="text-xs text-slate-500 mt-2">Frekuensi download oleh pengajar</div>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-xs text-slate-400 font-semibold">Total Pratinjau Dokumen</div>
                  <div className="text-2xl font-bold text-blue-400 mt-1">{stats.total_views}x</div>
                  <div className="text-xs text-slate-500 mt-2">Dilihat via Google Drive Viewer</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">Jejak Rekam Aktivitas (ACTIVITY_LOG)</h3>
                  <p className="text-xs text-slate-400">Tersinkronisasi langsung ke Google Sheets</p>
                </div>
                <button
                  onClick={loadAdminData}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Segarkan</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">Waktu</th>
                      <th className="p-3.5">Pengguna</th>
                      <th className="p-3.5">Aksi</th>
                      <th className="p-3.5">ID Soal / File ID</th>
                      <th className="p-3.5">Rincian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          Belum ada catatan log aktivitas.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3.5 text-slate-400 whitespace-nowrap">
                            {formatDate(log.timestamp)}
                          </td>
                          <td className="p-3.5">
                            <span className="font-semibold text-white">{log.user_name}</span>
                            <span className="text-[10px] text-slate-500 block">{log.user_role}</span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.action === 'UPLOAD'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : log.action === 'DELETE'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : log.action === 'DOWNLOAD'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : log.action === 'SYNC'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-[11px] text-blue-400">
                            {log.bank_soal_id || log.file_id || '-'}
                          </td>
                          <td className="p-3.5 text-slate-300 max-w-xs truncate">
                            {log.details ? JSON.stringify(log.details) : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Category CRUD Modal */}
      <CategoryCrudModal
        isOpen={isCatModalOpen}
        onClose={() => setIsCatModalOpen(false)}
        onSaved={handleCategorySaved}
        editingCategory={editingCategory}
        defaultType={defaultCatType}
      />
    </div>
  );
};
