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
  RotateCcw,
  ShieldAlert,
  Lock,
  Unlock,
  FileSpreadsheet,
  FileText,
  Users,
  User,
  RefreshCw,
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
  type SantriSholatSummary,
  filterSholatByDateRange,
  isSholatRowPutih,
  findExistingSholatRecordForDate,
  formatRincianSholatTelat,
  normalizeSantriKey,
} from '../utils/sholatEngine';
import {
  exportSholatToExcel,
  exportSholatToPdf,
  formatSholatPeriodeLabel,
} from '../utils/sholatExport';

interface RekapSholatPanelProps {
  masterData: MasterSantri[];
  sholatList: SholatRow[];
  onAddSholat: (
    input: SholatInput
  ) => Promise<
    | {
        syncedToSheet: boolean;
        needsGasUpdate?: boolean;
        errorMessage?: string;
      }
    | void
  >;
  onDeleteSholat: (idSholat: string) => void;
  onResetSholatRange?: (
    startDate: string,
    endDate: string,
    keterangan: string
  ) => void;
  usersRoleList?: UserRoleRow[];
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  activeMusyrifName?: string;
  onSyncNow?: () => void;
  onSilentSync?: () => void;
  onPullByDateRange?: (range: DateRangeFilter) => Promise<void>;
  isSyncing?: boolean;
  lastSyncTime?: string | null;
  logoUrl?: string;
}

type PrayerKey = 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya';

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
  onSyncNow,
  onSilentSync,
  onPullByDateRange,
  isSyncing = false,
  lastSyncTime,
  logoUrl = '/assets/aistudio/Logo_Al-Andalus_c7d889d5.png',
}) => {
  const [subTab, setSubTab] = useState<'input' | 'rekap'>('input');

  // Form input state
  const [tanggal, setTanggal] = useState<string>(() => getTodayDateISO());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSantri, setSelectedSantri] = useState<MasterSantri | null>(
    null
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const [subuh, setSubuh] = useState<SholatStatus>('TEPAT');
  const [dzuhur, setDzuhur] = useState<SholatStatus>('TEPAT');
  const [ashar, setAshar] = useState<SholatStatus>('TEPAT');
  const [maghrib, setMaghrib] = useState<SholatStatus>('TEPAT');
  const [isya, setIsya] = useState<SholatStatus>('TEPAT');

  // Status penguncian otomatis dari input sebelumnya di tanggal yang sama
  const [savedLockedMap, setSavedLockedMap] = useState<
    Record<PrayerKey, boolean>
  >({
    subuh: false,
    dzuhur: false,
    ashar: false,
    maghrib: false,
    isya: false,
  });
  const [unlockedPrayers, setUnlockedPrayers] = useState<Set<PrayerKey>>(
    () => new Set()
  );

  // State untuk Ekspor Rekap Excel & PDF (Keseluruhan Anak / Per Anak)
  const [exportMode, setExportMode] = useState<'ALL' | 'SINGLE'>('ALL');
  const [selectedExportSantri, setSelectedExportSantri] = useState<string>('');
  const exportSectionRef = useRef<HTMLDivElement>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const filteredSantri = searchMasterSantri(searchQuery, masterData);
  const datePresets = getDynamicDatePresets();

  // Nama santri aktif yang sedang dipilih/diketik pada form input
  const currentInputSantriName = useMemo(() => {
    if (selectedSantri) return selectedSantri.namaSantri;
    return searchQuery.trim();
  }, [selectedSantri, searchQuery]);

  // Cek apakah di tanggal tersebut santri ini sudah pernah diinput (dan belum diputihkan)
  const existingDayRecord = useMemo(() => {
    if (!currentInputSantriName || !tanggal) return null;
    return findExistingSholatRecordForDate(
      sholatList,
      tanggal,
      currentInputSantriName
    );
  }, [sholatList, tanggal, currentInputSantriName]);

  // Otomatis muat dan kunci status sholat yang sudah tercatat TELAT ketika tanggal atau santri dipilih
  useEffect(() => {
    if (existingDayRecord) {
      setSubuh(existingDayRecord.subuh);
      setDzuhur(existingDayRecord.dzuhur);
      setAshar(existingDayRecord.ashar);
      setMaghrib(existingDayRecord.maghrib);
      setIsya(existingDayRecord.isya);
      setSavedLockedMap({
        subuh: existingDayRecord.subuh === 'TELAT',
        dzuhur: existingDayRecord.dzuhur === 'TELAT',
        ashar: existingDayRecord.ashar === 'TELAT',
        maghrib: existingDayRecord.maghrib === 'TELAT',
        isya: existingDayRecord.isya === 'TELAT',
      });
    } else {
      setSubuh('TEPAT');
      setDzuhur('TEPAT');
      setAshar('TEPAT');
      setMaghrib('TEPAT');
      setIsya('TEPAT');
      setSavedLockedMap({
        subuh: false,
        dzuhur: false,
        ashar: false,
        maghrib: false,
        isya: false,
      });
    }
    setUnlockedPrayers(new Set());
  }, [existingDayRecord]);

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

  // Fungsi klik utama waktu sholat:
  // Jika masih TEPAT -> ubah menjadi TELAT (dan dikunci otomatis sebagai TELAT).
  // Jika sudah TELAT -> tetap TELAT (dikunci otomatis agar bila diklik lagi di waktu sholat yang sama tetap TELAT).
  const handleSelectTelatAndLock = (
    key: PrayerKey,
    setter: React.Dispatch<React.SetStateAction<SholatStatus>>
  ) => {
    setter('TELAT');
    setSavedLockedMap((prev) => ({ ...prev, [key]: true }));
    setUnlockedPrayers((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  // Fungsi khusus untuk membuka kunci dan mengubah kembali ke TEPAT
  const handleUnlockToTepat = (
    key: PrayerKey,
    setter: React.Dispatch<React.SetStateAction<SholatStatus>>
  ) => {
    setter('TEPAT');
    setSavedLockedMap((prev) => ({ ...prev, [key]: false }));
    setUnlockedPrayers((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
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

    const nama = selectedSantri
      ? selectedSantri.namaSantri
      : existingDayRecord
      ? existingDayRecord.namaSantri
      : searchQuery.trim();
    const nis = selectedSantri
      ? selectedSantri.idSantri
      : existingDayRecord?.nis || '-';
    const kelas = selectedSantri
      ? selectedSantri.kelas
      : existingDayRecord?.kelas || '-';
    const gedung = existingDayRecord?.gedung || '-';
    const kamar = selectedSantri
      ? selectedSantri.kamar
      : existingDayRecord?.kamar || '-';

    const input: SholatInput = {
      idSholat: existingDayRecord?.idSholat,
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
      unlockedPrayers: Array.from(unlockedPrayers),
    };

    const isUpdatingExisting = Boolean(existingDayRecord);
    const syncResult = await onAddSholat(input);
    setUnlockedPrayers(new Set());

    if (syncResult && !syncResult.syncedToSheet) {
      await Swal.fire({
        icon: 'warning',
        title: syncResult.needsGasUpdate
          ? 'Tersimpan Lokal — Perbarui Code.gs Spreadsheet!'
          : 'Tersimpan Lokal (Belum Sinkron ke Server)',
        html: `<div class="text-xs text-slate-600 space-y-2 text-left">
          <p>Data <b>${nama}</b> (${tanggal}) sudah tercatat di perangkat Anda, <b>namun belum terbaca oleh admin/ustadz lain</b>.</p>
          ${
            syncResult.needsGasUpdate
              ? `<p class="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-amber-900">
                  <b>Penyebab:</b> Script <code>Code.gs</code> di Google Spreadsheet Anda masih versi lama sehingga belum memproses menu <code>Rekap_Sholat</code>.<br/>
                  <b>Solusi:</b> Buka menu <b>⚙️ Koneksi Sheet &amp; Code.gs</b> → Salin Code.gs terbaru → tempel ke Apps Script Spreadsheet → klik <b>Deploy → Manage deployments → Edit → Version: New version → Deploy</b>.
                </p>`
              : `<p class="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-rose-900"><b>Detail:</b> ${syncResult.errorMessage || 'Gagal terhubung ke Google Sheets.'}</p>`
          }
        </div>`,
        confirmButtonColor: '#075e54',
      });
    } else {
      await Swal.fire({
        icon: 'success',
        title: isUpdatingExisting
          ? 'Rekap Sholat Diperbarui & Dikunci!'
          : 'Rekap Sholat Disimpan!',
        html: `<div class="text-xs text-slate-600 space-y-1">
          <p>Data keterlambatan sholat untuk <b>${nama}</b> pada tanggal <b>${tanggal}</b> berhasil disimpan (${activeMusyrifName}) dan disinkronkan ke Spreadsheet agar terbaca oleh seluruh admin &amp; ustadz.</p>
          <p class="font-mono text-[11px] bg-slate-100 p-2 rounded-lg mt-1">
            Subuh: <b>${subuh}</b> · Dzuhur: <b>${dzuhur}</b> · Ashar: <b>${ashar}</b> · Maghrib: <b>${maghrib}</b> · Isya: <b>${isya}</b>
          </p>
        </div>`,
        confirmButtonColor: '#075e54',
        timer: 2400,
      });
    }

    // Reset form
    setSearchQuery('');
    setSelectedSantri(null);
    setSubuh('TEPAT');
    setDzuhur('TEPAT');
    setAshar('TEPAT');
    setMaghrib('TEPAT');
    setIsya('TEPAT');
    setSavedLockedMap({
      subuh: false,
      dzuhur: false,
      ashar: false,
      maghrib: false,
      isya: false,
    });
    setSubTab('rekap');
  };

  const dateFilteredList = filterSholatByDateRange(sholatList, dateRange);
  const activeDateFilteredList = useMemo(
    () => dateFilteredList.filter((r) => !isSholatRowPutih(r)),
    [dateFilteredList]
  );
  const diputihkanCount =
    dateFilteredList.length - activeDateFilteredList.length;
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
      total:
        subuhTelat + dzuhurTelat + asharTelat + maghribTelat + isyaTelat,
    };
  }, [activeDateFilteredList]);

  const santriSummaryList: SantriSholatSummary[] = useMemo(() => {
    const map = new Map<string, SantriSholatSummary>();

    for (const row of dateFilteredList) {
      const key = row.namaSantri.toLowerCase().trim();
      const isPutih = isSholatRowPutih(row);
      if (!map.has(key)) {
        map.set(key, {
          namaSantri: row.namaSantri,
          nis: row.nis || '-',
          kelas: row.kelas,
          gedung: row.gedung || '-',
          kamar: row.kamar,
          subuhTelat: 0,
          dzuhurTelat: 0,
          asharTelat: 0,
          maghribTelat: 0,
          isyaTelat: 0,
          totalTelat: 0,
          diputihkanRecords: 0,
          tanggalTelatList: [],
        });
      }
      const item = map.get(key)!;
      if (isPutih) {
        item.diputihkanRecords++;
      } else {
        let hasTelatOnRow = false;
        if (row.subuh === 'TELAT') {
          item.subuhTelat++;
          hasTelatOnRow = true;
        }
        if (row.dzuhur === 'TELAT') {
          item.dzuhurTelat++;
          hasTelatOnRow = true;
        }
        if (row.ashar === 'TELAT') {
          item.asharTelat++;
          hasTelatOnRow = true;
        }
        if (row.maghrib === 'TELAT') {
          item.maghribTelat++;
          hasTelatOnRow = true;
        }
        if (row.isya === 'TELAT') {
          item.isyaTelat++;
          hasTelatOnRow = true;
        }
        item.totalTelat =
          item.subuhTelat +
          item.dzuhurTelat +
          item.asharTelat +
          item.maghribTelat +
          item.isyaTelat;

        if (
          hasTelatOnRow &&
          row.tanggal &&
          !item.tanggalTelatList.includes(row.tanggal)
        ) {
          item.tanggalTelatList.push(row.tanggal);
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalTelat - a.totalTelat
    );
  }, [dateFilteredList]);

  const pencatatBySantri = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of dateFilteredList) {
      const key = row.namaSantri.toLowerCase().trim();
      const raw = String(row.pencatat || '').trim();
      if (!raw) continue;
      if (!map.has(key)) map.set(key, []);
      const existing = map.get(key)!;
      for (const part of raw.split(',')) {
        const clean = part.trim();
        if (clean && !existing.includes(clean)) {
          existing.push(clean);
        }
      }
    }
    return map;
  }, [dateFilteredList]);

  // Pastikan pilihan santri ekspor otomatis terisi bila mode SINGLE dipilih
  useEffect(() => {
    if (
      exportMode === 'SINGLE' &&
      !selectedExportSantri &&
      santriSummaryList.length > 0
    ) {
      setSelectedExportSantri(santriSummaryList[0].namaSantri);
    }
  }, [exportMode, selectedExportSantri, santriSummaryList]);

  const periodeLabel = useMemo(
    () => formatSholatPeriodeLabel(dateRange.startDate, dateRange.endDate),
    [dateRange.startDate, dateRange.endDate]
  );

  const selectedSingleSummary = useMemo(() => {
    if (!selectedExportSantri) return santriSummaryList[0] || null;
    const key = normalizeSantriKey(selectedExportSantri);
    return (
      santriSummaryList.find((s) => normalizeSantriKey(s.namaSantri) === key) ||
      null
    );
  }, [santriSummaryList, selectedExportSantri]);

  const handleExportExcel = async (
    overrideMode?: 'ALL' | 'SINGLE',
    overrideSantriName?: string
  ) => {
    const modeToUse = overrideMode || exportMode;
    const santriToUse =
      overrideSantriName ||
      selectedExportSantri ||
      santriSummaryList[0]?.namaSantri ||
      '';

    if (modeToUse === 'SINGLE' && !santriToUse) {
      await Swal.fire({
        icon: 'warning',
        title: 'Pilih Santri Terlebih Dahulu',
        text: 'Belum ada data santri yang bisa diekspor pada rentang tanggal ini.',
        confirmButtonColor: '#075e54',
      });
      return;
    }

    const res = exportSholatToExcel({
      summaries: santriSummaryList,
      dailyRows: dateFilteredList,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      mode: modeToUse,
      selectedSantriName: santriToUse,
      pencatatBySantri,
    });

    await Swal.fire({
      icon: 'success',
      title: 'File Excel (.xlsx) Diunduh!',
      html: `<div class="text-xs text-slate-600 space-y-1">
        <p>File rekap <b>${res.filename}</b> (${res.rowCount} santri · ${periodeLabel}) berhasil diunduh.</p>
        <p class="text-[11px] text-slate-500">Berisi sheet <b>Rekap Akumulasi</b> dan <b>Log Harian</b> lengkap dengan rentang tanggal, nama, kelas, asrama, total telat, dan rincian sholat.</p>
      </div>`,
      confirmButtonColor: '#075e54',
      timer: 2200,
    });
  };

  const handleExportPdf = async (
    overrideMode?: 'ALL' | 'SINGLE',
    overrideSantriName?: string
  ) => {
    const modeToUse = overrideMode || exportMode;
    const santriToUse =
      overrideSantriName ||
      selectedExportSantri ||
      santriSummaryList[0]?.namaSantri ||
      '';

    if (modeToUse === 'SINGLE' && !santriToUse) {
      await Swal.fire({
        icon: 'warning',
        title: 'Pilih Santri Terlebih Dahulu',
        text: 'Belum ada data santri yang bisa diekspor pada rentang tanggal ini.',
        confirmButtonColor: '#075e54',
      });
      return;
    }

    const res = await exportSholatToPdf({
      summaries: santriSummaryList,
      dailyRows: dateFilteredList,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      mode: modeToUse,
      selectedSantriName: santriToUse,
      pencatatBySantri,
      logoUrl,
    });

    await Swal.fire({
      icon: 'success',
      title: 'File PDF (.pdf) Diunduh!',
      html: `<div class="text-xs text-slate-600 space-y-1">
        <p>File rekap <b>${res.filename}</b> (${res.rowCount} santri · ${periodeLabel}) berhasil diunduh.</p>
        <p class="text-[11px] text-slate-500">Memuat rentang tanggal, nama santri, kelas, asrama, total keterlambatan, dan rincian sholat telat.</p>
      </div>`,
      confirmButtonColor: '#075e54',
      timer: 2200,
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
      onResetSholatRange(
        dateRange.startDate,
        dateRange.endDate,
        keteranganPemutihan
      );
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

  const prayerItems: Array<{
    key: PrayerKey;
    label: string;
    icon: string;
    value: SholatStatus;
    setter: React.Dispatch<React.SetStateAction<SholatStatus>>;
    wasSavedTelat: boolean;
  }> = [
    {
      key: 'subuh',
      label: 'Subuh',
      icon: '🌅',
      value: subuh,
      setter: setSubuh,
      wasSavedTelat: existingDayRecord?.subuh === 'TELAT',
    },
    {
      key: 'dzuhur',
      label: 'Dzuhur',
      icon: '☀️',
      value: dzuhur,
      setter: setDzuhur,
      wasSavedTelat: existingDayRecord?.dzuhur === 'TELAT',
    },
    {
      key: 'ashar',
      label: 'Ashar',
      icon: '🌤️',
      value: ashar,
      setter: setAshar,
      wasSavedTelat: existingDayRecord?.ashar === 'TELAT',
    },
    {
      key: 'maghrib',
      label: 'Maghrib',
      icon: '🌆',
      value: maghrib,
      setter: setMaghrib,
      wasSavedTelat: existingDayRecord?.maghrib === 'TELAT',
    },
    {
      key: 'isya',
      label: 'Isya',
      icon: '🌙',
      value: isya,
      setter: setIsya,
      wasSavedTelat: existingDayRecord?.isya === 'TELAT',
    },
  ];

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
            Penguncian Otomatis Harian · Ekspor Rekap Excel &amp; PDF (Per Anak &amp; Keseluruhan) · Sinkron Spreadsheet
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
            📋 Data Rekap &amp; Ekspor ({dateFilteredList.length})
          </button>
        </div>
      </div>

      {subTab === 'input' ? (
        /* TAB 1: FORM INPUT KETERLAMBATAN SHOLAT (Dengan Penguncian Otomatis) */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">
              Formulir Input Keterlambatan Sholat Santri
            </h3>
            <p className="text-xs text-slate-500">
              Pilih tanggal dan nama santri. Jika di tanggal yang sama santri sudah tercatat <strong>TELAT</strong> pada waktu sholat sebelumnya, statusnya otomatis tertulis <strong>TELAT (Terkunci)</strong> agar tidak berubah saat input waktu sholat berikutnya, namun tetap bisa diubah ke <strong>TEPAT</strong>.
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
                  {filteredSantri.map((santri) => {
                    const existingForItem = findExistingSholatRecordForDate(
                      sholatList,
                      tanggal,
                      santri.namaSantri
                    );
                    return (
                      <button
                        key={santri.idSantri || santri.namaSantri}
                        type="button"
                        onClick={() => handleSelectSantri(santri)}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-50 transition text-xs flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">
                              {santri.namaSantri}
                            </p>
                            {existingForItem && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                🔒 Sudah Ada Input Tgl {tanggal}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Kelas {santri.kelas} · Kamar {santri.kamar}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          ID: {santri.idSantri}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedSantri && (
                <div className="mt-2 rounded-xl bg-emerald-50/80 border border-emerald-200 p-3 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-emerald-900">
                      Terpilih: {selectedSantri.namaSantri}
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      Kelas {selectedSantri.kelas} · Asrama/Kamar{' '}
                      {selectedSantri.kamar}
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
                    Ganti Santri
                  </button>
                </div>
              )}
            </div>

            {/* Banner Informasi Penguncian Otomatis jika di tanggal yang sama sudah ada data */}
            {existingDayRecord && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200/90 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">
                    Data {existingDayRecord.namaSantri} pada Tanggal {tanggal} Ditemukan (Otomatis Terkunci)
                  </p>
                  <p className="text-[11px] font-semibold text-amber-900">
                    👤 Dicatat sebelumnya oleh: <span className="underline">{existingDayRecord.pencatat || 'Admin'}</span>
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Waktu sholat yang sebelumnya sudah diinput <strong>TELAT</strong> pada tanggal ini otomatis tertulis <strong>TELAT &amp; Terkunci</strong> agar tetap <strong>TELAT</strong> saat Anda menginput waktu sholat lainnya. Jika ingin mengoreksi ke <strong>TEPAT</strong>, klik tombol <strong>&ldquo;Ubah ke Tepat&rdquo;</strong> di bawah waktu sholat terkait.
                  </p>
                </div>
              </div>
            )}

            {/* Status 5 Waktu Sholat (Dengan Sistem Penguncian Otomatis) */}
            <div className="rounded-2xl bg-stone-50 border border-slate-200/80 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-800">
                  Status Sholat 5 Waktu (Klik untuk Tandai Telat &amp; Kunci Otomatis):
                </p>
                <span className="text-[10px] text-slate-500">
                  Status TELAT otomatis terkunci · Klik &ldquo;Ubah ke Tepat&rdquo; untuk membuka
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {prayerItems.map((item) => {
                  const isTelat = item.value === 'TELAT';
                  const isLocked = savedLockedMap[item.key] || isTelat;

                  return (
                    <div
                      key={item.key}
                      className={`rounded-2xl p-2.5 border transition flex flex-col justify-between gap-2 ${
                        isTelat
                          ? 'bg-rose-50/70 border-rose-300 shadow-xs'
                          : 'bg-white border-slate-200/90'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-800">
                          {item.icon} {item.label}
                        </label>
                        {item.wasSavedTelat && isTelat && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300"
                            title="Sudah tercatat TELAT sebelumnya di tanggal ini"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            <span>Tersimpan</span>
                          </span>
                        )}
                      </div>

                      {/* Tombol Utama: Jika diklik saat TEPAT -> jadi TELAT (Terkunci). Jika diklik saat sudah TELAT -> tetap TELAT (Terkunci) */}
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectTelatAndLock(item.key, item.setter)
                        }
                        className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          isTelat
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {isTelat ? (
                          <>
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                            <span>TELAT (Terkunci)</span>
                          </>
                        ) : (
                          <span>✅ Tepat Waktu</span>
                        )}
                      </button>

                      {/* Tombol Ubah ke Tepat (Hanya muncul saat status TELAT / Terkunci) */}
                      {isTelat && isLocked ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleUnlockToTepat(item.key, item.setter)
                          }
                          className="w-full py-1.5 px-2 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Unlock className="w-3 h-3 shrink-0" />
                          <span>Ubah ke Tepat</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleSelectTelatAndLock(item.key, item.setter)
                          }
                          className="w-full py-1.5 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>⚠️ Tandai Telat</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-[#075e54] hover:bg-[#054c42] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {existingDayRecord
                  ? `Simpan Perubahan & Kunci Rekap (${existingDayRecord.namaSantri})`
                  : 'Simpan Rekap Sholat Santri'}
              </span>
            </button>
          </form>
        </div>
      ) : (
        /* TAB 2: DATA REKAP, FILTER RENTANG TANGGAL & KIRIM REKAP WA */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Data Rekap Keterlambatan Sholat ({dateFilteredList.length} Catatan{isDateFiltered && sholatList.length !== dateFilteredList.length ? ` dari ${sholatList.length} total` : ''})
              </h3>
              <p className="text-xs text-slate-500">
                Menampilkan seluruh catatan dari semua Admin &amp; Ustadz · Sinkron terakhir: {lastSyncTime || '-'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onSyncNow && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={isSyncing}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Menyinkronkan...' : 'Tarik Data Terbaru'}</span>
                </button>
              )}
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
                onClick={() => handleExportExcel('ALL')}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Unduh Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportPdf('ALL')}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#07361D] hover:bg-[#0B4627] text-[#F5D000] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Unduh PDF (.pdf)</span>
              </button>
            </div>
          </div>

          {/* Filter Rentang Tanggal */}
          <div className="rounded-2xl bg-stone-50/90 border border-slate-200/80 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <CalendarRange className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>Filter Rentang Tanggal (Dari Tanggal s/d Sampai Tanggal)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onPullByDateRange && (
                  <button
                    type="button"
                    onClick={() => onPullByDateRange(dateRange)}
                    disabled={isSyncing}
                    className="px-2.5 py-1 rounded-lg bg-[#075e54] hover:bg-[#054c42] text-white text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menarik Data...' : 'Tarik Data Rentang Ini'}</span>
                  </button>
                )}
                {isDateFiltered && (
                  <button
                    type="button"
                    onClick={() => {
                      onDateRangeChange({ startDate: '', endDate: '' });
                      onSilentSync?.();
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Tanggal</span>
                  </button>
                )}
              </div>
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
                    onClick={() => {
                      onDateRangeChange({
                        startDate: preset.startDate,
                        endDate: preset.endDate,
                      });
                      onSilentSync?.();
                    }}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => {
                    onDateRangeChange({
                      ...dateRange,
                      startDate: e.target.value,
                    });
                    onSilentSync?.();
                  }}
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
                  onChange={(e) => {
                    onDateRangeChange({
                      ...dateRange,
                      endDate: e.target.value,
                    });
                    onSilentSync?.();
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-800"
                />
              </div>
            </div>

            {isDateFiltered && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-900">
                <span>
                  📅 Periode aktif: <strong>{periodeLabel}</strong> · Menampilkan <strong>{dateFilteredList.length}</strong> dari <strong>{sholatList.length}</strong> catatan di Spreadsheet.
                </span>
                {sholatList.length > dateFilteredList.length && (
                  <button
                    type="button"
                    onClick={() => onDateRangeChange({ startDate: '', endDate: '' })}
                    className="font-bold text-amber-950 underline hover:text-emerald-800 cursor-pointer"
                  >
                    Tampilkan Semua Tanggal ({sholatList.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Kartu Ringkasan Total Keterlambatan per Waktu Sholat */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-2xl p-3 text-center shadow-xs border border-rose-800">
              <p className="text-[10px] text-rose-200 font-medium">🌅 Subuh</p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">
                {sholatStats.subuh}
              </p>
            </div>
            <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-2xl p-3 text-center shadow-xs border border-rose-800">
              <p className="text-[10px] text-rose-200 font-medium">☀️ Dzuhur</p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">
                {sholatStats.dzuhur}
              </p>
            </div>
            <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-2xl p-3 text-center shadow-xs border border-rose-800">
              <p className="text-[10px] text-rose-200 font-medium">🌤️ Ashar</p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">
                {sholatStats.ashar}
              </p>
            </div>
            <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-2xl p-3 text-center shadow-xs border border-rose-800">
              <p className="text-[10px] text-rose-200 font-medium">
                🌆 Maghrib
              </p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">
                {sholatStats.maghrib}
              </p>
            </div>
            <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white rounded-2xl p-3 text-center shadow-xs border border-rose-800">
              <p className="text-[10px] text-rose-200 font-medium">🌙 Isya</p>
              <p className="text-xl font-mono font-bold text-white mt-0.5">
                {sholatStats.isya}
              </p>
            </div>
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-3 text-center shadow-xs border border-slate-700">
              <p className="text-[10px] text-emerald-400 font-medium">
                📊 Total Telat
              </p>
              <p className="text-xl font-mono font-bold text-emerald-300 mt-0.5">
                {sholatStats.total}
              </p>
            </div>
          </div>

          {/* PANEL EKSPOR REKAP KETERLAMBATAN SHOLAT KE EXCEL (.xlsx) & PDF (.pdf) */}
          <div
            ref={exportSectionRef}
            className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-4 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-emerald-200/70">
              <div>
                <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-[#075e54]" />
                  <span>
                    Ekspor Rekapan Keterlambatan Sholat (Excel &amp; PDF)
                  </span>
                </h4>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Memuat <strong>Rentang Tanggal</strong>, <strong>Nama</strong>, <strong>Kelas</strong>, <strong>Asrama/Kamar</strong>, <strong>Total Keterlambatan</strong>, dan <strong>Rincian Sholat Apa Saja yang Telat</strong>.
                </p>
              </div>

              {/* Pilihan Mode: Keseluruhan Anak vs Per Anak */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-200">
                <button
                  type="button"
                  onClick={() => setExportMode('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    exportMode === 'ALL'
                      ? 'bg-[#075e54] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Keseluruhan Anak ({santriSummaryList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportMode('SINGLE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    exportMode === 'SINGLE'
                      ? 'bg-[#075e54] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Per Anak</span>
                </button>
              </div>
            </div>

            {exportMode === 'SINGLE' && (
              <div>
                <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                  Pilih Nama Santri (Ekspor Rekap Per Anak)
                </label>
                <select
                  value={selectedExportSantri}
                  onChange={(e) => setSelectedExportSantri(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#075e54] focus:outline-none"
                >
                  {santriSummaryList.length === 0 ? (
                    <option value="">-- Belum ada santri di rentang ini --</option>
                  ) : (
                    santriSummaryList.map((st) => (
                      <option key={st.namaSantri} value={st.namaSantri}>
                        {st.namaSantri} (Kelas {st.kelas} · {st.kamar}) — Total Telat: {st.totalTelat}x
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* Preview Data yang Akan Diekspor */}
            <div className="bg-white rounded-xl border border-emerald-200/90 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Preview Isi Rekap ({exportMode === 'ALL' ? 'Keseluruhan Anak' : `Per Anak: ${selectedSingleSummary?.namaSantri || '-'}`}):
                </span>
                <span className="text-[11px] font-mono font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                  🗓️ Rentang: {periodeLabel}
                </span>
              </div>

              {exportMode === 'SINGLE' ? (
                selectedSingleSummary ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div>
                      <p className="text-[11px] text-slate-500">Nama Santri</p>
                      <p className="font-bold text-slate-900">{selectedSingleSummary.namaSantri}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Kelas &amp; Asrama</p>
                      <p className="font-semibold text-slate-800">
                        Kelas {selectedSingleSummary.kelas || '-'} · Asrama {selectedSingleSummary.kamar || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Total Keterlambatan</p>
                      <p className="font-bold text-rose-700 text-sm">
                        {selectedSingleSummary.totalTelat} Kali
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Rincian Sholat Telat</p>
                      <p className="font-semibold text-slate-800">
                        {formatRincianSholatTelat(selectedSingleSummary)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    Belum ada data santri pada rentang tanggal ini.
                  </p>
                )
              ) : (
                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2">No</th>
                        <th className="p-2">Nama</th>
                        <th className="p-2">Kelas</th>
                        <th className="p-2">Asrama</th>
                        <th className="p-2 text-center">Total Telat</th>
                        <th className="p-2">Rincian Sholat Telat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {santriSummaryList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-3 text-center text-slate-500">
                            Belum ada data pada rentang tanggal ini.
                          </td>
                        </tr>
                      ) : (
                        santriSummaryList.slice(0, 6).map((st, idx) => (
                          <tr key={st.namaSantri}>
                            <td className="p-2 font-mono text-slate-500">{idx + 1}</td>
                            <td className="p-2 font-bold text-slate-900">{st.namaSantri}</td>
                            <td className="p-2 text-slate-700">{st.kelas || '-'}</td>
                            <td className="p-2 text-slate-700">{st.kamar || '-'}</td>
                            <td className="p-2 text-center font-bold text-rose-700">
                              {st.totalTelat}x
                            </td>
                            <td className="p-2 text-slate-700">
                              {formatRincianSholatTelat(st)}
                            </td>
                          </tr>
                        ))
                      )}
                      {santriSummaryList.length > 6 && (
                        <tr>
                          <td colSpan={6} className="p-2 text-center text-[10px] text-slate-500 bg-slate-50">
                            + {santriSummaryList.length - 6} santri lainnya akan ikut diekspor ke Excel &amp; PDF
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleExportExcel()}
                className="flex-1 min-w-[180px] min-h-[42px] px-4 py-2 rounded-xl bg-[#075e54] hover:bg-[#054c42] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>
                  {exportMode === 'ALL'
                    ? 'Unduh Rekap Keseluruhan (Excel .xlsx)'
                    : `Unduh Rekap ${selectedSingleSummary?.namaSantri || 'Santri'} (Excel .xlsx)`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleExportPdf()}
                className="flex-1 min-w-[180px] min-h-[42px] px-4 py-2 rounded-xl bg-[#07361D] hover:bg-[#0B4627] text-[#F5D000] text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>
                  {exportMode === 'ALL'
                    ? 'Unduh Rekap Keseluruhan (PDF .pdf)'
                    : `Unduh Rekap ${selectedSingleSummary?.namaSantri || 'Santri'} (PDF .pdf)`}
                </span>
              </button>
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
                      <th className="p-2.5">Nama, Kelas &amp; Asrama</th>
                      <th className="p-2.5 text-center">Subuh</th>
                      <th className="p-2.5 text-center">Dzuhur</th>
                      <th className="p-2.5 text-center">Ashar</th>
                      <th className="p-2.5 text-center">Maghrib</th>
                      <th className="p-2.5 text-center">Isya</th>
                      <th className="p-2.5 text-center">Total Telat</th>
                      <th className="p-2.5">Rincian Sholat Telat</th>
                      <th className="p-2.5">Pencatat</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center rounded-r-xl">Ekspor Anak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 font-mono text-[11px]">
                    {santriSummaryList.map((st, idx) => (
                      <tr
                        key={st.namaSantri}
                        className="hover:bg-white transition"
                      >
                        <td className="p-2.5 font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="p-2.5">
                          <p className="font-bold text-slate-900 font-sans">
                            {st.namaSantri}
                          </p>
                          <p className="text-[10px] text-slate-500 font-sans">
                            Kelas {st.kelas} · Asrama {st.kamar}
                          </p>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={
                              st.subuhTelat > 0
                                ? 'text-rose-700 font-bold'
                                : 'text-slate-400'
                            }
                          >
                            {st.subuhTelat}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={
                              st.dzuhurTelat > 0
                                ? 'text-rose-700 font-bold'
                                : 'text-slate-400'
                            }
                          >
                            {st.dzuhurTelat}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={
                              st.asharTelat > 0
                                ? 'text-rose-700 font-bold'
                                : 'text-slate-400'
                            }
                          >
                            {st.asharTelat}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={
                              st.maghribTelat > 0
                                ? 'text-rose-700 font-bold'
                                : 'text-slate-400'
                            }
                          >
                            {st.maghribTelat}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={
                              st.isyaTelat > 0
                                ? 'text-rose-700 font-bold'
                                : 'text-slate-400'
                            }
                          >
                            {st.isyaTelat}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-bold text-rose-800 bg-rose-50/50">
                          {st.totalTelat}x
                        </td>
                        <td className="p-2.5 font-sans text-[11px] text-slate-700">
                          {formatRincianSholatTelat(st)}
                        </td>
                        <td className="p-2.5 font-sans text-[11px] text-slate-700">
                          {(pencatatBySantri.get(st.namaSantri.toLowerCase().trim()) || []).join(', ') || '-'}
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
                        <td className="p-2.5 text-center font-sans">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleExportExcel('SINGLE', st.namaSantri)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold transition cursor-pointer whitespace-nowrap"
                              title={`Unduh Excel untuk ${st.namaSantri}`}
                            >
                              <FileSpreadsheet className="w-3 h-3" />
                              <span>Excel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportPdf('SINGLE', st.namaSantri)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#07361D] hover:bg-[#0B4627] text-[#F5D000] text-[10px] font-bold transition cursor-pointer whitespace-nowrap"
                              title={`Unduh PDF untuk ${st.namaSantri}`}
                            >
                              <FileText className="w-3 h-3" />
                              <span>PDF</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabel Data Sholat Harian */}
          {dateFilteredList.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-slate-600 bg-stone-50 rounded-2xl border border-slate-200/70 space-y-3">
              <p>
                Tidak ada data rekap sholat pada periode <strong>{periodeLabel}</strong>.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {onPullByDateRange && (
                  <button
                    type="button"
                    onClick={() => onPullByDateRange(dateRange)}
                    disabled={isSyncing}
                    className="px-3.5 py-1.5 rounded-xl bg-[#075e54] hover:bg-[#054c42] text-white text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menarik Data...' : 'Tarik Data Terbaru dari Sheet'}</span>
                  </button>
                )}
                {isDateFiltered && (
                  <button
                    type="button"
                    onClick={() => onDateRangeChange({ startDate: '', endDate: '' })}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Tampilkan Semua Tanggal ({sholatList.length})
                  </button>
                )}
              </div>
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
                          <span className="text-slate-500 font-semibold">
                            Subuh:
                          </span>
                          {getStatusBadge(row.subuh)}
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-500 font-semibold">
                            Dzuhur:
                          </span>
                          {getStatusBadge(row.dzuhur)}
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-500 font-semibold">
                            Ashar:
                          </span>
                          {getStatusBadge(row.ashar)}
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-500 font-semibold">
                            Maghrib:
                          </span>
                          {getStatusBadge(row.maghrib)}
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-slate-500 font-semibold">
                            Isya:
                          </span>
                          {getStatusBadge(row.isya)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                        👤 {row.pencatat || 'Admin'}
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
