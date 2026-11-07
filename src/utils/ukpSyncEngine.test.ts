import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_MASTER_DATA,
  INITIAL_LAPORAN_MUSYRIF,
  INITIAL_USERS_ROLE,
  searchMasterSantri,
  validateLaporanInput,
  createLaporanRow,
  runSyncStatusUKP,
  calculateReportOverview,
  buildReportStatusPieData,
  filterLaporanByDateRange,
  generateDailyWhatsAppReport,
  splitLaporanByHandlingStatus,
  authenticateUserRole,
  searchUsersRoleByName,
  normalizeRoleValue,
  getTodayDateISO,
  normalizeDateYYYYMMDD,
  getDynamicDatePresets,
  generateDailyHealthCsvReport,
  type LaporanMusyrifRow,
  type DataUKPRow,
} from './ukpSyncEngine';
import { normalizeUsersRoleList, cleanGasWebAppUrl } from './gasClient';

test('searchMasterSantri finds santri by name, ID, class, or room case-insensitively', () => {
  const byName = searchMasterSantri('fauzan', INITIAL_MASTER_DATA);
  assert.equal(byName.length, 1);
  assert.equal(byName[0].idSantri, 'AND-2026-001');
  assert.equal(byName[0].kelas, 'X IPA 1');
  assert.equal(byName[0].kamar, 'Cordoba 102');

  const byRoom = searchMasterSantri('granada', INITIAL_MASTER_DATA);
  assert.equal(byRoom.length, 2);
});

test('validateLaporanInput rejects empty santri or short keluhan and accepts valid payload', () => {
  const missingSantri = validateLaporanInput({
    idSantri: '',
    namaSantri: '',
    kelas: '',
    kamar: '',
    tanggalLaporan: '2026-11-04',
    keluhanUtama: 'Demam tinggi',
  });
  assert.equal(missingSantri.valid, false);

  const shortKeluhan = validateLaporanInput({
    idSantri: 'AND-2026-001',
    namaSantri: 'Ahmad Fauzan Al-Farisi',
    kelas: 'X IPA 1',
    kamar: 'Cordoba 102',
    tanggalLaporan: '2026-11-04',
    keluhanUtama: 'Bat',
  });
  assert.equal(shortKeluhan.valid, false);

  const validPayload = validateLaporanInput({
    idSantri: 'AND-2026-001',
    namaSantri: 'Ahmad Fauzan Al-Farisi',
    kelas: 'X IPA 1',
    kamar: 'Cordoba 102',
    tanggalLaporan: '2026-11-04',
    keluhanUtama: 'Demam tinggi disertai menggigil sejak subuh',
  });
  assert.equal(validPayload.valid, true);
});

test('createLaporanRow sets default status MENUNGGU PENANGANAN and maps columns properly', () => {
  const fixedDate = new Date(2026, 10, 4, 8, 15, 30);
  const row = createLaporanRow(
    {
      idSantri: 'AND-2026-001',
      namaSantri: 'Ahmad Fauzan Al-Farisi',
      kelas: 'X IPA 1',
      kamar: 'Cordoba 102',
      tanggalLaporan: '2026-11-04',
      keluhanUtama: 'Pusing dan mual setelah makan pagi',
    },
    4,
    fixedDate
  );

  assert.equal(row.idLaporan, 'LP-20261104-004');
  assert.equal(row.statusPenanganan, 'MENUNGGU PENANGANAN');
  assert.equal(row.tindakanUKP, '');
  assert.equal(row.waktuUpdate, '');
  assert.equal(row.kelas, 'X IPA 1');
  assert.equal(row.kamar, 'Cordoba 102');
});

test('runSyncStatusUKP searches Data_UKP Bottom-Up and updates L, N, O only when Tindakan (P) is filled', () => {
  const laporan: LaporanMusyrifRow[] = [
    {
      idLaporan: 'LP-001',
      timestamp: '04/11/2026 07:00:00',
      tanggalLaporan: '2026-11-04',
      idSantri: 'AND-2026-002',
      namaSantri: 'Muhammad Zaidan Al-Ghifari',
      kelas: 'XI IPS 2',
      kamar: 'Granada 204',
      keluhanUtama: 'Demam tinggi',
      statusPenanganan: 'MENUNGGU PENANGANAN',
      tindakanUKP: '',
      waktuUpdate: '',
    },
    {
      idLaporan: 'LP-002',
      timestamp: '04/11/2026 07:15:00',
      tanggalLaporan: '2026-11-04',
      idSantri: 'AND-2026-004',
      namaSantri: 'Bilal Rabbani Putra',
      kelas: 'VII Tahfizh A',
      kamar: 'Toledo 105',
      keluhanUtama: 'Maag kambuh',
      statusPenanganan: 'MENUNGGU PENANGANAN',
      tindakanUKP: '',
      waktuUpdate: '',
    },
  ];

  const dataUKP: DataUKPRow[] = [
    // Older row for Zaidan at top
    {
      idRow: 'UKP-1',
      tanggalPemeriksaan: '2026-10-20',
      nama: 'Muhammad Zaidan Al-Ghifari',
      keluhan: 'Flu ringan',
      tindakan: 'Tindakan Lama Bulan Lalu',
    },
    // Newer row for Zaidan at bottom -> must be chosen by Bottom-Up search!
    {
      idRow: 'UKP-2',
      tanggalPemeriksaan: '2026-11-04',
      nama: 'Muhammad Zaidan Al-Ghifari',
      keluhan: 'Demam tinggi',
      tindakan: 'Observasi UKP & Paracetamol 500mg',
    },
    // Row for Bilal where Tindakan (Col P) is still empty -> must NOT update status
    {
      idRow: 'UKP-3',
      tanggalPemeriksaan: '2026-11-04',
      nama: 'Bilal Rabbani Putra',
      keluhan: 'Maag kambuh',
      tindakan: '   ',
    },
  ];

  const syncTime = '04/11/2026 09:00:00';
  const result = runSyncStatusUKP(laporan, dataUKP, syncTime);

  assert.equal(result.checkedWaitingCount, 2);
  assert.equal(result.updatedCount, 1);

  // Zaidan updated with bottom-most row's action
  const zaidanRow = result.updatedLaporan[0];
  assert.equal(
    zaidanRow.statusPenanganan,
    'SUDAH DITANGANI - Observasi UKP & Paracetamol 500mg'
  );
  assert.equal(zaidanRow.tindakanUKP, 'Observasi UKP & Paracetamol 500mg');
  assert.equal(zaidanRow.waktuUpdate, syncTime);

  // Bilal remains MENUNGGU PENANGANAN because Col P is empty
  const bilalRow = result.updatedLaporan[1];
  assert.equal(bilalRow.statusPenanganan, 'MENUNGGU PENANGANAN');
  assert.equal(bilalRow.tindakanUKP, '');
  assert.equal(bilalRow.waktuUpdate, '');
});

test('calculateReportOverview computes total, pending, resolved, and resolutionRate accurately', () => {
  const initialStats = calculateReportOverview(INITIAL_LAPORAN_MUSYRIF);
  assert.equal(initialStats.total, 5);
  assert.equal(initialStats.pending, 2);
  assert.equal(initialStats.resolved, 3);
  assert.equal(initialStats.resolutionRate, 60);

  const emptyStats = calculateReportOverview([]);
  assert.equal(emptyStats.total, 0);
  assert.equal(emptyStats.pending, 0);
  assert.equal(emptyStats.resolved, 0);
  assert.equal(emptyStats.resolutionRate, 0);
});

test('buildReportStatusPieData returns accurate slices for Resolved and Pending reports', () => {
  const slices = buildReportStatusPieData(INITIAL_LAPORAN_MUSYRIF);
  assert.equal(slices.length, 2);
  assert.equal(slices[0].key, 'DONE');
  assert.equal(slices[0].value, 3);
  assert.equal(slices[0].percentage, 60);
  assert.equal(slices[1].key, 'WAITING');
  assert.equal(slices[1].value, 2);
  assert.equal(slices[1].percentage, 40);
});

test('filterLaporanByDateRange filters reports by startDate and endDate for monthly monitoring', () => {
  // Semua tanggal
  const allRows = filterLaporanByDateRange(INITIAL_LAPORAN_MUSYRIF, {
    startDate: '',
    endDate: '',
  });
  assert.equal(allRows.length, 5);

  // Bulan November 2026
  const novRows = filterLaporanByDateRange(INITIAL_LAPORAN_MUSYRIF, {
    startDate: '2026-11-01',
    endDate: '2026-11-30',
  });
  assert.equal(novRows.length, 3);
  const novStats = calculateReportOverview(novRows);
  assert.equal(novStats.total, 3);
  assert.equal(novStats.pending, 2);
  assert.equal(novStats.resolved, 1);

  // Bulan Oktober 2026
  const octRows = filterLaporanByDateRange(INITIAL_LAPORAN_MUSYRIF, {
    startDate: '2026-10-01',
    endDate: '2026-10-31',
  });
  assert.equal(octRows.length, 2);
  const octStats = calculateReportOverview(octRows);
  assert.equal(octStats.total, 2);
  assert.equal(octStats.pending, 0);
  assert.equal(octStats.resolved, 2);
});

test('generateDailyWhatsAppReport formats concise daily santri health summary (Nama, Kelas, Sakit) and wa.me URL accurately', () => {
  const report = generateDailyWhatsAppReport(
    INITIAL_LAPORAN_MUSYRIF,
    '2026-11-04',
    '081234567890'
  );
  assert.equal(report.count, 3);
  assert.equal(report.pendingCount, 2);
  assert.equal(report.resolvedCount, 1);
  assert.equal(report.formattedDate, '04 November 2026');
  const expectedText = [
    '*LAPORAN HARIAN KESEHATAN SANTRI*',
    '*Pesantren Al Andalus Putra*',
    'Tanggal: 04 November 2026',
    '',
    '1. *Umar Abdul Aziz* (XII Agama 1) - Sakit kepala berdenyut dan badan lemas setelah shalat Subuh',
    '2. *Muhammad Zaidan Al-Ghifari* (XI IPS 2) - Demam 38.4°C disertai batuk kering dan nyeri tenggorokan',
    '3. *Bilal Rabbani Putra* (VII Tahfizh A) - Nyeri ulu hati (maag kambuh) dan mual sejak pagi',
    '',
    'Bidang Pengasuhan Pesantren Al-Andalus',
  ].join('\n');
  assert.equal(report.text, expectedText);
  assert.equal(report.waUrl.startsWith('https://wa.me/6281234567890?text='), true);

  const emptyDay = generateDailyWhatsAppReport(
    INITIAL_LAPORAN_MUSYRIF,
    '2026-11-05'
  );
  assert.equal(emptyDay.count, 0);
  assert.equal(emptyDay.text.includes('(Nihil)'), true);
});

test('splitLaporanByHandlingStatus separates belumTertangani and sudahTertangani for Musyrif view', () => {
  const groups = splitLaporanByHandlingStatus(INITIAL_LAPORAN_MUSYRIF);
  assert.equal(groups.total, 5);
  assert.equal(groups.belumTertangani.length, 2);
  assert.equal(groups.sudahTertangani.length, 3);
  assert.equal(
    groups.belumTertangani[0].namaSantri,
    'Muhammad Zaidan Al-Ghifari'
  );
  assert.equal(groups.sudahTertangani[0].namaSantri, 'Salman Al-Farisi Hakim');
});

test('authenticateUserRole and searchUsersRoleByName support 3 roles and partial name recommendations', () => {
  const wrongPass = authenticateUserRole(
    'Admin Pengasuhan',
    'wrongpassword',
    INITIAL_USERS_ROLE
  );
  assert.equal(wrongPass.valid, false);

  const validAdminPusat = authenticateUserRole(
    'Admin Pusat',
    'admin123',
    INITIAL_USERS_ROLE
  );
  assert.equal(validAdminPusat.valid, true);
  assert.equal(validAdminPusat.user?.role, 'admin_pusat');

  const validAdminPengasuhan = authenticateUserRole(
    'Admin Pengasuhan',
    'admin123',
    INITIAL_USERS_ROLE
  );
  assert.equal(validAdminPengasuhan.valid, true);
  assert.equal(validAdminPengasuhan.user?.role, 'admin_pengasuhan');

  // Partial name search recommendations
  const recs = searchUsersRoleByName('salman', INITIAL_USERS_ROLE);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].namaUser, 'Ust. Salman Al-Farisi');

  // Unique partial name authentication works directly
  const validPartialMusyrif = authenticateUserRole(
    'Salman',
    'cordoba123',
    INITIAL_USERS_ROLE
  );
  assert.equal(validPartialMusyrif.valid, true);
  assert.equal(validPartialMusyrif.user?.namaUser, 'Ust. Salman Al-Farisi');
});

test('normalizeUsersRoleList extracts from kolom nama and normalizes 3 roles', () => {
  const rawFromSheet = [
    {
      id_user: 'USR-01',
      nama: 'Ust. Salman Al-Farisi',
      role: 'user',
      password: 'cordoba123',
      keterangan: 'Asrama Cordoba',
    },
    {
      idUser: 'USR-02',
      namaUser: 'USR-02',
      nama: 'Admin Pengasuhan',
      role: 'admin_pengasuhan',
      password: 'admin123',
    },
    {
      idUser: 'USR-03',
      nama: 'Admin Pusat',
      role: 'admin_pusat',
      password: 'admin123',
    },
  ];

  const normalized = normalizeUsersRoleList(rawFromSheet);
  assert.equal(normalized.length, 3);
  assert.equal(normalized[0].namaUser, 'Ust. Salman Al-Farisi');
  assert.equal(normalized[0].role, 'user');
  assert.equal(normalized[1].namaUser, 'Admin Pengasuhan');
  assert.equal(normalized[1].role, 'admin_pengasuhan');
  assert.equal(normalized[2].namaUser, 'Admin Pusat');
  assert.equal(normalized[2].role, 'admin_pusat');
  assert.equal(normalizeRoleValue('admin', 'Admin Pusat'), 'admin_pusat');
  assert.equal(normalizeRoleValue('user', 'SDM'), 'admin_pusat');
  assert.equal(normalizeRoleValue('sdm', 'Staf SDM'), 'admin_pusat');
  assert.equal(
    normalizeRoleValue('user', 'Admin Pengasuhan'),
    'admin_pengasuhan'
  );
  assert.equal(
    normalizeRoleValue('pengasuhan', 'Staf Pengasuhan'),
    'admin_pengasuhan'
  );
});

test('getTodayDateISO, normalizeDateYYYYMMDD, and getDynamicDatePresets handle real-time dates properly', () => {
  const sampleDate = new Date(2026, 10, 6, 14, 30, 0);
  assert.equal(getTodayDateISO(sampleDate), '2026-11-06');
  assert.equal(normalizeDateYYYYMMDD('06/11/2026'), '2026-11-06');
  assert.equal(normalizeDateYYYYMMDD('2026/11/6'), '2026-11-06');
  assert.equal(normalizeDateYYYYMMDD('2026-11-06T08:00:00.000Z'), '2026-11-06');

  const presets = getDynamicDatePresets(sampleDate);
  assert.equal(presets.length, 4);
  assert.equal(presets[1].label, 'Hari Ini');
  assert.equal(presets[1].startDate, '2026-11-06');
  assert.equal(presets[2].startDate, '2026-11-01');
  assert.equal(presets[2].endDate, '2026-11-30');
});

test('generateDailyHealthCsvReport generates CSV summary with headers, incidents, and summary stats', () => {
  const csvReport = generateDailyHealthCsvReport(
    INITIAL_LAPORAN_MUSYRIF,
    '2026-11-04'
  );
  assert.equal(csvReport.totalIncidents, 3);
  assert.equal(csvReport.pendingCount, 2);
  assert.equal(csvReport.resolvedCount, 1);
  assert.equal(
    csvReport.filename,
    'Laporan_Kesehatan_Santri_AlAndalus_2026-11-04.csv'
  );
  assert.equal(
    csvReport.csvContent.includes(
      'No,ID_Laporan,Tanggal_Laporan,Timestamp_Input,ID_Santri,Nama_Santri,Kelas,Kamar,Musyrif_Pelapor,Keluhan_Utama,Kategori_Penanganan,Status_Penanganan,Tindakan_UKP,Waktu_Update_UKP'
    ),
    true
  );
  assert.equal(
    csvReport.csvContent.includes('RINGKASAN LAPORAN KESEHATAN SANTRI'),
    true
  );
  assert.equal(
    csvReport.csvContent.includes('Muhammad Zaidan Al-Ghifari'),
    true
  );
});

test('cleanGasWebAppUrl normalizes Google Apps Script URLs and converts /dev to /exec', () => {
  assert.equal(
    cleanGasWebAppUrl(
      '  "https://script.google.com/macros/s/AKfycbx12345/dev?action=test"  '
    ),
    'https://script.google.com/macros/s/AKfycbx12345/exec'
  );
});

test('normalizeUsersRoleList recovers swapped numeric passwords (12345678 / 87654321) and restores real user names', () => {
  const swappedRows = [
    {
      id_user: 'Ust. Salman Al-Farisi',
      nama: '12345678',
      namaUser: '12345678',
      role: 'user',
      password: 'user',
      keterangan: 'Asrama Cordoba',
    },
    {
      nama: '87654321',
      namaUser: '87654321',
      role: 'admin_pengasuhan',
      password: 'Admin Pengasuhan',
      keterangan: 'Pengasuhan Putra',
    },
  ];
  const recovered = normalizeUsersRoleList(swappedRows);
  assert.equal(recovered[0].namaUser, 'Ust. Salman Al-Farisi');
  assert.equal(recovered[0].password, '12345678');
  assert.equal(recovered[1].namaUser, 'Admin Pengasuhan');
  assert.equal(recovered[1].password, '87654321');
});

test('runSyncStatusUKP ignores old Data_UKP records (tanggalPemeriksaan < tanggalLaporan) and reverts falsely resolved reports', () => {
  const laporan: LaporanMusyrifRow[] = [
    {
      idLaporan: 'LP-20261107-005',
      timestamp: '2026-11-07 11:30:09',
      tanggalLaporan: '2026-11-07',
      namaMusyrif: 'Abdul Aziz',
      idSantri: 'SAN-294',
      namaSantri: 'Sulthan Rindra Alfaridzi',
      kelas: '7-',
      kamar: 'Saraqusthah - 2',
      keluhanUtama: 'Sakit kepala & mual',
      statusPenanganan: 'SUDAH DITANGANI - Rawat Jalan',
      tindakanUKP: 'Rawat Jalan',
      waktuUpdate: '07/11/2026 11:33:20',
    },
  ];
  const oldUkp: DataUKPRow[] = [
    {
      idRow: 'UKP-61',
      tanggalPemeriksaan: '2026-09-24',
      nama: 'Sulthan Rindra Alfaridzi',
      keluhan: 'Diare',
      tindakan: 'Rawat Jalan',
    },
  ];

  // Karena tanggalPemeriksaan (2026-09-24) lebih lama dari tanggalLaporan (2026-11-07),
  // status harus dikembalikan menjadi MENUNGGU PENANGANAN
  const resOld = runSyncStatusUKP(laporan, oldUkp);
  assert.equal(resOld.updatedLaporan[0].statusPenanganan, 'MENUNGGU PENANGANAN');
  assert.equal(resOld.updatedLaporan[0].tindakanUKP, '');

  // Jika ada pemeriksaan baru di Data_UKP pada tanggal >= 2026-11-07, barulah berubah menjadi SUDAH DITANGANI
  const newUkp: DataUKPRow[] = [
    ...oldUkp,
    {
      idRow: 'UKP-176',
      tanggalPemeriksaan: '2026-11-07',
      nama: 'Sulthan Rindra Alfaridzi',
      keluhan: 'Sakit kepala & mual',
      tindakan: 'Obat Maag & Istirahat',
    },
  ];
  const resNew = runSyncStatusUKP(resOld.updatedLaporan, newUkp);
  assert.equal(
    resNew.updatedLaporan[0].statusPenanganan,
    'SUDAH DITANGANI - Obat Maag & Istirahat'
  );
});
