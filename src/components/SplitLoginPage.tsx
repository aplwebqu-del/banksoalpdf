import React, { useState } from "react";
import {
  FileText,
  Shield,
  GraduationCap,
  Sparkles,
  HardDrive,
  FileSpreadsheet,
  Lock,
  ArrowRight,
  CheckCircle2,
  Zap,
  Users,
  Database,
  Search,
  KeyRound,
  Mail,
  Eye,
  EyeOff,
  Building,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { UserProfile } from "../types";
import { AppStore } from "../services/store";
import { toast } from "./ui/Toast";

interface SplitLoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const SplitLoginPage: React.FC<SplitLoginPageProps> = ({ onLoginSuccess }) => {
  const users = AppStore.getUsers();
  const settings = AppStore.getSettings();
  const [identifierInput, setIdentifierInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showCredentialsHelp, setShowCredentialsHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFormLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifierInput.trim()) {
      toast.error("Username, Email, atau NIP Wajib Diisi");
      return;
    }
    if (!passwordInput.trim()) {
      toast.error("Kata Sandi Wajib Diisi");
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const result = AppStore.authenticate(identifierInput, passwordInput);
      setIsLoading(false);

      if (result.success && result.user) {
        toast.success("Login Berhasil!", `Selamat datang kembali, ${result.user.name}`);
        onLoginSuccess(result.user);
      } else {
        toast.error("Gagal Masuk", result.message || "Kredensial tidak cocok.");
      }
    }, 350);
  };

  const handleFillCredentials = (u: UserProfile) => {
    setIdentifierInput(u.username || u.email);
    setPasswordInput(u.password || (u.role === "ADMIN" ? "admin" : "guru"));
  };

  return (
    <div
      id="split-login-page"
      className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col lg:flex-row selection:bg-blue-600 selection:text-white"
    >
      {/* Left Column: Visual Showcase & Brand Highlights */}
      <div className="w-full lg:w-7/12 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
        {/* Ambient background glows */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header & Institution Branding */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3.5">
            {settings.institution_logo_url ? (
              <img
                src={settings.institution_logo_url}
                alt="Logo Lembaga"
                className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shadow-xl shadow-blue-500/10 bg-slate-800"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-blue-500/20">
                <FileText className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-white">
                  {settings.site_title || "Bank Soal PDF"}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Portal Resmi
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {settings.school_name || "SMA Negeri Unggulan 1"} • {settings.app_subtitle || "Repositori & Arsip Soal Pengajar"}
              </p>
            </div>
          </div>

          <div className="pt-6 space-y-3 max-w-xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Temukan, Kelola & Arsipkan Bank Soal dengan Cepat
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Repositori digital naskah ujian guru terintegrasi cloud database Google Spreadsheet 7 tabel & Google Drive dengan deteksi duplicate hash SHA-256.
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="relative z-10 my-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-2 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Pencarian Cepat Berindeks
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Temukan naskah soal berdasarkan mata pelajaran, jenjang, kelas, kurikulum, bab, dan tags dalam hitungan detik.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-2 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              7 Tabel Database Cloud
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tersinkronisasi otomatis ke Google Spreadsheet (Users, Bank Soal, Categories, Tags, Activity, Settings, Sync Log).
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-2 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              SHA-256 Anti-Duplikasi
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deteksi otomatis berkas kembar dengan checksum hash kriptografis sebelum file terunggah.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 space-y-2 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              AI Metadata Assistant
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Rekomendasi otomatis taksonomi soal dan materi ujian bertenaga model Gemini terintegrasi.
            </p>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="relative z-10 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Sistem Otentikasi & Hak Akses Pengajar Terproteksi</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">v2.5 Production</span>
        </div>
      </div>

      {/* Right Column: Secure Form Login (Strictly Credentials Login) */}
      <div className="w-full lg:w-5/12 bg-slate-950 p-8 sm:p-12 lg:p-16 flex flex-col justify-center items-center">
        <div className="w-full max-w-md space-y-7">
          {/* Header */}
          <div className="space-y-2 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Autentikasi Terenkripsi</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Masuk ke Repositori Soal
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Gunakan Username, Email, atau NIP terdaftar serta kata sandi Anda.
            </p>
          </div>

          {/* Form Login */}
          <form onSubmit={handleFormLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span>Username / Email / NIP Pengajar:</span>
              </label>
              <input
                id="login-identifier-input"
                type="text"
                value={identifierInput}
                onChange={(e) => setIdentifierInput(e.target.value)}
                placeholder="contoh: admin, siti.rahmawati, atau NIP"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Kata Sandi:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-slate-400 hover:text-blue-400 flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showPassword ? "Sembunyikan" : "Lihat Sandi"}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password-input"
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Masukkan kata sandi akun"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              id="form-login-submit-btn"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-2 mt-3"
            >
              <span>{isLoading ? "Memverifikasi Kredensial..." : "Masuk ke Sistem Bank Soal"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Collapsible Info Credentials Reference */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
            <button
              type="button"
              id="toggle-credentials-help-btn"
              onClick={() => setShowCredentialsHelp(!showCredentialsHelp)}
              className="w-full p-3 flex items-center justify-between text-left text-xs font-semibold text-slate-300 hover:bg-slate-850 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                <span>Informasi Login & Akun Terdaftar (Database)</span>
              </div>
              {showCredentialsHelp ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showCredentialsHelp && (
              <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/60 space-y-2.5 text-xs text-slate-300">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Daftar akun pengajar dan administrator yang tersimpan dalam tabel database sistem:
                </p>
                <div className="space-y-1.5">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleFillCredentials(u)}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-blue-500/50 cursor-pointer flex items-center justify-between transition-all group"
                      title="Klik untuk mengisi form otomatis"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                          alt={u.name}
                          className="w-7 h-7 rounded-full object-cover border border-slate-700"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                              {u.name.split(",")[0]}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                u.role === "ADMIN"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                              }`}
                            >
                              {u.role}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            user: <b>{u.username || u.email}</b> • pass: <b>{u.password || (u.role === "ADMIN" ? "admin" : "guru")}</b>
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Gunakan ↵
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  * Catatan: Fitur Switch User langsung tanpa kata sandi hanya tersedia di Panel Admin.
                </p>
              </div>
            )}
          </div>

          {/* Database Notice */}
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 flex items-center gap-3">
            <Database className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="leading-relaxed text-[11px]">
              Tersambung ke database Google Spreadsheet 7 tabel dengan proteksi hak akses berbasis peran (RBAC).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
