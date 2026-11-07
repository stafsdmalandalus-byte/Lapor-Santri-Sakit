import React, { useState } from 'react';
import Swal from 'sweetalert2';
import {
  Table,
  Plus,
  CheckCircle2,
  Clock,
  Stethoscope,
  Users,
  FileSpreadsheet,
  KeyRound,
} from 'lucide-react';
import {
  type MasterSantri,
  type LaporanMusyrifRow,
  type DataUKPRow,
  type SyncLogItem,
  type DateRangeFilter,
  type UserRoleRow,
  filterLaporanByDateRange,
  getTodayDateISO,
} from '../utils/ukpSyncEngine';
import { type ReportStatusFilter } from './ReportOverview';

interface SpreadsheetSyncPanelProps {
  masterData: MasterSantri[];
  laporanList: LaporanMusyrifRow[];
  ukpList: DataUKPRow[];
  usersRoleList: UserRoleRow[];
  syncLogs: SyncLogItem[];
  lastSyncTime: string | null;
  statusFilter: ReportStatusFilter;
  onStatusFilterChange: (filter: ReportStatusFilter) => void;
  dateRange: DateRangeFilter;
  autoTriggerEnabled: boolean;
  onToggleAutoTrigger: () => void;
  onRunSyncNow: () => void;
  onUpdateUKPTindakan: (idRow: string, tindakanBaru: string) => void;
  onAddUKPRow: (newRow: Omit<DataUKPRow, 'idRow'>) => void;
  onAddMasterSantri: (newSantri: MasterSantri) => void;
  onUpdateUserPassword: (namaUser: string, newPassword: string) => void;
  onAddUserRole: (newUser: UserRoleRow) => void;
  hideUsersRoleTab?: boolean;
}

export const SpreadsheetSyncPanel: React.FC<SpreadsheetSyncPanelProps> = ({
  masterData,
  laporanList,
  ukpList,
  usersRoleList,
  syncLogs,
  statusFilter,
  onStatusFilterChange,
  dateRange,
  onUpdateUKPTindakan,
  onAddUKPRow,
  onAddMasterSantri,
  onUpdateUserPassword,
  onAddUserRole,
  hideUsersRoleTab = false,
}) => {
  const [activeSheet, setActiveSheet] = useState<
    'Laporan_Musyrif' | 'Data_UKP' | 'Master_Data' | 'users_role'
  >('Laporan_Musyrif');

  // State form tambah baris Data_UKP (Simulasi IMPORTRANGE UKP)
  const [ukpNama, setUkpNama] = useState<string>(
    masterData[3]?.namaSantri || 'Bilal Rabbani Putra'
  );
  const [ukpTanggal, setUkpTanggal] = useState<string>(() => getTodayDateISO());
  const [ukpKeluhan, setUkpKeluhan] = useState<string>(
    'Nyeri ulu hati dan mual'
  );
  const [ukpTindakan, setUkpTindakan] = useState<string>(
    'Pemberian Antasida Doen & Istirahat Observasi UKP'
  );

  // State form tambah Master_Data
  const [newNama, setNewNama] = useState<string>('');
  const [newKelas, setNewKelas] = useState<string>('');
  const [newKamar, setNewKamar] = useState<string>('');
  const [newIdSantri, setNewIdSantri] = useState<string>('');

  // State form tambah users_role
  const [newRoleUserNama, setNewRoleUserNama] = useState<string>('');
  const [newRoleUserType, setNewRoleUserType] = useState<
    'user' | 'admin_pengasuhan' | 'admin_pusat'
  >('user');
  const [newRoleUserPassword, setNewRoleUserPassword] = useState<string>('');
  const [newRoleUserKet, setNewRoleUserKet] = useState<string>('');

  const dateFilteredLaporan = filterLaporanByDateRange(laporanList, dateRange);
  const waitingCount = dateFilteredLaporan.filter(
    (r) => r.statusPenanganan.trim().toUpperCase() === 'MENUNGGU PENANGANAN'
  ).length;
  const handledCount = dateFilteredLaporan.length - waitingCount;

  const filteredLaporan = dateFilteredLaporan.filter((row) => {
    const isWaiting =
      row.statusPenanganan.trim().toUpperCase() === 'MENUNGGU PENANGANAN';
    if (statusFilter === 'WAITING') return isWaiting;
    if (statusFilter === 'DONE') return !isWaiting;
    return true;
  });

  const handleAddUkpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ukpNama.trim()) return;
    onAddUKPRow({
      tanggalPemeriksaan: ukpTanggal || getTodayDateISO(),
      nama: ukpNama.trim(),
      keluhan: ukpKeluhan.trim() || 'Pemeriksaan UKP',
      tindakan: ukpTindakan.trim(),
    });
    Swal.fire({
      icon: 'success',
      title: 'Baris Data_UKP Ditambahkan',
      text: `Baris baru untuk ${ukpNama} ditambahkan di bagian paling bawah (Bottom) sheet Data_UKP.`,
      confirmButtonColor: '#047857',
    });
  };

  const handleAddMasterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNama.trim() || !newKelas.trim() || !newKamar.trim()) return;
    const generatedId =
      newIdSantri.trim() ||
      `AND-2026-${String(masterData.length + 1).padStart(3, '0')}`;
    onAddMasterSantri({
      namaSantri: newNama.trim(),
      kelas: newKelas.trim(),
      kamar: newKamar.trim(),
      idSantri: generatedId,
    });
    setNewNama('');
    setNewKelas('');
    setNewKamar('');
    setNewIdSantri('');
    Swal.fire({
      icon: 'success',
      title: 'Santri Ditambahkan ke Master_Data',
      text: `${newNama} (${generatedId}) kini tersedia di pencarian Autocomplete Musyrif.`,
      confirmButtonColor: '#047857',
    });
  };

  const handleAddUserRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleUserNama.trim() || !newRoleUserPassword.trim()) return;
    onAddUserRole({
      namaUser: newRoleUserNama.trim(),
      role: newRoleUserType,
      password: newRoleUserPassword.trim(),
      keterangan:
        newRoleUserKet.trim() ||
        (newRoleUserType === 'admin_pusat'
          ? 'Admin Pusat (Akses Penuh & Kode Script)'
          : newRoleUserType === 'admin_pengasuhan'
          ? 'Admin Pengasuhan'
          : 'Musyrif Asrama'),
    });
    setNewRoleUserNama('');
    setNewRoleUserPassword('');
    setNewRoleUserKet('');
    Swal.fire({
      icon: 'success',
      title: 'Akun Ditambahkan ke Sheet users_role',
      text: `Akun ${newRoleUserNama} (${newRoleUserType}) siap digunakan pada halaman Login.`,
      confirmButtonColor: '#0B4627',
    });
  };

  return (
    <div className="space-y-5">
      {/* Tab Pilihan Sheet Google Sheets */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/90">
        <div className="flex flex-col gap-3 pb-4 mb-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="Tab Google Sheets"
              className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeSheet === 'Laporan_Musyrif'}
                onClick={() => setActiveSheet('Laporan_Musyrif')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeSheet === 'Laporan_Musyrif'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span>2. Laporan_Musyrif ({laporanList.length})</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeSheet === 'Data_UKP'}
                onClick={() => setActiveSheet('Data_UKP')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeSheet === 'Data_UKP'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                <span>3. Data_UKP ({ukpList.length})</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeSheet === 'Master_Data'}
                onClick={() => setActiveSheet('Master_Data')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeSheet === 'Master_Data'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>1. Master_Data ({masterData.length})</span>
              </button>

              {!hideUsersRoleTab && (
                <button
                  type="button"
                  role="tab"
                  data-testid="tab-sheet-users-role"
                  aria-selected={activeSheet === 'users_role'}
                  onClick={() => setActiveSheet('users_role')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeSheet === 'users_role'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span>4. users_role ({usersRoleList.length})</span>
                </button>
              )}
            </div>

            {activeSheet === 'Laporan_Musyrif' && (
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => onStatusFilterChange('ALL')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
                    statusFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => onStatusFilterChange('WAITING')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
                    statusFilter === 'WAITING'
                      ? 'bg-white text-amber-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Menunggu ({waitingCount})
                </button>
                <button
                  type="button"
                  onClick={() => onStatusFilterChange('DONE')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap ${
                    statusFilter === 'DONE'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ditangani ({handledCount})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SHEET 2: LAPORAN_MUSYRIF */}
        {activeSheet === 'Laporan_Musyrif' && (
          <div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-3 font-mono">Kol A/B/C · ID & Tanggal</th>
                    <th className="py-2.5 px-3">Kol E/F/G/H · Santri, Kelas & Kamar</th>
                    <th className="py-2.5 px-3">Kol J · Keluhan_Utama</th>
                    <th className="py-2.5 px-3">
                      Kol L/N/O · Status_Penanganan & Tindakan UKP
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredLaporan.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-8 text-center text-slate-500"
                      >
                        Tidak ada baris laporan pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredLaporan.map((row, idx) => {
                      const isWaiting =
                        row.statusPenanganan.trim().toUpperCase() ===
                        'MENUNGGU PENANGANAN';
                      return (
                        <tr
                          key={`${row.idLaporan}-${row.idSantri}-${idx}`}
                          className="hover:bg-slate-50/80 transition align-top"
                        >
                          <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap tabular-nums">
                            <div className="font-semibold text-slate-900">
                              {row.idLaporan}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Tgl: {row.tanggalLaporan}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {row.timestamp}
                            </div>
                            {row.namaMusyrif && (
                              <div className="text-[10px] font-sans font-medium text-emerald-800 mt-1">
                                Pelapor: {row.namaMusyrif}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-900">
                              {row.namaSantri}
                            </div>
                            <div className="text-slate-600 mt-0.5">
                              {row.kelas} · {row.kamar}
                            </div>
                            <div className="font-mono text-[11px] text-emerald-700 tabular-nums mt-0.5">
                              {row.idSantri}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-700 max-w-[210px] leading-relaxed">
                            {row.keluhanUtama}
                          </td>
                          <td className="py-3 px-3">
                            {isWaiting ? (
                              <div className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span>{row.statusPenanganan}</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-start gap-1.5 font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>{row.statusPenanganan}</span>
                              </div>
                            )}
                            <div className="text-[11px] text-slate-500 mt-1">
                              <span className="font-medium text-slate-600">
                                Kol N:
                              </span>{' '}
                              {row.tindakanUKP || 'Belum diisi UKP'}
                            </div>
                            {row.waktuUpdate && (
                              <div className="font-mono text-[10px] text-slate-400 mt-0.5 tabular-nums">
                                Kol O (Update): {row.waktuUpdate}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SHEET 3: DATA_UKP (IMPORTRANGE) */}
        {activeSheet === 'Data_UKP' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-600 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3.5">
              <p className="font-semibold text-emerald-950">
                Catatan IMPORTRANGE & Pencarian Bottom-Up (Baris Terbawah ke Atas):
              </p>
              <p className="mt-0.5 text-slate-600">
                Ubah isi kolom <strong>Tindakan (Kolom P)</strong> pada tabel di bawah atau tambahkan baris pemeriksaan UKP baru di bagian paling bawah, lalu klik tombol{' '}
                <strong>Jalankan syncStatusUKP()</strong> untuk menguji pembaruan status otomatis.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-3 font-mono">Baris Sheet</th>
                    <th className="py-2.5 px-3 font-mono">
                      Kol D · Tanggal_Pemeriksaan
                    </th>
                    <th className="py-2.5 px-3">Kol E · Nama</th>
                    <th className="py-2.5 px-3">Kol G · Keluhan</th>
                    <th className="py-2.5 px-3">
                      Kol P · Tindakan (Dapat Diedit untuk Uji Sync)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {ukpList.map((row, idx) => (
                    <tr
                      key={`${row.idRow}-${row.nama}-${idx}`}
                      className="hover:bg-slate-50/80 transition"
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-500 tabular-nums">
                        #{idx + 2}
                        {idx === ukpList.length - 1 && (
                          <span className="ml-1.5 text-[11px] text-emerald-700 font-semibold">
                            (Bottom)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 tabular-nums">
                        {row.tanggalPemeriksaan}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {row.nama}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {row.keluhan}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          aria-label={`Tindakan UKP untuk ${row.nama} baris ${idx + 2}`}
                          value={row.tindakan}
                          onChange={(e) =>
                            onUpdateUKPTindakan(row.idRow, e.target.value)
                          }
                          placeholder="Kosong (belum ada tindakan UKP)..."
                          className="w-full min-w-[240px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Form Simulasi Tambah Baris Baru di Data_UKP (Paling Bawah) */}
            <form
              onSubmit={handleAddUkpSubmit}
              className="rounded-2xl bg-stone-50 border border-slate-200/80 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-700" />
                  <span>
                    Simulasikan Data Baru Masuk ke Data_UKP (Baris Paling Bawah)
                  </span>
                </h4>
                <span className="text-[11px] text-slate-500 font-mono">
                  IMPORTRANGE Simulator
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div>
                  <label
                    htmlFor="sim-ukp-tanggal"
                    className="block text-[11px] font-medium text-slate-600 mb-1"
                  >
                    Kol D · Tanggal_Pemeriksaan
                  </label>
                  <input
                    id="sim-ukp-tanggal"
                    type="date"
                    value={ukpTanggal}
                    onChange={(e) => setUkpTanggal(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sim-ukp-nama"
                    className="block text-[11px] font-medium text-slate-600 mb-1"
                  >
                    Kol E · Nama Santri
                  </label>
                  <select
                    id="sim-ukp-nama"
                    value={ukpNama}
                    onChange={(e) => setUkpNama(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  >
                    {masterData.map((s, idx) => (
                      <option
                        key={`${s.idSantri}-${s.namaSantri}-${idx}`}
                        value={s.namaSantri}
                      >
                        {s.namaSantri}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="sim-ukp-keluhan"
                    className="block text-[11px] font-medium text-slate-600 mb-1"
                  >
                    Kol G · Keluhan
                  </label>
                  <input
                    id="sim-ukp-keluhan"
                    type="text"
                    value={ukpKeluhan}
                    onChange={(e) => setUkpKeluhan(e.target.value)}
                    placeholder="Keluhan saat diperiksa"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sim-ukp-tindakan"
                    className="block text-[11px] font-medium text-slate-600 mb-1"
                  >
                    Kol P · Tindakan UKP
                  </label>
                  <input
                    id="sim-ukp-tindakan"
                    type="text"
                    value={ukpTindakan}
                    onChange={(e) => setUkpTindakan(e.target.value)}
                    placeholder="Contoh: Rawat UKP & Obat Maag"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="min-h-[38px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah ke Baris Terbawah Data_UKP</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SHEET 1: MASTER_DATA */}
        {activeSheet === 'Master_Data' && (
          <div className="space-y-4">
            <div className="text-xs text-slate-500">
              Sumber data pencarian Autocomplete Musyrif: <strong>Kolom A</strong> (Nama_Santri) ·{' '}
              <strong>Kolom B</strong> (Kelas) · <strong>Kolom F</strong> (Daftar_Kamar) ·{' '}
              <strong>Kolom G</strong> (ID_Santri).
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-3">Kolom A · Nama_Santri</th>
                    <th className="py-2.5 px-3">Kolom B · Kelas</th>
                    <th className="py-2.5 px-3">Kolom F · Daftar_Kamar</th>
                    <th className="py-2.5 px-3 font-mono">Kolom G · ID_Santri</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {masterData.map((santri, idx) => (
                    <tr
                      key={`${santri.idSantri}-${santri.namaSantri}-${idx}`}
                      className="hover:bg-slate-50/80 transition"
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {santri.namaSantri}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {santri.kelas}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {santri.kamar}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-700 tabular-nums">
                        {santri.idSantri}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={handleAddMasterSubmit}
              className="rounded-2xl bg-stone-50 border border-slate-200/80 p-4 space-y-3"
            >
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-700" />
                <span>Tambah Santri Baru ke Sheet Master_Data</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  aria-label="Nama Santri Baru"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  placeholder="Nama_Santri (Kolom A)"
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  aria-label="Kelas Santri Baru"
                  value={newKelas}
                  onChange={(e) => setNewKelas(e.target.value)}
                  placeholder="Kelas (Kolom B) mis. X IPA 2"
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  aria-label="Kamar Santri Baru"
                  value={newKamar}
                  onChange={(e) => setNewKamar(e.target.value)}
                  placeholder="Daftar_Kamar (Kolom F)"
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  aria-label="ID Santri Baru"
                  value={newIdSantri}
                  onChange={(e) => setNewIdSantri(e.target.value)}
                  placeholder="ID_Santri (Kolom G, opsional)"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="min-h-[38px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Simpan ke Master_Data</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SHEET 4: USERS_ROLE (Database Password & Role Admin Pusat / Admin Pengasuhan / Musyrif) */}
        {!hideUsersRoleTab && activeSheet === 'users_role' && (
          <div className="space-y-4" data-testid="sheet-users-role-panel">
            <div className="text-xs text-slate-600 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-3.5">
              <p className="font-semibold text-emerald-950">
                Sheet <span className="font-mono">users_role</span> — Database Autentikasi 3 Role &amp; Password:
              </p>
              <p className="mt-0.5 text-slate-600">
                Mengambil langsung dari <strong>Kolom <code>nama</code> (Kolom B)</strong> sebagai <code>musrif_pelapor</code> (mengabaikan <code>id_user</code> di Kolom A) · <strong>Kolom <code>role</code></strong> (<code>admin_pusat</code> / <code>admin_pengasuhan</code> / <code>user</code>) · <strong>Kolom <code>password</code></strong>.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-3">Kolom Nama · nama (musrif_pelapor)</th>
                    <th className="py-2.5 px-3">Kolom Role · role</th>
                    <th className="py-2.5 px-3">Kolom Password · password (Dapat Diedit)</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {usersRoleList.map((u, idx) => (
                    <tr
                      key={`${u.namaUser}-${u.role}-${idx}`}
                      className="hover:bg-slate-50/80 transition"
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {u.nama || u.namaUser}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            u.role === 'admin_pusat'
                              ? 'bg-[#07361D] text-[#F5D000]'
                              : u.role === 'admin_pengasuhan' || u.role === 'admin'
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          aria-label={`Password untuk ${u.namaUser}`}
                          value={u.password}
                          onChange={(e) =>
                            onUpdateUserPassword(u.namaUser, e.target.value)
                          }
                          className="w-full max-w-[180px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {u.keterangan}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={handleAddUserRoleSubmit}
              className="rounded-2xl bg-stone-50 border border-slate-200/80 p-4 space-y-3"
            >
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-700" />
                <span>Tambah Akun Baru ke Sheet users_role</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  value={newRoleUserNama}
                  onChange={(e) => setNewRoleUserNama(e.target.value)}
                  placeholder="Nama (Kolom nama)"
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <select
                  value={newRoleUserType}
                  onChange={(e) =>
                    setNewRoleUserType(
                      e.target.value as
                        | 'user'
                        | 'admin_pengasuhan'
                        | 'admin_pusat'
                    )
                  }
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                >
                  <option value="user">Role: user (Musyrif)</option>
                  <option value="admin_pengasuhan">
                    Role: admin_pengasuhan (Admin Pengasuhan)
                  </option>
                  <option value="admin_pusat">
                    Role: admin_pusat (Admin Pusat &amp; Kode.gs)
                  </option>
                </select>
                <input
                  type="text"
                  value={newRoleUserPassword}
                  onChange={(e) => setNewRoleUserPassword(e.target.value)}
                  placeholder="Password (Kolom C)"
                  required
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
                <input
                  type="text"
                  value={newRoleUserKet}
                  onChange={(e) => setNewRoleUserKet(e.target.value)}
                  placeholder="Keterangan Asrama (Kolom D)"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="min-h-[38px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Simpan ke Sheet users_role</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Riwayat Log Eksekusi syncStatusUKP() */}
      {syncLogs.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/90">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Table className="w-4 h-4 text-emerald-700" />
              <span>Log Pembaruan Terakhir oleh syncStatusUKP() (Bottom-Up)</span>
            </h4>
            <span className="text-xs font-mono text-emerald-700 tabular-nums">
              {syncLogs.length} baris diperbarui
            </span>
          </div>
          <div className="space-y-2">
            {syncLogs.map((log, i) => (
              <div
                key={`${log.idLaporan}-${i}`}
                className="rounded-xl bg-emerald-50/60 border border-emerald-200/70 px-3.5 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-mono font-semibold text-emerald-900">
                    {log.idLaporan}
                  </span>{' '}
                  · <strong>{log.namaSantri}</strong> cocok dengan{' '}
                  <span className="font-mono">
                    Data_UKP baris #{log.ukpRowNumber}
                  </span>{' '}
                  → Status L menjadi{' '}
                  <span className="font-semibold text-emerald-800">
                    &ldquo;{log.statusBaru}&rdquo;
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-500 shrink-0 tabular-nums">
                  Kol O: {log.waktuUpdate}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
