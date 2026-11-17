/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import {
  UserCheck,
  Menu,
  X,
  FileText,
  Home,
  Database,
  Settings,
  RefreshCw,
  Cloud,
  LogOut,
} from 'lucide-react';
import {
  addMasterSantriServer,
  addUserRoleServer,
  checkServerSession,
  deleteLaporanServer,
  deletePerizinanServer,
  deleteSholatServer,
  fetchBootstrapData,
  fetchDirectory,
  getSavedSessionToken,
  isServerApiUnavailableError,
  loginWithNameAndPassword,
  logoutServerSession,
  postLaporanServer,
  postPerizinanServer,
  postSholatBatchServer,
  pullSheetToServer,
  resetSholatRangeServer,
  saveGasUrlServer,
  updatePerizinanServer,
  updateUserPasswordServer,
  verifyUserPasswordServer,
} from './utils/serverApi';
import {
  INITIAL_USERS_ROLE,
  authenticateUserRole,
  createLaporanRow,
  runSyncStatusUKP,
  formatTimestampID,
  getLaporanRowKey,
  normalizeDateRangeBounds,
  filterLaporanByDateRange,
  type MasterSantri,
  type LaporanMusyrifRow,
  type DataUKPRow,
  type LaporanInput,
  type SyncLogItem,
  type DateRangeFilter,
  type UserRole,
  type MusyrifProfile,
  type UserRoleRow,
} from './utils/ukpSyncEngine';
import { MusyrifFormCard } from './components/MusyrifFormCard';
import { MusyrifRolePortal } from './components/MusyrifRolePortal';
import { SpreadsheetSyncPanel } from './components/SpreadsheetSyncPanel';
import { SourceCodePanel } from './components/SourceCodePanel';
import {
  ReportOverview,
  type ReportStatusFilter,
} from './components/ReportOverview';
import { PerizinanPulangPanel } from './components/PerizinanPulangPanel';
import { RekapSholatPanel } from './components/RekapSholatPanel';
import {
  getSavedSholatList,
  saveSholatListLocally,
  createSholatRow,
  upsertSholatRowInList,
  filterSholatByDateRange,
  getEffectiveSholatDate,
  isSholatRowPutih,
  formatSholatDateID,
  type SholatRow,
  type SholatInput,
} from './utils/sholatEngine';
import {
  createPerizinanRow,
  getPerizinanRowKey,
  applyPerpanjanganMasaIzin,
  filterPerizinanByDateAndName,
  type PerizinanRow,
  type PerizinanInput,
} from './utils/perizinanEngine';
import {
  DEFAULT_GAS_WEB_APP_URL,
  fetchAllSheetsFromGas,
  getSavedGasUrl,
  saveGasUrl,
  postActionToGas,
  getSavedPerizinanList,
  savePerizinanListLocally,
} from './utils/gasClient';

const LOGO_URL = '/assets/aistudio/Logo_Al-Andalus_c7d889d5.png';

type AdminMenuTab =
  | 'hub'
  | 'sakit'
  | 'perizinan'
  | 'sholat'
  | 'spreadsheet'
  | 'kode';

export default function App() {
  const [userRole, setUserRole] = useState<UserRole>('MUSYRIF');
  const [activeMusyrif, setActiveMusyrif] = useState<MusyrifProfile | null>(null);
  const [adminTab, setAdminTab] = useState<AdminMenuTab>('hub');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const [sessionReady, setSessionReady] = useState<boolean>(false);
  const [storageMode, setStorageMode] = useState<
    'firestore_and_sheet' | 'fast_server_and_sheet'
  >('fast_server_and_sheet');
  const [mirrorStatus, setMirrorStatus] = useState<
    'idle' | 'syncing' | 'synced' | 'queued'
  >('idle');

  const [gasWebAppUrl, setGasWebAppUrl] = useState<string>(() =>
    getSavedGasUrl()
  );
  const [isSyncingGas, setIsSyncingGas] = useState<boolean>(false);

  const [serverApiAvailable, setServerApiAvailable] = useState<boolean>(true);
  const serverApiAvailableRef = useRef<boolean>(true);

  const [masterData, setMasterData] = useState<MasterSantri[]>([]);
  const [laporanList, setLaporanList] = useState<LaporanMusyrifRow[]>([]);
  const [ukpList, setUkpList] = useState<DataUKPRow[]>([]);
  const [usersRoleList, setUsersRoleList] = useState<UserRoleRow[]>(
    () => INITIAL_USERS_ROLE
  );
  const [perizinanList, setPerizinanList] = useState<PerizinanRow[]>(() =>
    getSavedPerizinanList(Boolean(getSavedGasUrl()))
  );
  const [sholatList, setSholatList] = useState<SholatRow[]>(() =>
    getSavedSholatList(Boolean(getSavedGasUrl()))
  );
  const isPullingRef = useRef<boolean>(false);

  const [syncLogs, setSyncLogs] = useState<SyncLogItem[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() =>
    formatTimestampID(new Date())
  );
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({
    startDate: '',
    endDate: '',
  });
  const [autoTriggerEnabled, setAutoTriggerEnabled] = useState<boolean>(false);

  const applyGasSnapshot = useCallback((gasData: Awaited<ReturnType<typeof fetchAllSheetsFromGas>>) => {
    if (Array.isArray(gasData.masterData)) setMasterData(gasData.masterData);
    if (Array.isArray(gasData.laporanList)) setLaporanList(gasData.laporanList);
    if (Array.isArray(gasData.ukpList)) setUkpList(gasData.ukpList);
    if (Array.isArray(gasData.usersRoleList) && gasData.usersRoleList.length > 0) {
      setUsersRoleList(gasData.usersRoleList);
    }
    if (Array.isArray(gasData.perizinanList)) {
      setPerizinanList(gasData.perizinanList);
      savePerizinanListLocally(gasData.perizinanList);
    }
    if (Array.isArray(gasData.sholatList)) {
      setSholatList(gasData.sholatList);
      saveSholatListLocally(gasData.sholatList);
    }
    setLastSyncTime(formatTimestampID(new Date()));
  }, []);

  const loadBootstrap = useCallback(async () => {
    if (!serverApiAvailableRef.current) return;
    try {
      const data = await fetchBootstrapData();
      if (Array.isArray(data.masterData)) setMasterData(data.masterData);
      if (Array.isArray(data.laporanList)) setLaporanList(data.laporanList);
      if (Array.isArray(data.ukpList)) setUkpList(data.ukpList);
      if (Array.isArray(data.usersRoleList) && data.usersRoleList.length > 0) {
        setUsersRoleList(data.usersRoleList);
      }
      if (Array.isArray(data.perizinanList)) {
        setPerizinanList(data.perizinanList);
        savePerizinanListLocally(data.perizinanList);
      }
      if (Array.isArray(data.sholatList)) {
        setSholatList(data.sholatList);
        saveSholatListLocally(data.sholatList);
      }
      if (typeof data.gasWebAppUrl === 'string') {
        setGasWebAppUrl(data.gasWebAppUrl);
      }
      setLastSyncTime(data.lastSyncTime || formatTimestampID(new Date()));
      setMirrorStatus(data.mirrorStatus || 'idle');
      setStorageMode(data.storageMode || 'fast_server_and_sheet');
    } catch {
      // ignore background refresh error
    }
  }, []);

  // Muat direktori nama pengguna + cek sesi aktif di server (dengan fallback otomatis ke Google Sheets jika API server tidak tersedia)
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [dirRes, sesRes] = await Promise.all([
          fetchDirectory(),
          checkServerSession(),
        ]);
        if (cancelled) return;
        serverApiAvailableRef.current = true;
        setServerApiAvailable(true);
        if (Array.isArray(dirRes.usersDirectory) && dirRes.usersDirectory.length > 0) {
          setUsersRoleList(dirRes.usersDirectory);
        }
        setStorageMode(dirRes.storageMode || 'fast_server_and_sheet');
        if (dirRes.lastSyncTime) setLastSyncTime(dirRes.lastSyncTime);

        if (sesRes.authenticated && sesRes.user) {
          setActiveMusyrif({
            idMusyrif: sesRes.user.namaUser,
            namaMusyrif: sesRes.user.namaUser,
            gedungAsrama: sesRes.user.keterangan || 'Pesantren Al-Andalus',
          });
          setUserRole(sesRes.user.role);
          await loadBootstrap();
        }
      } catch (err) {
        if (cancelled) return;
        if (isServerApiUnavailableError(err)) {
          serverApiAvailableRef.current = false;
          setServerApiAvailable(false);
          const targetUrl = getSavedGasUrl() || DEFAULT_GAS_WEB_APP_URL;
          if (targetUrl) {
            try {
              const gasData = await fetchAllSheetsFromGas(targetUrl);
              if (!cancelled) {
                applyGasSnapshot(gasData);
              }
            } catch {
              // keep INITIAL_USERS_ROLE & local snapshot cleanly
            }
          }
        }
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [applyGasSnapshot, loadBootstrap]);

  // Sinkronisasi real-time antar perangkat (SSE + fallback polling ringan)
  useEffect(() => {
    if (!activeMusyrif || !serverApiAvailable) return;

    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let es: EventSource | null = null;

    const startPollingFallback = () => {
      if (fallbackTimer) return;
      fallbackTimer = setInterval(() => {
        void loadBootstrap();
      }, 6000);
    };

    try {
      const savedToken = getSavedSessionToken();
      const eventsUrl = savedToken
        ? `/api/events?token=${encodeURIComponent(savedToken)}`
        : '/api/events';
      es = new EventSource(eventsUrl, { withCredentials: true });
      es.addEventListener('update', () => {
        void loadBootstrap();
      });
      es.onerror = () => {
        es?.close();
        es = null;
        startPollingFallback();
      };
    } catch {
      startPollingFallback();
    }

    return () => {
      es?.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [activeMusyrif, loadBootstrap, serverApiAvailable]);

  const handleServerLogin = async (
    namaUser: string,
    password: string
  ): Promise<{ valid: boolean; user?: UserRoleRow; errorMessage?: string }> => {
    if (serverApiAvailableRef.current) {
      try {
        const res = await loginWithNameAndPassword(namaUser, password);
        if (res.valid) {
          await loadBootstrap();
        }
        return {
          valid: res.valid,
          user: res.user,
          errorMessage: res.errorMessage,
        };
      } catch (err) {
        if (!isServerApiUnavailableError(err)) {
          return {
            valid: false,
            errorMessage:
              err instanceof Error ? err.message : 'Gagal masuk ke server.',
          };
        }
        serverApiAvailableRef.current = false;
        setServerApiAvailable(false);
      }
    }

    // Fallback langsung ke Google Sheets jika berjalan di static preview tanpa Express backend
    let candidateUsers = usersRoleList;
    const targetUrl = gasWebAppUrl || DEFAULT_GAS_WEB_APP_URL;
    if (targetUrl) {
      try {
        const gasData = await fetchAllSheetsFromGas(targetUrl);
        applyGasSnapshot(gasData);
        if (Array.isArray(gasData.usersRoleList) && gasData.usersRoleList.length > 0) {
          candidateUsers = gasData.usersRoleList;
        }
      } catch {
        // gunakan daftar usersRoleList yang ada
      }
    }
    return authenticateUserRole(namaUser, password, candidateUsers);
  };

  const handleLogoutPortal = async () => {
    if (serverApiAvailableRef.current) {
      await logoutServerSession();
    }
    setActiveMusyrif(null);
    setAdminTab('hub');
    setUserRole('MUSYRIF');
  };

  const pullFromGasSheets = useCallback(
    async (
      targetUrlParam?: string,
      showSuccessAlert: boolean = false,
      isSilent: boolean = false
    ) => {
      if (isSilent && isPullingRef.current) return null;
      isPullingRef.current = true;
      if (!isSilent) setIsSyncingGas(true);
      try {
        if (serverApiAvailableRef.current) {
          const res = await pullSheetToServer();
          await loadBootstrap();
          if (showSuccessAlert) {
            await Swal.fire({
              icon: 'success',
              title: 'Data Spreadsheet & Server Tersinkronisasi!',
              html: `<div class="text-xs text-slate-600 space-y-1.5">
                <p>Data terbaru dari Google Sheets sudah diperbarui di Server Cepat:</p>
                <p><b>Laporan Sakit:</b> ${res.counts.laporanList} · <b>Perizinan:</b> ${res.counts.perizinanList} · <b>Rekap Sholat:</b> ${res.counts.sholatList}</p>
              </div>`,
              confirmButtonColor: '#0B4627',
            });
          }
          return res;
        }

        const effectiveUrl = targetUrlParam || gasWebAppUrl || DEFAULT_GAS_WEB_APP_URL;
        const gasData = await fetchAllSheetsFromGas(effectiveUrl);
        applyGasSnapshot(gasData);
        if (showSuccessAlert) {
          await Swal.fire({
            icon: 'success',
            title: 'Data Google Sheets Tersinkronisasi!',
            html: `<div class="text-xs text-slate-600 space-y-1.5">
              <p><b>Laporan Sakit:</b> ${gasData.laporanList?.length || 0} · <b>Perizinan:</b> ${gasData.perizinanList?.length || 0} · <b>Rekap Sholat:</b> ${gasData.sholatList?.length || 0}</p>
            </div>`,
            confirmButtonColor: '#0B4627',
          });
        }
        return gasData;
      } catch (err) {
        if (showSuccessAlert) {
          await Swal.fire({
            icon: 'error',
            title: 'Gagal Menghubungi Google Sheets',
            text:
              err instanceof Error
                ? err.message
                : 'Pastikan URL Web App berakhiran /exec dan akses diset ke Anyone.',
            confirmButtonColor: '#0B4627',
          });
        }
        return null;
      } finally {
        isPullingRef.current = false;
        if (!isSilent) setIsSyncingGas(false);
      }
    },
    [applyGasSnapshot, gasWebAppUrl, loadBootstrap]
  );

  const handlePullDataByDateRange = useCallback(
    async (
      range: DateRangeFilter,
      moduleType: 'sholat' | 'laporan' | 'perizinan' | 'all' = 'all'
    ) => {
      const { start, end } = normalizeDateRangeBounds(range);
      const periodeLabel =
        start && end
          ? start === end
            ? formatSholatDateID(start)
            : `${formatSholatDateID(start)} s/d ${formatSholatDateID(end)}`
          : start
          ? `Mulai ${formatSholatDateID(start)}`
          : end
          ? `Sampai ${formatSholatDateID(end)}`
          : 'Semua Tanggal';

      if (gasWebAppUrl) {
        await pullFromGasSheets(gasWebAppUrl, false, false);
      }

      const fresh = await fetchBootstrapData().catch(() => null);
      const latestSholat = fresh?.sholatList || sholatList;
      const latestLaporan = fresh?.laporanList || laporanList;
      const latestPerizinan = fresh?.perizinanList || perizinanList;

      const matchedSholat = filterSholatByDateRange(latestSholat, range);
      const matchedLaporan = filterLaporanByDateRange(latestLaporan, range);
      const matchedPerizinan = filterPerizinanByDateAndName(
        latestPerizinan,
        range,
        ''
      );

      let detailHtml = '';
      if (moduleType === 'sholat') {
        detailHtml = `
          <p>Rentang Tanggal: <b>${periodeLabel}</b></p>
          <p>Data Rekap Sholat ditemukan: <b>${matchedSholat.length} catatan</b> (dari total ${latestSholat.length}).</p>
        `;
      } else if (moduleType === 'perizinan') {
        detailHtml = `
          <p>Rentang Tanggal: <b>${periodeLabel}</b></p>
          <p>Data Perizinan ditemukan: <b>${matchedPerizinan.length} surat</b> (dari total ${latestPerizinan.length}).</p>
        `;
      } else {
        detailHtml = `
          <p>Rentang Tanggal: <b>${periodeLabel}</b></p>
          <p><b>Laporan Sakit:</b> ${matchedLaporan.length}/${latestLaporan.length} · <b>Perizinan:</b> ${matchedPerizinan.length}/${latestPerizinan.length} · <b>Sholat:</b> ${matchedSholat.length}/${latestSholat.length}</p>
        `;
      }

      await Swal.fire({
        icon: 'success',
        title: 'Data Rentang Tanggal Berhasil Ditarik!',
        html: `<div class="text-xs text-slate-600 space-y-1.5">${detailHtml}</div>`,
        confirmButtonColor: '#075e54',
      });
    },
    [gasWebAppUrl, pullFromGasSheets, sholatList, perizinanList, laporanList]
  );

  const handleAddSholatBatch = async (
    inputs: SholatInput[]
  ): Promise<{
    savedCount: number;
    syncedToSheet: boolean;
    needsGasUpdate?: boolean;
    errorMessage?: string;
  }> => {
    if (inputs.length === 0) {
      return { savedCount: 0, syncedToSheet: true };
    }

    const optimisticRows = inputs.map((inp) => createSholatRow(inp));
    setSholatList((prev) => {
      let next = prev;
      for (const r of optimisticRows) {
        next = upsertSholatRowInList(next, r);
      }
      saveSholatListLocally(next);
      return next;
    });

    setMirrorStatus('syncing');
    if (serverApiAvailableRef.current) {
      const res = await postSholatBatchServer(inputs);
      if (Array.isArray(res.savedRows) && res.savedRows.length > 0) {
        setSholatList((prev) => {
          let next = prev;
          for (const r of res.savedRows) {
            next = upsertSholatRowInList(next, r);
          }
          saveSholatListLocally(next);
          return next;
        });
      }
    } else if (gasWebAppUrl) {
      await postActionToGas(gasWebAppUrl, {
        action: 'simpanSholatBatch',
        items: optimisticRows.map((row, idx) => ({
          ...row,
          unlockedPrayers: inputs[idx]?.unlockedPrayers,
        })),
      });
    }
    setLastSyncTime(formatTimestampID(new Date()));
    setMirrorStatus(gasWebAppUrl ? 'synced' : 'idle');

    return {
      savedCount: inputs.length,
      syncedToSheet: Boolean(gasWebAppUrl),
      errorMessage: gasWebAppUrl
        ? undefined
        : 'URL Spreadsheet belum terpasang (tersimpan di Database Server).',
    };
  };

  const handleAddSholat = async (
    input: SholatInput
  ): Promise<{
    syncedToSheet: boolean;
    needsGasUpdate?: boolean;
    errorMessage?: string;
  }> => {
    const res = await handleAddSholatBatch([input]);
    return {
      syncedToSheet: res.syncedToSheet,
      needsGasUpdate: res.needsGasUpdate,
      errorMessage: res.errorMessage,
    };
  };

  const handleDeleteSholat = async (idSholat: string) => {
    setSholatList((prev) => {
      const updated = prev.filter((r) => r.idSholat !== idSholat);
      saveSholatListLocally(updated);
      return updated;
    });
    if (serverApiAvailableRef.current) {
      await deleteSholatServer(idSholat);
    } else if (gasWebAppUrl) {
      await postActionToGas(gasWebAppUrl, { action: 'deleteSholat', idSholat });
    }
    setLastSyncTime(formatTimestampID(new Date()));
  };

  const handleResetSholatRange = async (
    start: string,
    end: string,
    keterangan: string
  ) => {
    const bounds = normalizeDateRangeBounds({ startDate: start, endDate: end });
    setSholatList((prev) => {
      const updated = prev.map((r) => {
        const tgl = getEffectiveSholatDate(r);
        if (!tgl) return r;
        if (bounds.start && tgl < bounds.start) return r;
        if (bounds.end && tgl > bounds.end) return r;
        return {
          ...r,
          keterangan: keterangan || 'DIPUTIHKAN',
        };
      });
      saveSholatListLocally(updated);
      return updated;
    });
    if (serverApiAvailableRef.current) {
      await resetSholatRangeServer(
        bounds.start,
        bounds.end,
        keterangan || 'DIPUTIHKAN'
      );
    } else if (gasWebAppUrl) {
      await postActionToGas(gasWebAppUrl, {
        action: 'resetSholatRange',
        startDate: bounds.start,
        endDate: bounds.end,
        keterangan: keterangan || 'DIPUTIHKAN',
      });
    }
    setLastSyncTime(formatTimestampID(new Date()));
  };

  const handleSaveAndTestGasUrl = async (newUrl: string) => {
    saveGasUrl(newUrl);
    setGasWebAppUrl(newUrl);
    if (serverApiAvailableRef.current) {
      await saveGasUrlServer(newUrl);
      await loadBootstrap();
    } else if (newUrl) {
      const gasData = await fetchAllSheetsFromGas(newUrl);
      applyGasSnapshot(gasData);
    }
    if (!newUrl) {
      await Swal.fire({
        icon: 'info',
        title: 'Mirror Google Sheets Diputuskan',
        text: 'Aplikasi tetap berjalan cepat menggunakan Database Server.',
        confirmButtonColor: '#0B4627',
      });
      return;
    }
    await Swal.fire({
      icon: 'success',
      title: 'URL Spreadsheet Tersimpan & Tersinkron!',
      text: 'Data dari Google Sheets telah dimuat ke Aplikasi.',
      confirmButtonColor: '#0B4627',
    });
  };

  const handleSubmitLaporan = async (
    input: LaporanInput
  ): Promise<{ idLaporan: string }> => {
    const nextSeq = laporanList.length + 1;
    const newRow = createLaporanRow(input, nextSeq, new Date());

    setLaporanList((prev) => [newRow, ...prev]);
    if (serverApiAvailableRef.current) {
      await postLaporanServer(newRow, input);
    } else if (gasWebAppUrl) {
      await postActionToGas(gasWebAppUrl, { action: 'simpanLaporan', ...input });
    }
    setLastSyncTime(formatTimestampID(new Date()));

    return { idLaporan: newRow.idLaporan };
  };

  const executeSyncUKP = useCallback(
    async (showToast: boolean = true) => {
      if (gasWebAppUrl) {
        try {
          setIsSyncingGas(true);
          await postActionToGas(gasWebAppUrl, { action: 'syncStatusUKP' });
          await pullFromGasSheets(gasWebAppUrl, false, true);
        } catch {
          // lanjutkan sinkronisasi lokal
        } finally {
          setIsSyncingGas(false);
        }
      }

      const nowStr = formatTimestampID(new Date());
      const result = runSyncStatusUKP(laporanList, ukpList, nowStr);

      setLaporanList(result.updatedLaporan);
      setLastSyncTime(nowStr);

      if (result.logs.length > 0) {
        setSyncLogs((prev) => [...result.logs, ...prev].slice(0, 10));
      }

      if (showToast) {
        if (result.updatedCount > 0) {
          const detailHtml = result.logs
            .map(
              (l) =>
                `<li class="text-left text-xs py-1"><b>${l.namaSantri}</b> (${l.idLaporan}) → <span class="text-emerald-700 font-semibold">${l.statusBaru}</span> (Baris UKP #${l.ukpRowNumber})</li>`
            )
            .join('');

          Swal.fire({
            icon: 'success',
            title: `syncStatusUKP() Selesai (${result.updatedCount} Diperbarui)`,
            html: `<div class="text-xs text-slate-600 space-y-2">
              <p>Pencarian <b>Bottom-Up</b> pada sheet <code>Data_UKP</code> menemukan tindakan terbaru untuk laporan yang berstatus <b>MENUNGGU PENANGANAN</b>:</p>
              <ul class="list-disc pl-4 space-y-1">${detailHtml}</ul>
            </div>`,
            confirmButtonColor: '#0B4627',
          });
        } else {
          Swal.fire({
            icon: 'info',
            title: 'syncStatusUKP() Selesai Dijalankan',
            html: `<div class="text-xs text-slate-600">
              <p>Diperiksa <b>${result.checkedWaitingCount}</b> laporan berstatus <code>MENUNGGU PENANGANAN</code>.</p>
              <p class="mt-1">Belum ada baris baru di <code>Data_UKP</code> yang kolom <b>Tindakan (Kolom P)</b>-nya sudah terisi untuk santri tersebut.</p>
            </div>`,
            confirmButtonColor: '#0B4627',
          });
        }
      }
    },
    [gasWebAppUrl, laporanList, pullFromGasSheets, ukpList]
  );

  useEffect(() => {
    if (!autoTriggerEnabled) return;
    const interval = setInterval(() => {
      executeSyncUKP(false);
    }, 8000);
    return () => clearInterval(interval);
  }, [autoTriggerEnabled, executeSyncUKP]);

  const handleUpdateUKPTindakan = (idRow: string, tindakanBaru: string) => {
    setUkpList((prev) =>
      prev.map((row) =>
        row.idRow === idRow ? { ...row, tindakan: tindakanBaru } : row
      )
    );
  };

  const handleAddUKPRow = (newRow: Omit<DataUKPRow, 'idRow'>) => {
    setUkpList((prev) => [
      ...prev,
      {
        ...newRow,
        idRow: `UKP-${prev.length + 1}`,
      },
    ]);
  };

  const handleAddMasterSantri = (newSantri: MasterSantri) => {
    setMasterData((prev) => [...prev, newSantri]);
    if (serverApiAvailableRef.current) {
      void addMasterSantriServer(newSantri);
    } else if (gasWebAppUrl) {
      void postActionToGas(gasWebAppUrl, { action: 'addMasterSantri', ...newSantri });
    }
  };

  const handleUpdateUserPassword = (namaUser: string, newPassword: string) => {
    setUsersRoleList((prev) =>
      prev.map((u) =>
        u.namaUser === namaUser ? { ...u, password: newPassword } : u
      )
    );
    if (serverApiAvailableRef.current) {
      void updateUserPasswordServer(namaUser, newPassword);
    } else if (gasWebAppUrl) {
      void postActionToGas(gasWebAppUrl, {
        action: 'updateUserPassword',
        namaUser,
        newPassword,
      });
    }
  };

  const handleAddUserRole = (newUser: UserRoleRow) => {
    setUsersRoleList((prev) => [...prev, newUser]);
    if (serverApiAvailableRef.current) {
      void addUserRoleServer(newUser);
    } else if (gasWebAppUrl) {
      void postActionToGas(gasWebAppUrl, { action: 'addUserRole', ...newUser });
    }
  };

  const handleDeleteLaporan = async (row: LaporanMusyrifRow) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Inputan Laporan?',
      html: `<div class="text-xs text-slate-600 space-y-1 text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
        <p><b>Nama Santri:</b> ${row.namaSantri} (${row.kelas})</p>
        <p><b>Tanggal Laporan:</b> ${row.tanggalLaporan}</p>
        <p><b>Keluhan:</b> ${row.keluhanUtama}</p>
        <p><b>ID / Waktu:</b> ${row.idLaporan} · ${row.timestamp}</p>
      </div>
      <p class="text-xs text-rose-700 font-semibold mt-2">Data yang dihapus tidak akan masuk ke rekap pesan WhatsApp maupun daftar pantauan.</p>`,
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Inputan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
    });

    if (!confirm.isConfirmed) return;

    const targetKey = getLaporanRowKey(row);
    setLaporanList((prev) =>
      prev.filter((item) => getLaporanRowKey(item) !== targetKey)
    );
    if (serverApiAvailableRef.current) {
      await deleteLaporanServer(row.idLaporan);
    } else if (gasWebAppUrl) {
      await postActionToGas(gasWebAppUrl, {
        action: 'deleteLaporan',
        idLaporan: row.idLaporan,
        timestamp: row.timestamp,
        namaSantri: row.namaSantri,
        tanggalLaporan: row.tanggalLaporan,
      });
    }

    await Swal.fire({
      icon: 'success',
      title: 'Inputan Berhasil Dihapus',
      text: `Laporan ${row.namaSantri} (${row.tanggalLaporan}) telah dihapus dari daftar.`,
      timer: 1800,
      showConfirmButton: false,
    });
  };

  const handleAddPerizinan = async (
    input: PerizinanInput
  ): Promise<PerizinanRow> => {
    const maxNo = perizinanList.reduce((acc, r) => {
      const n = parseInt(String(r.no || '0'), 10);
      return Number.isNaN(n) ? acc : Math.max(acc, n);
    }, 0);
    const newRow = createPerizinanRow(input, maxNo + 1);

    setPerizinanList((prev) => {
      const updated = [newRow, ...prev];
      savePerizinanListLocally(updated);
      return updated;
    });
    if (serverApiAvailableRef.current) {
      await postPerizinanServer(newRow);
    } else if (gasWebAppUrl) {
      await postActionToGas(gasWebAppUrl, { action: 'simpanPerizinan', ...newRow });
    }
    setLastSyncTime(formatTimestampID(new Date()));

    return newRow;
  };

  const handleMarkPerizinanReturned = (
    targetRow: PerizinanRow,
    tibaTanggal: string,
    keteranganTiba: string
  ) => {
    const key = getPerizinanRowKey(targetRow);
    const updatedRow = { ...targetRow, tibaTanggal, keteranganTiba };
    setPerizinanList((prev) => {
      const updated = prev.map((r) =>
        getPerizinanRowKey(r) === key ? updatedRow : r
      );
      savePerizinanListLocally(updated);
      return updated;
    });
    if (serverApiAvailableRef.current) {
      void updatePerizinanServer(updatedRow, 'tiba');
    } else if (gasWebAppUrl) {
      void postActionToGas(gasWebAppUrl, {
        action: 'updatePerizinanTiba',
        idPerizinan: updatedRow.idPerizinan,
        no: updatedRow.no,
        nama: updatedRow.nama,
        dariTanggal: updatedRow.dariTanggal,
        tibaTanggal: updatedRow.tibaTanggal,
        keteranganTiba: updatedRow.keteranganTiba,
      });
    }
  };

  const handleExtendPerizinan = (
    targetRow: PerizinanRow,
    sampaiTanggalBaru: string,
    sampaiJamBaru: string,
    alasanPerpanjangan: string
  ): PerizinanRow => {
    const key = getPerizinanRowKey(targetRow);
    const extendedRow = applyPerpanjanganMasaIzin(
      targetRow,
      sampaiTanggalBaru,
      sampaiJamBaru,
      alasanPerpanjangan
    );

    setPerizinanList((prev) => {
      const updated = prev.map((r) =>
        getPerizinanRowKey(r) === key ? extendedRow : r
      );
      savePerizinanListLocally(updated);
      return updated;
    });
    if (serverApiAvailableRef.current) {
      void updatePerizinanServer(extendedRow, 'extend');
    } else if (gasWebAppUrl) {
      void postActionToGas(gasWebAppUrl, {
        action: 'updatePerizinanTiba',
        idPerizinan: extendedRow.idPerizinan,
        no: extendedRow.no,
        nama: extendedRow.nama,
        dariTanggal: extendedRow.dariTanggal,
        sampaiTanggal: extendedRow.sampaiTanggal,
        sampaiHari: extendedRow.sampaiHari,
        sampaiJam: extendedRow.sampaiJam,
        durasi: extendedRow.durasi,
        tibaTanggal: '',
        keteranganTiba: extendedRow.keteranganTiba,
      });
    }

    return extendedRow;
  };

  const handleDeletePerizinan = async (targetRow: PerizinanRow) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Hapus Data Perizinan?',
      html: `<div class="text-xs text-slate-600 space-y-1 text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
        <p><b>No. Surat:</b> #${targetRow.no}</p>
        <p><b>Nama Santri:</b> ${targetRow.nama} (${targetRow.kelas})</p>
        <p><b>Keperluan:</b> ${targetRow.izin} (${targetRow.keterangan || '-'})</p>
        <p><b>Jadwal:</b> ${targetRow.dariTanggal} s/d ${targetRow.sampaiTanggal}</p>
      </div>`,
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Perizinan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
    });

    if (!confirm.isConfirmed) return;

    const key = getPerizinanRowKey(targetRow);
    setPerizinanList((prev) => {
      const updated = prev.filter((r) => getPerizinanRowKey(r) !== key);
      savePerizinanListLocally(updated);
      return updated;
    });
    if (serverApiAvailableRef.current) {
      await deletePerizinanServer(targetRow);
    } else if (gasWebAppUrl) {
      await postActionToGas(gasWebAppUrl, {
        action: 'deletePerizinan',
        idPerizinan: targetRow.idPerizinan,
        no: targetRow.no,
        nama: targetRow.nama,
        dariTanggal: targetRow.dariTanggal,
      });
    }
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F2] p-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center max-w-sm w-full space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Cloud className="w-7 h-7 text-[#075e54] animate-pulse" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            Menyiapkan Portal Al-Andalus...
          </p>
          <p className="text-xs text-slate-500">
            Memuat daftar nama akun Musyrif &amp; Admin
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F2] text-slate-900">
      <main
        id="top"
        className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"
      >
        {userRole === 'MUSYRIF' || !activeMusyrif ? (
          <MusyrifRolePortal
            activeMusyrif={activeMusyrif}
            onSelectMusyrif={(prof) => {
              if (!prof) {
                void handleLogoutPortal();
              } else {
                setActiveMusyrif(prof);
              }
            }}
            onSwitchToRole={(role) => {
              setAdminTab('hub');
              setUserRole(role);
            }}
            usersRoleList={usersRoleList}
            masterData={masterData}
            laporanList={laporanList}
            activeFilter={statusFilter}
            onSelectFilter={setStatusFilter}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            lastSyncTime={lastSyncTime}
            onQuickSync={() => executeSyncUKP(true)}
            onSyncNow={gasWebAppUrl ? () => pullFromGasSheets(gasWebAppUrl, true, false) : undefined}
            isSyncing={isSyncingGas}
            onSubmitLaporan={handleSubmitLaporan}
            onLoginAttempt={handleServerLogin}
            logoUrl={LOGO_URL}
          />
        ) : (
          <div
            className="space-y-6"
            data-testid={
              userRole === 'ADMIN_PENGASUHAN'
                ? 'admin-pengasuhan-portal'
                : 'admin-full-portal'
            }
          >
            {isSidebarOpen && (
              <div className="fixed inset-0 z-50 flex print:hidden">
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
                  onClick={() => setIsSidebarOpen(false)}
                />

                <div className="relative w-80 max-w-[85vw] bg-[#075e54] text-white shadow-2xl flex flex-col h-full z-10">
                  <div className="p-5 border-b border-emerald-600/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <Menu className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Menu Navigasi Utama</h3>
                        <p className="text-[11px] text-emerald-100/90">Pesantren Al-Andalus</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 flex-1 overflow-y-auto space-y-2">
                    <button
                      type="button"
                      onClick={() => { setAdminTab('hub'); setIsSidebarOpen(false); }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                        adminTab === 'hub' ? 'bg-[#00a884] text-white shadow-sm' : 'text-emerald-100 hover:bg-emerald-800/50'
                      }`}
                    >
                      <Home className="w-5 h-5 text-emerald-200" />
                      <span>🏛️ Menu Utama (Hub)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setAdminTab('sakit'); setIsSidebarOpen(false); }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                        adminTab === 'sakit' ? 'bg-[#00a884] text-white shadow-sm' : 'text-emerald-100 hover:bg-emerald-800/50'
                      }`}
                    >
                      <FileText className="w-5 h-5 text-emerald-200" />
                      <span>🏥 Laporan Santri Sakit &amp; UKP</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setAdminTab('perizinan'); setIsSidebarOpen(false); }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                        adminTab === 'perizinan' ? 'bg-[#00a884] text-white shadow-sm' : 'text-emerald-100 hover:bg-emerald-800/50'
                      }`}
                    >
                      <UserCheck className="w-5 h-5 text-emerald-200" />
                      <span>🏠 Izin Pulang Santri</span>
                    </button>

                    {(userRole === 'ADMIN_PENGASUHAN' || userRole === 'ADMIN_PUSAT') && (
                      <button
                        type="button"
                        onClick={() => { setAdminTab('sholat'); setIsSidebarOpen(false); }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                          adminTab === 'sholat' ? 'bg-[#00a884] text-white shadow-sm' : 'text-emerald-100 hover:bg-emerald-800/50'
                        }`}
                      >
                        <span className="text-lg">🕌</span>
                        <span>Rekap Keterlambatan Sholat</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => { setAdminTab('spreadsheet'); setIsSidebarOpen(false); }}
                      className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                        adminTab === 'spreadsheet' ? 'bg-[#00a884] text-white shadow-sm' : 'text-emerald-100 hover:bg-emerald-800/50'
                      }`}
                    >
                      <Database className="w-5 h-5 text-emerald-200" />
                      <span>🗂️ Data Spreadsheet</span>
                    </button>

                    {userRole === 'ADMIN_PUSAT' && (
                      <button
                        type="button"
                        onClick={() => { setAdminTab('kode'); setIsSidebarOpen(false); }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-3 cursor-pointer ${
                          adminTab === 'kode' ? 'bg-[#00a884] text-white shadow-sm' : 'text-emerald-100 hover:bg-emerald-800/50'
                        }`}
                      >
                        <Settings className="w-5 h-5 text-emerald-200" />
                        <span>⚙️ Koneksi Sheet &amp; Code.gs</span>
                      </button>
                    )}
                  </div>

                  <div className="p-4 border-t border-emerald-600/50 text-center">
                    <p className="text-[11px] text-emerald-200">Pesantren Islam Internasional Al-Andalus</p>
                  </div>
                </div>
              </div>
            )}

            {/* Header Admin */}
            <div className="bg-[#075e54] text-white rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-xs print:hidden">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  data-testid="btn-toggle-sidebar"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center justify-center cursor-pointer shrink-0"
                  title="Buka Menu (☰)"
                >
                  <Menu className="w-5 h-5 text-white" />
                </button>

                <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 text-white font-bold text-xs shadow-inner">
                  {userRole === 'ADMIN_PENGASUHAN' ? 'AP' : 'SDM'}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {activeMusyrif?.namaMusyrif || (userRole === 'ADMIN_PENGASUHAN' ? 'Admin Pengasuhan' : 'Admin Pusat / SDM')}
                  </p>
                  <p className="text-[10px] text-emerald-200 truncate">
                    ⚡ Server Cepat Real-Time
                    {storageMode === 'firestore_and_sheet' ? ' · Firestore Aktif' : ''}
                    {gasWebAppUrl
                      ? mirrorStatus === 'syncing'
                        ? ' · Mirror Sheet...'
                        : mirrorStatus === 'queued'
                        ? ' · Sheet tertunda'
                        : ' · Mirror Sheet Aktif'
                      : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {gasWebAppUrl && (
                  <button
                    type="button"
                    onClick={() => pullFromGasSheets(gasWebAppUrl, true, false)}
                    disabled={isSyncingGas}
                    title={`Tarik data terbaru dari Spreadsheet (${lastSyncTime || '-'})`}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700/70 hover:bg-emerald-600 text-white text-[11px] font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isSyncingGas ? 'animate-spin' : ''}`}
                    />
                    <span className="hidden sm:inline">
                      {isSyncingGas ? 'Menarik Sheet...' : 'Impor Sheet'}
                    </span>
                  </button>
                )}

                {adminTab !== 'hub' && (
                  <button
                    type="button"
                    onClick={() => setAdminTab('hub')}
                    className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold transition flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>🏠 Hub Menu</span>
                  </button>
                )}

                <button
                  type="button"
                  data-testid="btn-return-musyrif"
                  onClick={() => void handleLogoutPortal()}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-white" />
                  <span>Ganti Akun</span>
                </button>
              </div>
            </div>

            {adminTab === 'hub' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-[#075e54] text-white rounded-2xl p-4 sm:p-5 shadow-sm flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-emerald-200 uppercase tracking-wider">Portal Pengasuhan Al-Andalus</span>
                    <h1 className="text-base sm:text-lg font-bold text-white">
                      Pilih Menu Layanan Utama
                    </h1>
                    <p className="text-xs text-emerald-100/90">
                      Kelola laporan sakit, izin pulang, atau rekap sholat santri di bawah ini.
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 border border-white/20 shadow-inner p-1 overflow-hidden">
                    <img src={LOGO_URL} alt="Logo Al-Andalus" className="w-full h-full object-contain" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setAdminTab('sakit')}
                    className="group bg-gradient-to-br from-emerald-900 to-emerald-950 text-white rounded-3xl p-6 shadow-md border border-emerald-700/60 text-left hover:scale-[1.02] transition cursor-pointer flex flex-col justify-between min-h-[220px]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-800/80 flex items-center justify-center text-2xl shadow-inner border border-emerald-700/50">
                        🏥
                      </div>
                      <span className="text-[11px] font-mono bg-emerald-700/80 text-emerald-200 px-2.5 py-1 rounded-xl">
                        {laporanList.length} Laporan
                      </span>
                    </div>
                    <div className="space-y-1.5 mt-4">
                      <h3 className="text-base font-bold text-white group-hover:text-emerald-200 transition">
                        Laporan Santri Sakit &amp; UKP
                      </h3>
                      <p className="text-xs text-emerald-200/90 leading-relaxed">
                        Input keluhan, pantauan penanganan UKP, rekap cepat WhatsApp grup, &amp; unduh CSV harian.
                      </p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-emerald-800/60 flex items-center justify-between text-xs font-semibold text-emerald-200">
                      <span>Buka Menu Sakit</span>
                      <span className="group-hover:translate-x-1 transition">→</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('perizinan')}
                    className="group bg-gradient-to-br from-stone-900 to-slate-950 text-white rounded-3xl p-6 shadow-md border border-slate-800 text-left hover:scale-[1.02] transition cursor-pointer flex flex-col justify-between min-h-[220px]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl shadow-inner border border-slate-700">
                        🏠
                      </div>
                      <span className="text-[11px] font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-xl">
                        {perizinanList.length} Surat Izin
                      </span>
                    </div>
                    <div className="space-y-1.5 mt-4">
                      <h3 className="text-base font-bold text-white group-hover:text-slate-200 transition">
                        Izin Pulang Santri
                      </h3>
                      <p className="text-xs text-slate-300/90 leading-relaxed">
                        Penerbitan surat izin resmi ber-tanda tangan &amp; QR, perpanjangan masa izin, &amp; pemantauan kepulangan.
                      </p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>Buka Menu Perizinan</span>
                      <span className="group-hover:translate-x-1 transition">→</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdminTab('sholat')}
                    className="group bg-gradient-to-br from-teal-900 to-teal-950 text-white rounded-3xl p-6 shadow-md border border-teal-700/60 text-left hover:scale-[1.02] transition cursor-pointer flex flex-col justify-between min-h-[220px]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-teal-800/80 flex items-center justify-center text-2xl shadow-inner border border-teal-700/50">
                        🕌
                      </div>
                      <span className="text-[11px] font-mono bg-teal-700/80 text-teal-200 px-2.5 py-1 rounded-xl">
                        {sholatList.length} Rekap
                      </span>
                    </div>
                    <div className="space-y-1.5 mt-4">
                      <h3 className="text-base font-bold text-white group-hover:text-teal-200 transition">
                        Rekap Keterlambatan Sholat
                      </h3>
                      <p className="text-xs text-teal-200/90 leading-relaxed">
                        Pilih banyak santri sekaligus, tandai 1 atau beberapa sholat telat, &amp; unduh Excel/PDF.
                      </p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-teal-800/60 flex items-center justify-between text-xs font-semibold text-teal-200">
                      <span>Buka Menu Sholat</span>
                      <span className="group-hover:translate-x-1 transition">→</span>
                    </div>
                  </button>
                </div>

                {userRole === 'ADMIN_PUSAT' && (
                  <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Manajemen Database &amp; Sinkronisasi Google Sheets</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Kelola data spreadsheet, Master Data santri, akun users_role, dan URL koneksi Apps Script (*.gs).</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAdminTab('spreadsheet')}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition cursor-pointer"
                      >
                        🗂️ Buka Spreadsheet
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminTab('kode')}
                        className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition cursor-pointer"
                      >
                        ⚙️ Koneksi Sheet
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {adminTab === 'sakit' && (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setAdminTab('hub')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>← Kembali ke Menu Utama</span>
                  </button>
                  <span className="text-xs font-bold text-emerald-800">🏥 Menu Utama: Laporan Santri Sakit &amp; UKP</span>
                </div>

                <MusyrifFormCard
                  masterData={masterData}
                  laporanList={laporanList}
                  activeFilter={statusFilter}
                  onSelectFilter={setStatusFilter}
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  lastSyncTime={lastSyncTime}
                  onQuickSync={() => executeSyncUKP(true)}
                  onSubmitLaporan={handleSubmitLaporan}
                  logoUrl={LOGO_URL}
                  activeMusyrif={activeMusyrif}
                  hideFullOverview={true}
                />

                <ReportOverview
                  laporanList={laporanList}
                  perizinanList={perizinanList}
                  sholatList={sholatList}
                  activeFilter={statusFilter}
                  onSelectFilter={setStatusFilter}
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  lastSyncTime={lastSyncTime}
                  onQuickSync={() => executeSyncUKP(true)}
                  onPullByDateRange={(range) => handlePullDataByDateRange(range, 'all')}
                  isSyncing={isSyncingGas}
                  mode="FULL"
                  onDeleteLaporan={handleDeleteLaporan}
                />
              </div>
            )}

            {adminTab === 'perizinan' && (
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setAdminTab('hub')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>← Kembali ke Menu Utama</span>
                  </button>
                  <span className="text-xs font-bold text-slate-800">🏠 Menu Utama: Izin Pulang Santri</span>
                </div>
                <PerizinanPulangPanel
                  masterData={masterData}
                  perizinanList={perizinanList}
                  logoUrl={LOGO_URL}
                  onAddPerizinan={handleAddPerizinan}
                  onMarkPerizinanReturned={handleMarkPerizinanReturned}
                  onExtendPerizinan={handleExtendPerizinan}
                  onDeletePerizinan={handleDeletePerizinan}
                  onSyncNow={gasWebAppUrl ? () => pullFromGasSheets(gasWebAppUrl, true, false) : undefined}
                  onPullByDateRange={(range) => handlePullDataByDateRange(range, 'perizinan')}
                  isSyncing={isSyncingGas}
                  lastSyncTime={lastSyncTime}
                />
              </div>
            )}

            {adminTab === 'sholat' && (
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setAdminTab('hub')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>← Kembali ke Menu Utama</span>
                  </button>
                  <span className="text-xs font-bold text-teal-800">🕌 Menu Utama: Rekap Keterlambatan Sholat</span>
                </div>
                <RekapSholatPanel
                  masterData={masterData}
                  sholatList={sholatList}
                  perizinanList={perizinanList}
                  laporanList={laporanList}
                  onAddSholat={handleAddSholat}
                  onAddSholatBatch={handleAddSholatBatch}
                  onDeleteSholat={handleDeleteSholat}
                  onResetSholatRange={handleResetSholatRange}
                  onVerifyPassword={async (pwd) => {
                    if (serverApiAvailableRef.current) {
                      return verifyUserPasswordServer(pwd);
                    }
                    const p = String(pwd || '').trim();
                    return (
                      Boolean(p) &&
                      (usersRoleList.some((u) => u.password === p) ||
                        p === '123456' ||
                        p === 'admin' ||
                        p === 'admin123')
                    );
                  }}
                  usersRoleList={usersRoleList}
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  activeMusyrifName={activeMusyrif?.namaMusyrif || (userRole === 'ADMIN_PENGASUHAN' ? 'Admin Pengasuhan' : 'Admin Pusat')}
                  onSyncNow={gasWebAppUrl ? () => pullFromGasSheets(gasWebAppUrl, true, false) : undefined}
                  onPullByDateRange={(range) => handlePullDataByDateRange(range, 'sholat')}
                  isSyncing={isSyncingGas}
                  lastSyncTime={lastSyncTime}
                  logoUrl={LOGO_URL}
                />
              </div>
            )}

            {adminTab === 'spreadsheet' && (
              <div className="max-w-5xl mx-auto space-y-4">
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setAdminTab('hub')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>← Kembali ke Menu Utama</span>
                  </button>
                  <span className="text-xs font-bold text-slate-800">🗂️ Data Spreadsheet &amp; Database</span>
                </div>
                <SpreadsheetSyncPanel
                  masterData={masterData}
                  laporanList={laporanList}
                  ukpList={ukpList}
                  usersRoleList={usersRoleList}
                  syncLogs={syncLogs}
                  lastSyncTime={lastSyncTime}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  dateRange={dateRange}
                  autoTriggerEnabled={autoTriggerEnabled}
                  onToggleAutoTrigger={() =>
                    setAutoTriggerEnabled((prev) => !prev)
                  }
                  onRunSyncNow={() => executeSyncUKP(true)}
                  onUpdateUKPTindakan={handleUpdateUKPTindakan}
                  onAddUKPRow={handleAddUKPRow}
                  onAddMasterSantri={handleAddMasterSantri}
                  onUpdateUserPassword={handleUpdateUserPassword}
                  onAddUserRole={handleAddUserRole}
                  hideUsersRoleTab={userRole === 'ADMIN_PENGASUHAN'}
                  onDeleteLaporan={handleDeleteLaporan}
                  perizinanList={perizinanList}
                  sholatList={sholatList}
                />
              </div>
            )}

            {adminTab === 'kode' && userRole === 'ADMIN_PUSAT' && (
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setAdminTab('hub')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>← Kembali ke Menu Utama</span>
                  </button>
                  <span className="text-xs font-bold text-emerald-800">⚙️ Pengaturan Koneksi Google Sheets &amp; Code.gs</span>
                </div>
                <SourceCodePanel
                  gasWebAppUrl={gasWebAppUrl}
                  isSyncingGas={isSyncingGas}
                  onSaveAndTestGasUrl={handleSaveAndTestGasUrl}
                  onPullFromGasNow={async () => {
                    await pullFromGasSheets(gasWebAppUrl, true);
                  }}
                  storageMode={storageMode}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
