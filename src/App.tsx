/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import { onAuthStateChanged, type User } from 'firebase/auth';
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
  ShieldCheck,
} from 'lucide-react';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  signInWithGooglePopup,
  signOutFirebase,
} from './firebase';
import {
  buildAllowedEmails,
  deleteLaporanFromFirestore,
  deletePerizinanFromFirestore,
  deleteSholatFromFirestore,
  deleteStaffAccessEmail,
  migrateSheetsSnapshotToFirestore,
  resetSholatRangeInFirestore,
  saveLaporanToFirestore,
  saveMasterSantriToFirestore,
  savePerizinanToFirestore,
  saveSholatBatchToFirestore,
  saveStaffAccessEmail,
  saveUserRoleToFirestore,
  subscribePortalCollections,
  syncAllowedEmailsAcrossAllCollections,
  type StaffAccessRow,
} from './utils/firestoreSync';
import {
  INITIAL_MASTER_DATA,
  INITIAL_LAPORAN_MUSYRIF,
  INITIAL_DATA_UKP,
  INITIAL_USERS_ROLE,
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
  getSavedGasUrl,
  saveGasUrl,
  fetchAllSheetsFromGas,
  postLaporanToGas,
  postActionToGas,
  deleteLaporanFromGas,
  getSavedPerizinanList,
  savePerizinanListLocally,
  postPerizinanToGas,
  updatePerizinanTibaInGas,
  extendPerizinanInGas,
  deletePerizinanFromGas,
  postSholatBatchToGas,
  deleteSholatFromGas,
  resetSholatRangeInGas,
  type GasAllDataResponse,
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

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState<boolean>(false);
  const [authErrorMsg, setAuthErrorMsg] = useState<string>('');
  const [firestoreReady, setFirestoreReady] = useState<boolean>(false);
  const [mirrorStatus, setMirrorStatus] = useState<
    'idle' | 'syncing' | 'synced' | 'queued'
  >('idle');
  const [staffAccessList, setStaffAccessList] = useState<StaffAccessRow[]>([]);
  const [staffAccessLoaded, setStaffAccessLoaded] = useState<boolean>(false);
  const [isSyncingAccess, setIsSyncingAccess] = useState<boolean>(false);
  const hasAutoMigratedRef = useRef<boolean>(false);

  const [gasWebAppUrl, setGasWebAppUrl] = useState<string>(() =>
    getSavedGasUrl()
  );
  const [isSyncingGas, setIsSyncingGas] = useState<boolean>(false);

  const [masterData, setMasterData] = useState<MasterSantri[]>([]);
  const [laporanList, setLaporanList] = useState<LaporanMusyrifRow[]>([]);
  const [ukpList, setUkpList] = useState<DataUKPRow[]>([]);
  const [usersRoleList, setUsersRoleList] = useState<UserRoleRow[]>([]);
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

  const isBootstrappedOrListedStaff = useMemo(() => {
    const em = (firebaseUser?.email || '').trim().toLowerCase();
    if (!em) return false;
    if (em === BOOTSTRAPPED_ADMIN_EMAIL) return true;
    return staffAccessList.some((s) => s.email.toLowerCase() === em);
  }, [firebaseUser?.email, staffAccessList]);

  const isAdminFirebaseUser = useMemo(() => {
    const em = (firebaseUser?.email || '').trim().toLowerCase();
    if (!em) return false;
    if (em === BOOTSTRAPPED_ADMIN_EMAIL) return true;
    return staffAccessList.some(
      (s) =>
        s.email.toLowerCase() === em &&
        (s.role === 'admin_pusat' || s.role === 'admin_pengasuhan')
    );
  }, [firebaseUser?.email, staffAccessList]);

  const allowedEmailsForDocs = useMemo(() => {
    const expandedStaff = staffAccessList.flatMap((s) => [
      s.email,
      ...(s.allowedEmails || []),
    ]);
    return buildAllowedEmails(firebaseUser?.email, expandedStaff);
  }, [firebaseUser?.email, staffAccessList]);

  // Pantau status login Firebase Google
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
      setAuthReady(true);
      if (!u) {
        setFirestoreReady(false);
        setStaffAccessLoaded(false);
        hasAutoMigratedRef.current = false;
      }
    });
    return () => unsub();
  }, []);

  // Langganan Real-Time ke Database Utama Firestore (cepat, <1 detik antar perangkat)
  useEffect(() => {
    const email = firebaseUser?.email;
    const uid = firebaseUser?.uid;
    if (!email || !uid) return;

    const unsub = subscribePortalCollections({
      userEmail: email,
      userUid: uid,
      onUpdate: (partial, ready) => {
        if (partial.masterData !== undefined) {
          setMasterData(partial.masterData);
        }
        if (partial.ukpList !== undefined) {
          setUkpList(partial.ukpList);
        }
        if (partial.laporanList !== undefined) {
          setLaporanList(partial.laporanList);
        }
        if (partial.usersRoleList !== undefined) {
          setUsersRoleList(partial.usersRoleList);
        }
        if (partial.perizinanList !== undefined) {
          setPerizinanList(partial.perizinanList);
          savePerizinanListLocally(partial.perizinanList);
        }
        if (partial.sholatList !== undefined) {
          setSholatList(partial.sholatList);
          saveSholatListLocally(partial.sholatList);
        }
        if (partial.staffAccessList !== undefined) {
          setStaffAccessList(partial.staffAccessList);
          setStaffAccessLoaded(true);
        }
        if (ready) {
          setFirestoreReady(true);
          setLastSyncTime(formatTimestampID(new Date()));
        }
      },
    });

    return () => unsub();
  }, [firebaseUser?.email, firebaseUser?.uid]);

  // Fungsi menarik data dari Google Sheets lalu mengimpor ke Firestore (Mirror / Impor Manual)
  const pullFromGasSheets = useCallback(
    async (
      targetUrl: string,
      showSuccessAlert: boolean = false,
      isSilent: boolean = false
    ): Promise<GasAllDataResponse | null> => {
      if (!targetUrl.trim()) return null;
      if (isSilent && isPullingRef.current) return null;
      isPullingRef.current = true;
      if (!isSilent) {
        setIsSyncingGas(true);
      }
      try {
        const res = await fetchAllSheetsFromGas(targetUrl);
        if (Array.isArray(res.masterData)) {
          setMasterData(res.masterData);
        }
        if (Array.isArray(res.ukpList)) {
          setUkpList(res.ukpList);
        }
        if (Array.isArray(res.laporanList)) {
          const synced = runSyncStatusUKP(
            res.laporanList,
            res.ukpList || []
          );
          setLaporanList(synced.updatedLaporan);
          res.laporanList = synced.updatedLaporan;
        }
        if (Array.isArray(res.usersRoleList) && res.usersRoleList.length > 0) {
          setUsersRoleList(res.usersRoleList);
        }
        if (Array.isArray(res.perizinanList)) {
          setPerizinanList(res.perizinanList);
          savePerizinanListLocally(res.perizinanList);
        }
        const hasSholatList = Array.isArray(res.sholatList);
        if (hasSholatList && res.sholatList) {
          setSholatList(res.sholatList);
          saveSholatListLocally(res.sholatList);
        }

        // Impor otomatis ke Database Utama Firestore agar tersinkron di semua Admin
        let migratedCount = 0;
        if (firebaseUser?.uid && firebaseUser?.email) {
          const migRes = await migrateSheetsSnapshotToFirestore({
            masterData: res.masterData,
            usersRoleList: res.usersRoleList,
            laporanList: res.laporanList,
            ukpList: res.ukpList,
            perizinanList: res.perizinanList,
            sholatList: res.sholatList,
            uid: firebaseUser.uid,
            userEmail: firebaseUser.email,
            allowedEmails: allowedEmailsForDocs,
            isAdminUser: isAdminFirebaseUser,
          });
          migratedCount = migRes.totalMigrated;
        }

        setLastSyncTime(res.lastSyncTime || formatTimestampID(new Date()));

        if (showSuccessAlert) {
          await Swal.fire({
            icon: hasSholatList ? 'success' : 'warning',
            title: hasSholatList
              ? 'Data Spreadsheet & Cloud Tersinkronisasi!'
              : 'Sebagian Data Tersinkronisasi (Perbarui Code.gs)',
            html: `<div class="text-xs text-slate-600 space-y-1.5">
              <p>Data terbaru berhasil ditarik dari Google Sheets &amp; disimpan ke Database Cloud (<b>${migratedCount}</b> item):</p>
              <p><b>Laporan Sakit:</b> ${res.laporanList?.length ?? 0} · <b>Perizinan:</b> ${res.perizinanList?.length ?? 0} · <b>Rekap Sholat:</b> ${hasSholatList ? (res.sholatList?.length ?? 0) : 'Belum terbaca'}</p>
              ${
                !hasSholatList
                  ? '<p class="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">⚠️ <b>Code.gs</b> yang ter-deploy belum mengirim <code>sholatList</code>. Salin ulang <b>Code.gs</b> terbaru dari menu <b>Koneksi Sheet</b> lalu klik <b>Deploy → Manage deployments → Edit → Version: New version → Deploy</b>.</p>'
                  : ''
              }
            </div>`,
            confirmButtonColor: '#0B4627',
          });
        }
        return res;
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
        if (!isSilent) {
          setIsSyncingGas(false);
        }
      }
    },
    [
      firebaseUser?.uid,
      firebaseUser?.email,
      allowedEmailsForDocs,
      isAdminFirebaseUser,
    ]
  );

  // Tarik data terbaru dari Google Sheets lalu tampilkan ringkasan sesuai rentang tanggal yang dipilih
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

      if (!gasWebAppUrl) {
        const count =
          moduleType === 'sholat'
            ? filterSholatByDateRange(sholatList, range).length
            : moduleType === 'perizinan'
            ? filterPerizinanByDateAndName(perizinanList, range, '').length
            : filterLaporanByDateRange(laporanList, range).length;
        await Swal.fire({
          icon: 'info',
          title: 'Data Lokal Ditampilkan',
          text: `Ditemukan ${count} data pada rentang ${periodeLabel} (Spreadsheet belum terhubung).`,
          confirmButtonColor: '#075e54',
        });
        return;
      }

      const res = await pullFromGasSheets(gasWebAppUrl, false, false);
      if (!res) {
        await Swal.fire({
          icon: 'error',
          title: 'Gagal Menarik Data',
          text: 'Koneksi ke Google Sheets gagal. Pastikan URL Web App aktif dan akses diset ke Anyone.',
          confirmButtonColor: '#075e54',
        });
        return;
      }

      const latestSholat = res.sholatList || [];
      const latestLaporan = res.laporanList || [];
      const latestPerizinan = res.perizinanList || [];

      const matchedSholat = filterSholatByDateRange(latestSholat, range);
      const matchedLaporan = filterLaporanByDateRange(latestLaporan, range);
      const matchedPerizinan = filterPerizinanByDateAndName(
        latestPerizinan,
        range,
        ''
      );

      let detailHtml = '';
      if (moduleType === 'sholat') {
        const hasSholatList = Array.isArray(res.sholatList);
        detailHtml = `
          <p>Rentang Tanggal: <b>${periodeLabel}</b></p>
          <p>Data Rekap Sholat ditemukan: <b>${matchedSholat.length} catatan</b> (dari total ${latestSholat.length} di Spreadsheet).</p>
          ${
            !hasSholatList
              ? '<p class="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1">⚠️ <b>Code.gs</b> belum mengirim <code>sholatList</code>. Perbarui Code.gs &amp; Deploy New version.</p>'
              : ''
          }
        `;
      } else if (moduleType === 'perizinan') {
        detailHtml = `
          <p>Rentang Tanggal: <b>${periodeLabel}</b></p>
          <p>Data Perizinan ditemukan: <b>${matchedPerizinan.length} surat</b> (dari total ${latestPerizinan.length} di Spreadsheet).</p>
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

  // Migrasi awal 1 kali otomatis bila Firestore masih kosong namun URL Spreadsheet sudah tersambung
  useEffect(() => {
    if (!firestoreReady || !firebaseUser?.uid || hasAutoMigratedRef.current) {
      return;
    }
    const isFirestoreEmpty =
      masterData.length === 0 &&
      sholatList.length === 0 &&
      laporanList.length === 0 &&
      perizinanList.length === 0;

    if (isFirestoreEmpty) {
      hasAutoMigratedRef.current = true;
      if (gasWebAppUrl) {
        void pullFromGasSheets(gasWebAppUrl, false, false);
      } else if (isAdminFirebaseUser) {
        setMasterData(INITIAL_MASTER_DATA);
        setLaporanList(INITIAL_LAPORAN_MUSYRIF);
        setUkpList(INITIAL_DATA_UKP);
        setUsersRoleList(INITIAL_USERS_ROLE);
      }
    } else {
      hasAutoMigratedRef.current = true;
    }
  }, [
    firestoreReady,
    firebaseUser?.uid,
    masterData.length,
    sholatList.length,
    laporanList.length,
    perizinanList.length,
    gasWebAppUrl,
    pullFromGasSheets,
    isAdminFirebaseUser,
  ]);

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

    let rowsForMirror = optimisticRows;
    if (firebaseUser?.uid) {
      rowsForMirror = await saveSholatBatchToFirestore({
        inputs,
        existingSholatList: sholatList,
        uid: firebaseUser.uid,
        allowedEmails: allowedEmailsForDocs,
      });
      setLastSyncTime(formatTimestampID(new Date()));
    }

    if (!gasWebAppUrl) {
      return {
        savedCount: inputs.length,
        syncedToSheet: false,
        errorMessage: 'URL Spreadsheet belum terpasang (tersimpan di Database Cloud).',
      };
    }

    // Mirror ke Google Sheets di latar belakang tanpa memblokir layar
    setMirrorStatus('syncing');
    void postSholatBatchToGas(
      gasWebAppUrl,
      rowsForMirror.map((row, idx) => ({
        ...row,
        unlockedPrayers: inputs[idx]?.unlockedPrayers,
      }))
    )
      .then((res) => {
        if (res.status === 'error') {
          setMirrorStatus('queued');
        } else {
          setMirrorStatus('synced');
        }
      })
      .catch(() => {
        setMirrorStatus('queued');
      });

    return { savedCount: inputs.length, syncedToSheet: true };
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

    if (firebaseUser?.uid) {
      await deleteSholatFromFirestore(idSholat);
      setLastSyncTime(formatTimestampID(new Date()));
    }

    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      void deleteSholatFromGas(gasWebAppUrl, idSholat)
        .then(() => setMirrorStatus('synced'))
        .catch(() => setMirrorStatus('queued'));
    }
  };

  const handleResetSholatRange = async (
    start: string,
    end: string,
    keterangan: string
  ) => {
    const bounds = normalizeDateRangeBounds({ startDate: start, endDate: end });
    const matchingRows = sholatList.filter((r) => {
      if (isSholatRowPutih(r)) return false;
      const tgl = getEffectiveSholatDate(r);
      if (!tgl) return false;
      if (bounds.start && tgl < bounds.start) return false;
      if (bounds.end && tgl > bounds.end) return false;
      return true;
    });

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

    if (firebaseUser?.uid && matchingRows.length > 0) {
      await resetSholatRangeInFirestore(
        matchingRows,
        keterangan || 'DIPUTIHKAN'
      );
      setLastSyncTime(formatTimestampID(new Date()));
    }

    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      void resetSholatRangeInGas(
        gasWebAppUrl,
        bounds.start,
        bounds.end,
        keterangan
      )
        .then(() => setMirrorStatus('synced'))
        .catch(() => setMirrorStatus('queued'));
    }
  };

  const handleSaveAndTestGasUrl = async (newUrl: string) => {
    saveGasUrl(newUrl);
    setGasWebAppUrl(newUrl);
    if (!newUrl) {
      await Swal.fire({
        icon: 'info',
        title: 'Mirror Google Sheets Diputuskan',
        text: 'Aplikasi tetap berjalan cepat menggunakan Database Cloud Firebase Firestore.',
        confirmButtonColor: '#0B4627',
      });
      return;
    }
    await pullFromGasSheets(newUrl, true);
  };

  // Handler Submit Laporan Musyrif (Simpan cepat ke Firestore, mirror latar belakang ke Sheet)
  const handleSubmitLaporan = async (
    input: LaporanInput
  ): Promise<{ idLaporan: string }> => {
    const nextSeq = laporanList.length + 1;
    const newRow = createLaporanRow(input, nextSeq, new Date());

    setLaporanList((prev) => [newRow, ...prev]);

    if (firebaseUser?.uid) {
      await saveLaporanToFirestore({
        row: newRow,
        uid: firebaseUser.uid,
        allowedEmails: allowedEmailsForDocs,
      });
      setLastSyncTime(formatTimestampID(new Date()));
    }

    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      void postLaporanToGas(gasWebAppUrl, input)
        .then((res) => {
          setMirrorStatus(res.status === 'error' ? 'queued' : 'synced');
        })
        .catch(() => {
          setMirrorStatus('queued');
        });
    }

    return { idLaporan: newRow.idLaporan };
  };

  // Handler Eksekusi syncStatusUKP() (Bottom-Up Search di Data_UKP)
  const executeSyncUKP = useCallback(
    async (showToast: boolean = true) => {
      if (gasWebAppUrl) {
        try {
          setIsSyncingGas(true);
          await postActionToGas(gasWebAppUrl, { action: 'syncStatusUKP' });
          await pullFromGasSheets(gasWebAppUrl, false);
        } catch {
          // Lanjutkan sinkronisasi lokal
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

  // Simulasi Time-Driven Trigger otomatis setiap 8 detik jika diaktifkan
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
    if (firebaseUser?.uid) {
      void saveMasterSantriToFirestore({
        santri: newSantri,
        uid: firebaseUser.uid,
        allowedEmails: allowedEmailsForDocs,
      });
    }
    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      postActionToGas(gasWebAppUrl, {
        action: 'addMasterSantri',
        ...newSantri,
      })
        .then(() => setMirrorStatus('synced'))
        .catch(() => setMirrorStatus('queued'));
    }
  };

  const handleUpdateUserPassword = (namaUser: string, newPassword: string) => {
    const existingUser = usersRoleList.find((u) => u.namaUser === namaUser);
    setUsersRoleList((prev) =>
      prev.map((u) =>
        u.namaUser === namaUser ? { ...u, password: newPassword } : u
      )
    );
    if (firebaseUser?.uid && existingUser) {
      void saveUserRoleToFirestore({
        user: { ...existingUser, password: newPassword },
        uid: firebaseUser.uid,
        allowedEmails: allowedEmailsForDocs,
      });
    }
    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      postActionToGas(gasWebAppUrl, {
        action: 'updateUserPassword',
        namaUser,
        newPassword,
      })
        .then(() => setMirrorStatus('synced'))
        .catch(() => setMirrorStatus('queued'));
    }
  };

  const handleAddUserRole = (newUser: UserRoleRow) => {
    setUsersRoleList((prev) => [...prev, newUser]);
    if (firebaseUser?.uid) {
      void saveUserRoleToFirestore({
        user: newUser,
        uid: firebaseUser.uid,
        allowedEmails: allowedEmailsForDocs,
      });
    }
    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      postActionToGas(gasWebAppUrl, {
        action: 'addUserRole',
        ...newUser,
      })
        .then(() => setMirrorStatus('synced'))
        .catch(() => setMirrorStatus('queued'));
    }
  };

  // Handler Hapus Inputan Laporan (di Mode Admin Pengasuhan & Admin Pusat)
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

    if (firebaseUser?.uid) {
      await deleteLaporanFromFirestore(row.idLaporan);
    }

    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      void deleteLaporanFromGas(gasWebAppUrl, row)
        .then(() => setMirrorStatus('synced'))
        .catch(() => setMirrorStatus('queued'));
    }

    await Swal.fire({
      icon: 'success',
      title: 'Inputan Berhasil Dihapus',
      text: `Laporan ${row.namaSantri} (${row.tanggalLaporan}) telah dihapus dari daftar.`,
      timer: 1800,
      showConfirmButton: false,
    });
  };

  // Handler Perizinan Pulang (Khusus Mode Admin Pengasuhan & Admin Pusat/SDM)
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

    if (firebaseUser?.uid) {
      await savePerizinanToFirestore({
        row: newRow,
        uid: firebaseUser.uid,
        allowedEmails: allowedEmailsForDocs,
      });
      setLastSyncTime(formatTimestampID(new Date()));
    }

    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      void postPerizinanToGas(gasWebAppUrl, newRow)
        .then((res) => {
          setMirrorStatus(res.status === 'error' ? 'queued' : 'synced');
        })
        .catch(() => setMirrorStatus('queued'));
    }

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

    if (firebaseUser?.uid) {
      void savePerizinanToFirestore({
        row: updatedRow,
        uid: firebaseUser.uid,
        allowedEmails: allowedEmailsForDocs,
      });
    }

    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      updatePerizinanTibaInGas(
        gasWebAppUrl,
        targetRow,
        tibaTanggal,
        keteranganTiba
      )
        .then(() => setMirrorStatus('synced'))
        .catch(() => setMirrorStatus('queued'));
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

    if (firebaseUser?.uid) {
      void savePerizinanToFirestore({
        row: extendedRow,
        uid: firebaseUser.uid,
        allowedEmails: allowedEmailsForDocs,
      });
    }

    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      extendPerizinanInGas(gasWebAppUrl, extendedRow)
        .then(() => setMirrorStatus('synced'))
        .catch(() => setMirrorStatus('queued'));
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

    if (firebaseUser?.uid) {
      await deletePerizinanFromFirestore(
        targetRow.idPerizinan || `IZN_${targetRow.no}_${targetRow.dariTanggal}`
      );
    }

    if (gasWebAppUrl) {
      setMirrorStatus('syncing');
      deletePerizinanFromGas(gasWebAppUrl, targetRow)
        .then(() => setMirrorStatus('synced'))
        .catch(() => setMirrorStatus('queued'));
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoggingInGoogle(true);
    setAuthErrorMsg('');
    try {
      await signInWithGooglePopup();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('unauthorized-domain')) {
        setAuthErrorMsg(
          'Domain belum terdaftar di Firebase Authentication (Authorized domains). Tambahkan domain Vercel ini di Firebase Console → Authentication → Settings → Authorized domains.'
        );
      } else if (!msg.includes('popup-closed-by-user')) {
        setAuthErrorMsg(`Gagal masuk Google: ${msg}`);
      }
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleAddStaffEmail = async (
    email: string,
    nama: string,
    role: 'admin_pusat' | 'admin_pengasuhan' | 'user'
  ) => {
    if (!firebaseUser?.uid) return;
    const nextAllowed = buildAllowedEmails(firebaseUser.email, [
      ...allowedEmailsForDocs,
      email,
    ]);
    setIsSyncingAccess(true);
    try {
      await saveStaffAccessEmail({
        email,
        nama,
        role,
        uid: firebaseUser.uid,
        allowedEmails: nextAllowed,
      });
      const { updatedCount } = await syncAllowedEmailsAcrossAllCollections({
        allowedEmails: nextAllowed,
        userEmail: firebaseUser.email || BOOTSTRAPPED_ADMIN_EMAIL,
      });
      await Swal.fire({
        icon: 'success',
        title: 'Akses Gmail Tim Ditambahkan!',
        html: `<div class="text-xs text-slate-600 space-y-1">
          <p><b>${email}</b> kini resmi diizinkan login.</p>
          <p>Hak akses <b>${updatedCount}</b> data Cloud lama &amp; baru langsung disinkronkan otomatis agar bisa dibaca dari email tersebut.</p>
        </div>`,
        confirmButtonColor: '#075e54',
      });
    } finally {
      setIsSyncingAccess(false);
    }
  };

  const handleRemoveStaffEmail = async (email: string) => {
    if (!firebaseUser?.uid) return;
    const lowerTarget = email.trim().toLowerCase();
    const nextAllowed = buildAllowedEmails(
      firebaseUser.email,
      allowedEmailsForDocs.filter((e) => e.toLowerCase() !== lowerTarget)
    );
    setIsSyncingAccess(true);
    try {
      await deleteStaffAccessEmail(email);
      await syncAllowedEmailsAcrossAllCollections({
        allowedEmails: nextAllowed,
        userEmail: firebaseUser.email || BOOTSTRAPPED_ADMIN_EMAIL,
      });
    } finally {
      setIsSyncingAccess(false);
    }
  };

  const handleSyncStaffAccessNow = async () => {
    if (!firebaseUser?.email) return;
    setIsSyncingAccess(true);
    try {
      const { updatedCount } = await syncAllowedEmailsAcrossAllCollections({
        allowedEmails: allowedEmailsForDocs,
        userEmail: firebaseUser.email,
      });
      await Swal.fire({
        icon: 'success',
        title: 'Akses Data Cloud Diselaraskan!',
        text: `${updatedCount} dokumen lama diperbarui hak aksesnya untuk seluruh email tim terdaftar (${allowedEmailsForDocs.length} akun).`,
        confirmButtonColor: '#075e54',
      });
    } finally {
      setIsSyncingAccess(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F2] p-6">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center max-w-sm w-full space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Cloud className="w-7 h-7 text-[#075e54] animate-pulse" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            Menghubungkan Database Cloud...
          </p>
          <p className="text-xs text-slate-500">
            Memeriksa sesi akun Google Pesantren Al-Andalus
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F2] p-4 sm:p-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-lg border border-emerald-200/80 max-w-md w-full space-y-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-stone-50 border border-slate-200 p-2 flex items-center justify-center">
            <img
              src={LOGO_URL}
              alt="Logo Pesantren Islam Internasional Al-Andalus"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-bold border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Database Cloud Real-Time &amp; Mirror Spreadsheet</span>
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 pt-1">
              Portal Bidang Pengasuhan Al-Andalus
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Masuk dengan akun Google resmi Pesantren agar seluruh catatan sakit, perizinan, dan rekap sholat tersinkronisasi <strong>real-time</strong> dalam hitungan milidetik sekaligus tetap tersalin ke Google Spreadsheet.
            </p>
          </div>

          {authErrorMsg && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-left text-xs text-rose-800">
              {authErrorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoggingInGoogle}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#075e54] hover:bg-[#054c42] text-white text-sm font-bold shadow-sm transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
          >
            <Cloud className="w-5 h-5" />
            <span>
              {isLoggingInGoogle
                ? 'Membuka Login Google...'
                : 'Masuk dengan Akun Google'}
            </span>
          </button>

          <p className="text-[11px] text-slate-500">
            Gunakan akun <code className="font-mono text-slate-700">{BOOTSTRAPPED_ADMIN_EMAIL}</code> atau Gmail tim yang telah didaftarkan Admin Pusat.
          </p>
        </div>
      </div>
    );
  }

  const isUnauthorizedEmailWaiting =
    firestoreReady &&
    staffAccessLoaded &&
    !isBootstrappedOrListedStaff &&
    masterData.length === 0 &&
    sholatList.length === 0 &&
    laporanList.length === 0 &&
    perizinanList.length === 0 &&
    usersRoleList.length === 0;

  if (isUnauthorizedEmailWaiting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F2] p-4 sm:p-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-lg border border-amber-200 max-w-md w-full space-y-5 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 p-2 flex items-center justify-center">
            <img
              src={LOGO_URL}
              alt="Logo Pesantren Islam Internasional Al-Andalus"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-bold">
              Menunggu Pendaftaran Email Tim
            </span>
            <h1 className="text-base font-extrabold text-slate-900 pt-1">
              Email Belum Terdaftar di Portal Cloud
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Anda masuk menggunakan akun <strong className="text-slate-900">{firebaseUser.email}</strong>. Akun ini belum ditambahkan ke daftar tim oleh Admin Pusat (<code className="font-mono">{BOOTSTRAPPED_ADMIN_EMAIL}</code>).
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-left text-[11px] text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">Cara Mengaktifkan Akun Ini:</p>
            <p>1. Minta Admin Pusat membuka menu <strong>⚙️ Koneksi Sheet &amp; Code.gs</strong>.</p>
            <p>2. Tambahkan email <code className="font-mono text-slate-900">{firebaseUser.email}</code> pada kolom <strong>Daftar Email Google Tim</strong>.</p>
            <p>3. Setelah ditambahkan, klik tombol <strong>Cek Ulang Akses</strong> di bawah.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#075e54] hover:bg-[#054c42] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Cek Ulang Akses</span>
            </button>
            <button
              type="button"
              onClick={() => signOutFirebase()}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Ganti Akun Google</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F2] text-slate-900">
      {/* Main Content Area Berdasarkan 3 Role */}
      <main
        id="top"
        className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"
      >
        {userRole === 'MUSYRIF' ? (
          /* ROLE 3: MUSYRIF (Login Ketik Nama Rekomendasi + Password -> Masuk Otomatis Sesuai Role di users_role) */
          <MusyrifRolePortal
            activeMusyrif={activeMusyrif}
            onSelectMusyrif={setActiveMusyrif}
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
            logoUrl={LOGO_URL}
          />
        ) : (
          /* ROLE 1 & 2: ADMIN PENGASUHAN & ADMIN PUSAT / SDM DENGAN BAR MENU NAVIGASI */
          <div
            className="space-y-6"
            data-testid={
              userRole === 'ADMIN_PENGASUHAN'
                ? 'admin-pengasuhan-portal'
                : 'admin-full-portal'
            }
          >
            {/* Left Sidebar Drawer (Di samping kiri dengan titik/garis tiga) */}
            {isSidebarOpen && (
              <div className="fixed inset-0 z-50 flex print:hidden">
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
                  onClick={() => setIsSidebarOpen(false)}
                />
                
                {/* Sidebar Content */}
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

            {/* WhatsApp Contact Header Style (Sederhana & Rapi ala Kontak WA) */}
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
                    ☁️ Cloud Real-Time ({firebaseUser.email})
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
                    title={`Tarik data dari Spreadsheet & simpan ke Cloud (${lastSyncTime || '-'})`}
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
                  onClick={() => {
                    setActiveMusyrif(null);
                    setAdminTab('hub');
                    setUserRole('MUSYRIF');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-white" />
                  <span>Ganti Peran</span>
                </button>

                <button
                  type="button"
                  onClick={() => signOutFirebase()}
                  title={`Keluar akun Google (${firebaseUser.email})`}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-900/50 hover:bg-rose-800/80 text-white text-[11px] font-semibold transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ISI HALAMAN SESUAI MENU TAB YANG DIPILIH */}
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
                        Pencatatan 1-tap sholat 5 waktu (Subuh, Dzuhur, Ashar, Maghrib, Isya) &amp; leaderboard keterlambatan santri.
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
                      <p className="text-[11px] text-slate-500 mt-0.5">Kelola data spreadsheet, Master Data santri, dan URL koneksi Apps Script (*.gs).</p>
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
                  firebaseUserEmail={firebaseUser.email}
                  staffAccessList={staffAccessList}
                  isSyncingAccess={isSyncingAccess}
                  onSyncStaffAccessNow={handleSyncStaffAccessNow}
                  onAddStaffEmail={handleAddStaffEmail}
                  onRemoveStaffEmail={handleRemoveStaffEmail}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

