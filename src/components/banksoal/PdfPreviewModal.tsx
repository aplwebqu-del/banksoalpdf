import React, { useState } from "react";
import {
  X,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  FileText,
  BookOpen,
  Calendar,
  Layers,
  History,
  Tag,
  HardDrive,
  CheckCircle,
  Copy,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Star,
} from "lucide-react";
import { BankSoal, UserProfile } from "../../types";
import { AppStore } from "../../services/store";
import { toast } from "../ui/Toast";

interface PdfPreviewModalProps {
  item: BankSoal | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onEdit: (item: BankSoal) => void;
  onOpenVersionHistory: (item: BankSoal) => void;
  onDelete: (item: BankSoal) => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  item,
  isOpen,
  onClose,
  currentUser,
  onEdit,
  onOpenVersionHistory,
  onDelete,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showMetadataSidebar, setShowMetadataSidebar] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  if (!isOpen || !item) return null;

  const isFav = AppStore.isFavorite(item.id, currentUser.id);

  const handleDownload = () => {
    AppStore.recordDownload(item.id);
    toast.success("Mengunduh Berkas PDF", item.file_name);
    if (item.download_url) {
      window.open(item.download_url, "_blank");
    } else if (item.web_view_url) {
      window.open(item.web_view_url, "_blank");
    }
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(item.file_hash);
    toast.info("SHA-256 Checksum Disalin", item.file_hash.slice(0, 16) + "...");
  };

  const handleToggleFavorite = () => {
    const isNow = AppStore.toggleFavorite(item.id);
    if (isNow) toast.success("Ditambahkan ke Favorit", item.title);
    else toast.info("Dihapus dari Favorit", item.title);
  };

  return (
    <div
      id="pdf-preview-modal"
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md transition-all ${
        isFullscreen ? "p-0" : ""
      }`}
    >
      <div
        className={`bg-slate-900 border border-slate-800 rounded-3xl w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
          isFullscreen ? "h-screen rounded-none border-none" : "max-w-6xl h-[92vh]"
        }`}
      >
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-850">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-slate-800 text-blue-400 px-1.5 py-0.2 rounded">
                  {item.business_id}
                </span>
                <span className="text-xs text-slate-400 truncate">
                  v{item.current_version_number} • {item.mata_pelajaran} Kelas {item.kelas}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white truncate max-w-md sm:max-w-xl">
                {item.title}
              </h3>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-xl border border-slate-700 transition-colors ${
                isFav
                  ? "bg-amber-400/20 text-amber-400 border-amber-500/30"
                  : "bg-slate-800 text-slate-300 hover:text-white"
              }`}
              title="Favorit"
            >
              <Star className={`w-4 h-4 ${isFav ? "fill-amber-400" : ""}`} />
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unduh PDF</span>
            </button>

            {item.web_view_url && (
              <a
                href={item.web_view_url}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors"
                title="Buka Langsung di Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Google Drive</span>
              </a>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl border border-slate-700"
              title="Layar Penuh"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Workspace: Viewer (Center) + Metadata Pane (Right) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Center PDF Viewer Canvas Simulator */}
          <div className="flex-1 bg-slate-950 flex flex-col justify-between overflow-hidden relative">
            {/* Viewer Toolbar */}
            <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] w-12 text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 ml-1"
                  title="Rotate"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Page Navigator */}
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span>
                  Halaman <span className="font-semibold text-white">{currentPage}</span> dari{" "}
                  <span className="font-semibold text-white">{item.page_count}</span>
                </span>
                <button
                  disabled={currentPage >= item.page_count}
                  onClick={() => setCurrentPage((p) => Math.min(item.page_count, p + 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setShowMetadataSidebar(!showMetadataSidebar)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  showMetadataSidebar
                    ? "bg-blue-600/20 border-blue-500 text-blue-300"
                    : "bg-slate-800 border-slate-700 text-slate-300"
                }`}
              >
                {showMetadataSidebar ? "Sembunyikan Metadata" : "Tampilkan Metadata"}
              </button>
            </div>

            {/* Document Render Canvas */}
            <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center">
              <div
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease-out",
                }}
                className="bg-white text-slate-900 rounded-lg shadow-2xl w-full max-w-2xl min-h-[750px] p-8 sm:p-12 relative flex flex-col justify-between"
              >
                {/* PDF Header Mock */}
                <div>
                  <div className="border-b-2 border-slate-900 pb-4 text-center">
                    <p className="text-[11px] font-bold tracking-wider uppercase text-slate-600">
                      REPOSITORI NASKAH SOAL EVALUASI & ASESMEN PEMBELAJARAN
                    </p>
                    <h2 className="text-xl font-bold uppercase mt-1 tracking-tight text-slate-900">
                      {item.title}
                    </h2>
                    <p className="text-xs text-slate-700 mt-1 font-semibold">
                      Mata Pelajaran: {item.mata_pelajaran} | Tingkat: Kelas {item.kelas} ({item.jenjang}) | Tahun: {item.tahun_ajaran}
                    </p>
                  </div>

                  {/* Document Meta Row */}
                  <div className="grid grid-cols-2 text-xs py-3 border-b border-slate-200 text-slate-700">
                    <div>
                      <p><strong>Bentuk Soal:</strong> {item.jenis_soal}</p>
                      <p><strong>Kurikulum:</strong> {item.kurikulum}</p>
                    </div>
                    <div className="text-right">
                      <p><strong>Tingkat Kesulitan:</strong> {item.tingkat_kesulitan}</p>
                      <p><strong>Semester:</strong> {item.semester}</p>
                    </div>
                  </div>

                  {/* Sample Questions Body Render */}
                  <div className="mt-6 space-y-6 text-xs text-slate-800">
                    <div className="space-y-2">
                      <p className="font-bold">
                        1. Berdasarkan capaian pembelajaran pada materi {item.bab}, perhatikan pernyataan analisis berikut:
                      </p>
                      <p className="text-slate-600 italic pl-4 border-l-2 border-slate-300">
                        "{item.deskripsi || 'Siswa diharapkan mampu menganalisis permasalahan kontekstual dan menyelesaikan model penyelesaian secara terstruktur.'}"
                      </p>
                      <p className="pt-1">
                        Pernyataan yang paling tepat untuk menggambarkan karakteristik konsep di atas adalah...
                      </p>
                      <div className="grid grid-cols-1 gap-1.5 pl-4 pt-1 font-medium">
                        <div className="p-1.5 rounded hover:bg-slate-100 flex items-center gap-2">
                          <span className="font-bold">A.</span> Memiliki keterkaitan variabel independen terhadap sistem evaluasi terpadu.
                        </div>
                        <div className="p-1.5 rounded hover:bg-slate-100 flex items-center gap-2">
                          <span className="font-bold">B.</span> Menerapkan prinsip penyederhanaan fungsi linear non-komutatif.
                        </div>
                        <div className="p-1.5 rounded hover:bg-slate-100 flex items-center gap-2">
                          <span className="font-bold">C.</span> Menghasilkan representasi model sesuai rubrik asesmen Kurikulum Merdeka.
                        </div>
                        <div className="p-1.5 rounded hover:bg-slate-100 flex items-center gap-2">
                          <span className="font-bold">D.</span> Mengintegrasikan pendekatan studi kasus kontekstual berbasis numerasi.
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-slate-100">
                      <p className="font-bold">
                        2. Uraikan langkah-langkah sistematis dalam menyelesaikan permasalahan {item.topik}:
                      </p>
                      <div className="h-20 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400 italic">
                        [Ruang Jawaban Lembar Kerja Siswa]
                      </div>
                    </div>
                  </div>
                </div>

                {/* PDF Footer Mock */}
                <div className="pt-6 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>ID: {item.business_id} • Versi {item.current_version_number}</span>
                  <span>Halaman {currentPage} dari {item.page_count}</span>
                  <span>Bank Soal PDF SaaS Archive</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Metadata Pane */}
          {showMetadataSidebar && (
            <div className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 p-5 overflow-y-auto space-y-5 text-xs text-slate-300 shrink-0">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-white">Detail & Metadata Soal</h4>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    item.sync_status === "SYNCED"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}
                >
                  {item.sync_status}
                </span>
              </div>

              {/* Core Information */}
              <div className="space-y-2.5">
                <div>
                  <span className="text-slate-500 font-medium block">Nomor Arsip / ID:</span>
                  <span className="font-mono font-bold text-blue-400 text-sm">{item.business_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Mata Pelajaran:</span>
                  <span className="font-bold text-white">{item.mata_pelajaran}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Jenjang & Kelas:</span>
                  <span className="font-bold text-white">
                    {item.jenjang} - Kelas {item.kelas}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Kurikulum:</span>
                  <span className="font-bold text-white">{item.kurikulum}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Bab / Pokok Bahasan:</span>
                  <span className="font-bold text-white">{item.bab}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Topik / Subtopik:</span>
                  <span className="font-bold text-white">
                    {item.topik} {item.subtopik ? `(${item.subtopik})` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Bentuk & Tingkat Kesulitan:</span>
                  <span className="font-bold text-white">
                    {item.jenis_soal} • {item.tingkat_kesulitan}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Tahun Ajaran & Semester:</span>
                  <span className="font-bold text-white">
                    {item.tahun_ajaran} ({item.semester})
                  </span>
                </div>
              </div>

              {/* Tags */}
              <div>
                <span className="text-slate-500 font-medium block mb-1.5">Tags & Label:</span>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((t) => (
                    <span
                      key={t}
                      className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md text-[11px]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Storage & Checksum */}
              <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Penyimpanan & Checksum
                </span>
                <div>
                  <span className="text-slate-500 block">Profil Storage:</span>
                  <span className="font-semibold text-slate-200">{item.storage_profile_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Google Drive File ID:</span>
                  <span className="font-mono text-slate-300 text-[10px] break-all">
                    {item.drive_file_id || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">SHA-256 Checksum:</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono text-[10px] text-slate-400 truncate max-w-[200px]">
                      {item.file_hash}
                    </span>
                    <button
                      onClick={handleCopyHash}
                      className="p-1 hover:text-white text-slate-400"
                      title="Salin Hash"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Version History Button */}
              <button
                onClick={() => {
                  onClose();
                  onOpenVersionHistory(item);
                }}
                className="w-full flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-750 rounded-xl border border-slate-700 text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold">Riwayat Versi Naskah</span>
                </div>
                <span className="font-bold text-purple-300">v{item.current_version_number}</span>
              </button>

              {/* Bottom Actions */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => {
                    onClose();
                    onEdit(item);
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Metadata Soal</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onDelete(item);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 font-semibold rounded-xl border border-slate-700 hover:border-rose-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Pindahkan ke Sampah</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
