import React, { useState, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
  UserCheck,
  LogOut,
  Clock,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  Search,
  X,
} from 'lucide-react';
import {
  splitLaporanByHandlingStatus,
  authenticateUserRole,
  searchUsersRoleByName,
  normalizeRoleValue,
  type UserRole,
  type UserRoleRow,
  type MusyrifProfile,
  type MasterSantri,
  type LaporanMusyrifRow,
  type LaporanInput,
  type DateRangeFilter,
} from '../utils/ukpSyncEngine';
import { MusyrifFormCard } from './MusyrifFormCard';
import { type ReportStatusFilter } from './ReportOverview';

interface MusyrifRolePortalProps {
  usersRoleList: UserRoleRow[];
  activeMusyrif: MusyrifProfile | null;
  onSelectMusyrif: (musyrif: MusyrifProfile | null) => void;
  onSwitchToRole: (role: UserRole) => void;
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
}

export const MusyrifRolePortal: React.FC<MusyrifRolePortalProps> = ({
  usersRoleList,
  activeMusyrif,
  onSelectMusyrif,
  onSwitchToRole,
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
}) => {
  const [namaSearchQuery, setNamaSearchQuery] = useState<string>('');
  const [selectedNamaUser, setSelectedNamaUser] = useState<string>('');
  const [isNamaDropdownOpen, setIsNamaDropdownOpen] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [briefTab, setBriefTab] = useState<'ALL' | 'WAITING' | 'DONE'>('ALL');
  const [musyrifNavTab, setMusyrifNavTab] = useState<'input' | 'status'>('input');

  const namaDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        namaDropdownRef.current &&
        !namaDropdownRef.current.contains(e.target as Node)
      ) {
        setIsNamaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const recommendedUsers = searchUsersRoleByName(
    namaSearchQuery,
    usersRoleList
  );

  const handlingGroups = splitLaporanByHandlingStatus(laporanList);

  const displayedRows =
    briefTab === 'WAITING'
      ? handlingGroups.belumTertangani
      : briefTab === 'DONE'
      ? handlingGroups.sudahTertangani
      : laporanList;

  const handlePickRecommendedUser = (user: UserRoleRow) => {
    const displayNama = user.nama || user.namaUser;
    setSelectedNamaUser(displayNama);
    setNamaSearchQuery(displayNama);
    setIsNamaDropdownOpen(false);
  };

  const handleClearNama = () => {
    setSelectedNamaUser('');
    setNamaSearchQuery('');
    setIsNamaDropdownOpen(true);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetNameInput = (selectedNamaUser || namaSearchQuery).trim();
    const cleanPass = passwordInput.trim();

    const auth = authenticateUserRole(
      targetNameInput,
      cleanPass,
      usersRoleList
    );

    if (!auth.valid || !auth.user) {
      await Swal.fire({
        icon: 'error',
        title: 'Login Gagal',
        text:
          auth.errorMessage ||
          'Nama atau password tidak sesuai dengan data pada sheet users_role.',
        confirmButtonColor: '#0B4627',
        confirmButtonText: 'Coba Lagi',
      });
      return;
    }

    const chosenUser = auth.user;
    const finalNama = chosenUser.nama || chosenUser.namaUser;
    const normUserRole = normalizeRoleValue(
      chosenUser.role,
      finalNama,
      chosenUser.keterangan
    );

    setPasswordInput('');
    onSelectMusyrif({
      idMusyrif: finalNama,
      namaMusyrif: finalNama,
      gedungAsrama: chosenUser.keterangan || 'Pesantren Al-Andalus',
    });

    // Otomatis masuk sesuai role yang diatur di sheet users_role
    if (normUserRole === 'admin_pusat' || normUserRole === 'admin') {
      onSwitchToRole('ADMIN_PUSAT');
    } else if (normUserRole === 'admin_pengasuhan') {
      onSwitchToRole('ADMIN_PENGASUHAN');
    } else {
      onSwitchToRole('MUSYRIF');
    }
  };

  // TAMPILAN 1: HALAMAN LOGIN SEDERHANA (Ketik Nama Rekomendasi + Password -> Masuk Otomatis Sesuai Role di users_role)
  if (!activeMusyrif) {
    return (
      <div className="max-w-md mx-auto">
        {/* Logo Pesantren Al-Andalus di bagian atas di luar kotak login */}
        <div className="flex justify-center mb-5" data-testid="login-top-logo">
          <img
            src={logoUrl}
            alt="Logo Pesantren Al-Andalus"
            className="h-28 sm:h-32 w-auto object-contain"
          />
        </div>

        <div
          data-testid="musyrif-login-card"
          className="bg-white rounded-3xl shadow-md border border-[#D4AF37]/45 overflow-hidden"
        >
          {/* Header Tampilan Awal Masuk dengan Nuansa Andalusia */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#07361D] via-[#0B4627] to-[#052613] text-white px-6 py-6 text-center border-b-2 border-[#D4AF37]/60">
            {/* Ornamen Geometri Rub el Hizb Andalusia */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 text-[#F5D000]/10"
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
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute -left-10 -bottom-10 w-36 h-36 text-[#F5D000]/10"
              viewBox="0 0 120 120"
              fill="none"
            >
              <circle cx="60" cy="60" r="46" stroke="currentColor" strokeWidth="2" />
              <rect
                x="28"
                y="28"
                width="64"
                height="64"
                transform="rotate(45 60 60)"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>

            <div className="relative z-10 flex flex-col items-center">
              <p className="text-xs font-semibold tracking-wider uppercase text-[#F5D000]">
                Pesantren Al-Andalus
              </p>
              <h2 className="text-lg font-bold tracking-tight text-white mt-0.5">
                Portal Lapor Sakit Santri
              </h2>
              <p className="text-[11px] text-emerald-100/90 mt-1">
                Terintegrasi Unit Kesehatan Pesantren (UKP)
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4 bg-[#FAF8F2]/40">
            {/* Ketik Nama dengan Rekomendasi Otomatis (Autocomplete dari Kolom nama di Sheet users_role) */}
            <div ref={namaDropdownRef} className="relative">
              <label
                htmlFor="select-nama-musyrif"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Nama Pengguna
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="select-nama-musyrif"
                  data-testid="select-nama-musyrif"
                  type="text"
                  role="combobox"
                  aria-expanded={isNamaDropdownOpen}
                  aria-controls="musyrif-nama-recommendations"
                  aria-autocomplete="list"
                  autoComplete="off"
                  value={namaSearchQuery}
                  onFocus={() => setIsNamaDropdownOpen(true)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNamaSearchQuery(val);
                    const exact = usersRoleList.find(
                      (u) =>
                        (u.nama || u.namaUser).trim().toLowerCase() ===
                        val.trim().toLowerCase()
                    );
                    if (exact) {
                      setSelectedNamaUser(exact.nama || exact.namaUser);
                      setIsNamaDropdownOpen(false);
                    } else {
                      setSelectedNamaUser('');
                      setIsNamaDropdownOpen(true);
                    }
                  }}
                  placeholder="Ketik beberapa huruf nama Anda..."
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 py-2.5 text-sm font-medium text-slate-900 focus:border-[#0B4627] focus:outline-none focus:ring-3 focus:ring-[#0B4627]/15"
                />
                {namaSearchQuery && (
                  <button
                    type="button"
                    onClick={handleClearNama}
                    aria-label="Hapus ketikan nama"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Daftar Rekomendasi Nama dari Sheet users_role */}
              {isNamaDropdownOpen && (
                <div
                  id="musyrif-nama-recommendations"
                  role="listbox"
                  data-testid="musyrif-nama-recommendations"
                  className="mt-1.5 w-full max-h-48 overflow-y-auto rounded-2xl bg-white shadow-md border border-[#D4AF37]/40 divide-y divide-slate-100"
                >
                  {usersRoleList.length === 0 ? (
                    <div className="p-3.5 text-xs text-emerald-700 text-center font-medium">
                      Sedang memuat daftar nama dari Google Sheet...
                    </div>
                  ) : recommendedUsers.length === 0 ? (
                    <div className="p-3.5 text-xs text-slate-500 text-center">
                      Nama &ldquo;{namaSearchQuery}&rdquo; tidak ditemukan pada sheet{' '}
                      <code className="font-mono">users_role</code>.
                    </div>
                  ) : (
                    recommendedUsers.map((u, idx) => {
                      const displayNama = u.nama || u.namaUser;
                      const isSelected = selectedNamaUser === displayNama;
                      const resolvedRole = normalizeRoleValue(
                        u.role,
                        displayNama,
                        u.keterangan
                      );
                      const roleLabel =
                        resolvedRole === 'admin_pusat' || resolvedRole === 'admin'
                          ? 'Admin Pusat / SDM'
                          : resolvedRole === 'admin_pengasuhan'
                          ? 'Admin Pengasuhan'
                          : 'Musyrif';

                      return (
                        <button
                          key={`${displayNama}-${resolvedRole}-${idx}`}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handlePickRecommendedUser(u)}
                          className={`w-full text-left px-4 py-2.5 transition flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50 text-[#0B4627]'
                              : 'hover:bg-[#FAF8F2] text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {displayNama}
                            </p>
                            {u.keterangan && (
                              <p className="text-[11px] text-slate-500 truncate">
                                {u.keterangan}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                              resolvedRole === 'admin_pusat' ||
                              resolvedRole === 'admin'
                                ? 'bg-[#07361D] text-[#F5D000]'
                                : resolvedRole === 'admin_pengasuhan'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {roleLabel}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Input Password Sesuai Sheet users_role */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="input-login-password"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="input-login-password"
                  data-testid="input-login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onFocus={() => setIsNamaDropdownOpen(false)}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Masukkan password..."
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-900 focus:border-[#0B4627] focus:outline-none focus:ring-3 focus:ring-[#0B4627]/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Tampilkan atau sembunyikan password"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              data-testid="btn-login-musyrif"
              className="w-full min-h-[46px] rounded-xl bg-[#0B4627] hover:bg-[#08361E] text-white font-semibold text-sm px-5 py-2.5 shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-[#F5D000]" />
              <span>Masuk</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // TAMPILAN 2: PORTAL MUSYRIF AKTIF (Input Laporan + Ringkasan Pantauan Santri + Unduh CSV Harian)
  return (
    <div className="space-y-6" data-testid="musyrif-active-portal">
      {/* Bar Identitas Sesi Login Musyrif */}
      <div className="bg-white rounded-2xl px-4 py-3 shadow-xs border border-[#D4AF37]/45 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {activeMusyrif.namaMusyrif}
              </span>
              <span className="text-[11px] font-medium text-[#0B4627] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                {activeMusyrif.gedungAsrama}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Role: Musyrif · Input Laporan &amp; Pantauan Ringkas Status Santri
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectMusyrif(null)}
            data-testid="btn-logout-musyrif"
            className="min-h-[34px] px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Bar Menu Navigasi Musyrif (2 Tab: Input Laporan & Pantauan Status UKP) */}
      <nav
        aria-label="Menu Navigasi Musyrif"
        data-testid="musyrif-nav-bar"
        className="bg-white rounded-2xl p-1.5 shadow-xs border border-[#D4AF37]/40 flex flex-wrap items-center gap-1.5"
      >
        <button
          type="button"
          data-testid="tab-musyrif-input"
          onClick={() => setMusyrifNavTab('input')}
          className={`flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            musyrifNavTab === 'input'
              ? 'bg-[#07361D] text-[#F5D000] shadow-xs'
              : 'text-slate-700 hover:bg-stone-100'
          }`}
        >
          <span>📝 Input Laporan Santri</span>
        </button>

        <button
          type="button"
          data-testid="tab-musyrif-status"
          onClick={() => setMusyrifNavTab('status')}
          className={`flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            musyrifNavTab === 'status'
              ? 'bg-[#07361D] text-[#F5D000] shadow-xs'
              : 'text-slate-700 hover:bg-stone-100'
          }`}
        >
          <span>📋 Pantauan Status UKP</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
              musyrifNavTab === 'status'
                ? 'bg-[#F5D000] text-[#07361D]'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {handlingGroups.belumTertangani.length} Menunggu
          </span>
        </button>
      </nav>

      {musyrifNavTab === 'input' ? (
        /* TAB 1: Form Input Laporan Santri Sakit */
        <div className="max-w-2xl mx-auto">
          <MusyrifFormCard
            masterData={masterData}
            laporanList={laporanList}
            activeFilter={activeFilter}
            onSelectFilter={onSelectFilter}
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
            lastSyncTime={lastSyncTime}
            onQuickSync={onQuickSync}
            onSubmitLaporan={onSubmitLaporan}
            logoUrl={logoUrl}
            activeMusyrif={activeMusyrif}
            hideFullOverview={true}
          />
        </div>
      ) : (
        /* TAB 2: Pantauan Ringkas Status UKP */
        <div className="max-w-3xl mx-auto">
          <section
            aria-label="Status Data Tertangani dan Belum"
            data-testid="musyrif-brief-status-card"
            className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90"
          >
            <div className="flex items-center justify-between gap-2 pb-3.5 mb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Pantauan Ringkas Status Santri
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ringkasan laporan yang <strong>Belum Tertangani</strong> &amp;{' '}
                  <strong>Sudah Tertangani</strong> UKP (Sesuai Nama &amp; Tanggal Laporan)
                </p>
              </div>
              <button
                type="button"
                onClick={onQuickSync}
                className="min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Cek Status UKP</span>
              </button>
            </div>

            {/* 3 Ringkasan Badge (Total, Belum Tertangani, Sudah Tertangani) */}
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => setBriefTab('ALL')}
                className={`text-left rounded-2xl p-3 border transition cursor-pointer ${
                  briefTab === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-stone-50 text-slate-900 border-slate-200/80 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-semibold ${
                      briefTab === 'ALL' ? 'text-slate-200' : 'text-slate-600'
                    }`}
                  >
                    Semua
                  </span>
                  <ClipboardList className="w-3.5 h-3.5 opacity-75" />
                </div>
                <p className="text-2xl font-bold font-mono tabular-nums mt-1.5">
                  {handlingGroups.total}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBriefTab('WAITING')}
                data-testid="musyrif-tab-belum"
                className={`text-left rounded-2xl p-3 border transition cursor-pointer ${
                  briefTab === 'WAITING'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-amber-50/70 text-amber-950 border-amber-200/80 hover:bg-amber-100/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-semibold ${
                      briefTab === 'WAITING' ? 'text-amber-100' : 'text-amber-800'
                    }`}
                  >
                    Belum Ditangani
                  </span>
                  <Clock className="w-3.5 h-3.5 opacity-80" />
                </div>
                <p className="text-2xl font-bold font-mono tabular-nums mt-1.5">
                  {handlingGroups.belumTertangani.length}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setBriefTab('DONE')}
                data-testid="musyrif-tab-sudah"
                className={`text-left rounded-2xl p-3 border transition cursor-pointer ${
                  briefTab === 'DONE'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-emerald-50/70 text-emerald-950 border-emerald-200/80 hover:bg-emerald-100/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-semibold ${
                      briefTab === 'DONE' ? 'text-emerald-100' : 'text-emerald-800'
                    }`}
                  >
                    Sudah Tertangani
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 opacity-80" />
                </div>
                <p className="text-2xl font-bold font-mono tabular-nums mt-1.5">
                  {handlingGroups.sudahTertangani.length}
                </p>
              </button>
            </div>

            {/* Daftar Ringkas Santri (Belum Tertangani & Sudah Tertangani) */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {displayedRows.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Tidak ada data laporan pada kategori ini.
                </div>
              ) : (
                displayedRows.map((row, idx) => {
                  const isWaiting =
                    row.statusPenanganan.trim().toUpperCase() ===
                    'MENUNGGU PENANGANAN';
                  return (
                    <div
                      key={`${row.idLaporan}-${row.idSantri}-${idx}`}
                      className={`rounded-2xl p-3.5 border transition ${
                        isWaiting
                          ? 'bg-amber-50/40 border-amber-200/80'
                          : 'bg-emerald-50/40 border-emerald-200/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {row.namaSantri}{' '}
                            <span className="font-normal text-slate-500">
                              ({row.kelas} · {row.kamar})
                            </span>
                          </p>
                          <p className="text-xs text-slate-700 mt-1">
                            {row.keluhanUtama}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${
                            isWaiting
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {isWaiting ? 'BELUM DITANGANI' : 'TERTANGANI'}
                        </span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>
                          Status UKP:{' '}
                          <strong
                            className={
                              isWaiting ? 'text-amber-800' : 'text-emerald-800'
                            }
                          >
                            {row.tindakanUKP
                              ? row.tindakanUKP
                              : 'Menunggu Pemeriksaan UKP'}
                          </strong>
                        </span>
                        <span className="font-mono text-[10px]">
                          {row.tanggalLaporan}
                          {row.namaMusyrif ? ` · ${row.namaMusyrif}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
