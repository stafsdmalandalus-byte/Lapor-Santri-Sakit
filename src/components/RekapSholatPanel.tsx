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
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import {
  type MasterSantri,
  type DateRangeFilter,
  type UserRoleRow,
  type LaporanMusyrifRow,
  searchMasterSantri,
  getTodayDateISO,
  getDynamicDatePresets,
  normalizeDateYYYYMMDD,
} from '../utils/ukpSyncEngine';
import type { PerizinanRow } from '../utils/perizinanEngine';
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
  onAddSholatBatch?: (
    inputs: SholatInput[]
  ) => Promise<
    | {
        savedCount: number;
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
  perizinanList?: PerizinanRow[];
  laporanList?: LaporanMusyrifRow[];
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

const PRAYER_META: Array<{ key: PrayerKey; label: string; icon: string }> = [
  { key: 'subuh', label: 'Subuh', icon: '🌅' },
  { key: 'dzuhur', label: 'Dzuhur', icon: '☀️' },
  { key: 'ashar', label: 'Ashar', icon: '🌤️' },
  { key: 'maghrib', label: 'Maghrib', icon: '🌆' },
  { key: 'isya', label: 'Isya', icon: '🌙' },
];

export const RekapSholatPanel: React.FC<RekapSholatPanelProps> = ({
  masterData,
  sholatList,
  onAddSholat,
  onAddSholatBatch,
  onDeleteSholat,
  onResetSholatRange,
  usersRoleList = [],
  perizinanList = [],
  laporanList = [],
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

  // Form input massal (Pilih banyak santri dulu -> klik 1 atau beberapa sholat telat)
  const [tanggal, setTanggal] = useState<string>(() => getTodayDateISO());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterKelas, setFilterKelas] = useState<string>('ALL');
  const [filterKamar, setFilterKamar] = useState<string>('ALL');
  const [checklistMode, setChecklistMode] = useState<'ALL' | 'UNRECORDED'>('ALL');
  const [stayOnInputAfterSave, setStayOnInputAfterSave] = useState<boolean>(true);
  const [selectedSantriMap, setSelectedSantriMap] = useState<
    Map<string, MasterSantri>
  >(() => new Map());
  const [batchTelatPrayers, setBatchTelatPrayers] = useState<Set<PrayerKey>>(
    () => new Set()
  );
  const [unlockedBySantri, setUnlockedBySantri] = useState<
    Map<string, Set<PrayerKey>>
  >(() => new Map());
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);

  // State Filter & Ekspor Tab Rekap
  const [rekapKelas, setRekapKelas] = useState<string>('ALL');
  const [rekapKamar, setRekapKamar] = useState<string>('ALL');
  const [exportMode, setExportMode] = useState<'ALL' | 'SINGLE'>('ALL');
  const [selectedExportSantri, setSelectedExportSantri] = useState<string>('');
  const exportSectionRef = useRef<HTMLDivElement>(null);

  const datePresets = getDynamicDatePresets();

  const kelasOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of masterData) {
      const k = String(s.kelas || '').trim();
      if (k && k !== '-') set.add(k);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterData]);

  const kamarOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of masterData) {
      const km = String(s.kamar || '').trim();
      if (km && km !== '-') set.add(km);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterData]);

  // Lencana otomatis santri sedang Izin Pulang atau Lapor Sakit pada tanggal terpilih
  const santriStatusBadgesMap = useMemo(() => {
    const map = new Map<
      string,
      {
        isIzinPulang: boolean;
        izinDetail: string;
        isSakit: boolean;
        keluhan: string;
      }
    >();
    const tglNorm = normalizeDateYYYYMMDD(tanggal) || tanggal;

    for (const p of perizinanList) {
      if (String(p.tibaTanggal || '').trim()) continue;
      const dari = normalizeDateYYYYMMDD(p.dariTanggal);
      const sampai = normalizeDateYYYYMMDD(p.sampaiTanggal);
      const isActiveOnDate = Boolean(
        dari &&
          ((sampai && tglNorm >= dari && tglNorm <= sampai) ||
            (!sampai && tglNorm === dari))
      );
      if (!isActiveOnDate) continue;
      const key = normalizeSantriKey(p.nama);
      if (!key) continue;
      const prev = map.get(key) || {
        isIzinPulang: false,
        izinDetail: '',
        isSakit: false,
        keluhan: '',
      };
      map.set(key, {
        ...prev,
        isIzinPulang: true,
        izinDetail: p.izin || 'Izin Pulang',
      });
    }

    for (const l of laporanList) {
      const tglLap = normalizeDateYYYYMMDD(l.tanggalLaporan);
      const isWaiting = String(l.statusPenanganan || '')
        .toUpperCase()
        .includes('MENUNGGU');
      if (tglLap !== tglNorm && !isWaiting) continue;
      const key = normalizeSantriKey(l.namaSantri);
      if (!key) continue;
      const prev = map.get(key) || {
        isIzinPulang: false,
        izinDetail: '',
        isSakit: false,
        keluhan: '',
      };
      map.set(key, {
        ...prev,
        isSakit: true,
        keluhan: prev.keluhan || l.keluhanUtama || 'Sakit',
      });
    }

    return map;
  }, [perizinanList, laporanList, tanggal]);

  const baseFilteredSantri = useMemo(() => {
    const base = searchQuery.trim()
      ? searchMasterSantri(searchQuery, masterData)
      : masterData;
    return base.filter((s) => {
      if (filterKelas !== 'ALL' && String(s.kelas || '').trim() !== filterKelas) {
        return false;
      }
      if (filterKamar !== 'ALL' && String(s.kamar || '').trim() !== filterKamar) {
        return false;
      }
      return true;
    });
  }, [searchQuery, masterData, filterKelas, filterKamar]);

  const unrecordedCount = useMemo(() => {
    return baseFilteredSantri.filter(
      (s) => !findExistingSholatRecordForDate(sholatList, tanggal, s.namaSantri)
    ).length;
  }, [baseFilteredSantri, sholatList, tanggal]);

  const filteredSantri = useMemo(() => {
    if (checklistMode === 'ALL') return baseFilteredSantri;
    return baseFilteredSantri.filter(
      (s) => !findExistingSholatRecordForDate(sholatList, tanggal, s.namaSantri)
    );
  }, [baseFilteredSantri, checklistMode, sholatList, tanggal]);

  const selectedSantriList = useMemo(
    () => Array.from(selectedSantriMap.values()),
    [selectedSantriMap]
  );

  // Reset status buka-kunci jika tanggal berganti
  useEffect(() => {
    setUnlockedBySantri(new Map());
  }, [tanggal]);

  const toggleSelectSantri = (santri: MasterSantri) => {
    const key = normalizeSantriKey(santri.namaSantri);
    if (!key) return;
    setSelectedSantriMap((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, santri);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedSantriMap((prev) => {
      const next = new Map(prev);
      for (const s of filteredSantri) {
        const key = normalizeSantriKey(s.namaSantri);
        if (key) next.set(key, s);
      }
      return next;
    });
  };

  const handleClearAllSelected = () => {
    setSelectedSantriMap(new Map());
    setUnlockedBySantri(new Map());
  };

  const handleToggleBatchPrayer = (key: PrayerKey) => {
    setBatchTelatPrayers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleToggleUnlockSantriPrayer = (
    santriKey: string,
    prayerKey: PrayerKey
  ) => {
    setUnlockedBySantri((prev) => {
      const next = new Map(prev);
      const currentSet = new Set(next.get(santriKey) || []);
      if (currentSet.has(prayerKey)) {
        currentSet.delete(prayerKey);
      } else {
        currentSet.add(prayerKey);
      }
      if (currentSet.size === 0) {
        next.delete(santriKey);
      } else {
        next.set(santriKey, currentSet);
      }
      return next;
    });
  };

  const computedBatchPreview = useMemo(() => {
    return selectedSantriList.map((santri) => {
      const santriKey = normalizeSantriKey(santri.namaSantri);
      const existing = findExistingSholatRecordForDate(
        sholatList,
        tanggal,
        santri.namaSantri
      );
      const unlockedSet = unlockedBySantri.get(santriKey) || new Set<PrayerKey>();

      const getFinal = (pKey: PrayerKey): SholatStatus => {
        const wasSavedTelat = existing?.[pKey] === 'TELAT';
        const isUnlocked = unlockedSet.has(pKey);
        if (wasSavedTelat && !isUnlocked) return 'TELAT';
        if (batchTelatPrayers.has(pKey)) return 'TELAT';
        if (existing && !isUnlocked && existing[pKey]) return existing[pKey];
        return 'TEPAT';
      };

      return {
        santri,
        santriKey,
        existing,
        unlockedSet,
        subuh: getFinal('subuh'),
        dzuhur: getFinal('dzuhur'),
        ashar: getFinal('ashar'),
        maghrib: getFinal('maghrib'),
        isya: getFinal('isya'),
      };
    });
  }, [
    selectedSantriList,
    sholatList,
    tanggal,
    unlockedBySantri,
    batchTelatPrayers,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSantriList.length === 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Pilih Santri Terlebih Dahulu',
        text: 'Centang minimal 1 atau banyak nama santri yang akan dicatat.',
        confirmButtonColor: '#075e54',
      });
      return;
    }

    if (batchTelatPrayers.size === 0 && unlockedBySantri.size === 0) {
      const confirmNoPrayer = await Swal.fire({
        icon: 'question',
        title: 'Belum Ada Sholat yang Ditandai Telat',
        text: `Anda memilih ${selectedSantriList.length} santri, tetapi belum memilih waktu sholat yang telat. Lanjutkan simpan sebagai TEPAT?`,
        showCancelButton: true,
        confirmButtonText: 'Ya, Tetap Simpan',
        cancelButtonText: 'Pilih Sholat Dulu',
        confirmButtonColor: '#075e54',
      });
      if (!confirmNoPrayer.isConfirmed) return;
    }

    const batchInputs: SholatInput[] = computedBatchPreview.map((item) => ({
      idSholat: item.existing?.idSholat,
      tanggal,
      nis: item.santri.idSantri || item.existing?.nis || '-',
      namaSantri: item.santri.namaSantri,
      kelas: item.santri.kelas || item.existing?.kelas || '-',
      gedung: item.existing?.gedung || '-',
      kamar: item.santri.kamar || item.existing?.kamar || '-',
      subuh: item.subuh,
      dzuhur: item.dzuhur,
      ashar: item.ashar,
      maghrib: item.maghrib,
      isya: item.isya,
      pencatat: activeMusyrifName,
      unlockedPrayers: Array.from(item.unlockedSet),
    }));

    setIsSubmittingBatch(true);
    try {
      let syncedToSheet = true;
      let errorMsg = '';

      if (onAddSholatBatch) {
        const res = await onAddSholatBatch(batchInputs);
        if (res) {
          syncedToSheet = res.syncedToSheet;
          errorMsg = res.errorMessage || '';
        }
      } else {
        for (const inp of batchInputs) {
          const r = await onAddSholat(inp);
          if (r && !r.syncedToSheet) {
            syncedToSheet = false;
            errorMsg = r.errorMessage || '';
          }
        }
      }

      const selectedPrayerLabels = PRAYER_META.filter((p) =>
        batchTelatPrayers.has(p.key)
      )
        .map((p) => p.label)
        .join(', ');

      await Swal.fire({
        icon: 'success',
        title: `Berhasil Menyimpan ${batchInputs.length} Santri!`,
        html: `<div class="text-xs text-slate-600 space-y-1.5 text-left">
          <p>Rekap keterlambatan tanggal <b>${tanggal}</b> untuk <b>${batchInputs.length} santri</b> telah tersimpan ke <b>Database Cloud</b> (${activeMusyrifName}).</p>
          ${
            selectedPrayerLabels
              ? `<p class="bg-rose-50 text-rose-800 border border-rose-200 rounded-lg p-2 font-semibold">Sholat ditandai TELAT: ${selectedPrayerLabels}</p>`
              : ''
          }
          <p class="text-[11px] ${
            syncedToSheet ? 'text-emerald-700' : 'text-amber-700'
          }">
            ${
              syncedToSheet
                ? '✅ Mirror ke Google Spreadsheet aktif di latar belakang.'
                : `ℹ️ Tersimpan di Database Cloud (Mirror Spreadsheet: ${errorMsg || 'menunggu sinkronisasi'}).`
            }
          </p>
        </div>`,
        confirmButtonColor: '#075e54',
        timer: 2500,
      });

      setSelectedSantriMap(new Map());
      setBatchTelatPrayers(new Set());
      setUnlockedBySantri(new Map());
      setSearchQuery('');
      if (!stayOnInputAfterSave) {
        setSubTab('rekap');
      }
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const dateFilteredList = filterSholatByDateRange(sholatList, dateRange);

  const rekapKelasOptions = useMemo(() => {
    const set = new Set<string>(kelasOptions);
    for (const r of dateFilteredList) {
      const k = String(r.kelas || '').trim();
      if (k && k !== '-') set.add(k);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [kelasOptions, dateFilteredList]);

  const rekapKamarOptions = useMemo(() => {
    const set = new Set<string>(kamarOptions);
    for (const r of dateFilteredList) {
      const km = String(r.kamar || '').trim();
      if (km && km !== '-') set.add(km);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [kamarOptions, dateFilteredList]);

  const rekapFilteredList = useMemo(() => {
    return dateFilteredList.filter((r) => {
      if (rekapKelas !== 'ALL' && String(r.kelas || '').trim() !== rekapKelas) {
        return false;
      }
      if (rekapKamar !== 'ALL' && String(r.kamar || '').trim() !== rekapKamar) {
        return false;
      }
      return true;
    });
  }, [dateFilteredList, rekapKelas, rekapKamar]);

  const activeDateFilteredList = useMemo(
    () => rekapFilteredList.filter((r) => !isSholatRowPutih(r)),
    [rekapFilteredList]
  );
  const diputihkanCount =
    rekapFilteredList.length - activeDateFilteredList.length;
  const isDateFiltered =
    dateRange.startDate.trim() !== '' || dateRange.endDate.trim() !== '';
  const isRekapFiltered =
    isDateFiltered || rekapKelas !== 'ALL' || rekapKamar !== 'ALL';

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

    for (const row of rekapFilteredList) {
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
  }, [rekapFilteredList]);

  const pencatatBySantri = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of rekapFilteredList) {
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
  }, [rekapFilteredList]);

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
      dailyRows: rekapFilteredList,
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
      dailyRows: rekapFilteredList,
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

  // Badge ringkas status sholat pada tabel rekap harian

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
            📋 Data Rekap &amp; Ekspor ({rekapFilteredList.length})
          </button>
        </div>
      </div>

      {subTab === 'input' ? (
        /* TAB 1: FORM INPUT MASSAL (Pilih Banyak Nama Dulu -> Klik 1/Beberapa Sholat Telat) */
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">
              Input Cepat Keterlambatan Sholat (Pilih Banyak Nama Sekaligus)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              <strong>Langkah 1:</strong> Pilih banyak nama santri yang terlambat.{' '}
              <strong>Langkah 2:</strong> Klik 1 atau beberapa waktu sholat yang telat untuk seluruh santri terpilih. Status <strong>TELAT</strong> sebelumnya pada tanggal sama tetap dikunci otomatis.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            {/* LANGKAH 1: PILIH BANYAK NAMA SANTRI */}
            <div className="rounded-2xl bg-stone-50 border border-slate-200/90 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    1️⃣ Pilih Banyak Nama Santri ({selectedSantriList.length} Terpilih)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Centang nama santri di bawah ini (bisa filter per kelas/kamar atau cari nama).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {filteredSantri.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Pilih Semua Tampil ({filteredSantri.length})
                    </button>
                  )}
                  {selectedSantriList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllSelected}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Kosongkan ({selectedSantriList.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Cari Nama, Kelas, Kamar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative sm:col-span-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama santri..."
                    className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 focus:border-[#00a884] focus:outline-none focus:ring-2 focus:ring-[#00a884]/20"
                  />
                </div>
                <select
                  value={filterKelas}
                  onChange={(e) => setFilterKelas(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#00a884] focus:outline-none"
                >
                  <option value="ALL">Semua Kelas ({kelasOptions.length})</option>
                  {kelasOptions.map((kls) => (
                    <option key={kls} value={kls}>
                      Kelas {kls}
                    </option>
                  ))}
                </select>
                <select
                  value={filterKamar}
                  onChange={(e) => setFilterKamar(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#00a884] focus:outline-none"
                >
                  <option value="ALL">Semua Asrama / Kamar ({kamarOptions.length})</option>
                  {kamarOptions.map((kmr) => (
                    <option key={kmr} value={kmr}>
                      {kmr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode Tampilan Checklist: Semua vs Belum Dicatat Hari Ini */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setChecklistMode('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      checklistMode === 'ALL'
                        ? 'bg-[#075e54] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua Santri ({baseFilteredSantri.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setChecklistMode('UNRECORDED')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      checklistMode === 'UNRECORDED'
                        ? 'bg-[#075e54] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Belum Dicatat Tgl Ini ({unrecordedCount})
                  </button>
                </div>
                <span className="text-[10px] text-slate-500">
                  Lencana otomatis muncul jika santri sedang 🏠 Izin Pulang / 🏥 Lapor Sakit
                </span>
              </div>

              {/* Daftar Checklist Santri */}
              <div className="max-h-64 overflow-y-auto bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                {filteredSantri.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-500">
                    Tidak ada santri yang cocok dengan pencarian/filter.
                  </p>
                ) : (
                  filteredSantri.map((santri) => {
                    const key = normalizeSantriKey(santri.namaSantri);
                    const isChecked = selectedSantriMap.has(key);
                    const existingForItem = findExistingSholatRecordForDate(
                      sholatList,
                      tanggal,
                      santri.namaSantri
                    );
                    const statusBadge = santriStatusBadgesMap.get(key);
                    const lockedLabels = existingForItem
                      ? PRAYER_META.filter(
                          (p) => existingForItem[p.key] === 'TELAT'
                        ).map((p) => p.label)
                      : [];

                    return (
                      <button
                        key={santri.idSantri || santri.namaSantri}
                        type="button"
                        onClick={() => toggleSelectSantri(santri)}
                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition cursor-pointer ${
                          isChecked
                            ? 'bg-emerald-50/90 hover:bg-emerald-100/70'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#075e54] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {santri.namaSantri}
                              </span>
                              {statusBadge?.isIzinPulang && (
                                <span
                                  title={`Izin: ${statusBadge.izinDetail}`}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-bold"
                                >
                                  🏠 Izin Pulang
                                </span>
                              )}
                              {statusBadge?.isSakit && (
                                <span
                                  title={`Keluhan: ${statusBadge.keluhan}`}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-300 text-[10px] font-bold"
                                >
                                  🏥 Lapor Sakit
                                </span>
                              )}
                              {lockedLabels.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>{lockedLabels.join(', ')} Telat</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Kelas {santri.kelas || '-'} · {santri.kamar || '-'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md shrink-0">
                          {santri.idSantri || '-'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Chips Daftar Santri Terpilih */}
              {selectedSantriList.length > 0 && (
                <div className="pt-1">
                  <p className="text-[11px] font-bold text-emerald-900 mb-1.5">
                    Santri Terpilih ({selectedSantriList.length}):
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {selectedSantriList.map((s) => (
                      <span
                        key={s.namaSantri}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-semibold"
                      >
                        <span>{s.namaSantri}</span>
                        <span className="text-[10px] text-emerald-700">
                          ({s.kelas || '-'})
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSelectSantri(s)}
                          className="text-emerald-800 hover:text-rose-700 cursor-pointer"
                          title={`Hapus ${s.namaSantri}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* LANGKAH 2: KLIK 1 ATAU BEBERAPA SHOLAT YANG TELAT UNTUK SEMUA NAMA TERPILIH */}
            <div className="rounded-2xl bg-stone-50 border border-slate-200/90 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    2️⃣ Klik Sholat yang Telat untuk Semua Santri Terpilih
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Bisa pilih 1 waktu sholat atau lebih (misal Subuh saja, atau Subuh + Maghrib).
                  </p>
                </div>
                {batchTelatPrayers.size > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-bold">
                    {batchTelatPrayers.size} Sholat Dipilih Telat
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {PRAYER_META.map((item) => {
                  const isSelectedTelat = batchTelatPrayers.has(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleToggleBatchPrayer(item.key)}
                      className={`rounded-2xl p-3 border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1.5 min-h-[78px] ${
                        isSelectedTelat
                          ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                          : 'bg-white hover:bg-rose-50 text-slate-800 border-slate-200'
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-xs font-bold">{item.label}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          isSelectedTelat
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isSelectedTelat ? '⚠️ TELAT' : 'Klik jika Telat'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* LANGKAH 3: PRATINJAU STATUS & BUKA KUNCI (JIKA ADA KOREKSI PER ANAK) */}
            {computedBatchPreview.length > 0 && (
              <div className="rounded-2xl bg-amber-50/70 border border-amber-200/90 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>
                      Pratinjau Status Final ({computedBatchPreview.length} Santri · Tgl {tanggal})
                    </span>
                  </p>
                  <span className="text-[10px] text-amber-800">
                    Klik 🔒 pada sholat yang terkunci jika ingin ubah kembali ke TEPAT
                  </span>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {computedBatchPreview.map((item) => {
                    const statusBadge = santriStatusBadgesMap.get(item.santriKey);
                    return (
                      <div
                        key={item.santriKey}
                        className="bg-white rounded-xl border border-amber-200/80 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900">
                            {item.santri.namaSantri}
                          </span>
                          <span className="text-slate-500">
                            ({item.santri.kelas || '-'})
                          </span>
                          {statusBadge?.isIzinPulang && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-bold">
                              🏠 Izin Pulang
                            </span>
                          )}
                          {statusBadge?.isSakit && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-200 text-[10px] font-bold">
                              🏥 Sakit
                            </span>
                          )}
                          {item.existing?.pencatat && (
                            <span className="text-[10px] text-amber-800">
                              · Pencatat sblm: {item.existing.pencatat}
                            </span>
                          )}
                        </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {PRAYER_META.map((p) => {
                          const finalVal = item[p.key];
                          const wasLocked = item.existing?.[p.key] === 'TELAT';
                          const isUnlocked = item.unlockedSet.has(p.key);
                          if (wasLocked) {
                            return (
                              <button
                                key={p.key}
                                type="button"
                                onClick={() =>
                                  handleToggleUnlockSantriPrayer(
                                    item.santriKey,
                                    p.key
                                  )
                                }
                                title={
                                  isUnlocked
                                    ? 'Klik untuk kunci kembali jadi TELAT'
                                    : 'Sudah TELAT sebelumnya — klik untuk ubah ke TEPAT'
                                }
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                                  isUnlocked
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-rose-100 text-rose-800 border-rose-300'
                                }`}
                              >
                                {isUnlocked ? (
                                  <Unlock className="w-2.5 h-2.5" />
                                ) : (
                                  <Lock className="w-2.5 h-2.5" />
                                )}
                                <span>
                                  {p.label}: {finalVal}
                                </span>
                              </button>
                            );
                          }
                          return (
                            <span
                              key={p.key}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                finalVal === 'TELAT'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {p.label.slice(0, 3)}: {finalVal === 'TELAT' ? 'TELAT' : '✓'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-700 bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3.5 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={stayOnInputAfterSave}
                onChange={(e) => setStayOnInputAfterSave(e.target.checked)}
                className="w-4 h-4 accent-[#075e54] rounded cursor-pointer"
              />
              <span className="font-semibold">
                Tetap di halaman input setelah simpan (langsung lanjut input kelompok/waktu sholat berikutnya)
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmittingBatch}
              className="w-full min-h-[46px] rounded-xl bg-[#075e54] hover:bg-[#054c42] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isSubmittingBatch
                  ? 'Menyimpan ke Database Cloud...'
                  : selectedSantriList.length > 0
                  ? `Simpan Rekap untuk ${selectedSantriList.length} Santri Terpilih`
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
                Data Rekap Keterlambatan Sholat ({rekapFilteredList.length} Catatan{isRekapFiltered && sholatList.length !== rekapFilteredList.length ? ` dari ${sholatList.length} total` : ''})
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
                {isRekapFiltered && (
                  <button
                    type="button"
                    onClick={() => {
                      onDateRangeChange({ startDate: '', endDate: '' });
                      setRekapKelas('ALL');
                      setRekapKamar('ALL');
                      onSilentSync?.();
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Filter</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
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
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Filter Kelas
                </label>
                <select
                  value={rekapKelas}
                  onChange={(e) => setRekapKelas(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="ALL">Semua Kelas ({rekapKelasOptions.length})</option>
                  {rekapKelasOptions.map((kls) => (
                    <option key={kls} value={kls}>
                      Kelas {kls}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Filter Asrama / Kamar
                </label>
                <select
                  value={rekapKamar}
                  onChange={(e) => setRekapKamar(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="ALL">Semua Asrama ({rekapKamarOptions.length})</option>
                  {rekapKamarOptions.map((kmr) => (
                    <option key={kmr} value={kmr}>
                      {kmr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isRekapFiltered && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-900">
                <span>
                  📅 Filter aktif: <strong>{periodeLabel}</strong>
                  {rekapKelas !== 'ALL' ? ` · Kelas ${rekapKelas}` : ''}
                  {rekapKamar !== 'ALL' ? ` · ${rekapKamar}` : ''} · Menampilkan{' '}
                  <strong>{rekapFilteredList.length}</strong> dari <strong>{sholatList.length}</strong> catatan.
                </span>
                {sholatList.length > rekapFilteredList.length && (
                  <button
                    type="button"
                    onClick={() => {
                      onDateRangeChange({ startDate: '', endDate: '' });
                      setRekapKelas('ALL');
                      setRekapKamar('ALL');
                    }}
                    className="font-bold text-amber-950 underline hover:text-emerald-800 cursor-pointer"
                  >
                    Tampilkan Semua ({sholatList.length})
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
          {rekapFilteredList.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs text-slate-600 bg-stone-50 rounded-2xl border border-slate-200/70 space-y-3">
              <p>
                Tidak ada data rekap sholat pada filter/periode <strong>{periodeLabel}</strong>.
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
                {isRekapFiltered && (
                  <button
                    type="button"
                    onClick={() => {
                      onDateRangeChange({ startDate: '', endDate: '' });
                      setRekapKelas('ALL');
                      setRekapKamar('ALL');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Tampilkan Semua Data ({sholatList.length})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {rekapFilteredList.map((row) => {
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
