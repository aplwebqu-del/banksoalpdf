import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ToastProvider, useToast } from './components/Toast';
import { UploadModal } from './components/UploadModal';
import { EditSoalModal } from './components/EditSoalModal';
import { PdfViewerModal } from './components/PdfViewerModal';
import { HomeDashboardView } from './views/HomeDashboardView';
import { BankSoalListView } from './views/BankSoalListView';
import { CategoriesExplorerView } from './views/CategoriesExplorerView';
import { FavoritesView } from './views/FavoritesView';
import { HistoryView } from './views/HistoryView';
import { AdminPanelView } from './views/AdminPanelView';
import { SettingsView } from './views/SettingsView';
import { api } from './lib/api';
import { BankSoal, User, StatsOverview, FilterParams } from './types';

const MainApp: React.FC = () => {
  const { showToast } = useToast();

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Global Current User (Default to Guru, switchable to Admin)
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'user-guru-1',
    name: 'Budi Santoso, S.Pd',
    email: 'budi.santoso@sekolah.sch.id',
    role: 'GURU',
    school_institution: 'SMP Negeri 1 Surabaya',
  });

  // Global Modals State
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [editingSoal, setEditingSoal] = useState<BankSoal | null>(null);
  const [previewSoal, setPreviewSoal] = useState<BankSoal | null>(null);

  // Shared Data States
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [activeFilters, setActiveFilters] = useState<FilterParams>({});
  const [tagsList, setTagsList] = useState<{ tag: string; count: number }[]>([]);

  // Load Initial Global Stats & Tags
  useEffect(() => {
    loadGlobalData();
  }, [currentUser]);

  const loadGlobalData = async () => {
    try {
      const [statsRes, tagsRes] = await Promise.all([
        api.getStats(),
        api.getTags(),
      ]);
      setStats(statsRes);
      setTagsList(tagsRes.tags);
    } catch (err: any) {
      console.error('Error loading global data:', err);
    }
  };

  const handleGlobalSearchSubmit = (query: string) => {
    setActiveFilters((prev) => ({ ...prev, search: query }));
    setActiveTab('bank-soal');
  };

  const handleSelectMapelFromHome = (mapel: string) => {
    if (mapel === 'Semua') {
      setActiveFilters({});
    } else {
      setActiveFilters({ mata_pelajaran: mapel });
    }
    setActiveTab('bank-soal');
  };

  const handleCategoryFilterSelect = (key: string, val: string) => {
    setActiveFilters({ [key]: val });
    setActiveTab('bank-soal');
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      const res = await api.toggleFavorite(id);
      showToast(
        res.is_favorite
          ? 'Soal berhasil ditambahkan ke daftar Favorit!'
          : 'Soal dihapus dari daftar Favorit.',
        'success'
      );
      loadGlobalData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status favorit', 'error');
    }
  };

  const handleDeleteSoal = async (id: string, judul: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus bank soal "${judul}"? File PDF dan seluruh versinya akan dihapus permanen.`)) {
      return;
    }
    try {
      await api.deleteBankSoal(id);
      showToast(`Bank soal "${judul}" berhasil dihapus.`, 'success');
      loadGlobalData();
      if (previewSoal?.id === id) setPreviewSoal(null);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus bank soal', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onSwitchUser={(user) => {
          setCurrentUser(user);
          showToast(`Akun aktif dialihkan ke: ${user.name} (${user.role})`, 'info');
        }}
        onOpenUpload={() => setIsUploadOpen(true)}
        searchQuery={globalSearch}
        onSearchChange={setGlobalSearch}
        onSearchSubmit={handleGlobalSearchSubmit}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          currentView={activeTab}
          onNavigate={(view) => {
            if (view === 'terbaru') {
              setActiveFilters({ sortBy: 'terbaru' });
              setActiveTab('bank-soal');
            } else if (view === 'semua_soal') {
              setActiveFilters({});
              setActiveTab('bank-soal');
            } else {
              setActiveTab(view);
            }
          }}
          onSelectTab={setActiveTab}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onCloseMobile={() => setIsSidebarOpen(false)}
          currentUserRole={currentUser.role}
          userRole={currentUser.role}
          favCount={stats?.soal_favorit || 0}
          totalSoalCount={stats?.total_soal || 0}
          onOpenUpload={() => setIsUploadOpen(true)}
        />

        {/* Content View Canvas */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* View 1: Home Dashboard */}
            {activeTab === 'dashboard' && (
              <HomeDashboardView
                stats={stats}
                searchQuery={globalSearch}
                onSearchChange={setGlobalSearch}
                onSearchSubmit={handleGlobalSearchSubmit}
                onSelectMapel={handleSelectMapelFromHome}
                onPreviewSoal={(soal) => setPreviewSoal(soal)}
                onToggleFavorite={handleToggleFavorite}
                onNavigateAll={() => {
                  setActiveFilters({});
                  setActiveTab('bank-soal');
                }}
                onOpenUpload={() => setIsUploadOpen(true)}
              />
            )}

            {/* View 2: All Bank Soal Directory */}
            {activeTab === 'bank-soal' && (
              <BankSoalListView
                key={JSON.stringify(activeFilters)}
                initialFilters={activeFilters}
                currentUser={currentUser}
                onPreview={(soal) => setPreviewSoal(soal)}
                onEdit={(soal) => setEditingSoal(soal)}
                onDelete={handleDeleteSoal}
                onToggleFavorite={handleToggleFavorite}
                onOpenUpload={() => setIsUploadOpen(true)}
              />
            )}

            {/* View 3: Categories & Organization Explorer */}
            {activeTab.startsWith('kategori-') && (
              <CategoriesExplorerView
                activeSection={activeTab.replace('kategori-', '') as any}
                onSelectFilter={handleCategoryFilterSelect}
                tagsList={tagsList}
              />
            )}

            {/* View 4: Favorites */}
            {activeTab === 'favorit' && (
              <FavoritesView
                currentUser={currentUser}
                onPreview={(soal) => setPreviewSoal(soal)}
                onToggleFavorite={handleToggleFavorite}
                onNavigateAll={() => {
                  setActiveFilters({});
                  setActiveTab('bank-soal');
                }}
              />
            )}

            {/* View 5: Activity History */}
            {activeTab === 'riwayat' && <HistoryView />}

            {/* View 6: Admin Panel */}
            {activeTab === 'admin' && (
              <AdminPanelView
                currentUser={currentUser}
                onSwitchUser={(user) => {
                  setCurrentUser(user);
                  showToast(`Akun aktif: ${user.name} (${user.role})`, 'info');
                }}
              />
            )}

            {/* View 7: Settings */}
            {activeTab === 'pengaturan' && <SettingsView />}
          </div>
        </main>
      </div>

      {/* Global Modals */}
      {/* 1. Upload Bank Soal Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={(newSoal) => {
          loadGlobalData();
          setPreviewSoal(newSoal);
          setActiveTab('bank-soal');
        }}
        currentUser={currentUser}
      />

      {/* 2. Edit Metadata Modal */}
      <EditSoalModal
        soal={editingSoal}
        onClose={() => setEditingSoal(null)}
        onSuccess={(updated) => {
          loadGlobalData();
          if (previewSoal?.id === updated.id) {
            setPreviewSoal(updated);
          }
        }}
      />

      {/* 3. Interactive PDF Viewer Modal */}
      <PdfViewerModal
        soal={previewSoal}
        onClose={() => setPreviewSoal(null)}
        onToggleFavorite={handleToggleFavorite}
        onEdit={(soal) => {
          setPreviewSoal(null);
          setEditingSoal(soal);
        }}
        onDelete={handleDeleteSoal}
        currentUser={currentUser}
      />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
