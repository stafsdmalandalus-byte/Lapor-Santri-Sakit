/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import { UserCheck, Menu, X, BarChart3, MessageSquare, FileText, Home, Database, Settings, RefreshCw } from 'lucide-react';
import {
  INITIAL_MASTER_DATA,
  INITIAL_LAPORAN_MUSYRIF,
  INITIAL_DATA_UKP,
  INITIAL_USERS_ROLE,
  createLaporanRow,
  runSyncStatusUKP,
  formatTimestampID,
  getLaporanRowKey,
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
  type SholatRow,
  type SholatInput,
} from './utils/sholatEngine';
import {
  createPerizinanRow,
  getPerizinanRowKey,
  applyPerpanjanganMasaIzin,
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
  postSholatToGas,
  deleteSholatFromGas,
  resetSholatRangeInGas,
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

  const [gasWebAppUrl, setGasWebAppUrl] = useState<string>(() =>
    getSavedGasUrl()
  );
  const [isSyncingGas, setIsSyncingGas] = useState<boolean>(() =>
    Boolean(getSavedGasUrl())
  );

  const [masterData, setMasterData] = useState<MasterSantri[]>(() =>
    getSavedGasUrl() ? [] : INITIAL_MASTER_DATA
  );
  const [laporanList, setLaporanList] = useState<LaporanMusyrifRow[]>(() =>
    getSavedGasUrl() ? [] : INITIAL_LAPORAN_MUSYRIF
  );
  const [ukpList, setUkpList] = useState<DataUKPRow[]>(() =>
    getSavedGasUrl() ? [] : INITIAL_DATA_UKP
  );
  const [usersRoleList, setUsersRoleList] = useState<UserRoleRow[]>(() =>
    getSavedGasUrl() ? [] : INITIAL_USERS_ROLE
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

  // Fungsi menarik seluruh data sheet (Master_Data, Laporan_Musyrif, Data_UKP, users_role, Perizinan, Rekap_Sholat) dari Google Sheets
  const pullFromGasSheets = useCallback(
    async (
      targetUrl: string,
      showSuccessAlert: boolean = false,
      isSilent: boolean = false
    ) => {
      if (!targetUrl.trim()) return;
      if (isSilent && isPullingRef.current) return;
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
        }
        if (Array.isArray(res.usersRoleList) && res.usersRoleList.length > 0) {
          setUsersRoleList(res.usersRoleList);
        }
        if (Array.isArray(res.perizinanList)) {
          setPerizinanList(res.perizinanList);
          savePerizinanListLocally(res.perizinanList);
        }
        if (Array.isArray(res.sholatList)) {
          setSholatList(res.sholatList);
          saveSholatListLocally(res.sholatList);
        }
        setLastSyncTime(res.lastSyncTime || formatTimestampID(new Date()));

        if (showSuccessAlert) {
          await Swal.fire({
            icon: 'success',
            title: 'Data Tersinkronisasi dengan Google Sheets!',
            html: `<div class="text-xs text-slate-600 space-y-1">
              <p>Seluruh data terbaru dari semua Admin &amp; Musyrif telah ditarik:</p>
              <p><b>Laporan Sakit:</b> ${res.laporanList?.length ?? 0} · <b>Perizinan:</b> ${res.perizinanList?.length ?? 0} · <b>Rekap Sholat:</b> ${res.sholatList?.length ?? 0}</p>
            </div>`,
            confirmButtonColor: '#0B4627',
          });
        }
      } catch (err) {
        // Fallback hanya jika benar-benar gagal koneksi dan state masih kosong
        setMasterData((prev) => (prev.length === 0 ? INITIAL_MASTER_DATA : prev));
        setLaporanList((prev) =>
          prev.length === 0 ? INITIAL_LAPORAN_MUSYRIF : prev
        );
        setUkpList((prev) => (prev.length === 0 ? INITIAL_DATA_UKP : prev));
        setUsersRoleList((prev) =>
          prev.length === 0 ? INITIAL_USERS_ROLE : prev
        );
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
      } finally {
        isPullingRef.current = false;
        if (!isSilent) {
          setIsSyncingGas(false);
        }
      }
    },
    []
  );

  // Tarik otomatis saat pertama kali aplikasi dibuka bila URL Google Apps Script sudah tersimpan
  useEffect(() => {
    if (gasWebAppUrl) {
      pullFromGasSheets(gasWebAppUrl, false, false);
    }
  }, [gasWebAppUrl, pullFromGasSheets]);

  // Sinkronisasi otomatis antar perangkat Admin (polling 15 detik + saat pindah tab / kembali ke jendela browser)
  useEffect(() => {
    if (!gasWebAppUrl) return;

    const intervalId = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        pullFromGasSheets(gasWebAppUrl, false, true);
      }
    }, 15000);

    const handleWindowFocusOrVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        pullFromGasSheets(gasWebAppUrl, false, true);
      }
    };

    window.addEventListener('focus', handleWindowFocusOrVisible);
    document.addEventListener('visibilitychange', handleWindowFocusOrVisible);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocusOrVisible);
      document.removeEventListener('visibilitychange', handleWindowFocusOrVisible);
    };
  }, [gasWebAppUrl, pullFromGasSheets]);

  // Tarik data terbaru secara diam-diam setiap kali Admin berpindah menu agar inputan admin lain langsung terlihat
  useEffect(() => {
    if (gasWebAppUrl && userRole !== 'MUSYRIF') {
      pullFromGasSheets(gasWebAppUrl, false, true);
    }
  }, [adminTab, userRole, gasWebAppUrl, pullFromGasSheets]);

  const handleAddSholat = async (input: SholatInput) => {
    const newRow = createSholatRow(input);
    setSholatList((prev) => {
      const updated = upsertSholatRowInList(prev, newRow);
      saveSholatListLocally(updated);
      return updated;
    });
    if (gasWebAppUrl) {
      try {
        const res = await postSholatToGas(gasWebAppUrl, {
          ...newRow,
          unlockedPrayers: input.unlockedPrayers,
        });
        if (Array.isArray(res.sholatList)) {
          setSholatList(res.sholatList);
          saveSholatListLocally(res.sholatList);
          setLastSyncTime(formatTimestampID(new Date()));
        } else {
          await pullFromGasSheets(gasWebAppUrl, false, true);
        }
      } catch {
        // Tetap tersimpan lokal bila jaringan bermasalah
      }
    }
  };

  const handleDeleteSholat = async (idSholat: string) => {
    setSholatList((prev) => {
      const updated = prev.filter((r) => r.idSholat !== idSholat);
      saveSholatListLocally(updated);
      return updated;
    });
    if (gasWebAppUrl) {
      try {
        const res = await deleteSholatFromGas(gasWebAppUrl, idSholat);
        if (Array.isArray(res.sholatList)) {
          setSholatList(res.sholatList);
          saveSholatListLocally(res.sholatList);
          setLastSyncTime(formatTimestampID(new Date()));
        } else {
          await pullFromGasSheets(gasWebAppUrl, false, true);
        }
      } catch {
        // ignore
      }
    }
  };

  const handleResetSholatRange = async (
    start: string,
    end: string,
    keterangan: string
  ) => {
    setSholatList((prev) => {
      const updated = prev.map((r) => {
        const tgl = r.tanggal || '';
        if (!tgl) return r;
        if (start && tgl < start) return r;
        if (end && tgl > end) return r;
        return {
          ...r,
          keterangan: keterangan || 'DIPUTIHKAN',
        };
      });
      saveSholatListLocally(updated);
      return updated;
    });
    if (gasWebAppUrl) {
      try {
        const res = await resetSholatRangeInGas(
          gasWebAppUrl,
          start,
          end,
          keterangan
        );
        if (Array.isArray(res.sholatList)) {
          setSholatList(res.sholatList);
          saveSholatListLocally(res.sholatList);
          setLastSyncTime(formatTimestampID(new Date()));
        } else {
          await pullFromGasSheets(gasWebAppUrl, false, true);
        }
      } catch {
        // ignore
      }
    }
  };

  const handleSaveAndTestGasUrl = async (newUrl: string) => {
    saveGasUrl(newUrl);
    setGasWebAppUrl(newUrl);
    if (!newUrl) {
      await Swal.fire({
        icon: 'info',
        title: 'Koneksi Google Sheets Diputuskan',
        text: 'Aplikasi kembali menggunakan data lokal.',
        confirmButtonColor: '#0B4627',
      });
      return;
    }
    await pullFromGasSheets(newUrl, true);
  };

  // Handler Submit Laporan Musyrif (Simpan ke Sheet Laporan_Musyrif bila terhubung)
  const handleSubmitLaporan = async (
    input: LaporanInput
  ): Promise<{ idLaporan: string }> => {
    if (gasWebAppUrl) {
      try {
        const res = await postLaporanToGas(gasWebAppUrl, input);
        await pullFromGasSheets(gasWebAppUrl, false);
        if (res.idLaporan) {
          return { idLaporan: res.idLaporan };
        }
      } catch {
        // Fallback ke state lokal bila jaringan gagal
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 650));
    }

    const nextSeq = laporanList.length + 1;
    const newRow = createLaporanRow(input, nextSeq, new Date());

    setLaporanList((prev) => [newRow, ...prev]);
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
    if (gasWebAppUrl) {
      postActionToGas(gasWebAppUrl, {
        action: 'addMasterSantri',
        ...newSantri,
      }).catch(() => {});
    }
  };

  const handleUpdateUserPassword = (namaUser: string, newPassword: string) => {
    setUsersRoleList((prev) =>
      prev.map((u) =>
        u.namaUser === namaUser ? { ...u, password: newPassword } : u
      )
    );
    if (gasWebAppUrl) {
      postActionToGas(gasWebAppUrl, {
        action: 'updateUserPassword',
        namaUser,
        newPassword,
      }).catch(() => {});
    }
  };

  const handleAddUserRole = (newUser: UserRoleRow) => {
    setUsersRoleList((prev) => [...prev, newUser]);
    if (gasWebAppUrl) {
      postActionToGas(gasWebAppUrl, {
        action: 'addUserRole',
        ...newUser,
      }).catch(() => {});
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

    await deleteLaporanFromGas(gasWebAppUrl, row);

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

    if (gasWebAppUrl) {
      postPerizinanToGas(gasWebAppUrl, newRow)
        .then(() => pullFromGasSheets(gasWebAppUrl, false, true))
        .catch(() => {});
    }

    return newRow;
  };

  const handleMarkPerizinanReturned = (
    targetRow: PerizinanRow,
    tibaTanggal: string,
    keteranganTiba: string
  ) => {
    const key = getPerizinanRowKey(targetRow);
    setPerizinanList((prev) => {
      const updated = prev.map((r) =>
        getPerizinanRowKey(r) === key
          ? { ...r, tibaTanggal, keteranganTiba }
          : r
      );
      savePerizinanListLocally(updated);
      return updated;
    });

    if (gasWebAppUrl) {
      updatePerizinanTibaInGas(
        gasWebAppUrl,
        targetRow,
        tibaTanggal,
        keteranganTiba
      )
        .then(() => pullFromGasSheets(gasWebAppUrl, false, true))
        .catch(() => {});
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

    if (gasWebAppUrl) {
      extendPerizinanInGas(gasWebAppUrl, extendedRow)
        .then(() => pullFromGasSheets(gasWebAppUrl, false, true))
        .catch(() => {});
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

    if (gasWebAppUrl) {
      deletePerizinanFromGas(gasWebAppUrl, targetRow)
        .then(() => pullFromGasSheets(gasWebAppUrl, false, true))
        .catch(() => {});
    }
  };

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
                    {userRole === 'ADMIN_PENGASUHAN' ? 'Online · Pengasuhan Al-Andalus' : 'Online · Akses Penuh SDM & Pusat'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {gasWebAppUrl && (
                  <button
                    type="button"
                    onClick={() => pullFromGasSheets(gasWebAppUrl, true, false)}
                    disabled={isSyncingGas}
                    title={`Tarik data terbaru dari semua Admin (${lastSyncTime || '-'})`}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700/70 hover:bg-emerald-600 text-white text-[11px] font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isSyncingGas ? 'animate-spin' : ''}`}
                    />
                    <span className="hidden sm:inline">
                      {isSyncingGas ? 'Menyinkronkan...' : 'Sinkronkan'}
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
                  <span>Keluar</span>
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
                  onAddSholat={handleAddSholat}
                  onDeleteSholat={handleDeleteSholat}
                  onResetSholatRange={handleResetSholatRange}
                  usersRoleList={usersRoleList}
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  activeMusyrifName={activeMusyrif?.namaMusyrif || (userRole === 'ADMIN_PENGASUHAN' ? 'Admin Pengasuhan' : 'Admin Pusat')}
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
                  onPullFromGasNow={() => pullFromGasSheets(gasWebAppUrl, true)}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

