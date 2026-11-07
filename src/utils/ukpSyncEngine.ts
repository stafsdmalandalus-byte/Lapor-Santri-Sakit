export type UserRole = 'MUSYRIF' | 'ADMIN_PENGASUHAN' | 'ADMIN_PUSAT';

export type SheetRoleType =
  | 'admin_pusat'
  | 'admin_pengasuhan'
  | 'admin'
  | 'user';

export interface MusyrifProfile {
  idMusyrif: string;
  namaMusyrif: string;
  gedungAsrama: string;
}

export interface UserRoleRow {
  /** Kolom Nama (Kolom B / kolom `nama` di sheet users_role, bukan Kolom A `id_user`) */
  namaUser: string;
  nama?: string;
  /** Kolom Role ('admin_pusat' | 'admin_pengasuhan' | 'admin' | 'user') */
  role: SheetRoleType;
  /** Kolom Password */
  password: string;
  /** Kolom Keterangan / Bagian */
  keterangan: string;
}

export const INITIAL_USERS_ROLE: UserRoleRow[] = [
  {
    namaUser: 'Admin Pusat',
    role: 'admin_pusat',
    password: 'admin123',
    keterangan: 'Admin Pusat (Akses Penuh & Kode Script)',
  },
  {
    namaUser: 'SDM',
    role: 'admin_pusat',
    password: 'admin123',
    keterangan: 'Staf SDM & Admin Pusat (Akses Penuh & Kode Script)',
  },
  {
    namaUser: 'Admin Pengasuhan',
    role: 'admin_pengasuhan',
    password: 'admin123',
    keterangan: 'Admin Pengasuhan (Dashboard & Pantauan Santri)',
  },
  {
    namaUser: 'Ust. Salman Al-Farisi',
    role: 'user',
    password: 'cordoba123',
    keterangan: 'Musyrif Cordoba',
  },
  {
    namaUser: 'Ust. Haidar Azzam',
    role: 'user',
    password: 'granada123',
    keterangan: 'Musyrif Granada',
  },
  {
    namaUser: 'Ust. Luqmanul Hakim',
    role: 'user',
    password: 'sevilla123',
    keterangan: 'Musyrif Sevilla',
  },
  {
    namaUser: 'Ust. Abdurrahman Zufar',
    role: 'user',
    password: 'toledo123',
    keterangan: 'Musyrif Toledo & Malaga',
  },
];

/**
 * Menormalkan string role dari sheet users_role menjadi SheetRoleType.
 * Memeriksa kolom role, nama, dan keterangan agar akun seperti "Admin Pengasuhan"
 * dan "SDM" / "Admin Pusat" tetap dikenali meskipun di sheet tertulis variasi nama/role.
 */
export function normalizeRoleValue(
  rawRole: string,
  namaUser: string = '',
  keterangan: string = ''
): SheetRoleType {
  const r = (rawRole || '').trim().toLowerCase();
  const n = (namaUser || '').trim().toLowerCase();
  const k = (keterangan || '').trim().toLowerCase();
  const combined = `${r} ${n} ${k}`;

  if (
    combined.includes('pengasuhan') ||
    combined.includes('kesantrian') ||
    combined.includes('kepengrasuhan')
  ) {
    return 'admin_pengasuhan';
  }

  if (
    combined.includes('pusat') ||
    combined.includes('sdm') ||
    combined.includes('hrd') ||
    combined.includes('super') ||
    combined.includes('utama') ||
    combined.includes('operator') ||
    r.includes('admin') ||
    n.includes('admin')
  ) {
    return 'admin_pusat';
  }

  return 'user';
}

/**
 * Mencari rekomendasi nama pengguna dari sheet users_role berdasarkan ketikan nama
 */
export function searchUsersRoleByName(
  query: string,
  usersRoleList: UserRoleRow[],
  roleCategory?: 'user' | 'admin_pengasuhan' | 'admin_pusat'
): UserRoleRow[] {
  const q = query.trim().toLowerCase();

  const matchesRoleCategory = (u: UserRoleRow): boolean => {
    if (!roleCategory) return true;
    const norm = normalizeRoleValue(u.role, u.nama || u.namaUser);
    if (roleCategory === 'user') {
      return norm === 'user';
    }
    if (roleCategory === 'admin_pengasuhan') {
      return norm === 'admin_pengasuhan' || norm === 'admin';
    }
    if (roleCategory === 'admin_pusat') {
      return norm === 'admin_pusat' || norm === 'admin';
    }
    return true;
  };

  if (!q) {
    const byCategory = usersRoleList.filter(matchesRoleCategory);
    return byCategory.length > 0 ? byCategory : usersRoleList;
  }

  const matched = usersRoleList.filter((u) => {
    const displayNama = (u.nama || u.namaUser).toLowerCase();
    const ket = (u.keterangan || '').toLowerCase();
    return displayNama.includes(q) || ket.includes(q);
  });

  return matched.sort((a, b) => {
    const aCat = matchesRoleCategory(a) ? 0 : 1;
    const bCat = matchesRoleCategory(b) ? 0 : 1;
    return aCat - bCat;
  });
}

export function authenticateUserRole(
  namaUserInput: string,
  passwordInput: string,
  usersRoleList: UserRoleRow[]
): {
  valid: boolean;
  user?: UserRoleRow;
  errorMessage?: string;
} {
  const cleanName = namaUserInput.trim().toLowerCase();
  if (!cleanName) {
    return {
      valid: false,
      errorMessage:
        'Silakan ketik dan pilih nama Anda terlebih dahulu.',
    };
  }

  let target = usersRoleList.find(
    (u) => (u.nama || u.namaUser).trim().toLowerCase() === cleanName
  );

  if (!target) {
    const partialMatches = usersRoleList.filter((u) =>
      (u.nama || u.namaUser).trim().toLowerCase().includes(cleanName)
    );
    if (partialMatches.length === 1) {
      target = partialMatches[0];
    }
  }

  if (!target) {
    return {
      valid: false,
      errorMessage:
        'Nama pengguna tidak ditemukan pada sheet users_role. Silakan pilih dari rekomendasi nama yang muncul.',
    };
  }

  if (!passwordInput.trim()) {
    return {
      valid: false,
      errorMessage: 'Password wajib diisi sesuai data pada sheet users_role.',
    };
  }

  if (target.password !== passwordInput.trim()) {
    return {
      valid: false,
      errorMessage:
        'Password salah. Silakan periksa kembali password Anda pada sheet users_role.',
    };
  }

  return {
    valid: true,
    user: target,
  };
}

export const MASTER_MUSYRIF: MusyrifProfile[] = [
  {
    idMusyrif: 'MSY-01',
    namaMusyrif: 'Ust. Salman Al-Farisi',
    gedungAsrama: 'Asrama Cordoba',
  },
  {
    idMusyrif: 'MSY-02',
    namaMusyrif: 'Ust. Haidar Azzam',
    gedungAsrama: 'Asrama Granada',
  },
  {
    idMusyrif: 'MSY-03',
    namaMusyrif: 'Ust. Luqmanul Hakim',
    gedungAsrama: 'Asrama Sevilla',
  },
  {
    idMusyrif: 'MSY-04',
    namaMusyrif: 'Ust. Abdurrahman Zufar',
    gedungAsrama: 'Asrama Toledo & Malaga',
  },
];

export interface MasterSantri {
  /** Kolom A: Nama_Santri */
  namaSantri: string;
  /** Kolom B: Kelas */
  kelas: string;
  /** Kolom F: Daftar_Kamar */
  kamar: string;
  /** Kolom G: ID_Santri */
  idSantri: string;
}

export interface LaporanMusyrifRow {
  /** Kolom A: ID_Laporan */
  idLaporan: string;
  /** Kolom B: Timestamp */
  timestamp: string;
  /** Kolom C: Tanggal_Laporan (YYYY-MM-DD) */
  tanggalLaporan: string;
  /** Kolom E: ID_Santri */
  idSantri: string;
  /** Kolom F: Nama_Santri */
  namaSantri: string;
  /** Kolom G: Kelas */
  kelas: string;
  /** Kolom H: Kamar */
  kamar: string;
  /** Kolom J: Keluhan_Utama */
  keluhanUtama: string;
  /** Kolom L: Status_Penanganan (default: "MENUNGGU PENANGANAN") */
  statusPenanganan: string;
  /** Kolom N: Tindakan_UKP */
  tindakanUKP: string;
  /** Kolom O: Waktu_Update */
  waktuUpdate: string;
  /** Nama Musyrif Pelapor */
  namaMusyrif?: string;
}

export interface DataUKPRow {
  idRow: string;
  /** Kolom D: Tanggal_Pemeriksaan */
  tanggalPemeriksaan: string;
  /** Kolom E: Nama */
  nama: string;
  /** Kolom G: Keluhan */
  keluhan: string;
  /** Kolom P: Tindakan */
  tindakan: string;
}

export interface LaporanInput {
  idSantri: string;
  namaSantri: string;
  kelas: string;
  kamar: string;
  tanggalLaporan: string;
  keluhanUtama: string;
  namaMusyrif?: string;
  musrif_pelapor?: string;
}

export interface SyncLogItem {
  idLaporan: string;
  namaSantri: string;
  tindakanBaru: string;
  statusBaru: string;
  ukpRowNumber: number;
  waktuUpdate: string;
}

export interface SyncResult {
  updatedLaporan: LaporanMusyrifRow[];
  updatedCount: number;
  checkedWaitingCount: number;
  logs: SyncLogItem[];
}

export const INITIAL_MASTER_DATA: MasterSantri[] = [
  {
    namaSantri: 'Ahmad Fauzan Al-Farisi',
    kelas: 'X IPA 1',
    kamar: 'Cordoba 102',
    idSantri: 'AND-2026-001',
  },
  {
    namaSantri: 'Muhammad Zaidan Al-Ghifari',
    kelas: 'XI IPS 2',
    kamar: 'Granada 204',
    idSantri: 'AND-2026-002',
  },
  {
    namaSantri: 'Umar Abdul Aziz',
    kelas: 'XII Agama 1',
    kamar: 'Sevilla 301',
    idSantri: 'AND-2026-003',
  },
  {
    namaSantri: 'Bilal Rabbani Putra',
    kelas: 'VII Tahfizh A',
    kamar: 'Toledo 105',
    idSantri: 'AND-2026-004',
  },
  {
    namaSantri: 'Salman Al-Farisi Hakim',
    kelas: 'VIII Reguler B',
    kamar: 'Cordoba 108',
    idSantri: 'AND-2026-005',
  },
  {
    namaSantri: 'Ibrahim Khalilullah',
    kelas: 'IX Tahfizh A',
    kamar: 'Granada 201',
    idSantri: 'AND-2026-006',
  },
  {
    namaSantri: 'Yusuf Maulana Siddiq',
    kelas: 'X Agama 2',
    kamar: 'Sevilla 305',
    idSantri: 'AND-2026-007',
  },
  {
    namaSantri: 'Hamzah Assadullah',
    kelas: 'XI IPA 1',
    kamar: 'Malaga 103',
    idSantri: 'AND-2026-008',
  },
  {
    namaSantri: 'Rasyid Ridho Pratama',
    kelas: 'VIII Tahfizh C',
    kamar: 'Toledo 102',
    idSantri: 'AND-2026-009',
  },
  {
    namaSantri: 'Faqihuddin Al-Ayyubi',
    kelas: 'XII IPA 2',
    kamar: 'Sevilla 308',
    idSantri: 'AND-2026-010',
  },
];

export const INITIAL_LAPORAN_MUSYRIF: LaporanMusyrifRow[] = [
  {
    idLaporan: 'LP-20261018-001',
    timestamp: '18/10/2026 08:20:00',
    tanggalLaporan: '2026-10-18',
    idSantri: 'AND-2026-005',
    namaSantri: 'Salman Al-Farisi Hakim',
    kelas: 'VIII Reguler B',
    kamar: 'Cordoba 108',
    keluhanUtama: 'Batuk pilek dan demam ringan setelah kegiatan pramuka',
    statusPenanganan: 'SUDAH DITANGANI - Pemberian Paracetamol & Vitamin C',
    tindakanUKP: 'Pemberian Paracetamol & Vitamin C',
    waktuUpdate: '18/10/2026 09:10:00',
    namaMusyrif: 'Ust. Salman Al-Farisi',
  },
  {
    idLaporan: 'LP-20261025-002',
    timestamp: '25/10/2026 19:45:12',
    tanggalLaporan: '2026-10-25',
    idSantri: 'AND-2026-007',
    namaSantri: 'Yusuf Maulana Siddiq',
    kelas: 'X Agama 2',
    kamar: 'Sevilla 305',
    keluhanUtama: 'Alergi gatal kulit pada lengan dan punggung',
    statusPenanganan: 'SUDAH DITANGANI - Pemberian Cetirizine 10mg & Bedak Salicyl',
    tindakanUKP: 'Pemberian Cetirizine 10mg & Bedak Salicyl',
    waktuUpdate: '25/10/2026 20:15:00',
    namaMusyrif: 'Ust. Luqmanul Hakim',
  },
  {
    idLaporan: 'LP-20261104-001',
    timestamp: '04/11/2026 06:15:10',
    tanggalLaporan: '2026-11-04',
    idSantri: 'AND-2026-003',
    namaSantri: 'Umar Abdul Aziz',
    kelas: 'XII Agama 1',
    kamar: 'Sevilla 301',
    keluhanUtama: 'Sakit kepala berdenyut dan badan lemas setelah shalat Subuh',
    statusPenanganan: 'SUDAH DITANGANI - Istirahat di UKP & Paracetamol 500mg',
    tindakanUKP: 'Istirahat di UKP & Paracetamol 500mg',
    waktuUpdate: '04/11/2026 07:30:00',
    namaMusyrif: 'Ust. Luqmanul Hakim',
  },
  {
    idLaporan: 'LP-20261104-002',
    timestamp: '04/11/2026 07:05:42',
    tanggalLaporan: '2026-11-04',
    idSantri: 'AND-2026-002',
    namaSantri: 'Muhammad Zaidan Al-Ghifari',
    kelas: 'XI IPS 2',
    kamar: 'Granada 204',
    keluhanUtama: 'Demam 38.4°C disertai batuk kering dan nyeri tenggorokan',
    statusPenanganan: 'MENUNGGU PENANGANAN',
    tindakanUKP: '',
    waktuUpdate: '',
    namaMusyrif: 'Ust. Haidar Azzam',
  },
  {
    idLaporan: 'LP-20261104-003',
    timestamp: '04/11/2026 07:40:19',
    tanggalLaporan: '2026-11-04',
    idSantri: 'AND-2026-004',
    namaSantri: 'Bilal Rabbani Putra',
    kelas: 'VII Tahfizh A',
    kamar: 'Toledo 105',
    keluhanUtama: 'Nyeri ulu hati (maag kambuh) dan mual sejak pagi',
    statusPenanganan: 'MENUNGGU PENANGANAN',
    tindakanUKP: '',
    waktuUpdate: '',
    namaMusyrif: 'Ust. Abdurrahman Zufar',
  },
];

export const INITIAL_DATA_UKP: DataUKPRow[] = [
  {
    idRow: 'UKP-1',
    tanggalPemeriksaan: '2026-11-03',
    nama: 'Muhammad Zaidan Al-Ghifari',
    keluhan: 'Batuk ringan',
    tindakan: 'Pemberian Vitamin C & Madu Hangat',
  },
  {
    idRow: 'UKP-2',
    tanggalPemeriksaan: '2026-11-04',
    nama: 'Umar Abdul Aziz',
    keluhan: 'Sakit kepala berdenyut dan badan lemas',
    tindakan: 'Istirahat di UKP & Paracetamol 500mg',
  },
  {
    idRow: 'UKP-3',
    tanggalPemeriksaan: '2026-11-04',
    nama: 'Muhammad Zaidan Al-Ghifari',
    keluhan: 'Demam 38.4°C disertai batuk kering',
    tindakan: 'Observasi Kamar Isolasi UKP + Paracetamol & Ambroxol',
  },
  {
    idRow: 'UKP-4',
    tanggalPemeriksaan: '2026-11-04',
    nama: 'Bilal Rabbani Putra',
    keluhan: 'Nyeri ulu hati dan mual',
    tindakan: '',
  },
];

/**
 * Pencarian Autocomplete Santri dari Master_Data berdasarkan Nama_Santri (A), ID_Santri (G), Kelas (B), atau Kamar (F)
 */
export function searchMasterSantri(
  query: string,
  masterData: MasterSantri[]
): MasterSantri[] {
  const q = query.trim().toLowerCase();
  if (!q) return masterData;
  return masterData.filter(
    (s) =>
      s.namaSantri.toLowerCase().includes(q) ||
      s.idSantri.toLowerCase().includes(q) ||
      s.kelas.toLowerCase().includes(q) ||
      s.kamar.toLowerCase().includes(q)
  );
}

/**
 * Validasi input laporan musyrif sebelum dikirim ke sheet Laporan_Musyrif
 */
export function validateLaporanInput(input: LaporanInput): {
  valid: boolean;
  errorMessage?: string;
} {
  if (!input.namaSantri.trim() || !input.idSantri.trim()) {
    return {
      valid: false,
      errorMessage:
        'Silakan pilih Nama Santri terlebih dahulu dari daftar pencarian Master Data.',
    };
  }
  if (!input.kelas.trim() || !input.kamar.trim()) {
    return {
      valid: false,
      errorMessage:
        'Data Kelas dan Kamar belum terisi otomatis. Pastikan memilih santri yang valid.',
    };
  }
  if (!input.tanggalLaporan.trim()) {
    return {
      valid: false,
      errorMessage: 'Tanggal Laporan wajib diisi.',
    };
  }
  if (input.keluhanUtama.trim().length < 5) {
    return {
      valid: false,
      errorMessage:
        'Keluhan Utama wajib diisi minimal 5 karakter agar petugas UKP memahami kondisi santri.',
    };
  }
  return { valid: true };
}

/**
 * Format Date ke format DD/MM/YYYY HH:mm:ss
 */
export function formatTimestampID(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
}

/**
 * Membuat baris baru untuk sheet Laporan_Musyrif
 * Struktur Kolom:
 * A: ID_Laporan, B: Timestamp, C: Tanggal_Laporan, E: ID_Santri, F: Nama_Santri,
 * G: Kelas, H: Kamar, J: Keluhan_Utama, L: Status_Penanganan ("MENUNGGU PENANGANAN"),
 * N: Tindakan_UKP, O: Waktu_Update
 */
export function createLaporanRow(
  input: LaporanInput,
  sequenceNumber: number,
  now: Date = new Date()
): LaporanMusyrifRow {
  const dateCompact = input.tanggalLaporan.replace(/-/g, '');
  const seqStr = String(sequenceNumber).padStart(3, '0');
  return {
    idLaporan: `LP-${dateCompact}-${seqStr}`,
    timestamp: formatTimestampID(now),
    tanggalLaporan: input.tanggalLaporan,
    idSantri: input.idSantri.trim(),
    namaSantri: input.namaSantri.trim(),
    kelas: input.kelas.trim(),
    kamar: input.kamar.trim(),
    keluhanUtama: input.keluhanUtama.trim(),
    statusPenanganan: 'MENUNGGU PENANGANAN',
    tindakanUKP: '',
    waktuUpdate: '',
    namaMusyrif: (input.musrif_pelapor || input.namaMusyrif || '').trim(),
  };
}

/**
 * Fungsi Sinkronisasi Utama: syncStatusUKP()
 * - Mencari baris di Laporan_Musyrif yang berstatus "MENUNGGU PENANGANAN" (Kolom L)
 * - Mencocokkan Nama_Santri (Kolom F) dengan Nama di Data_UKP (Kolom E)
 * - Pencarian di Data_UKP dilakukan dari baris paling bawah ke atas (Bottom-Up)
 *   agar selalu mengambil tindakan pemeriksaan terbaru.
 * - Jika Kolom Tindakan (P) di Data_UKP sudah terisi, maka:
 *   - Kolom L (Status_Penanganan) -> "SUDAH DITANGANI - [Nama Tindakan]"
 *   - Kolom N (Tindakan_UKP) -> [Nama Tindakan]
 *   - Kolom O (Waktu_Update) -> Stempel Waktu Update
 */
export function runSyncStatusUKP(
  laporanRows: LaporanMusyrifRow[],
  ukpRows: DataUKPRow[],
  waktuUpdateStr: string = formatTimestampID(new Date())
): SyncResult {
  const logs: SyncLogItem[] = [];
  let updatedCount = 0;
  let checkedWaitingCount = 0;

  const updatedLaporan = laporanRows.map((laporan) => {
    const currentStatus = laporan.statusPenanganan.trim().toUpperCase();
    const targetNama = laporan.namaSantri.trim().toLowerCase();
    const tglLaporan = normalizeDateYYYYMMDD(laporan.tanggalLaporan);

    if (currentStatus === 'MENUNGGU PENANGANAN') {
      checkedWaitingCount++;
    }

    if (!targetNama) {
      return laporan;
    }

    // Pencarian Bottom-Up (dari baris paling bawah ke atas di Data_UKP)
    // WAJIB cocok Nama Santri DAN Tanggal Pemeriksaan UKP >= Tanggal Laporan Musyrif
    for (let j = ukpRows.length - 1; j >= 0; j--) {
      const ukp = ukpRows[j];
      const ukpNama = ukp.nama.trim().toLowerCase();
      const ukpTindakan = ukp.tindakan.trim();
      const tglUkp = normalizeDateYYYYMMDD(ukp.tanggalPemeriksaan);

      const isDateValid =
        !tglLaporan || !tglUkp ? true : tglUkp >= tglLaporan;

      if (ukpNama === targetNama && ukpTindakan !== '' && isDateValid) {
        if (currentStatus !== 'MENUNGGU PENANGANAN') {
          return laporan;
        }
        const statusBaru = `SUDAH DITANGANI - ${ukpTindakan}`;
        updatedCount++;
        logs.push({
          idLaporan: laporan.idLaporan,
          namaSantri: laporan.namaSantri,
          tindakanBaru: ukpTindakan,
          statusBaru,
          ukpRowNumber: j + 2, // Baris di Google Sheets (header di baris 1)
          waktuUpdate: waktuUpdateStr,
        });

        return {
          ...laporan,
          statusPenanganan: statusBaru,
          tindakanUKP: ukpTindakan,
          waktuUpdate: waktuUpdateStr,
        };
      }
    }

    // Jika sebelumnya terlanjur berstatus SUDAH DITANGANI karena terekam data UKP tanggal lama
    // (sebelum tanggal laporan), kembalikan ke MENUNGGU PENANGANAN
    if (
      currentStatus !== 'MENUNGGU PENANGANAN' &&
      tglLaporan &&
      ukpRows.length > 0
    ) {
      const hasAnyOldRecordOnly = ukpRows.some(
        (u) =>
          u.nama.trim().toLowerCase() === targetNama &&
          normalizeDateYYYYMMDD(u.tanggalPemeriksaan) < tglLaporan
      );
      if (hasAnyOldRecordOnly) {
        return {
          ...laporan,
          statusPenanganan: 'MENUNGGU PENANGANAN',
          tindakanUKP: '',
          waktuUpdate: '',
        };
      }
    }

    return laporan;
  });

  return {
    updatedLaporan,
    updatedCount,
    checkedWaitingCount,
    logs,
  };
}

export interface ReportOverviewStats {
  total: number;
  pending: number;
  resolved: number;
  resolutionRate: number;
}

/**
 * Menghitung ringkasan jumlah laporan (Total, Menunggu Penanganan, Sudah Ditangani)
 * untuk komponen Report Overview Musyrif.
 */
export function calculateReportOverview(
  laporanRows: LaporanMusyrifRow[]
): ReportOverviewStats {
  const total = laporanRows.length;
  const pending = laporanRows.filter(
    (r) => r.statusPenanganan.trim().toUpperCase() === 'MENUNGGU PENANGANAN'
  ).length;
  const resolved = total - pending;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return {
    total,
    pending,
    resolved,
    resolutionRate,
  };
}

export interface ReportStatusPieSlice {
  name: string;
  key: 'WAITING' | 'DONE';
  value: number;
  percentage: number;
  color: string;
}

/**
 * Menghasilkan data distribusi status laporan (Menunggu vs Ditangani) untuk Recharts PieChart
 */
export function buildReportStatusPieData(
  laporanRows: LaporanMusyrifRow[]
): ReportStatusPieSlice[] {
  const stats = calculateReportOverview(laporanRows);
  const pendingPct =
    stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0;
  const resolvedPct = stats.total > 0 ? 100 - pendingPct : 0;

  return [
    {
      name: 'Sudah Ditangani',
      key: 'DONE',
      value: stats.resolved,
      percentage: resolvedPct,
      color: '#059669', // emerald-600
    },
    {
      name: 'Menunggu UKP',
      key: 'WAITING',
      value: stats.pending,
      percentage: pendingPct,
      color: '#d97706', // amber-600
    },
  ];
}

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

/**
 * Memfilter daftar laporan berdasarkan rentang Tanggal_Laporan (Kolom C, format YYYY-MM-DD)
 */
export function filterLaporanByDateRange(
  laporanRows: LaporanMusyrifRow[],
  range: DateRangeFilter
): LaporanMusyrifRow[] {
  const start = normalizeDateYYYYMMDD(range.startDate);
  const end = normalizeDateYYYYMMDD(range.endDate);

  if (!start && !end) {
    return laporanRows;
  }

  return laporanRows.filter((row) => {
    const tgl = normalizeDateYYYYMMDD(row.tanggalLaporan);
    if (!tgl) return false;
    if (start && tgl < start) return false;
    if (end && tgl > end) return false;
    return true;
  });
}

const BULAN_INDO = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Mengubah YYYY-MM-DD menjadi "04 November 2026"
 */
export function formatTanggalIndo(yyyyMmDd: string): string {
  const norm = normalizeDateYYYYMMDD(yyyyMmDd);
  const parts = norm.split('-');
  if (parts.length !== 3) return yyyyMmDd;
  const [y, m, d] = parts;
  const monthIdx = parseInt(m, 10) - 1;
  const namaBulan = BULAN_INDO[monthIdx] || m;
  return `${d} ${namaBulan} ${y}`;
}

export interface DailyWhatsAppReport {
  targetDate: string;
  formattedDate: string;
  count: number;
  pendingCount: number;
  resolvedCount: number;
  text: string;
  waUrl: string;
}

/**
 * Membuat format teks Laporan Cepat Harian ke WhatsApp beserta link wa.me
 */
export function generateDailyWhatsAppReport(
  laporanRows: LaporanMusyrifRow[],
  targetDate: string,
  phoneNumber: string = ''
): DailyWhatsAppReport {
  const cleanDate = normalizeDateYYYYMMDD(targetDate);
  const formattedDate = formatTanggalIndo(cleanDate);
  const dailyRows = laporanRows.filter(
    (r) => normalizeDateYYYYMMDD(r.tanggalLaporan) === cleanDate
  );
  const stats = calculateReportOverview(dailyRows);

  const lines: string[] = [
    '*LAPORAN HARIAN KESEHATAN SANTRI*',
    '*Pesantren Al Andalus Putra*',
    `Tanggal: ${formattedDate}`,
    '',
  ];

  if (dailyRows.length === 0) {
    lines.push(
      'Alhamdulillah, tidak ada laporan santri sakit pada tanggal ini (Nihil).'
    );
  } else {
    dailyRows.forEach((row, idx) => {
      lines.push(
        `${idx + 1}. *${row.namaSantri}* (${row.kelas}) - ${row.keluhanUtama}`
      );
    });
  }

  lines.push('');
  lines.push('Bidang Pengasuhan Pesantren Al-Andalus');

  const text = lines.join('\n');
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, '');
  const normalizedPhone = digitsOnly.startsWith('0')
    ? `62${digitsOnly.slice(1)}`
    : digitsOnly;

  const baseUrl = normalizedPhone
    ? `https://wa.me/${normalizedPhone}`
    : 'https://wa.me/';
  const waUrl = `${baseUrl}?text=${encodeURIComponent(text)}`;

  return {
    targetDate: cleanDate,
    formattedDate,
    count: stats.total,
    pendingCount: stats.pending,
    resolvedCount: stats.resolved,
    text,
    waUrl,
  };
}

export interface MusyrifHandlingGroups {
  belumTertangani: LaporanMusyrifRow[];
  sudahTertangani: LaporanMusyrifRow[];
  total: number;
}

/**
 * Memisahkan data laporan santri menjadi kelompok Belum Tertangani (MENUNGGU PENANGANAN)
 * dan Sudah Tertangani untuk tampilan ringkas Musyrif.
 */
export function splitLaporanByHandlingStatus(
  laporanRows: LaporanMusyrifRow[]
): MusyrifHandlingGroups {
  const belumTertangani = laporanRows.filter(
    (r) => r.statusPenanganan.trim().toUpperCase() === 'MENUNGGU PENANGANAN'
  );
  const sudahTertangani = laporanRows.filter(
    (r) => r.statusPenanganan.trim().toUpperCase() !== 'MENUNGGU PENANGANAN'
  );
  return {
    belumTertangani,
    sudahTertangani,
    total: laporanRows.length,
  };
}

/**
 * Mengembalikan tanggal hari ini secara real-time dalam format YYYY-MM-DD (sesuai waktu lokal perangkat)
 */
export function getTodayDateISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  return `${y}-${m}-${d}`;
}

/**
 * Menormalkan berbagai format tanggal (DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, ISO) menjadi YYYY-MM-DD
 */
export function normalizeDateYYYYMMDD(raw: string): string {
  const clean = String(raw || '').trim();
  if (!clean) return '';

  // Sudah YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Format YYYY-MM-DDTHH:mm...
  const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Format YYYY/MM/DD
  const ymdSlash = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdSlash) {
    const y = ymdSlash[1];
    const m = ymdSlash[2].padStart(2, '0');
    const d = ymdSlash[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return clean;
}

export interface DatePresetItem {
  label: string;
  startDate: string;
  endDate: string;
}

/**
 * Menghasilkan preset rentang tanggal dinamis sesuai tanggal real-time saat ini
 */
export function getDynamicDatePresets(now: Date = new Date()): DatePresetItem[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayISO = getTodayDateISO(now);

  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed
  const curMonthLastDay = new Date(curYear, curMonth + 1, 0).getDate();
  const curMonthName = BULAN_INDO[curMonth]?.slice(0, 3) || '';
  const thisMonthStart = `${curYear}-${pad(curMonth + 1)}-01`;
  const thisMonthEnd = `${curYear}-${pad(curMonth + 1)}-${pad(curMonthLastDay)}`;

  const prevDate = new Date(curYear, curMonth - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();
  const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
  const prevMonthName = BULAN_INDO[prevMonth]?.slice(0, 3) || '';
  const prevMonthStart = `${prevYear}-${pad(prevMonth + 1)}-01`;
  const prevMonthEnd = `${prevYear}-${pad(prevMonth + 1)}-${pad(prevMonthLastDay)}`;

  return [
    { label: 'Semua Waktu', startDate: '', endDate: '' },
    { label: 'Hari Ini', startDate: todayISO, endDate: todayISO },
    {
      label: `Bulan Ini (${curMonthName})`,
      startDate: thisMonthStart,
      endDate: thisMonthEnd,
    },
    {
      label: `Bulan Lalu (${prevMonthName})`,
      startDate: prevMonthStart,
      endDate: prevMonthEnd,
    },
  ];
}

export function escapeCsvCell(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface DailyHealthCsvReport {
  targetDate: string;
  formattedDate: string;
  filename: string;
  rowCount: number;
  totalIncidents: number;
  pendingCount: number;
  resolvedCount: number;
  csvContent: string;
}

/**
 * Menghasilkan laporan ringkasan insiden kesehatan harian dalam format CSV
 * yang dapat diunduh langsung oleh Musyrif maupun Admin.
 * Bila targetDate dikosongkan (''), seluruh data laporan akan disertakan.
 */
export function generateDailyHealthCsvReport(
  laporanRows: LaporanMusyrifRow[],
  targetDate: string = ''
): DailyHealthCsvReport {
  const cleanDate = targetDate.trim();
  const matchingRows = cleanDate
    ? laporanRows.filter(
        (r) => normalizeDateYYYYMMDD(r.tanggalLaporan) === cleanDate
      )
    : laporanRows;

  const stats = calculateReportOverview(matchingRows);
  const formattedDate = cleanDate
    ? formatTanggalIndo(cleanDate)
    : 'Semua Tanggal';
  const fileSuffix = cleanDate ? cleanDate : 'Semua_Tanggal';
  const filename = `Laporan_Kesehatan_Santri_AlAndalus_${fileSuffix}.csv`;

  const headers = [
    'No',
    'ID_Laporan',
    'Tanggal_Laporan',
    'Timestamp_Input',
    'ID_Santri',
    'Nama_Santri',
    'Kelas',
    'Kamar',
    'Musyrif_Pelapor',
    'Keluhan_Utama',
    'Kategori_Penanganan',
    'Status_Penanganan',
    'Tindakan_UKP',
    'Waktu_Update_UKP',
  ];

  const rowsCsv: string[] = [headers.map(escapeCsvCell).join(',')];

  matchingRows.forEach((row, index) => {
    const isWaiting =
      row.statusPenanganan.trim().toUpperCase() === 'MENUNGGU PENANGANAN';
    const kategori = isWaiting ? 'BELUM DITANGANI' : 'SUDAH TERTANGANI';
    const cells = [
      index + 1,
      row.idLaporan,
      row.tanggalLaporan,
      row.timestamp,
      row.idSantri,
      row.namaSantri,
      row.kelas,
      row.kamar,
      row.namaMusyrif || '-',
      row.keluhanUtama,
      kategori,
      row.statusPenanganan,
      row.tindakanUKP || 'Menunggu Pemeriksaan UKP',
      row.waktuUpdate || '-',
    ];
    rowsCsv.push(cells.map(escapeCsvCell).join(','));
  });

  // Tambahkan blok ringkasan rekap harian di bagian bawah CSV
  rowsCsv.push('');
  rowsCsv.push(
    [
      'RINGKASAN LAPORAN KESEHATAN SANTRI',
      'Pesantren Al-Andalus',
      `Periode: ${formattedDate}`,
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  rowsCsv.push(
    ['Total Insiden Kesehatan', stats.total].map(escapeCsvCell).join(',')
  );
  rowsCsv.push(
    ['Belum Ditangani (Menunggu UKP)', stats.pending]
      .map(escapeCsvCell)
      .join(',')
  );
  rowsCsv.push(
    ['Sudah Tertangani UKP', stats.resolved].map(escapeCsvCell).join(',')
  );
  rowsCsv.push(
    ['Persentase Penanganan', `${stats.resolutionRate}%`]
      .map(escapeCsvCell)
      .join(',')
  );

  return {
    targetDate: cleanDate,
    formattedDate,
    filename,
    rowCount: stats.total,
    totalIncidents: stats.total,
    pendingCount: stats.pending,
    resolvedCount: stats.resolved,
    csvContent: rowsCsv.join('\n'),
  };
}

