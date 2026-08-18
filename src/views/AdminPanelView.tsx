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
  RotateCcw,
  UserCheck,
  UserX,
  HeartPulse,
  Server,
  Zap,
  Lock,
} from 'lucide-react';
import { User, AuditLogItem, StatsOverview, CategoryItem, DriveSyncResult, GoogleIntegrationConfig, BankSoal } from '../types';
import { api } from '../lib/api';
import { formatBytes, formatDate } from '../lib/utils';
import { useToast } from '../components/Toast';
import { CategoryCrudModal } from '../components/CategoryCrudModal';
import { UserCrudModal } from '../components/UserCrudModal';

interface AdminPanelViewProps {
  currentUser: User;
  onSwitchUser: (user: User) => void;
  onPreviewSoal?: (soal: BankSoal) => void;
  initialTab?: 'users' | 'trash' | 'health' | 'categories' | 'drive_sync' | 'storage' | 'audit';
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  currentUser,
  onSwitchUser,
  onPreviewSoal,
  initialTab = 'users',
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'trash' | 'health' | 'categories' | 'drive_sync' | 'storage' | 'audit'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [users, setUsers] = useState<User[]>([]);
  const [trashItems, setTrashItems] = useState<BankSoal[]>([]);
  const [trashCount, setTrashCount] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [googleConfig, setGoogleConfig] = useState<GoogleIntegrationConfig | null>(null);
  const [syncResult, setSyncResult] = useState<DriveSyncResult | null>(null);
  const [healthStatus, setHealthStatus] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  // User CRUD Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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
        const res = await api.getUsersList();
        setUsers(res.users);
      } else if (activeTab === 'trash') {
        const res = await api.getBankSoal({ status: 'arsip', limit: 100 });
        setTrashItems(res.items);
        setTrashCount(res.total);
      } else if (activeTab === 'health') {
        setIsHealthChecking(true);
        const health = await api.getHealth();
        setHealthStatus(health);
        setIsHealthChecking(false);
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

  // --- USER ACTIONS ---
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (user: User, isNew: boolean) => {
    try {
      if (isNew) {
        const res = await api.createUser(user);
        setUsers((prev) => [...prev, res.user]);
        showToast(`Pengguna "${res.user.name}" berhasil ditambahkan.`, 'success');
      } else {
        const res = await api.updateUser(user.id, user);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? res.user : u)));
        showToast(`Data "${res.user.name}" berhasil diperbarui.`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan pengguna', 'error');
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus akun "${name}"?`)) return;
    try {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast(`Akun "${name}" berhasil dihapus.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus akun', 'error');
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await api.updateUserStatus(user.id, nextStatus);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? res.user : u)));
      showToast(`Status "${user.name}" diubah menjadi ${nextStatus}.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status pengguna', 'error');
    }
  };

  // --- TRASH ACTIONS ---
  const handleRestoreSoal = async (id: string, judul: string) => {
    try {
      await api.restoreBankSoal(id);
      setTrashItems((prev) => prev.filter((item) => item.id !== id));
      setTrashCount((prev) => Math.max(0, prev - 1));
      showToast(`"${judul}" berhasil dipulihkan ke katalog aktif.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal memulihkan soal', 'error');
    }
  };

  const handlePermanentDeleteSoal = async (id: string, judul: string) => {
    if (!confirm(`PERINGATAN: Berkas PDF fisik "${judul}" di Google Drive dan rekaman di Google Sheets akan dihapus permanen dan tidak dapat dipulihkan. Lanjutkan?`)) return;
    try {
      await api.permanentDeleteBankSoal(id);
      setTrashItems((prev) => prev.filter((item) => item.id !== id));
      setTrashCount((prev) => Math.max(0, prev - 1));
      showToast(`"${judul}" berhasil dihapus secara permanen.`, 'info');
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus permanen', 'error');
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('Apakah Anda yakin ingin mengosongkan seluruh keranjang sampah? Semua berkas fisik PDF di Google Drive akan dimusnahkan.')) return;
    try {
      const res = await api.emptyTrash();
      setTrashItems([]);
      setTrashCount(0);
      showToast(`Keranjang sampah berhasil dikosongkan (${res.count} item dihapus).`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Gagal mengosongkan sampah', 'error');
    }
  };

  // --- SYNC ACTION ---
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

  // --- CATEGORIES ---
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
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-rose-400" />
            <h2 className="text-xl font-bold text-white">Panel Administrasi & Manajemen Sistem</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Pengelolaan pengguna, pemulihan sampah, master kategori, sinkronisasi Google Drive & Sheets, dan monitoring kesehatan sistem.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'users' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Pengajar & Akun
          </button>
          <button
            onClick={() => setActiveTab('trash')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'trash' ? 'bg-rose-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Keranjang Sampah</span>
            {trashCount > 0 && (
              <span className="px-1.5 py-0.2 bg-white text-rose-600 rounded-full text-[10px] font-bold">
                {trashCount}
              </span>
            )}
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
            onClick={() => setActiveTab('health')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'health' ? 'bg-emerald-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span>Kesehatan Sistem</span>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'storage' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Kapasitas
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-rose-400" />
                    <h3 className="text-sm font-bold text-white">Menu Mengatur Pengguna & Kata Sandi Login</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Data kredensial dan daftar pengguna hanya dapat diakses melalui Panel Admin. Tersinkronisasi ke Google Sheets sheet USERS.
                  </p>
                </div>
                <button
                  onClick={handleOpenAddUser}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition-all shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Pengguna</span>
                </button>
              </div>

              {users.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                  <div className="font-mono text-2xl text-slate-500 font-bold mb-2">[]</div>
                  <h4 className="text-sm font-bold text-white">Data Pengguna Kosong</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Belum ada data pengguna yang terdaftar di Google Sheets database.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.map((u) => {
                    const isCurrent = u.id === currentUser.id;
                    const isActive = u.status !== 'INACTIVE';
                    return (
                      <div
                        key={u.id}
                        className={`p-5 rounded-2xl border bg-slate-900 flex flex-col justify-between transition-all ${
                          isCurrent
                            ? 'border-blue-500 shadow-lg ring-1 ring-blue-500/20'
                            : isActive
                            ? 'border-slate-800'
                            : 'border-slate-800 opacity-60 bg-slate-950'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {u.avatar ? (
                                <img
                                  src={u.avatar}
                                  alt={u.name}
                                  className="w-11 h-11 rounded-full object-cover border border-slate-700"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-white">
                                  {u.name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <h4 className="font-bold text-white text-sm">{u.name}</h4>
                                <p className="text-xs text-slate-400">{u.email}</p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.role === 'ADMIN'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : u.role === 'EDITOR'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {u.role}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                                  isActive
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-slate-700 text-slate-400'
                                }`}
                              >
                                {isActive ? 'AKTIF' : 'NONAKTIF'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-1.5">
                            <div className="text-[11px] text-slate-300 font-medium flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                              <span className="truncate">{u.subject || 'Mata Pelajaran Umum'}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="truncate">{u.school_institution || 'Sekolah'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs hover:text-white transition-colors"
                              title="Edit Data Pengguna & Kata Sandi"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`p-1.5 rounded-lg text-xs transition-colors ${
                                isActive
                                  ? 'bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              }`}
                              title={isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                            >
                              {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                            {!isCurrent && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs transition-colors"
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {isCurrent ? (
                            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Akun Aktif</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                onSwitchUser(u);
                                showToast(`Beralih ke akun "${u.name}" (${u.role})`, 'info');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                            >
                              Gunakan Akun
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: KERANJANG SAMPAH (TRASH) */}
          {activeTab === 'trash' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-rose-400" />
                    <h3 className="text-base font-bold text-white">Keranjang Sampah & Pemulihan (Soft Delete)</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Berkas bank soal yang dihapus sementara. Anda dapat memulihkannya kembali atau menghapus secara permanen dari Google Drive & Sheets.
                  </p>
                </div>

                {trashItems.length > 0 && (
                  <button
                    onClick={handleEmptyTrash}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 transition-all shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Kosongkan Seluruh Sampah ({trashItems.length})</span>
                  </button>
                )}
              </div>

              {trashItems.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                  <div className="font-mono text-2xl text-slate-500 font-bold mb-2">[]</div>
                  <h4 className="text-sm font-bold text-white">Keranjang Sampah Kosong</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Tidak ada berkas bank soal yang berada di keranjang sampah saat ini. Semua data aktif dan tersimpan rapi.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trashItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900 border border-rose-500/30 p-5 rounded-2xl flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">
                            {item.id}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Diarsipkan
                          </span>
                        </div>

                        <h4 className="font-bold text-white text-sm mt-2 line-clamp-2">{item.judul}</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          {item.mata_pelajaran} • Kelas {item.kelas} ({item.jenjang})
                        </p>

                        <div className="mt-3 text-[11px] text-slate-500 space-y-1">
                          <div>File ID: <span className="font-mono text-slate-400">{item.file_id || '-'}</span></div>
                          <div>Ukuran: {formatBytes(item.ukuran_file)} • {item.jumlah_halaman} Halaman</div>
                          <div>Dihapus pada: {formatDate(item.updated_at)}</div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRestoreSoal(item.id, item.judul)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Pulihkan</span>
                        </button>
                        <button
                          onClick={() => handlePermanentDeleteSoal(item.id, item.judul)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus Permanen</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SYSTEM HEALTH & INTEGRITY */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-emerald-400" />
                    <span>Uji Koneksi Server & Google Storage Gateway</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Pemeriksaan realtime status koneksi Node.js API, Google Apps Script Gateway, Google Drive Storage, dan Google Sheets Database.
                  </p>
                </div>
                <button
                  onClick={loadAdminData}
                  disabled={isHealthChecking}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${isHealthChecking ? 'animate-spin' : ''}`} />
                  <span>{isHealthChecking ? 'Menguji Koneksi...' : 'Uji Koneksi ke Server'}</span>
                </button>
              </div>

              {/* Explicit Connection Destination Information */}
              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Rincian Tujuan Koneksi Sistem (Connection Destinations)
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Bukan Localhost (Google Cloud Storage)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Apps Script Gateway Destination */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-purple-400" />
                        1. Google Apps Script Web App (API Gateway)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300">
                        {healthStatus?.google_apps_script?.status || 'ONLINE'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 break-all select-all">
                      https://script.google.com/macros/s/AKfycbx_f5ytW5Hhw7dK-XxKEVLB53-hOZsvtyhqV4ifsfSdOtBSemR0t23G8oyw2XcXtxs9Dg/exec
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Tujuan: Menangani otentikasi, penerimaan payload upload, dan eksekusi query REST.
                    </p>
                  </div>

                  {/* Google Drive Storage Destination */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                        2. Google Drive Root Folder (Penyimpanan Berkas PDF)
                      </span>
                      <a
                        href="https://drive.google.com/drive/folders/1cYgXdF66T1GKMw3Dkd26J55E5HZPIRBG"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                      >
                        <span>Buka Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      Folder ID: <span className="text-white font-bold">1cYgXdF66T1GKMw3Dkd26J55E5HZPIRBG</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Tujuan: Tempat penyimpanan fisik seluruh berkas PDF bank soal dan versinya.
                    </p>
                  </div>

                  {/* Google Sheets Database Destination */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-emerald-400" />
                        3. Google Spreadsheet (Database Metadata)
                      </span>
                      <a
                        href="https://docs.google.com/spreadsheets/d/1xWK5VMJatqMtshx0FnFKZL54N2lQZ7wXoEJCQVT1o9A/edit"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                      >
                        <span>Buka Spreadsheet</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      Spreadsheet ID: <span className="text-white font-bold">1xWK5VMJatqMtshx0FnFKZL54N2lQZ7wXoEJCQVT1o9A</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Tujuan: Sheet BANK_SOAL, USERS, CATEGORIES, ACTIVITY_LOG, SYNC_LOG.
                    </p>
                  </div>

                  {/* Node.js Application Server */}
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-amber-400" />
                        4. Node.js Express REST API Server
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                        PORT 3000
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                      Host: <span className="text-white font-bold">0.0.0.0:3000</span> (Express + Vite)
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Tujuan: Mengorkestrasi routing, otorisasi RBAC, stream PDF, dan audit logging.
                    </p>
                  </div>
                </div>
              </div>

              {healthStatus && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Server */}
                  <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Node.js API Server</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {healthStatus.server?.status || 'ONLINE'}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-white">Aktif & Berjalan</div>
                    <div className="text-xs text-slate-400">
                      Uptime: {Math.floor((healthStatus.server?.uptime_seconds || 0) / 60)} menit
                    </div>
                  </div>

                  {/* Database */}
                  <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Google Sheets DB</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {healthStatus.database?.status || 'ONLINE'}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {healthStatus.database?.total_records || 0} Soal Terdaftar
                    </div>
                    <div className="text-xs text-slate-400">
                      Tabel: BANK_SOAL, USERS, CATEGORIES
                    </div>
                  </div>

                  {/* Google Drive */}
                  <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Google Drive Storage</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {healthStatus.google_drive?.status || 'ONLINE'}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-white">Penyimpanan Terhubung</div>
                    <div className="text-xs text-slate-400 truncate">
                      Folder: {healthStatus.google_drive?.root_folder_id || 'root'}
                    </div>
                  </div>

                  {/* Google Apps Script */}
                  <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Apps Script Gateway</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          healthStatus.google_apps_script?.configured
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {healthStatus.google_apps_script?.status || 'STANDBY'}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {healthStatus.google_apps_script?.latency_ms
                        ? `${healthStatus.google_apps_script.latency_ms} ms`
                        : 'Terkonfigurasi'}
                    </div>
                    <div className="text-xs text-slate-400">
                      Webhook POST / GET Handler
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MASTER CATEGORIES */}
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

              {filteredAdminCategories.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                  <div className="font-mono text-2xl text-slate-500 font-bold mb-2">[]</div>
                  <h4 className="text-sm font-bold text-white">Data Kategori Kosong</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Belum ada kategori yang cocok dengan filter atau terdaftar di Google Sheets.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAdminCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-5 rounded-2xl border border-slate-800 bg-slate-900 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                              {cat.type === 'jenjang' ? (
                                <GraduationCap className="w-4 h-4" />
                              ) : (
                                <BookOpen className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-sm">{cat.name}</h4>
                              <span className="text-[10px] text-slate-400 uppercase font-mono">
                                Kode: {cat.code || '-'}
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                            {cat.type}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                          {cat.description || 'Tidak ada deskripsi'}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-semibold">
                          {cat.count || 0} Soal Terkait
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditCategory(cat)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs hover:text-white transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs transition-colors"
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
          )}

          {/* TAB 5: DRIVE & SHEETS SYNC */}
          {activeTab === 'drive_sync' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-blue-400" />
                    <span>Sinkronisasi Otomatis Google Drive ↔ Google Sheets</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    Memverifikasi seluruh file PDF fisik di folder Google Drive dengan metadata baris di database Google Sheets.
                  </p>
                </div>
                <button
                  onClick={handleRunSync}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sedang Menyinkronkan...' : 'Jalankan Sinkronisasi'}</span>
                </button>
              </div>

              {syncResult && (
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">Hasil Sinkronisasi Terakhir</span>
                    <span className="text-xs text-slate-400">{formatDate(syncResult.timestamp)}</span>
                  </div>
                  <p className="text-xs text-emerald-400">{syncResult.details}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: STORAGE CAPACITY */}
          {activeTab === 'storage' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-xs text-slate-400 font-semibold">Total Berkas PDF</div>
                  <div className="text-2xl font-bold text-white mt-1">{stats.total_soal} Dokumen</div>
                  <div className="text-xs text-slate-500 mt-2">Tersimpan di Google Drive</div>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
                  <div className="text-xs text-slate-400 font-semibold">Penggunaan Storage</div>
                  <div className="text-2xl font-bold text-purple-400 mt-1">
                    {formatBytes(stats.total_storage_bytes)}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">Kapasitas penyimpanan Google Drive</div>
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

          {/* TAB 7: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-4 p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="font-bold text-white text-sm">Jejak Rekam Aktivitas & Audit Seluruh Sistem (ACTIVITY_LOG)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mencatat seluruh aksi hapus soal (soft delete & permanen), restore, upload, download, login, dan sinkronisasi ke Google Sheets.
                  </p>
                </div>
                <button
                  onClick={loadAdminData}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Segarkan Data Log</span>
                </button>
              </div>

              {/* Action Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'ALL', label: 'Semua Aksi' },
                  { id: 'DELETE', label: 'Hapus Soal (DELETE)' },
                  { id: 'RESTORE_BANK_SOAL', label: 'Pemulihan (RESTORE)' },
                  { id: 'UPLOAD', label: 'Upload' },
                  { id: 'EDIT', label: 'Edit / Update' },
                  { id: 'DOWNLOAD', label: 'Download' },
                  { id: 'SYNC', label: 'Sinkronisasi' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setAuditActionFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      auditActionFilter === f.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {(() => {
                const filtered = auditLogs.filter((l) => {
                  if (auditActionFilter === 'ALL') return true;
                  if (auditActionFilter === 'DELETE') {
                    return l.action === 'DELETE' || l.action === 'PERMANENT_DELETE' || l.action === 'EMPTY_TRASH';
                  }
                  return l.action === auditActionFilter;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
                      <div className="font-mono text-2xl text-slate-500 font-bold mb-2">[]</div>
                      <h4 className="text-sm font-bold text-white">Log Aktivitas Kosong</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Belum ada catatan log aktivitas yang terekam untuk filter ini.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="p-3.5">Waktu</th>
                          <th className="p-3.5">Pengguna</th>
                          <th className="p-3.5">Aksi Sistem</th>
                          <th className="p-3.5">ID Soal / File ID</th>
                          <th className="p-3.5">Rincian Perubahan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-950/30">
                        {filtered.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 text-slate-400 whitespace-nowrap font-mono">
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
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : log.action === 'DELETE' || log.action === 'PERMANENT_DELETE' || log.action === 'EMPTY_TRASH'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : log.action === 'RESTORE_BANK_SOAL'
                                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                                    : log.action === 'DOWNLOAD'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : log.action === 'SYNC'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                {log.action}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-[11px] text-blue-400">
                              {log.bank_soal_id || log.file_id || '-'}
                            </td>
                            <td className="p-3.5 text-slate-300 max-w-sm break-all font-mono text-[11px]">
                              {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* User CRUD Modal */}
      <UserCrudModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSaved={handleSaveUser}
        editingUser={editingUser}
      />

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
