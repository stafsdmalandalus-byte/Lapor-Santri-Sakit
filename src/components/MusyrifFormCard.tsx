import React, { useState, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
  Search,
  Send,
  X,
  Lock,
  Calendar,
  FileText,
  UserCheck,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import {
  type MasterSantri,
  type LaporanInput,
  type LaporanMusyrifRow,
  type DateRangeFilter,
  type MusyrifProfile,
  searchMasterSantri,
  validateLaporanInput,
  getTodayDateISO,
} from '../utils/ukpSyncEngine';
import {
  ReportOverview,
  type ReportStatusFilter,
} from './ReportOverview';

interface MusyrifFormCardProps {
  masterData: MasterSantri[];
  laporanList: LaporanMusyrifRow[];
  activeFilter: ReportStatusFilter;
  onSelectFilter: (filter: ReportStatusFilter) => void;
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  lastSyncTime: string | null;
  onQuickSync: () => void;
  onSubmitLaporan: (input: LaporanInput) => Promise<{ idLaporan: string }>;
  logoUrl: string;
  activeMusyrif?: MusyrifProfile | null;
  hideFullOverview?: boolean;
}

const KELUHAN_SHORTCUTS = [
  'Demam tinggi & menggigil sejak subuh',
  'Batuk berdahak, pilek & nyeri tenggorokan',
  'Sakit kepala / pusing berdenyut & lemas',
  'Nyeri ulu hati (maag kambuh) & mual',
  'Diare / gangguan pencernaan',
];

export const MusyrifFormCard: React.FC<MusyrifFormCardProps> = ({
  masterData,
  laporanList,
  activeFilter,
  onSelectFilter,
  dateRange,
  onDateRangeChange,
  lastSyncTime,
  onQuickSync,
  onSubmitLaporan,
  logoUrl,
  activeMusyrif = null,
  hideFullOverview = false,
}) => {
  const [tanggalLaporan, setTanggalLaporan] = useState<string>(() =>
    getTodayDateISO()
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSantri, setSelectedSantri] = useState<MasterSantri | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [keluhanUtama, setKeluhanUtama] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);

  const dropdownContainerRef = useRef<HTMLDivElement>(null);

  const filteredSantri = searchMasterSantri(searchQuery, masterData);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSantri = (santri: MasterSantri) => {
    setSelectedSantri(santri);
    setSearchQuery(santri.namaSantri);
    setIsDropdownOpen(false);
  };

  const handleClearSantri = () => {
    setSelectedSantri(null);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleAddKeluhanShortcut = (shortcut: string) => {
    setKeluhanUtama((prev) => {
      if (!prev.trim()) return shortcut;
      if (prev.includes(shortcut)) return prev;
      return `${prev.trim()}, ${shortcut.toLowerCase()}`;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const pelaporName = activeMusyrif?.namaMusyrif || 'Admin Pengasuhan';
    const inputPayload: LaporanInput = {
      idSantri: selectedSantri?.idSantri || '',
      namaSantri: selectedSantri?.namaSantri || '',
      kelas: selectedSantri?.kelas || '',
      kamar: selectedSantri?.kamar || '',
      tanggalLaporan,
      keluhanUtama,
      namaMusyrif: pelaporName,
      musrif_pelapor: pelaporName,
    };

    const validation = validateLaporanInput(inputPayload);
    if (!validation.valid) {
      await Swal.fire({
        icon: 'warning',
        title: 'Data Belum Lengkap',
        text: validation.errorMessage,
        confirmButtonColor: '#047857',
        confirmButtonText: 'Perbaiki Input',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmitLaporan(inputPayload);

      await Swal.fire({
        icon: 'success',
        title: 'Laporan Berhasil Dikirim!',
        html: `<div class="text-sm text-slate-600 space-y-1">
          <p>Data sakit santri <b>${inputPayload.namaSantri}</b> (${inputPayload.kelas} · ${inputPayload.kamar}) telah masuk ke <code>Laporan_Musyrif</code>.</p>
          <p class="text-xs text-slate-500">Pelapor: <b>${inputPayload.namaMusyrif}</b></p>
          <p class="font-mono text-xs text-emerald-700 pt-1">ID Laporan: ${result.idLaporan} · Status: MENUNGGU PENANGANAN</p>
        </div>`,
        confirmButtonColor: '#047857',
        confirmButtonText: 'Selesai',
      });

      // Reset form setelah sukses
      setSelectedSantri(null);
      setSearchQuery('');
      setKeluhanUtama('');
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Gagal Mengirim Laporan',
        text:
          error instanceof Error
            ? error.message
            : 'Terjadi kesalahan saat mengirim data ke Laporan_Musyrif.',
        confirmButtonColor: '#047857',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header Kartu Identitas Pesantren Al-Andalus */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#07361D] via-[#0B4627] to-[#052613] text-white rounded-3xl p-6 shadow-md mb-5 border-2 border-[#D4AF37]/50">
        {/* Ornamen Geometri Andalusia */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 w-40 h-40 text-[#F5D000]/10"
          viewBox="0 0 120 120"
          fill="none"
        >
          <circle cx="60" cy="60" r="52" stroke="currentColor" strokeWidth="2" />
          <rect
            x="24"
            y="24"
            width="72"
            height="72"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <rect
            x="24"
            y="24"
            width="72"
            height="72"
            transform="rotate(45 60 60)"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>

        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FAF8F2] p-1.5 shadow-md ring-2 ring-[#D4AF37]/80 shrink-0 flex items-center justify-center overflow-hidden">
            {!imgError ? (
              <img
                src={logoUrl}
                alt="Logo Pesantren Al-Andalus"
                onError={() => setImgError(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-emerald-50 flex items-center justify-center text-[#0B4627] font-bold text-lg">
                AA
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-[#F5D000]">
              Pesantren Al-Andalus
            </p>
            <h2 className="text-xl font-bold tracking-tight text-white leading-snug">
              Portal Lapor Sakit Santri
            </h2>
            <p className="text-xs text-emerald-100/90 mt-1">
              Formulir Pelaporan Musyrif · Integrasi Otomatis UKP
            </p>
          </div>
        </div>
      </div>

      {/* Komponen Report Overview Lengkap (Tampil di Mode Admin) */}
      {!hideFullOverview && (
        <ReportOverview
          laporanList={laporanList}
          activeFilter={activeFilter}
          onSelectFilter={onSelectFilter}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          lastSyncTime={lastSyncTime}
          onQuickSync={onQuickSync}
        />
      )}

      {/* Kartu Utama Form Musyrif */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90">
        <div className="flex items-start justify-between gap-3 pb-4 mb-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Input Laporan Santri Sakit
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeMusyrif ? (
                <>
                  Pelapor aktif:{' '}
                  <strong className="text-emerald-800">
                    {activeMusyrif.namaMusyrif}
                  </strong>{' '}
                  ({activeMusyrif.gedungAsrama})
                </>
              ) : (
                <>
                  Pilih santri dari <span className="font-mono">Master_Data</span> untuk mengisi Kelas &amp; Kamar otomatis
                </>
              )}
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap shrink-0 pt-0.5">
            {masterData.length} Santri
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Musyrif Pelapor (Otomatis dari Nama Login di Sheet users_role) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="input-musrif-pelapor"
                className="block text-xs font-semibold text-slate-700"
              >
                Musyrif Pelapor (<span className="font-mono">musrif_pelapor</span>)
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                <UserCheck className="w-3 h-3" />
                Sesuai Login
              </span>
            </div>
            <input
              id="input-musrif-pelapor"
              data-testid="input-musrif-pelapor"
              type="text"
              readOnly
              value={activeMusyrif?.namaMusyrif || 'Admin Pengasuhan'}
              className="w-full rounded-xl border border-slate-200 bg-stone-100/90 px-3.5 py-2.5 text-sm font-semibold text-slate-800 cursor-not-allowed focus:outline-none"
            />
          </div>

          {/* Tanggal Laporan (Kolom C) — Otomatis Real-Time & Tetap Bisa Pilih Tanggal */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="input-tanggal-laporan"
                className="block text-xs font-semibold text-slate-700"
              >
                Tanggal Laporan (Kolom C) <span className="text-rose-600">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                {tanggalLaporan !== getTodayDateISO() ? (
                  <button
                    type="button"
                    onClick={() => setTanggalLaporan(getTodayDateISO())}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md cursor-pointer"
                  >
                    Set Hari Ini
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Hari Ini (Real-Time)
                  </span>
                )}
              </div>
            </div>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-tanggal-laporan"
                type="date"
                value={tanggalLaporan}
                onChange={(e) => setTanggalLaporan(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 font-mono tabular-nums transition focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Autocomplete Nama Santri (Kolom A Master_Data -> Kolom F Laporan_Musyrif) */}
          <div ref={dropdownContainerRef} className="relative">
            <label
              htmlFor="input-nama-santri"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Nama Santri (Autocomplete <span className="font-mono">Master_Data</span>){' '}
              <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-nama-santri"
                type="text"
                role="combobox"
                aria-expanded={isDropdownOpen}
                aria-controls="santri-autocomplete-list"
                aria-autocomplete="list"
                value={searchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedSantri(null);
                  setIsDropdownOpen(true);
                }}
                placeholder="Ketik nama santri, kelas, kamar, atau ID..."
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 transition focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-500/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSantri}
                  aria-label="Hapus pilihan santri"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Autocomplete */}
            {isDropdownOpen && (
              <div
                id="santri-autocomplete-list"
                role="listbox"
                className="absolute z-30 mt-1.5 w-full max-h-60 overflow-y-auto rounded-2xl bg-white shadow-xl border border-slate-200 divide-y divide-slate-100"
              >
                {filteredSantri.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Nama santri &ldquo;{searchQuery}&rdquo; tidak ditemukan pada sheet{' '}
                    <span className="font-mono">Master_Data</span>.
                  </div>
                ) : (
                  filteredSantri.map((santri, idx) => {
                    const isSelected =
                      selectedSantri?.idSantri === santri.idSantri &&
                      selectedSantri?.namaSantri === santri.namaSantri;
                    return (
                      <button
                        key={`${santri.idSantri}-${santri.namaSantri}-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectSantri(santri)}
                        className={`w-full text-left px-4 py-3 transition flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-emerald-50/90 text-emerald-950'
                            : 'hover:bg-emerald-50/60 text-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {santri.namaSantri}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Kelas {santri.kelas} · Kamar {santri.kamar}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-emerald-700 shrink-0 tabular-nums">
                          {santri.idSantri}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Indikator Santri Terpilih */}
          {selectedSantri && (
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 px-3.5 py-2.5 flex items-center justify-between text-xs text-emerald-900">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="truncate">
                  Terpilih: <strong>{selectedSantri.namaSantri}</strong>
                </span>
              </div>
              <span className="font-mono text-emerald-800 shrink-0">
                {selectedSantri.idSantri}
              </span>
            </div>
          )}

          {/* Input Kelas (Kolom B Master_Data -> Kolom G Laporan_Musyrif) & Kamar (Kolom F Master_Data -> Kolom H Laporan_Musyrif) READONLY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="input-kelas-readonly"
                className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5"
              >
                <span>Kelas (Kolom B → G)</span>
                <span className="text-[11px] font-normal text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Terkunci
                </span>
              </label>
              <input
                id="input-kelas-readonly"
                type="text"
                readOnly
                value={selectedSantri?.kelas || ''}
                placeholder="Otomatis saat santri dipilih"
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-700 cursor-not-allowed focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="input-kamar-readonly"
                className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5"
              >
                <span>Kamar (Kolom F → H)</span>
                <span className="text-[11px] font-normal text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Terkunci
                </span>
              </label>
              <input
                id="input-kamar-readonly"
                type="text"
                readOnly
                value={selectedSantri?.kamar || ''}
                placeholder="Otomatis saat santri dipilih"
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-700 cursor-not-allowed focus:outline-none"
              />
            </div>
          </div>

          {/* ID Santri Readonly (Kolom G Master_Data -> Kolom E Laporan_Musyrif) */}
          <div>
            <label
              htmlFor="input-idsantri-readonly"
              className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5"
            >
              <span>ID Santri (Kolom G → E)</span>
              <span className="text-[11px] font-normal text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Readonly
              </span>
            </label>
            <input
              id="input-idsantri-readonly"
              type="text"
              readOnly
              value={selectedSantri?.idSantri || ''}
              placeholder="ID_Santri otomatis terisi dari Master_Data"
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-mono text-slate-600 cursor-not-allowed focus:outline-none tabular-nums"
            />
          </div>

          {/* Keluhan Utama (Kolom J Laporan_Musyrif) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="input-keluhan-utama"
                className="block text-xs font-semibold text-slate-700"
              >
                Keluhan Utama (Kolom J) <span className="text-rose-600">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Pilih cepat atau ketik manual
              </span>
            </div>

            {/* Quick Pick Gejala */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {KELUHAN_SHORTCUTS.map((gejala) => (
                <button
                  key={gejala}
                  type="button"
                  onClick={() => handleAddKeluhanShortcut(gejala)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 transition cursor-pointer"
                >
                  + {gejala}
                </button>
              ))}
            </div>

            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <textarea
                id="input-keluhan-utama"
                rows={3}
                value={keluhanUtama}
                onFocus={() => setIsDropdownOpen(false)}
                onChange={(e) => setKeluhanUtama(e.target.value)}
                required
                placeholder="Tuliskan keluhan utama, suhu tubuh (bila ada), dan waktu mulai gejala..."
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 transition focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Info Default Status Penanganan (Kolom L) */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              Status Awal (Kolom L):
            </span>
            <span className="font-mono font-semibold text-amber-700">
              MENUNGGU PENANGANAN
            </span>
          </div>

          {/* Submit Button dengan Efek Hover & Loading Spinner */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-semibold text-sm px-5 py-3 shadow-md shadow-emerald-900/10 transition flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                <span>Mengirim ke Laporan_Musyrif...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Kirim Laporan Sakit</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
