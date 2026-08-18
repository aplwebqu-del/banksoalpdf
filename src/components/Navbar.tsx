import React, { useState, useEffect } from 'react';
import { Search, Upload, User, ShieldCheck, GraduationCap, ChevronDown, Check, BookMarked, Menu } from 'lucide-react';
import { User as UserType } from '../types';
import { api } from '../lib/api';

export interface NavbarProps {
  currentUser: UserType;
  availableUsers?: UserType[];
  onSwitchUser: (user: UserType) => void;
  onOpenUpload: () => void;
  onSearchFocus?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit?: (q: string) => void;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  availableUsers: initialUsers,
  onSwitchUser,
  onOpenUpload,
  onSearchFocus,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onToggleSidebar,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [usersList, setUsersList] = useState<UserType[]>(initialUsers || []);

  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setUsersList(initialUsers);
    } else {
      api.getUsers()
        .then((res) => setUsersList(res.users))
        .catch(() => {});
    }
  }, [initialUsers]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      onSearchSubmit(searchQuery);
    }
  };

  const handleSelectUser = async (u: UserType) => {
    try {
      await api.switchUser(u.id);
      onSwitchUser(u);
    } catch {
      onSwitchUser(u);
    }
    setShowUserMenu(false);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-3 sm:px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      {/* Left: Hamburger & Brand */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
            title="Buka Navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20 font-bold text-lg">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-sm sm:text-base">Bank Soal PDF</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider hidden sm:inline-block">
                Terpadu
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden md:block">Repositori & Arsip Soal Pengajar</p>
          </div>
        </div>
      </div>

      {/* Global Quick Search Bar */}
      <div className="flex-1 max-w-xl mx-3 sm:mx-6 hidden md:block">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari judul, materi, mapel, kelas, bab, atau topik... (Tekan Enter)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onSearchFocus}
            className="w-full pl-10 pr-20 py-2 text-sm bg-slate-800/80 hover:bg-slate-800 focus:bg-slate-800 text-slate-100 placeholder-slate-400 rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-inner"
          />
          {onSearchSubmit && (
            <button
              onClick={() => onSearchSubmit(searchQuery)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
            >
              Cari
            </button>
          )}
        </div>
      </div>

      {/* Action Controls & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 transition-all hover:scale-[1.02]"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Upload PDF</span>
        </button>

        {/* User Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-all"
          >
            <div className="relative">
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                alt={currentUser.name}
                className="w-7 h-7 rounded-lg object-cover border border-slate-600"
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                  currentUser.role === 'ADMIN' ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
            </div>
            <div className="text-left hidden lg:block">
              <div className="text-xs font-semibold text-white leading-tight flex items-center gap-1.5">
                <span className="truncate max-w-[120px]">{currentUser.name.split(',')[0]}</span>
                {currentUser.role === 'ADMIN' ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                )}
              </div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                {currentUser.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* User Menu Modal / Dropdown */}
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-700 mb-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Akun Aktif</p>
                  <p className="text-sm font-bold text-white truncate mt-0.5">{currentUser.name}</p>
                  <p className="text-xs text-slate-400">{currentUser.institution || currentUser.email}</p>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md mt-1.5 ${
                      currentUser.role === 'ADMIN'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {currentUser.role === 'ADMIN' ? 'Hak Akses Administrator' : 'Hak Akses Pengajar / Guru'}
                  </span>
                </div>

                <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Ganti Akun (Simulasi Role)
                </div>

                <div className="space-y-1 mt-1 max-h-60 overflow-y-auto">
                  {usersList.map((u) => {
                    const isSelected = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                          isSelected
                            ? 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
                            : 'hover:bg-slate-700/60 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <img
                            src={u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                            alt={u.name}
                            className="w-7 h-7 rounded-lg object-cover"
                          />
                          <div className="truncate">
                            <div className="text-xs font-medium text-white truncate">{u.name}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>{u.role}</span>
                              <span>•</span>
                              <span className="truncate">{u.subject || 'Pengajar'}</span>
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
