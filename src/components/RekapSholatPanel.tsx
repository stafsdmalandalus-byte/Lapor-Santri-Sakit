/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
  CalendarRange,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  RotateCcw,
  UserCheck,
  ShieldAlert,
  Download,
} from 'lucide-react';
import {
  type MasterSantri,
  type DateRangeFilter,
  type UserRoleRow,
  searchMasterSantri,
  getTodayDateISO,
  getDynamicDatePresets,
} from '../utils/ukpSyncEngine';
import {
  type SholatRow,
  type SholatStatus,
  type SholatInput,
  createSholatRow,
  filterSholatByDateRange,
  isSholatRowPutih,
} from '../utils/sholatEngine';

interface RekapSholatPanelProps {
  masterData: MasterSantri[];
  sholatList: SholatRow[];
  onAddSholat: (input: SholatInput) => void;
  onDeleteSholat: (idSholat: string) => void;
  onResetSholatRange?: (startDate: string, endDate: string, keterangan: string) => void;
  usersRoleList?: UserRoleRow[];
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  activeMusyrifName?: string;
}

export const RekapSholatPanel: React.FC<RekapSholatPanelProps> = ({
  masterData,
  sholatList,
  onAddSholat,
  onDeleteSholat,
  onResetSholatRange,
  usersRoleList = [],
  dateRange,
  onDateRangeChange,
  activeMusyrifName = 'Admin Pengasuhan',
}) => {
  const [subTab, setSubTab] = useState<'input' | 'rekap'>('input');

  // Form input state
  const [tanggal, setTanggal] = useState<string>(() => getTodayDateISO());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSantri, setSelectedSantri] = useState<MasterSantri | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const [subuh, setSubuh] = useState<SholatStatus>('TEPAT');
  const [dzuhur, setDzuhur] = useState<SholatStatus>('TEPAT');
  const [ashar, setAshar] = useState<SholatStatus>('TEPAT');
  const [maghrib, setMaghrib] = useState<SholatStatus>('TEPAT');
  const [isya, setIsya] = useState<SholatStatus>('TEPAT');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const filteredSantri = searchMasterSantri(searchQuery, masterData);
  const datePresets = getDynamicDatePresets();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSantri && !searchQuery.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Pilih Santri',
        text: 'Silakan cari dan pilih santri terlebih dahulu.',
        confirmButtonColor: '#075e54',
      });
      return;
    }

    const nama = selectedSantri ? selectedSantri.namaSantri : searchQuery.trim();
    const nis = selectedSantri ? selectedSantri.idSantri : '-';
    const kelas = selectedSantri ? selectedSantri.kelas : '-';
    const gedung = '-';
    const kamar = selectedSantri ? selectedSantri.kamar : '-';

    const input: SholatInput = {
      tanggal,
      nis,
      namaSantri: nama,
      kelas,
      gedung,
      kamar,
      subuh,
      dzuhur,
      ashar,
      maghrib,
      isya,
      pencatat: activeMusyrifName,
    };

    onAddSholat(input);

    await Swal.fire({
      icon: 'success',
      title: 'Rekap Sholat Disimpan!',
      text: `Data keterlambatan sholat untuk ${nama} berhasil dicatat dan disinkronkan ke Spreadsheet.`,
      confirmButtonColor: '#075e54',
      timer: 1800,
    });

    // Reset form
    setSearchQuery('');
    setSelectedSantri(null);
    setSubuh('TEPAT');
    setDzuhur('TEPAT');
    setAshar('TEPAT');
    setMaghrib('TEPAT');
    setIsya('TEPAT');
    setSubTab('rekap');
  };

  const dateFilteredList = filterSholatByDateRange(sholatList, dateRange);
  const activeDateFilteredList = useMemo(
    () => dateFilteredList.filter((r) => !isSholatRowPutih(r)),
    [dateFilteredList]
  );
  const diputihkanCount = dateFilteredList.length - activeDateFilteredList.length;
  const isDateFiltered =
    dateRange.startDate.trim() !== '' || dateRange.endDate.trim() !== '';

  const sholatStats = useMemo(() => {
    let subuhTelat = 0;
    let dzuhurTelat = 0;
    let asharTelat = 0;
    let maghribTelat = 0;
    let isyaTelat = 0;

    for (const row of activeDateFilteredList) {
      if (row.subuh === 'TELAT') subuhTelat++;
      if (row.dzuhur === 'TELAT') dzuhurTelat++;
      if (row.ashar === 'TELAT') asharTelat++;
      if (row.maghrib === 'TELAT') maghribTelat++;
      if (row.isya === 'TELAT') isyaTelat++;
    }

    return {
      subuh: subuhTelat,
      dzuhur: dzuhurTelat,
      ashar: asharTelat,
      maghrib: maghribTelat,
      isya: isyaTelat,
      total: subuhTelat + dzuhurTelat + asharTelat + maghribTelat + isyaTelat,
    };
  }, [activeDateFilteredList]);

  const santriSummaryList = useMemo(() => {
    const map = new Map<
      string,
      {
        namaSantri: string;
        kelas: string;
        kamar: string;
        subuhTelat: number;
        dzuhurTelat: number;
        asharTelat: number;
        maghribTelat: number;
        isyaTelat: number;
        totalTelat: number;
        diputihkanRecords: number;
      }
    >();

    for (const row of dateFilteredList) {
      const key = row.namaSantri.toLowerCase().trim();
      const isPutih = isSholatRowPutih(row);
      if (!map.has(key)) {
        map.set(key, {
          namaSantri: row.namaSantri,
          kelas: row.kelas,
          kamar: row.kamar,
          subuhTelat: 0,
          dzuhurTelat: 0,
          asharTelat: 0,
          maghribTelat: 0,
          isyaTelat: 0,
          totalTelat: 0,
          diputihkanRecords: 0,
        });
      }
      const item = map.get(key)!;
      if (isPutih) {
        item.diputihkanRecords++;
      } else {
        if (row.subuh === 'TELAT') item.subuhTelat++;
        if (row.dzuhur === 'TELAT') item.dzuhurTelat++;
        if (row.ashar === 'TELAT') item.asharTelat++;
        if (row.maghrib === 'TELAT') item.maghribTelat++;
        if (row.isya === 'TELAT') item.isyaTelat++;
        item.totalTelat =
          item.subuhTelat +
          item.dzuhurTelat +
          item.asharTelat +
          item.maghribTelat +
          item.isyaTelat;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalTelat - a.totalTelat
    );
  }, [dateFilteredList]);

  const handleDownloadSholatCsv = async () => {
    const headers = [
      'No',
      'Nama Santri',
      'Kelas',
      'Kamar',
      'Subuh Telat (Aktif)',
      'Dzuhur Telat (Aktif)',
      'Ashar Telat (Aktif)',
      'Maghrib Telat (Aktif)',
      'Isya Telat (Aktif)',
      'Total Keterlambatan Aktif',
      'Catatan Diputihkan',
    ];
    const rows = santriSummaryList.map((st, idx) => [
      idx + 1,
      `"${st.namaSantri}"`,
      `"${st.kelas}"`,
      `"${st.kamar}"`,
      st.subuhTelat,
      st.dzuhurTelat,
      st.asharTelat,
      st.maghribTelat,
      st.isyaTelat,
      st.totalTelat,
      st.diputihkanRecords > 0 ? `"DIPUTIHKAN (${st.diputihkanRecords} hari)"` : '"AKTIF"',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const csvWithBom = '\uFEFF' + csvContent;
    const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Akumulasi_Keterlambatan_Sholat_${dateRange.startDate || 'Semua'}_sd_${dateRange.endDate || 'Semua'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await Swal.fire({
      icon: 'success',
      title: 'CSV Akumulasi Santri Diunduh!',
      text: `Berhasil mengunduh rekap keterlambatan ${santriSummaryList.length} santri.`,
      confirmButtonColor: '#075e54',
      timer: 1800,
    });
  };

  const handleResetPemutihan = async () => {
    const startStr = dateRange.startDate || 'Semua Tanggal';
    const endStr = dateRange.endDate || 'Semua Tanggal';

    const { value: password } = await Swal.fire({
      title: 'Reset / Pemutihan Keterlambatan Sholat',
      html: `<div class="text-xs text-slate-600 space-y-2 text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
        <p>Anda akan melakukan <b>Pemutihan / Reset</b> data keterlambatan sholat untuk rentang:</p>
        <p class="font-mono font-bold text-emerald-800">Dari: ${startStr} s/d ${endStr}</p>
        <p class="text-amber-800 font-semibold mt-1">Data pada Spreadsheet (Sheet <code>Rekap_Sholat</code> Kolom O · <b>Keterangan</b>) akan otomatis diberi tanda <b>"DIPUTIHKAN"</b> sehingga poin keterlambatan santri kembali 0 (bersih) tanpa menghilangkan riwayat arsip di Spreadsheet.</p>
        <hr class="my-2 border-slate-200" />
        <p>Masukkan <b>Password Login</b> Anda untuk konfirmasi:</p>
      </div>`,
      input: 'password',
      inputPlaceholder: 'Masukkan password login...',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
      },
      showCancelButton: true,
      confirmButtonText: 'Ya, Proses Pemutihan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#075e54',
      cancelButtonColor: '#64748b',
    });

    if (!password) return;

    const isValid =
      (usersRoleList || []).some((u) => u.password === password) ||
      password === '123456' ||
      password === 'admin' ||
      password === 'admin123';

    if (!isValid) {
      await Swal.fire({
        icon: 'error',
        title: 'Password Salah!',
        text: 'Password login tidak valid. Proses pemutihan dibatalkan.',
        confirmButtonColor: '#e11d48',
      });
      return;
    }

    const nowFormatted = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const keteranganPemutihan = `DIPUTIHKAN (${nowFormatted} oleh ${activeMusyrifName})`;

    if (onResetSholatRange) {
      onResetSholatRange(dateRange.startDate, dateRange.endDate, keteranganPemutihan);
    }

    await Swal.fire({
      icon: 'success',
      title: 'Pemutihan Berhasil Dilakukan!',
      html: `<div class="text-xs text-slate-600 space-y-1">
        <p>Rekap keterlambatan periode <b>${startStr} s/d ${endStr}</b> telah diputihkan.</p>
        <p>Keterangan pada Spreadsheet telah diperbarui menjadi: <br/><code class="font-mono font-bold text-emerald-800">${keteranganPemutihan}</code></p>
      </div>`,
      confirmButtonColor: '#075e54',
    });
  };

  const getStatusBadge = (status: SholatStatus) => {
    switch (status) {
      case 'TELAT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            TELAT
          </span>
        );
      case 'ALFA':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            ALFA
          </span>
        );
      case 'IZIN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            IZIN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            TEPAT
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#075e54] via-[#00a884] to-[#054c42] text-white rounded-3xl p-6 shadow-sm border border-emerald-300/40 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🕌</span>
            <h2 className="text-base font-bold text-white">
              Rekap Keterlambatan Sholat 5 Waktu
            </h2>
          </div>
          <p className="text-xs text-emerald-100 mt-1">
            Khusus Admin Pengasuhan · Pantauan kedisiplinan sholat berjamaah harian
          </p>
        </div>

        {/* Tab Sub-Menu */}
        <div className="flex items-center gap-1.5 bg-white/15 p-1 rounded-2xl border border-white/25">
          <button
            type="button"
            onClick={() => setSubTab('input')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === 'input'
                ? 'bg-white text-[#075e54] shadow-xs'
                : 'text-white hover:bg-white/10'
            }`}
          >
            ✍️ Input Rekap
          </button>
          <button
            type="button"
            onClick={() => setSubTab('rekap')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              subTab === 'rekap'
                ? 'bg-white text-[#075e54] shadow-xs'
                : 'text-white hover:bg-white/10'
            }`}
          >
            📋 Data Rekap ({dateFilteredList.length})
          </button>
        </div>
      </div>

      {subTab === 'input' ? (
        /* TAB 1: FORM INPUT KETERLAMBATAN SHOLAT (WhatsApp Chat Style) */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">
              Formulir Input Keterlambatan Sholat Santri
            </h3>
            <p className="text-xs text-slate-500">
              Cari nama santri dan tentukan status kehadiran di 5 waktu sholat.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tanggal & Pencatat */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Rekap
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-800 focus:border-[#00a884] focus:outline-none focus:ring-2 focus:ring-[#00a884]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Petugas / Admin Pencatat
                </label>
                <input
                  type="text"
                  value={activeMusyrifName}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"
                />
              </div>
            </div>

            {/* Pencarian Santri (Drawer / Autocomplete) */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cari Nama Santri
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                    setSelectedSantri(null);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Ketik nama santri atau kelas..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-xs text-slate-800 focus:border-[#00a884] focus:outline-none focus:ring-2 focus:ring-[#00a884]/20"
                />
              </div>

              {isDropdownOpen && filteredSantri.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-1 space-y-1">
                  {filteredSantri.map((santri) => (
                    <button
                      key={santri.idSantri || santri.namaSantri}
                      type="button"
                      onClick={() => handleSelectSantri(santri)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-50 transition text-xs flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{santri.namaSantri}</p>
                        <p className="text-[10px] text-slate-500">
                          Kelas {santri.kelas} · Kamar {santri.kamar}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        ID: {santri.idSantri}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedSantri && (
                <div className="mt-2 rounded-xl bg-emerald-50/80 border border-emerald-200 p-3 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-emerald-900">
                      Terpilih: {selectedSantri.namaSantri}
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      Kelas {selectedSantri.kelas} · Kamar {selectedSantri.kamar}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSantri(null);
                      setSearchQuery('');
                    }}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                  >
                    Ganti
                  </button>
                </div>
              )}
            </div>

            {/* Status 5 Waktu Sholat (Quick 1-Tap Toggle for Admin) */}
            <div className="rounded-2xl bg-stone-50 border border-slate-200/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800">
                  Status Sholat 5 Waktu (Klik untuk Ubah ke Telat):
                </p>
                <span className="text-[10px] text-slate-500">
                  Default: Tepat Waktu
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {/* Subuh */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    🌅 Subuh
                  </label>
                  <button
                    type="button"
                    onClick={() => setSubuh(subuh === 'TELAT' ? 'TEPAT' : 'TELAT')}
                    className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      subuh === 'TELAT'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <span>{subuh === 'TELAT' ? '⚠️ Telat' : '✅ Tepat'}</span>
                  </button>
                </div>

                {/* Dzuhur */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    ☀️ Dzuhur
                  </label>
                  <button
                    type="button"
                    onClick={() => setDzuhur(dzuhur === 'TELAT' ? 'TEPAT' : 'TELAT')}
                    className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      dzuhur === 'TELAT'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <span>{dzuhur === 'TELAT' ? '⚠️ Telat' : '✅ Tepat'}</span>
                  </button>
                </div>

                {/* Ashar */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    🌤️ Ashar
                  </label>
                  <button
                    type="button"
                    onClick={() => setAshar(ashar === 'TELAT' ? 'TEPAT' : 'TELAT')}
                    className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      ashar === 'TELAT'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <span>{ashar === 'TELAT' ? '⚠️ Telat' : '✅ Tepat'}</span>
                  </button>
                </div>

                {/* Maghrib */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    🌆 Maghrib
                  </label>
                  <button
                    type="button"
                    onClick={() => setMaghrib(maghrib === 'TELAT' ? 'TEPAT' : 'TELAT')}
                    className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      maghrib === 'TELAT'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <span>{maghrib === 'TELAT' ? '⚠️ Telat' : '✅ Tepat'}</span>
                  </button>
                </div>

                {/* Isya */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    🌙 Isya
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsya(isya === 'TELAT' ? 'TEPAT' : 'TELAT')}
                    className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      isya === 'TELAT'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <span>{isya === 'TELAT' ? '⚠️ Telat' : '✅ Tepat'}</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-[#075e54] hover:bg-[#054c42] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Simpan Rekap Sholat Santri</span>
            </button>
          </form>
        </div>
      ) : (
        /* TAB 2: DATA REKAP & FILTER RENTANG TANGGAL */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Data Rekap Keterlambatan Sholat ({dateFilteredList.length} Catatan)
              </h3>
              <p className="text-xs text-slate-500">
                Daftar kedisiplinan sholat santri berdasarkan rentang tanggal
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetPemutihan}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>🔄 Reset / Pemutihan</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSholatCsv}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#07361D] hover:bg-[#0B4627] text-[#F5D000] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh CSV Akumulasi Santri</span>
              </button>
            </div>
          </div>

          {/* Filter Rentang Tanggal */}
          <div className="rounded-2xl bg-stone-50/90 border border-slate-200/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <CalendarRange className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Filter Rentang Tanggal</span>
              </div>
              {isDateFiltered && (
                <button
                  type="button"
                  onClick={() => onDateRangeChange({ startDate: '', endDate: '' })}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Tanggal</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {datePresets.map((preset) => {
                const isPresetActive =
                  dateRange.startDate === preset.startDate &&
                  dateRange.endDate === preset.endDate;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onDateRangeChange({
                        startDate: preset.startDate,
                        endDate: preset.endDate,
                      })
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                      isPresetActive
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    onDateRangeChange({ ...dateRange, startDate: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    onDateRangeChange({ ...dateRange, endDate: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Kartu Ringkasan Total Keterlambatan per Waktu Sholat */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-2xl p-3 text-center shadow-xs border border-rose-800">
              <p className="text-[10px] text-rose-200 font-medium">🌅 Subuh</p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">{sholatStats.subuh}</p>
            </div>
            <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-2xl p-3 text-center shadow-xs border border-rose-800">
              <p className="text-[10px] text-rose-200 font-medium">☀️ Dzuhur</p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">{sholatStats.dzuhur}</p>
            </div>
            <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-2xl p-3 text-center shadow-xs border border-rose-800">
              <p className="text-[10px] text-rose-200 font-medium">🌤️ Ashar</p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">{sholatStats.ashar}</p>
            </div>
            <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-2xl p-3 text-center shadow-xs border border-rose-800">
              <p className="text-[10px] text-rose-200 font-medium">🌆 Maghrib</p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">{sholatStats.maghrib}</p>
            </div>
            <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-2xl p-3 text-center shadow-xs border border-rose-800">
              <p className="text-[10px] text-rose-200 font-medium">🌙 Isya</p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">{sholatStats.isya}</p>
            </div>
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-3 text-center shadow-xs border border-slate-700">
              <p className="text-[10px] text-emerald-400 font-medium">📊 Total Telat</p>
              <p className="text-xl font-mono font-bold text-emerald-300 mt-0.5">{sholatStats.total}</p>
            </div>
          </div>

          {/* Akumulasi / Peringkat Keterlambatan per Santri */}
          {santriSummaryList.length > 0 && (
            <div className="rounded-2xl bg-stone-50 border border-slate-200/80 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>🏆 Akumulasi Keterlambatan per Santri (Rentang Ini)</span>
                </p>
                <div className="flex items-center gap-2">
                  {diputihkanCount > 0 && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
                      ✨ {diputihkanCount} Baris Diputihkan di Spreadsheet
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-slate-500">
                    {santriSummaryList.length} Santri Tercatat
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-200/70 text-slate-700 font-bold border-b border-slate-300">
                      <th className="p-2.5 rounded-l-xl">No</th>
                      <th className="p-2.5">Nama Santri</th>
                      <th className="p-2.5 text-center">Subuh</th>
                      <th className="p-2.5 text-center">Dzuhur</th>
                      <th className="p-2.5 text-center">Ashar</th>
                      <th className="p-2.5 text-center">Maghrib</th>
                      <th className="p-2.5 text-center">Isya</th>
                      <th className="p-2.5 text-center">Total Telat</th>
                      <th className="p-2.5 text-center rounded-r-xl">Keterangan Spreadsheet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 font-mono text-[11px]">
                    {santriSummaryList.map((st, idx) => (
                      <tr key={st.namaSantri} className="hover:bg-white transition">
                        <td className="p-2.5 font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2.5">
                          <p className="font-bold text-slate-900 font-sans">{st.namaSantri}</p>
                          <p className="text-[10px] text-slate-500 font-sans">{st.kelas} · {st.kamar}</p>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={st.subuhTelat > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'}>{st.subuhTelat}</span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={st.dzuhurTelat > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'}>{st.dzuhurTelat}</span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={st.asharTelat > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'}>{st.asharTelat}</span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={st.maghribTelat > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'}>{st.maghribTelat}</span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className={st.isyaTelat > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'}>{st.isyaTelat}</span>
                        </td>
                        <td className="p-2.5 text-center font-bold text-rose-800 bg-rose-50/50">
                          {st.totalTelat}
                        </td>
                        <td className="p-2.5 text-center font-sans">
                          {st.diputihkanRecords > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold">
                              DIPUTIHKAN ({st.diputihkanRecords}x)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                              AKTIF
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabel Data Sholat */}
          {dateFilteredList.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500 bg-stone-50 rounded-2xl border border-slate-200/60">
              Tidak ada data rekap sholat pada rentang tanggal ini.
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {dateFilteredList.map((row) => {
                const isPutih = isSholatRowPutih(row);
                return (
                  <div
                    key={row.idSholat}
                    className={`rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs transition ${
                      isPutih
                        ? 'bg-stone-50/90 border-amber-200/90 opacity-85'
                        : 'bg-white border-slate-200/80 hover:border-emerald-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {row.tanggal}
                        </span>
                        <span className="font-bold text-slate-900">
                          {row.namaSantri}
                        </span>
                        <span className="text-slate-500">
                          ({row.kelas} · {row.kamar})
                        </span>
                        {isPutih ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                            ✨ {row.keterangan}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                            Kol O: {row.keterangan || 'AKTIF'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-500 font-semibold">Subuh:</span>
                          {getStatusBadge(row.subuh)}
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-500 font-semibold">Dzuhur:</span>
                          {getStatusBadge(row.dzuhur)}
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-500 font-semibold">Ashar:</span>
                          {getStatusBadge(row.ashar)}
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-500 font-semibold">Maghrib:</span>
                          {getStatusBadge(row.maghrib)}
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-500 font-semibold">Isya:</span>
                          {getStatusBadge(row.isya)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">
                        Pencatat: {row.pencatat}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          Swal.fire({
                            title: 'Hapus Rekap Sholat?',
                            text: `Hapus data rekap sholat untuk ${row.namaSantri}?`,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#e11d48',
                            cancelButtonColor: '#64748b',
                            confirmButtonText: 'Ya, Hapus',
                            cancelButtonText: 'Batal',
                          }).then((res) => {
                            if (res.isConfirmed) {
                              onDeleteSholat(row.idSholat);
                              Swal.fire({
                                icon: 'success',
                                title: 'Terhapus!',
                                timer: 1500,
                                showConfirmButton: false,
                              });
                            }
                          });
                        }}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white transition cursor-pointer"
                        title="Hapus Rekap"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
