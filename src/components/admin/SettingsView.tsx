import React, { useState } from "react";
import {
  Settings,
  Save,
  ShieldCheck,
  Zap,
  Sparkles,
  Database,
  RotateCcw,
} from "lucide-react";
import { SystemSettings } from "../../types";
import { AppStore } from "../../services/store";
import { toast } from "../ui/Toast";

interface SettingsViewProps {
  settings: SystemSettings;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onRefresh }) => {
  const [siteTitle, setSiteTitle] = useState(settings.site_title);
  const [schoolName, setSchoolName] = useState(settings.school_name);
  const [academicYear, setAcademicYear] = useState(settings.current_academic_year);
  const [semester, setSemester] = useState(settings.current_semester);
  const [allowTeacherUpload, setAllowTeacherUpload] = useState(settings.allow_teacher_upload);
  const [autoSyncSheets, setAutoSyncSheets] = useState(settings.auto_sync_sheets);
  const [autoFailover, setAutoFailover] = useState(settings.auto_failover);
  const [enableAiSuggest, setEnableAiSuggest] = useState(settings.enable_ai_suggest);
  const [maxUploadSizeMb, setMaxUploadSizeMb] = useState(settings.max_upload_size_mb);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    AppStore.updateSettings({
      site_title: siteTitle.trim(),
      school_name: schoolName.trim(),
      current_academic_year: academicYear.trim(),
      current_semester: semester,
      allow_teacher_upload: allowTeacherUpload,
      auto_sync_sheets: autoSyncSheets,
      auto_failover: autoFailover,
      enable_ai_suggest: enableAiSuggest,
      max_upload_size_mb: Number(maxUploadSizeMb),
    });

    toast.success("Pengaturan Tersimpan", "Konfigurasi sistem berhasil diperbarui");
    onRefresh();
  };

  const handleResetData = () => {
    if (confirm("Reset ulang data ke contoh awal (Seed Data)? Semua perubahan manual akan dikembalikan.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div id="settings-view" className="space-y-6 max-w-4xl">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-white tracking-tight">Pengaturan Sistem & Kebijakan</h2>
        <p className="text-xs text-slate-400 mt-1">
          Konfigurasi umum identitas sekolah, batasan berkas, sinkronisasi otomatis, dan integrasi AI.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Identitas Sekolah */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 text-xs">
          <h3 className="text-sm font-bold text-white">Identitas Sekolah & Aplikasi</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Judul Aplikasi</label>
              <input
                type="text"
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nama Lembaga / Sekolah</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tahun Ajaran Aktif</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Semester Aktif</label>
              <select
                value={semester}
                onChange={(e: any) => setSemester(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
          </div>
        </div>

        {/* Kebijakan Upload & AI */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 text-xs">
          <h3 className="text-sm font-bold text-white">Kebijakan Upload, Storage & Gemini AI</h3>

          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 bg-slate-850 border border-slate-800 rounded-xl cursor-pointer">
              <div>
                <span className="text-white font-semibold block">Izinkan Guru Mengunggah Naskah Soal</span>
                <span className="text-slate-400 text-[11px]">
                  Bila dinonaktifkan, hanya pengguna berstatus Administrator yang dapat mengunggah file.
                </span>
              </div>
              <input
                type="checkbox"
                checked={allowTeacherUpload}
                onChange={(e) => setAllowTeacherUpload(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-850 border border-slate-800 rounded-xl cursor-pointer">
              <div>
                <span className="text-white font-semibold block">
                  Sinkronisasi Otomatis ke Google Spreadsheet
                </span>
                <span className="text-slate-400 text-[11px]">
                  Setiap naskah baru langsung diindeks sebagai baris baru di spreadsheet yang terhubung.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoSyncSheets}
                onChange={(e) => setAutoSyncSheets(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-850 border border-slate-800 rounded-xl cursor-pointer">
              <div>
                <span className="text-white font-semibold block">
                  Automatic Failover Multi-Storage
                </span>
                <span className="text-slate-400 text-[11px]">
                  Otomatis beralih ke profil penyimpanan prioritas berikutnya bila profil utama error atau kuota penuh.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoFailover}
                onChange={(e) => setAutoFailover(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-850 border border-slate-800 rounded-xl cursor-pointer">
              <div>
                <span className="text-white font-semibold block">Gemini 3.7 AI Metadata Suggester</span>
                <span className="text-slate-400 text-[11px]">
                  Ekstraksi kecerdasan buatan untuk mengidentifikasi mata pelajaran, bab, dan tag dari nama file PDF.
                </span>
              </div>
              <input
                type="checkbox"
                checked={enableAiSuggest}
                onChange={(e) => setEnableAiSuggest(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
            </label>
          </div>
        </div>

        {/* Save & Reset */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleResetData}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-semibold border border-slate-700 hover:border-rose-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Pengaturan</span>
          </button>
        </div>
      </form>
    </div>
  );
};
