/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { UserCheck } from 'lucide-react';
import {
  INITIAL_MASTER_DATA,
  INITIAL_LAPORAN_MUSYRIF,
  INITIAL_DATA_UKP,
  INITIAL_USERS_ROLE,
  createLaporanRow,
  runSyncStatusUKP,
  formatTimestampID,
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
import {
  getSavedGasUrl,
  saveGasUrl,
  fetchAllSheetsFromGas,
  postLaporanToGas,
  postActionToGas,
} from './utils/gasClient';

const LOGO_URL = '/assets/aistudio/Logo_Al-Andalus_c7d889d5.png';

type AdminMenuTab = 'overview' | 'wa' | 'input' | 'spreadsheet' | 'kode';

export default function App() {
  const [userRole, setUserRole] = useState<UserRole>('MUSYRIF');
  const [activeMusyrif, setActiveMusyrif] = useState<MusyrifProfile | null>(null);
  const [adminTab, setAdminTab] = useState<AdminMenuTab>('overview');

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

  // Fungsi menarik seluruh data 4 sheet (Master_Data, Laporan_Musyrif, Data_UKP, users_role) dari Google Sheets
  const pullFromGasSheets = useCallback(
    async (targetUrl: string, showSuccessAlert: boolean = false) => {
      if (!targetUrl.trim()) return;
      setIsSyncingGas(true);
      try {
        const res = await fetchAllSheetsFromGas(targetUrl);
        if (res.masterData) {
          setMasterData(res.masterData);
        }
        if (res.ukpList) {
          setUkpList(res.ukpList);
        }
        if (res.laporanList) {
          const synced = runSyncStatusUKP(
            res.laporanList,
            res.ukpList || []
          );
          setLaporanList(synced.updatedLaporan);
        }
        if (res.usersRoleList && res.usersRoleList.length > 0) {
          setUsersRoleList(res.usersRoleList);
        }
        if (res.lastSyncTime) {
          setLastSyncTime(res.lastSyncTime);
        }

        if (showSuccessAlert) {
          await Swal.fire({
            icon: 'success',
            title: 'Terhubung ke Google Sheets!',
            html: `<div class="text-xs text-slate-600 space-y-1">
              <p>Data berhasil ditarik langsung dari Google Spreadsheet Anda:</p>
              <p><b>Master_Data:</b> ${res.masterData?.length ?? 0} santri · <b>Laporan_Musyrif:</b> ${res.laporanList?.length ?? 0} laporan · <b>users_role:</b> ${res.usersRoleList?.length ?? 0} akun</p>
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
        setIsSyncingGas(false);
      }
    },
    []
  );

  // Tarik otomatis saat pertama kali aplikasi dibuka bila URL Google Apps Script sudah tersimpan
  useEffect(() => {
    if (gasWebAppUrl) {
      pullFromGasSheets(gasWebAppUrl, false);
    }
  }, [gasWebAppUrl, pullFromGasSheets]);

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
              setAdminTab('overview');
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
            {/* Header Bar Identitas Role Admin */}
            <div className="bg-gradient-to-r from-[#07361D] via-[#0B4627] to-[#07361D] text-white rounded-2xl px-4 py-3.5 border border-[#D4AF37]/50 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs font-bold text-[#F5D000]">
                    {userRole === 'ADMIN_PENGASUHAN'
                      ? 'Mode Admin Pengasuhan — Pantauan Kesehatan, Analitik & Data Santri'
                      : 'Mode Admin Pusat / SDM — Akses Penuh Seluruh Sistem, Sheet & Kode.gs'}
                  </p>
                  <p className="text-[11px] text-emerald-100/90">
                    Login sebagai:{' '}
                    <strong>
                      {activeMusyrif?.namaMusyrif ||
                        (userRole === 'ADMIN_PENGASUHAN'
                          ? 'Admin Pengasuhan'
                          : 'Admin Pusat / SDM')}
                    </strong>{' '}
                    · Pilih menu di bawah untuk berpindah fitur tanpa perlu scroll panjang.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-return-musyrif"
                  onClick={() => {
                    setActiveMusyrif(null);
                    setAdminTab('overview');
                    setUserRole('MUSYRIF');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-[#D4AF37]/40 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#F5D000]" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>

            {/* BAR MENU NAVIGASI (TAB) */}
            <nav
              aria-label="Bar Menu Navigasi Admin"
              data-testid="admin-nav-bar"
              className="bg-white rounded-2xl p-1.5 shadow-xs border border-[#D4AF37]/40 flex flex-wrap items-center gap-1.5"
            >
              <button
                type="button"
                data-testid="tab-admin-overview"
                onClick={() => setAdminTab('overview')}
                className={`flex-1 min-w-[140px] min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  adminTab === 'overview'
                    ? 'bg-[#07361D] text-[#F5D000] shadow-xs'
                    : 'text-slate-700 hover:bg-stone-100'
                }`}
              >
                <span>📊 Report Overview</span>
              </button>

              <button
                type="button"
                data-testid="tab-admin-wa"
                onClick={() => setAdminTab('wa')}
                className={`flex-1 min-w-[140px] min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  adminTab === 'wa'
                    ? 'bg-[#07361D] text-[#F5D000] shadow-xs'
                    : 'text-slate-700 hover:bg-stone-100'
                }`}
              >
                <span>💬 Laporan Cepat ke WA</span>
              </button>

              <button
                type="button"
                data-testid="tab-admin-input"
                onClick={() => setAdminTab('input')}
                className={`flex-1 min-w-[140px] min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  adminTab === 'input'
                    ? 'bg-[#07361D] text-[#F5D000] shadow-xs'
                    : 'text-slate-700 hover:bg-stone-100'
                }`}
              >
                <span>📝 Input Laporan Santri</span>
              </button>

              <button
                type="button"
                data-testid="tab-admin-spreadsheet"
                onClick={() => setAdminTab('spreadsheet')}
                className={`flex-1 min-w-[140px] min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  adminTab === 'spreadsheet'
                    ? 'bg-[#07361D] text-[#F5D000] shadow-xs'
                    : 'text-slate-700 hover:bg-stone-100'
                }`}
              >
                <span>🗂️ Data Spreadsheet</span>
              </button>

              {userRole === 'ADMIN_PUSAT' && (
                <button
                  type="button"
                  data-testid="btn-admin-tab-kode"
                  onClick={() => setAdminTab('kode')}
                  className={`flex-1 min-w-[160px] min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    adminTab === 'kode'
                      ? 'bg-[#07361D] text-[#F5D000] shadow-xs'
                      : 'text-slate-700 hover:bg-stone-100'
                  }`}
                >
                  <span>⚙️ Koneksi Sheet &amp; Code.gs</span>
                </button>
              )}
            </nav>

            {/* ISI HALAMAN SESUAI MENU TAB YANG DIPILIH */}
            {adminTab === 'overview' && (
              <div className="max-w-3xl mx-auto">
                <ReportOverview
                  laporanList={laporanList}
                  activeFilter={statusFilter}
                  onSelectFilter={setStatusFilter}
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  lastSyncTime={lastSyncTime}
                  onQuickSync={() => executeSyncUKP(true)}
                  mode="OVERVIEW_ONLY"
                />
              </div>
            )}

            {adminTab === 'wa' && (
              <div className="max-w-3xl mx-auto">
                <ReportOverview
                  laporanList={laporanList}
                  activeFilter={statusFilter}
                  onSelectFilter={setStatusFilter}
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  lastSyncTime={lastSyncTime}
                  onQuickSync={() => executeSyncUKP(true)}
                  mode="WA_ONLY"
                />
              </div>
            )}

            {adminTab === 'input' && (
              <div className="max-w-2xl mx-auto">
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
              </div>
            )}

            {adminTab === 'spreadsheet' && (
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
              />
            )}

            {adminTab === 'kode' && userRole === 'ADMIN_PUSAT' && (
              <SourceCodePanel
                gasWebAppUrl={gasWebAppUrl}
                isSyncingGas={isSyncingGas}
                onSaveAndTestGasUrl={handleSaveAndTestGasUrl}
                onPullFromGasNow={() => pullFromGasSheets(gasWebAppUrl, true)}
              />
            )}
          </div>
        )}
      </main>

      {/* Custom Footer Sesuai Spesifikasi User */}
      <footer className="w-full bg-[#07361D] border-t-2 border-[#D4AF37]/50 py-5 px-4 text-center mt-10">
        <p className="text-xs font-medium text-[#F5D000]/90">
          Bidang Pengasuhan Pesantren Al-Andalus
        </p>
      </footer>
    </div>
  );
}

