import {
  type MasterSantri,
  cleanDisplayName,
  normalizePersonName,
  normalizeDateYYYYMMDD,
  formatTanggalIndo,
  getTodayDateISO,
  escapeCsvCell,
  type DateRangeFilter,
} from './ukpSyncEngine';
import {
  TTD_UST_AZIZ_DATA_URI,
  TTD_UST_AWLY_DATA_URI,
} from './perizinanSignatures';

export { TTD_UST_AZIZ_DATA_URI, TTD_UST_AWLY_DATA_URI };

export interface SantriPerizinanProfile {
  no: string;
  namaSantri: string;
  nis: string;
  kelas: string;
  gedung: string;
  kamar: string;
  pengasuh1: string;
  pengasuh2: string;
  pengasuh3?: string;
  muhafidz?: string;
}

export interface PerizinanRow {
  /** ID unik internal baris perizinan */
  idPerizinan?: string;
  /** Kolom A: Nomor Urut Surat / Perizinan */
  no: string;
  /** Kolom B: Nama Santri */
  nama: string;
  /** Kolom C: Kelas / Rombel (contoh: 11-C, 7-B) */
  kelas: string;
  /** Kolom D: Gedung Asrama (contoh: Abd al-Rahman al-Dakhil, Musa ibn Nusayr) */
  gedung: string;
  /** Kolom E: Nama Kamar (contoh: Isybiliyyah - 7, Saraqusthah - 3) */
  kamar: string;
  /** Kolom F: Kategori Izin (contoh: Berobat / Periksa, Kontrol rutin ke Dokter, Pernikahan Saudara) */
  izin: string;
  /** Kolom G: Keterangan Sakit / Detail Keperluan (contoh: Diare, demam, acara keluarga) */
  keterangan: string;
  /** Kolom H: Tujuan Pulang / Rumah Sakit / Alamat */
  tujuan: string;
  /** Kolom I: Pemberi Rekomendasi (contoh: Dokter, UKP, Wali Santri, Pengasuhan) */
  rekomendasi: string;
  /** Kolom J: Dari Tanggal (YYYY-MM-DD) */
  dariTanggal: string;
  /** Kolom K: Dari Hari (Ahad, Senin, Selasa, Rabu, Kamis, Jum'at, Sabtu) */
  dariHari: string;
  /** Kolom L: Dari Jam (contoh: 08:00) */
  dariJam: string;
  /** Kolom M: Sampai Tanggal (YYYY-MM-DD) */
  sampaiTanggal: string;
  /** Kolom N: Sampai Hari */
  sampaiHari: string;
  /** Kolom O: Sampai Jam (contoh: 17:00) */
  sampaiJam: string;
  /** Kolom P: Durasi (contoh: "3 Hari") */
  durasi: string;
  /** Kolom R: Bulan (contoh: "November") */
  bulan: string;
  /** Kolom S: Pengasuh 1 / Guru Sakan */
  pengasuh1: string;
  /** Kolom T: Pengasuh 2 */
  pengasuh2: string;
  /** Kolom U: Walikelas */
  walikelas: string;
  /** Kolom V: Tiba Tanggal (YYYY-MM-DD jika sudah kembali ke pondok, kosong jika masih izin) */
  tibaTanggal: string;
  /** Kolom W: Keterangan Kedatangan (Tepat Waktu / Terlambat / Catatan / Tag Perpanjangan) */
  keteranganTiba: string;
  /** Penanda apakah izin ini sudah diperpanjang */
  isExtended?: boolean;
  /** Tanggal batas kembali awal sebelum diperpanjang (YYYY-MM-DD) */
  sampaiTanggalAwal?: string;
  /** Alasan perpanjangan masa izin */
  alasanPerpanjangan?: string;
  /** Urutan perpanjangan (contoh: 1, 2) */
  perpanjanganKe?: number;
}

export interface PerizinanInput {
  nama: string;
  kelas: string;
  gedung: string;
  kamar: string;
  izin: string;
  keterangan: string;
  tujuan: string;
  rekomendasi: string;
  dariTanggal: string;
  dariJam: string;
  sampaiTanggal: string;
  sampaiJam: string;
  pengasuh1: string;
  pengasuh2: string;
  walikelas?: string;
}

export const KATEGORI_IZIN_OPTIONS: string[] = [
  'Berobat / Periksa',
  'Kontrol rutin ke Dokter',
  'Kontrol / periksa penyakit dalam',
  'Kontrol / periksa gigi',
  'Kontrol / periksa mata',
  'Pernikahan Saudara',
  'Acara Keluarga',
  'Tes sekolah',
  'Lain-lain',
];

export const REKOMENDASI_OPTIONS: string[] = [
  'Dokter',
  'UKP',
  'Wali Santri',
  'Bagian Pengasuhan',
  'Bagian Kedisiplinan',
];

const HARI_PESANTREN = [
  'Ahad',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  "Jum'at",
  'Sabtu',
];

const BULAN_INDO_LIST = [
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
 * Mengonversi format tanggal M/D/YYYY (seperti "11/8/2026" dari ekspor Google Sheet US locale)
 * atau format tanggal umum menjadi YYYY-MM-DD.
 */
export function normalizePerizinanDate(raw: string): string {
  const clean = String(raw || '').trim();
  if (!clean || clean === '-' || clean === '#N/A') return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Cek apakah M/D/YYYY atau D/M/YYYY
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const first = parseInt(slashMatch[1], 10);
    const second = parseInt(slashMatch[2], 10);
    const year = slashMatch[3];
    // Pada sheet Perizinan_2026-2027, "11/8/2026" dengan Bulan="November" adalah M/D/YYYY (bulan 11, tanggal 8)
    if (first >= 1 && first <= 12 && second >= 1 && second <= 31) {
      return `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`;
    }
  }

  return normalizeDateYYYYMMDD(clean);
}

/**
 * Menghasilkan nama hari pesantren (Ahad, Senin, Selasa, Rabu, Kamis, Jum'at, Sabtu) dari tanggal YYYY-MM-DD
 */
export function getIndonesianDayName(dateStr: string): string {
  const norm = normalizePerizinanDate(dateStr);
  if (!norm || !/^\d{4}-\d{2}-\d{2}$/.test(norm)) return '';
  const [y, m, d] = norm.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return '';
  return HARI_PESANTREN[dt.getDay()] || '';
}

/**
 * Menghasilkan nama bulan dari tanggal YYYY-MM-DD
 */
export function getIndonesianMonthName(dateStr: string): string {
  const norm = normalizePerizinanDate(dateStr);
  if (!norm || !/^\d{4}-\d{2}-\d{2}$/.test(norm)) return '';
  const [, m] = norm.split('-').map(Number);
  return BULAN_INDO_LIST[m - 1] || '';
}

export const getMonthNameID = getIndonesianMonthName;

/**
 * Menghitung durasi izin dalam hari (contoh: "2 Hari", "0 Hari")
 */
export function calculateDurationDays(
  dariTanggal: string,
  sampaiTanggal: string
): string {
  const start = normalizePerizinanDate(dariTanggal);
  const end = normalizePerizinanDate(sampaiTanggal);
  if (
    !start ||
    !end ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end)
  ) {
    return '0 Hari';
  }
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const diffDays = Math.max(0, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)));
  return `${diffDays} Hari`;
}

/**
 * Database referensi profil Gedung, Kamar, Kelas, Pengasuh 1 & Pengasuh 2
 * dari sheet Master Perizinan 2026-2027
 */
export const SANTRI_PERIZINAN_PROFILES: SantriPerizinanProfile[] = [
  {
    no: '162',
    namaSantri: 'Muhammad Fathi Hakeem Gamantik',
    nis: '252610119',
    kelas: '11-C',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 7',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Khanif Al Amin',
  },
  {
    no: '49',
    namaSantri: 'Raskha Alfarisqy Sofyan',
    nis: '262707038',
    kelas: '7-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 3',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    pengasuh3: 'Rudianto',
    muhafidz: 'Muhammad Hamdani',
  },
  {
    no: '74',
    namaSantri: 'Vierzanova Magani Wijayanto',
    nis: '252607045',
    kelas: '8-A',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Almariah - 5',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    pengasuh3: 'Rudianto',
    muhafidz: 'Usmandi',
  },
  {
    no: '58',
    namaSantri: 'Fathan Ibrahim Baen',
    nis: '252607014',
    kelas: '8-A',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Almariah - 4',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    pengasuh3: 'Rudianto',
    muhafidz: "Miftahussu'ud, S.Pd.I.",
  },
  {
    no: '18',
    namaSantri: 'Muhammad Sakha Arrafif',
    nis: '262707035',
    kelas: '7-A',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 1',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    pengasuh3: 'Rudianto',
    muhafidz: "Miftahussu'ud, S.Pd.I.",
  },
  {
    no: '160',
    namaSantri: 'Muhammad Dzaki Arroyan',
    nis: '252610092',
    kelas: '11-C',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 3',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Abdul Aziz',
  },
  {
    no: '133',
    namaSantri: 'Fadlan',
    nis: '232407021',
    kelas: '10-C',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 7',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Abdi Alhalim',
  },
  {
    no: '267',
    namaSantri: 'Athaullah Putra Rooney',
    nis: '252695024',
    kelas: '10-C',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 7',
    pengasuh1: 'Ghiyast Basysyarul Fasya, S.Ag',
    pengasuh2: 'Iki Rezeki',
    pengasuh3: 'Muslimin, S.Pd.',
    muhafidz: 'Khanif Al Amin',
  },
  {
    no: '39',
    namaSantri: 'M. Aqil Dzikri',
    nis: '262707023',
    kelas: '7-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 2',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    pengasuh3: 'Rudianto',
    muhafidz: 'Isman Ardiansyah',
  },
  {
    no: '136',
    namaSantri: 'Harits',
    nis: '232407029',
    kelas: '10-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 6',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Abdi Alhalim',
  },
  {
    no: '255',
    namaSantri: 'Muhammad Luthfi Gunara',
    nis: '242510077',
    kelas: '12-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 4',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    pengasuh3: 'Fajar Kurnia Aljufri',
    muhafidz: 'Fajar Kurnia Aljufri',
  },
  {
    no: '145',
    namaSantri: 'Yazid Zhafran',
    nis: '232407067',
    kelas: '10-C',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 7',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Abdi Alhalim',
  },
  {
    no: '41',
    namaSantri: 'Miqdad Nazran Zain',
    nis: '262707025',
    kelas: '7-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 1',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    pengasuh3: 'Rudianto',
    muhafidz: 'Hafizhuddin Mahfudz',
  },
  {
    no: '140',
    namaSantri: 'Muhammad Alfan Abbasy',
    nis: '232407041',
    kelas: '10-C',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 6',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Rudianto',
  },
  {
    no: '26',
    namaSantri: 'Zeroun Aldric Drastian',
    nis: '262707047',
    kelas: '7-A',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 2',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    pengasuh3: 'Rudianto',
    muhafidz: 'Isman Ardiansyah',
  },
  {
    no: '246',
    namaSantri: 'Gaza Ahmad Al Ghifari',
    nis: '242510062',
    kelas: '12-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 3',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    pengasuh3: 'Fajar Kurnia Aljufri',
    muhafidz: 'Muslimin, S.Pd.',
  },
  {
    no: '221',
    namaSantri: 'Fathul Balaad',
    nis: '242510058',
    kelas: '12-C',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 4',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    pengasuh3: 'Fajar Kurnia Aljufri',
    muhafidz: 'Fajar Kurnia Aljufri',
  },
  {
    no: '336',
    namaSantri: 'Jagat Khoirul Chisam',
    nis: '20250036',
    kelas: '8-B',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Almariah - 5',
    pengasuh1: 'Muhammad Taslim',
    pengasuh2: 'Hafizhuddin Mahfudz',
    pengasuh3: "Miftahussu'ud, S.Pd.I.",
    muhafidz: 'Muhammad Taslim',
  },
  {
    no: '199',
    namaSantri: 'Harun Yahya Aska',
    nis: '252610076',
    kelas: '11-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 4',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    pengasuh3: 'Fajar Kurnia Aljufri',
    muhafidz: 'Supandi',
  },
  {
    no: '245',
    namaSantri: 'Fawwaz Sakha Adirama',
    nis: '242510061',
    kelas: '12-D',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 1',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    pengasuh3: 'Fajar Kurnia Aljufri',
    muhafidz: 'Muslimin, S.Pd.',
  },
  {
    no: '258',
    namaSantri: 'Prayata Nala Firdaus',
    nis: '242510084',
    kelas: '12-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 4',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    pengasuh3: 'Fajar Kurnia Aljufri',
    muhafidz: 'Fajar Kurnia Aljufri',
  },
  {
    no: '148',
    namaSantri: 'Adryan Octwind Dipo Alam',
    nis: '252610050',
    kelas: '11-E',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 2',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Abdi Alhalim',
  },
  {
    no: '291',
    namaSantri: 'Asadel Kiral',
    nis: '20240014',
    kelas: '9-B',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Toledo - 1',
    pengasuh1: 'Ghiyast Basysyarul Fasya, S.Ag',
    pengasuh2: 'Iki Rezeki',
    pengasuh3: 'Muslimin, S.Pd.',
    muhafidz: 'Khanif Al Amin',
  },
  {
    no: '214',
    namaSantri: 'Abdullah Daeng Barang',
    nis: '242510046',
    kelas: '12-C',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 5',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    pengasuh3: 'Fajar Kurnia Aljufri',
    muhafidz: 'Muslimin, S.Pd.',
  },
  {
    no: '315',
    namaSantri: 'Ahmad Azammy',
    nis: '20250021',
    kelas: '8-B',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Almariah - 4',
    pengasuh1: 'Muhammad Taslim',
    pengasuh2: 'Hafizhuddin Mahfudz',
    pengasuh3: 'Hafizhuddin Mahfudz',
    muhafidz: 'Muhammad Taslim',
  },
  {
    no: '301',
    namaSantri: 'Abdullah Azzam',
    nis: '20240005',
    kelas: '9-B',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Toledo - 2',
    pengasuh1: 'Ghiyast Basysyarul Fasya, S.Ag',
    pengasuh2: 'Iki Rezeki',
    pengasuh3: 'Muslimin, S.Pd.',
    muhafidz: 'Khanif Al Amin',
  },
  {
    no: '135',
    namaSantri: 'Habib Zaidan Al Islami',
    nis: '232407026',
    kelas: '10-C',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 7',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Abdi Alhalim',
  },
  {
    no: '150',
    namaSantri: 'Alif Fadly Sutrisno',
    nis: '252610056',
    kelas: '11-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 4',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Abdul Aziz',
  },
  {
    no: '172',
    namaSantri: 'Ahmad Zaki Hawari',
    nis: '252610054',
    kelas: '11-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 4',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Khanif Al Amin',
  },
  {
    no: '31',
    namaSantri: 'Azghan Zidane Musandria',
    nis: '262707009',
    kelas: '7-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 1',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    pengasuh3: 'Rudianto',
    muhafidz: 'Iki Rezeki',
  },
  {
    no: '196',
    namaSantri: 'Azzam Saefulloh',
    nis: '252610064',
    kelas: '11-C',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 3',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    pengasuh3: 'Fajar Kurnia Aljufri',
    muhafidz: 'Muslimin, S.Pd.',
  },
  {
    no: '260',
    namaSantri: "Rizki Yusuf'a Mahendra",
    nis: '242510086',
    kelas: '12-C',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Almariah - 6',
    pengasuh1: 'Ghiyast Basysyarul Fasya, S.Ag',
    pengasuh2: 'Iki Rezeki',
    pengasuh3: 'Muslimin, S.Pd.',
    muhafidz: 'Rudianto',
  },
  {
    no: '240',
    namaSantri: 'Ahmad Bin Arifin Saefulloh',
    nis: '242510048',
    kelas: '12-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 5',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    pengasuh3: 'Fajar Kurnia Aljufri',
    muhafidz: 'Fajar Kurnia Aljufri',
  },
  {
    no: '293',
    namaSantri: 'Ziyan Hasan',
    nis: '20240063',
    kelas: '9-B',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Toledo - 1',
    pengasuh1: 'Ghiyast Basysyarul Fasya, S.Ag',
    pengasuh2: 'Iki Rezeki',
    pengasuh3: 'Muslimin, S.Pd.',
    muhafidz: 'Rudianto',
  },
  {
    no: '157',
    namaSantri: 'Keyshen Adam Firmansyah',
    nis: '252610083',
    kelas: '11-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 2',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Abdi Alhalim',
  },
  {
    no: '167',
    namaSantri: 'Rajendra Arsyad Prihadi',
    nis: '252610110',
    kelas: '11-E',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 1',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    pengasuh3: 'Abdul Haris',
    muhafidz: 'Khanif Al Amin',
  },
  {
    no: '270',
    namaSantri: 'Faiz Fathur Rizqi',
    nis: '252695023',
    kelas: '10-C',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 5',
    pengasuh1: 'Ghiyast Basysyarul Fasya, S.Ag',
    pengasuh2: 'Iki Rezeki',
    pengasuh3: 'Muslimin, S.Pd.',
    muhafidz: 'Abdul Haris',
  },
  {
    no: '272',
    namaSantri: 'Ilham Azzamy Muhammad',
    nis: '252695013',
    kelas: '10-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 7',
    pengasuh1: 'Ghiyast Basysyarul Fasya, S.Ag',
    pengasuh2: 'Iki Rezeki',
    pengasuh3: 'Muslimin, S.Pd.',
    muhafidz: 'Khanif Al Amin',
  },
  {
    no: '295',
    namaSantri: 'Sulthan Rindra Alfaridzi',
    nis: '20260044',
    kelas: '7-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 2',
    pengasuh1: 'Ghiyast Basysyarul Fasya, S.Ag',
    pengasuh2: 'Iki Rezeki',
    pengasuh3: 'Muslimin, S.Pd.',
    muhafidz: 'Abdul Aziz',
  },
];

/**
 * Mengindeks gedung dan pengasuh berdasarkan awalan nama kamar bila santri berasal dari Master_Data
 */
export function inferGedungAndPengasuhFromKamar(
  kamar: string,
  kelas: string
): {
  gedung: string;
  pengasuh1: string;
  pengasuh2: string;
} {
  const k = (kamar || '').toLowerCase();
  const c = (kelas || '').toLowerCase();

  if (k.includes('saraqusthah') || k.includes('cordoba')) {
    if (c.startsWith('7')) {
      return {
        gedung: 'Musa ibn Nusayr',
        pengasuh1: 'Khanif Al Amin',
        pengasuh2: 'Adi Erwandi, A.Md.',
      };
    }
    return {
      gedung: 'Musa ibn Nusayr',
      pengasuh1: 'Abdi Alhalim',
      pengasuh2: 'Supandi',
    };
  }
  if (
    k.includes('isybiliyyah') ||
    k.includes('gharnathah') ||
    k.includes('gharnatah') ||
    k.includes('granada') ||
    k.includes('sevilla')
  ) {
    return {
      gedung: 'Abd al-Rahman al-Dakhil',
      pengasuh1: 'Andre Abdullah Faqih',
      pengasuh2: 'Muhammad Hamdani',
    };
  }
  if (k.includes('almariah') || k.includes('toledo') || k.includes('malaga')) {
    return {
      gedung: 'Al-Walid ibn Abd al-Malik',
      pengasuh1: 'Isman Ardiansyah',
      pengasuh2: 'Nendi Kurnia',
    };
  }

  return {
    gedung: 'Musa ibn Nusayr',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
  };
}

/**
 * Mengambil data santri langsung dari sheet database Master_Data (sama persis seperti Izin Sakit),
 * lalu melengkapi informasi Gedung & Pengasuh berdasarkan Kamar/Kelas santri.
 */
export function searchSantriForPerizinan(
  query: string,
  masterData: MasterSantri[]
): SantriPerizinanProfile[] {
  // Indeks referensi tambahan untuk gedung & pengasuh bila nama cocok
  const refLookup = new Map<string, SantriPerizinanProfile>();
  for (const p of SANTRI_PERIZINAN_PROFILES) {
    const key = normalizePersonName(p.namaSantri);
    if (key) {
      refLookup.set(key, p);
    }
  }

  const masterProfiles: SantriPerizinanProfile[] = [];
  const seenKeys = new Set<string>();

  // Utamakan 100% daftar santri dari sheet Master_Data (sama seperti fitur Izin Sakit)
  for (const m of masterData) {
    const cleanName = cleanDisplayName(m.namaSantri);
    const key = normalizePersonName(cleanName);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const ref = refLookup.get(key);
    const kamarVal = (m.kamar || ref?.kamar || '-').trim();
    const kelasVal = (m.kelas || ref?.kelas || '-').trim();
    const inferred = inferGedungAndPengasuhFromKamar(kamarVal, kelasVal);

    masterProfiles.push({
      no: m.idSantri || ref?.no || '-',
      namaSantri: cleanName,
      nis: m.idSantri || ref?.nis || '-',
      kelas: kelasVal,
      gedung: ref?.gedung || inferred.gedung,
      kamar: kamarVal,
      pengasuh1: ref?.pengasuh1 || inferred.pengasuh1,
      pengasuh2: ref?.pengasuh2 || inferred.pengasuh2,
    });
  }

  // Fallback hanya jika masterData benar-benar kosong
  const sourceList =
    masterProfiles.length > 0 ? masterProfiles : SANTRI_PERIZINAN_PROFILES;

  const q = normalizePersonName(query);
  if (!q) return sourceList;

  return sourceList.filter(
    (s) =>
      normalizePersonName(s.namaSantri).includes(q) ||
      s.kelas.toLowerCase().includes(q) ||
      s.kamar.toLowerCase().includes(q) ||
      s.gedung.toLowerCase().includes(q) ||
      s.nis.toLowerCase().includes(q)
  );
}

/**
 * Data awal Perizinan sesuai 36 data riil pada Perizinan_2026-2027 - Perizinan.csv
 */
export const INITIAL_PERIZINAN_DATA: PerizinanRow[] = [
  {
    no: '1',
    nama: 'Muhammad Fathi Hakeem Gamantik',
    kelas: '11-C',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 7',
    izin: 'Berobat / Periksa',
    keterangan: 'Diare',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-09',
    sampaiHari: 'Senin',
    sampaiJam: '17:00',
    durasi: '1 Hari',
    bulan: 'November',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    walikelas: '-',
    tibaTanggal: '2026-11-08',
    keteranganTiba: 'Tepat Waktu',
  },
  {
    no: '2',
    nama: 'Raskha Alfarisqy Sofyan',
    kelas: '7-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 3',
    izin: 'Berobat / Periksa',
    keterangan: 'demam berdarah',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-11',
    dariHari: 'Rabu',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-11',
    sampaiHari: 'Rabu',
    sampaiJam: '17:00',
    durasi: '0 Hari',
    bulan: 'November',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '3',
    nama: 'Vierzanova Magani Wijayanto',
    kelas: '8-A',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Almariah - 5',
    izin: 'Berobat / Periksa',
    keterangan: 'diare, demam',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-06',
    dariHari: "Jum'at",
    dariJam: '08:00',
    sampaiTanggal: '2026-11-11',
    sampaiHari: 'Rabu',
    sampaiJam: '17:00',
    durasi: '5 Hari',
    bulan: 'November',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '4',
    nama: 'Fathan Ibrahim Baen',
    kelas: '8-A',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Almariah - 4',
    izin: 'Berobat / Periksa',
    keterangan: 'diare, demam',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-10',
    sampaiHari: 'Selasa',
    sampaiJam: '17:00',
    durasi: '2 Hari',
    bulan: 'November',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '5',
    nama: 'Muhammad Sakha Arrafif',
    kelas: '7-A',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 1',
    izin: 'Berobat / Periksa',
    keterangan: 'diare',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-10',
    sampaiHari: 'Selasa',
    sampaiJam: '17:00',
    durasi: '2 Hari',
    bulan: 'November',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '6',
    nama: 'Muhammad Dzaki Arroyan',
    kelas: '11-C',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 3',
    izin: 'Berobat / Periksa',
    keterangan: 'diare',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-10',
    sampaiHari: 'Selasa',
    sampaiJam: '17:00',
    durasi: '2 Hari',
    bulan: 'November',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '7',
    nama: 'Fadlan',
    kelas: '10-C',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 7',
    izin: 'Berobat / Periksa',
    keterangan: 'demam',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-10',
    sampaiHari: 'Selasa',
    sampaiJam: '17:00',
    durasi: '2 Hari',
    bulan: 'November',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '8',
    nama: 'Athaullah Putra Rooney',
    kelas: '10-C',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 7',
    izin: 'Berobat / Periksa',
    keterangan: 'demam',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-11',
    sampaiHari: 'Rabu',
    sampaiJam: '17:00',
    durasi: '3 Hari',
    bulan: 'November',
    pengasuh1: 'Ghiyast Basysyarul Fasya, S.Ag',
    pengasuh2: 'Iki Rezeki',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '9',
    nama: 'M. Aqil Dzikri',
    kelas: '7-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 2',
    izin: 'Kontrol / periksa penyakit dalam',
    keterangan: 'sesak napas',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-07',
    dariHari: 'Sabtu',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-09',
    sampaiHari: 'Senin',
    sampaiJam: '17:00',
    durasi: '2 Hari',
    bulan: 'November',
    pengasuh1: 'Khanif Al Amin',
    pengasuh2: 'Adi Erwandi, A.Md.',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '10',
    nama: 'Harits',
    kelas: '10-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 6',
    izin: 'Berobat / Periksa',
    keterangan: 'gigi bolong',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-07',
    dariHari: 'Sabtu',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-10',
    sampaiHari: 'Selasa',
    sampaiJam: '17:00',
    durasi: '3 Hari',
    bulan: 'November',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    walikelas: '-',
    tibaTanggal: '2026-11-10',
    keteranganTiba: 'Tepat Waktu',
  },
  {
    no: '11',
    nama: 'Muhammad Luthfi Gunara',
    kelas: '12-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 4',
    izin: 'Berobat / Periksa',
    keterangan: 'diare',
    tujuan: '',
    rekomendasi: 'UKP',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-10',
    sampaiHari: 'Selasa',
    sampaiJam: '17:00',
    durasi: '2 Hari',
    bulan: 'November',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '16',
    nama: 'Gaza Ahmad Al Ghifari',
    kelas: '12-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 3',
    izin: 'Lain-lain',
    keterangan: 'jenguk dan urus berkas',
    tujuan: '',
    rekomendasi: 'Wali Santri',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-10',
    sampaiHari: 'Selasa',
    sampaiJam: '17:00',
    durasi: '2 Hari',
    bulan: 'November',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '17',
    nama: 'Fathul Balaad',
    kelas: '12-C',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 4',
    izin: 'Berobat / Periksa',
    keterangan: 'amandel',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-07',
    dariHari: 'Sabtu',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-09',
    sampaiHari: 'Senin',
    sampaiJam: '17:00',
    durasi: '2 Hari',
    bulan: 'November',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '18',
    nama: 'Jagat Khoirul Chisam',
    kelas: '8-B',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Almariah - 5',
    izin: 'Kontrol rutin ke Dokter',
    keterangan: 'gigi',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-09',
    sampaiHari: 'Senin',
    sampaiJam: '17:00',
    durasi: '1 Hari',
    bulan: 'November',
    pengasuh1: 'Muhammad Taslim',
    pengasuh2: 'Hafizhuddin Mahfudz',
    walikelas: '-',
    tibaTanggal: '2026-11-10',
    keteranganTiba: 'Sudah Kembali',
  },
  {
    no: '19',
    nama: 'Harun Yahya Aska',
    kelas: '11-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 4',
    izin: 'Berobat / Periksa',
    keterangan: 'demam',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-10',
    sampaiHari: 'Selasa',
    sampaiJam: '17:00',
    durasi: '2 Hari',
    bulan: 'November',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    walikelas: '-',
    tibaTanggal: '2026-11-10',
    keteranganTiba: 'Tepat Waktu',
  },
  {
    no: '20',
    nama: 'Fawwaz Sakha Adirama',
    kelas: '12-D',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Saraqusthah - 1',
    izin: 'Berobat / Periksa',
    keterangan: 'demam',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-02',
    dariHari: 'Senin',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-11',
    sampaiHari: 'Rabu',
    sampaiJam: '17:00',
    durasi: '9 Hari',
    bulan: 'November',
    pengasuh1: 'Andre Abdullah Faqih',
    pengasuh2: 'Muhammad Hamdani',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '22',
    nama: 'Adryan Octwind Dipo Alam',
    kelas: '11-E',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 2',
    izin: 'Kontrol rutin ke Dokter',
    keterangan: 'Kontrol kesehatan',
    tujuan: 'Dokter',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-06',
    dariHari: "Jum'at",
    dariJam: '0:00',
    sampaiTanggal: '2026-11-09',
    sampaiHari: 'Senin',
    sampaiJam: '17:00',
    durasi: '3 Hari',
    bulan: 'November',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '23',
    nama: 'Asadel Kiral',
    kelas: '9-B',
    gedung: 'Al-Walid ibn Abd al-Malik',
    kamar: 'Toledo - 1',
    izin: 'Pernikahan Saudara',
    keterangan: 'acara keluarga',
    tujuan: '',
    rekomendasi: 'Wali Santri',
    dariTanggal: '2026-11-07',
    dariHari: 'Sabtu',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-10',
    sampaiHari: 'Selasa',
    sampaiJam: '17:00',
    durasi: '3 Hari',
    bulan: 'November',
    pengasuh1: 'Ghiyast Basysyarul Fasya, S.Ag',
    pengasuh2: 'Iki Rezeki',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
  {
    no: '35',
    nama: 'Keyshen Adam Firmansyah',
    kelas: '11-D',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 2',
    izin: 'Berobat / Periksa',
    keterangan: 'diare',
    tujuan: '',
    rekomendasi: 'Dokter',
    dariTanggal: '2026-11-08',
    dariHari: 'Ahad',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-10',
    sampaiHari: 'Selasa',
    sampaiJam: '17:00',
    durasi: '2 Hari',
    bulan: 'November',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    walikelas: '-',
    tibaTanggal: '2026-11-10',
    keteranganTiba: 'Tepat Waktu',
  },
  {
    no: '36',
    nama: 'Rajendra Arsyad Prihadi',
    kelas: '11-E',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Gharnathah - 1',
    izin: 'Berobat / Periksa',
    keterangan: 'sesak napas',
    tujuan: '',
    rekomendasi: 'UKP',
    dariTanggal: '2026-11-10',
    dariHari: 'Selasa',
    dariJam: '08:00',
    sampaiTanggal: '2026-11-13',
    sampaiHari: "Jum'at",
    sampaiJam: '17:00',
    durasi: '3 Hari',
    bulan: 'November',
    pengasuh1: 'Abdi Alhalim',
    pengasuh2: 'Supandi',
    walikelas: '-',
    tibaTanggal: '',
    keteranganTiba: '',
  },
];

export type PerizinanStatusType = 'RETURNED' | 'OVERDUE' | 'ACTIVE';

/**
 * Menentukan status kepulangan santri:
 * - 'RETURNED': Kolom `tibaTanggal` sudah terisi
 * - 'OVERDUE': Belum kembali dan `sampaiTanggal < todayISO`
 * - 'ACTIVE': Sedang izin pulang dan masih dalam batas tanggal izin
 */
export function getPerizinanStatus(
  row: PerizinanRow,
  todayISO: string = getTodayDateISO()
): PerizinanStatusType {
  const tiba = normalizePerizinanDate(row.tibaTanggal);
  if (tiba) {
    return 'RETURNED';
  }
  const sampai = normalizePerizinanDate(row.sampaiTanggal);
  const today = normalizePerizinanDate(todayISO);
  if (sampai && today && sampai < today) {
    return 'OVERDUE';
  }
  return 'ACTIVE';
}

export interface PerizinanOverviewStats {
  total: number;
  activeOut: number;
  overdue: number;
  returned: number;
  returnRate: number;
}

export function calculatePerizinanOverview(
  rows: PerizinanRow[],
  todayISO: string = getTodayDateISO()
): PerizinanOverviewStats {
  const total = rows.length;
  let activeOut = 0;
  let overdue = 0;
  let returned = 0;

  for (const r of rows) {
    const st = getPerizinanStatus(r, todayISO);
    if (st === 'RETURNED') {
      returned++;
    } else if (st === 'OVERDUE') {
      overdue++;
      activeOut++;
    } else {
      activeOut++;
    }
  }

  const returnRate = total > 0 ? Math.round((returned / total) * 100) : 0;
  return {
    total,
    activeOut,
    overdue,
    returned,
    returnRate,
  };
}

export function createPerizinanRow(
  input: PerizinanInput,
  nextNo: number
): PerizinanRow {
  const dariTanggal = normalizePerizinanDate(input.dariTanggal);
  const sampaiTanggal = normalizePerizinanDate(input.sampaiTanggal);
  return {
    no: String(nextNo),
    nama: cleanDisplayName(input.nama),
    kelas: input.kelas.trim(),
    gedung: input.gedung.trim(),
    kamar: input.kamar.trim(),
    izin: input.izin.trim() || 'Berobat / Periksa',
    keterangan: input.keterangan.trim(),
    tujuan: input.tujuan.trim(),
    rekomendasi: input.rekomendasi.trim() || 'Dokter',
    dariTanggal,
    dariHari: getIndonesianDayName(dariTanggal),
    dariJam: input.dariJam.trim() || '08:00',
    sampaiTanggal,
    sampaiHari: getIndonesianDayName(sampaiTanggal),
    sampaiJam: input.sampaiJam.trim() || '17:00',
    durasi: calculateDurationDays(dariTanggal, sampaiTanggal),
    bulan: getIndonesianMonthName(dariTanggal),
    pengasuh1: input.pengasuh1.trim() || '-',
    pengasuh2: input.pengasuh2.trim() || '-',
    walikelas: (input.walikelas || '-').trim(),
    tibaTanggal: '',
    keteranganTiba: '',
  };
}

export function getPerizinanRowKey(row: PerizinanRow): string {
  return `${String(row.no || '').trim()}||${normalizePersonName(row.nama)}||${normalizePerizinanDate(row.dariTanggal)}`;
}

export function filterPerizinanByDateAndName(
  rows: PerizinanRow[],
  range: DateRangeFilter,
  nameQuery: string
): PerizinanRow[] {
  const start = normalizePerizinanDate(range.startDate);
  const end = normalizePerizinanDate(range.endDate);
  const q = normalizePersonName(nameQuery);

  return rows.filter((row) => {
    const tgl = normalizePerizinanDate(row.dariTanggal);
    if (start && (!tgl || tgl < start)) return false;
    if (end && (!tgl || tgl > end)) return false;

    if (q) {
      const nama = normalizePersonName(row.nama);
      const kelas = (row.kelas || '').toLowerCase();
      const kamar = (row.kamar || '').toLowerCase();
      const gedung = (row.gedung || '').toLowerCase();
      const izin = (row.izin || '').toLowerCase();
      const ket = (row.keterangan || '').toLowerCase();
      if (
        !nama.includes(q) &&
        !kelas.includes(q) &&
        !kamar.includes(q) &&
        !gedung.includes(q) &&
        !izin.includes(q) &&
        !ket.includes(q)
      ) {
        return false;
      }
    }

    return true;
  });
}

export interface PerizinanWhatsAppReport {
  targetDate: string;
  formattedDate: string;
  count: number;
  activeCount: number;
  returnedCount: number;
  overdueCount: number;
  text: string;
  waUrl: string;
  includedRows: PerizinanRow[];
}

/**
 * Menghasilkan format teks Rekap Perizinan Pulang Santri untuk dikirim ke WhatsApp
 */
export function generatePerizinanWhatsAppReport(
  rows: PerizinanRow[],
  targetDate: string = '',
  filterMode: 'ACTIVE_ONLY' | 'DATE_MATCH' | 'ALL' = 'ACTIVE_ONLY',
  phoneNumber: string = '',
  todayISO: string = getTodayDateISO()
): PerizinanWhatsAppReport {
  const cleanDate = normalizePerizinanDate(targetDate);
  const formattedDate = cleanDate
    ? formatTanggalIndo(cleanDate)
    : formatTanggalIndo(todayISO);

  const includedRows = rows.filter((r) => {
    const st = getPerizinanStatus(r, todayISO);
    if (filterMode === 'ACTIVE_ONLY') {
      return st !== 'RETURNED';
    }
    if (filterMode === 'DATE_MATCH' && cleanDate) {
      return (
        normalizePerizinanDate(r.dariTanggal) === cleanDate ||
        normalizePerizinanDate(r.sampaiTanggal) === cleanDate
      );
    }
    return true;
  });

  const stats = calculatePerizinanOverview(includedRows, todayISO);

  const subtitleMode =
    filterMode === 'ACTIVE_ONLY'
      ? 'Daftar Santri Sedang Izin Pulang (Belum Kembali)'
      : filterMode === 'DATE_MATCH' && cleanDate
      ? `Tanggal Izin: ${formattedDate}`
      : 'Seluruh Data Perizinan Santri';

  const lines: string[] = [
    '*LAPORAN PERIZINAN PULANG SANTRI*',
    '*Pesantren Islam Internasional Al-Andalus*',
    `${subtitleMode}`,
    `Update: ${formattedDate}`,
    '',
  ];

  if (includedRows.length === 0) {
    lines.push(
      'Alhamdulillah, tidak ada santri yang sedang izin pulang pada filter ini (Nihil).'
    );
  } else {
    includedRows.forEach((row, idx) => {
      const st = getPerizinanStatus(row, todayISO);
      const extInfo = parsePerpanjanganInfo(row);
      const extBadge = extInfo.isExtended
        ? ` [DIPERPANJANG #${extInfo.perpanjanganKe} s/d ${row.sampaiTanggal}]`
        : '';
      const statusLabel =
        st === 'RETURNED'
          ? `[SUDAH TIBA: ${row.tibaTanggal}]`
          : st === 'OVERDUE'
          ? `[BELUM KEMBALI - LEWAT BATAS]${extBadge}`
          : `[SEDANG IZIN]${extBadge}`;
      const keperluanText = formatKeperluanTujuan(row);
      const jadwalText = `${row.dariHari || ''} ${row.dariTanggal || '-'} s/d ${row.sampaiHari || ''} ${row.sampaiTanggal || '-'} (${row.durasi || '0 Hari'})`.trim();

      lines.push(
        `${idx + 1}. *${row.nama}* (${row.kelas} · ${row.kamar}) — ${keperluanText || 'Izin Pulang'} | Jadwal: ${jadwalText} ${statusLabel}`
      );
    });
  }

  lines.push('');
  lines.push(
    `Ringkasan: Total ${stats.total} Santri (Sedang Izin: ${stats.activeOut}, Terlambat: ${stats.overdue}, Sudah Kembali: ${stats.returned})`
  );
  lines.push('Bagian Kedisiplinan & Pengasuhan Pesantren Al-Andalus');

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
    activeCount: stats.activeOut,
    returnedCount: stats.returned,
    overdueCount: stats.overdue,
    text,
    waUrl,
    includedRows,
  };
}

/**
 * Mengekstrak informasi perpanjangan masa izin baik dari properti langsung
 * maupun dari tag `[PERPANJANGAN ...]` yang tersimpan di kolom keteranganTiba Google Sheets.
 */
export interface PerpanjanganInfo {
  isExtended: boolean;
  sampaiTanggalBaru: string;
  sampaiJamBaru: string;
  sampaiTanggalAwal: string;
  alasanPerpanjangan: string;
  perpanjanganKe: number;
}

export function parsePerpanjanganInfo(row: PerizinanRow): PerpanjanganInfo {
  const ketTiba = String(row.keteranganTiba || '').trim();
  const tagMatch = ketTiba.match(
    /\[PERPANJANGAN(?:\s*#(\d+))?\s+s\/d\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}))?(?:\s*\|\s*Awal:\s*(\d{4}-\d{2}-\d{2}))?(?:\s*\|\s*Alasan:\s*([^\]]+))?\]/i
  );

  if (row.isExtended || tagMatch) {
    const ke =
      row.perpanjanganKe ||
      (tagMatch && tagMatch[1] ? parseInt(tagMatch[1], 10) : 1) ||
      1;
    const tglBaru = normalizePerizinanDate(
      (tagMatch && tagMatch[2]) || row.sampaiTanggal
    );
    const jamBaru = (tagMatch && tagMatch[3]) || row.sampaiJam || '17:00';
    const tglAwal = normalizePerizinanDate(
      row.sampaiTanggalAwal || (tagMatch && tagMatch[4]) || row.sampaiTanggal
    );
    const alasan =
      (row.alasanPerpanjangan || (tagMatch && tagMatch[5]) || '').trim();

    return {
      isExtended: true,
      sampaiTanggalBaru: tglBaru,
      sampaiJamBaru: jamBaru,
      sampaiTanggalAwal: tglAwal,
      alasanPerpanjangan: alasan,
      perpanjanganKe: ke,
    };
  }

  return {
    isExtended: false,
    sampaiTanggalBaru: normalizePerizinanDate(row.sampaiTanggal),
    sampaiJamBaru: row.sampaiJam || '17:00',
    sampaiTanggalAwal: normalizePerizinanDate(row.sampaiTanggal),
    alasanPerpanjangan: '',
    perpanjanganKe: 0,
  };
}

/**
 * Menerapkan perpanjangan masa izin pada suatu baris PerizinanRow:
 * - Memperbarui sampaiTanggal, sampaiHari, sampaiJam, dan durasi
 * - Menyimpan batas kembali awal (sampaiTanggalAwal) & alasanPerpanjangan
 * - Menyimpan tag [PERPANJANGAN ...] ke keteranganTiba agar tersimpan permanen di Google Sheets
 */
export function applyPerpanjanganMasaIzin(
  row: PerizinanRow,
  sampaiTanggalBaruRaw: string,
  sampaiJamBaruRaw: string = '17:00',
  alasanPerpanjanganRaw: string = ''
): PerizinanRow {
  const prevInfo = parsePerpanjanganInfo(row);
  const sampaiTanggalBaru = normalizePerizinanDate(sampaiTanggalBaruRaw);
  const sampaiJamBaru = (sampaiJamBaruRaw || row.sampaiJam || '17:00').trim();
  const sampaiTanggalAwal =
    prevInfo.isExtended && prevInfo.sampaiTanggalAwal
      ? prevInfo.sampaiTanggalAwal
      : normalizePerizinanDate(row.sampaiTanggal);
  const perpanjanganKe = prevInfo.perpanjanganKe + 1;
  const alasanPerpanjangan = alasanPerpanjanganRaw.trim();

  const sampaiHariBaru = getIndonesianDayName(sampaiTanggalBaru);
  const durasiBaru = calculateDurationDays(row.dariTanggal, sampaiTanggalBaru);

  const tagParts = [
    `PERPANJANGAN #${perpanjanganKe} s/d ${sampaiTanggalBaru} ${sampaiJamBaru}`,
    `Awal: ${sampaiTanggalAwal}`,
  ];
  if (alasanPerpanjangan) {
    tagParts.push(`Alasan: ${alasanPerpanjangan}`);
  }
  const tagString = `[${tagParts.join(' | ')}]`;

  return {
    ...row,
    sampaiTanggal: sampaiTanggalBaru,
    sampaiHari: sampaiHariBaru,
    sampaiJam: sampaiJamBaru,
    durasi: durasiBaru,
    tibaTanggal: '',
    keteranganTiba: tagString,
    isExtended: true,
    sampaiTanggalAwal,
    alasanPerpanjangan,
    perpanjanganKe,
  };
}

/**
 * Menghasilkan file CSV Rekap Perizinan sesuai struktur 23 kolom Perizinan_2026-2027
 */
export function generatePerizinanCsvReport(
  rows: PerizinanRow[],
  periodLabel: string = 'Semua_Data'
): { filename: string; csvContent: string } {
  const headers = [
    'No',
    'Nama',
    'Kelas',
    'Gedung',
    'Kamar',
    'Izin',
    'Keterangan',
    'Tujuan',
    'Rekomendasi',
    'Dari Tanggal',
    'Dari Hari',
    'Dari Jam',
    'Sampai Tanggal',
    'Sampai Hari',
    'Sampai Jam',
    'Durasi',
    'Bulan',
    'Pengasuh 1',
    'Pengasuh 2',
    'Walikelas',
    'Tiba Tanggal',
    'Keterangan Tiba',
  ];

  const csvRows: string[] = [headers.map(escapeCsvCell).join(',')];

  rows.forEach((r) => {
    const cells = [
      r.no,
      r.nama,
      r.kelas,
      r.gedung,
      r.kamar,
      r.izin,
      r.keterangan,
      r.tujuan,
      r.rekomendasi,
      r.dariTanggal,
      r.dariHari,
      r.dariJam,
      r.sampaiTanggal,
      r.sampaiHari,
      r.sampaiJam,
      r.durasi,
      r.bulan,
      r.pengasuh1,
      r.pengasuh2,
      r.walikelas,
      r.tibaTanggal,
      r.keteranganTiba,
    ];
    csvRows.push(cells.map(escapeCsvCell).join(','));
  });

  return {
    filename: `Rekap_Perizinan_Santri_AlAndalus_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`,
    csvContent: csvRows.join('\n'),
  };
}

/**
 * Memformat tanggal YYYY-MM-DD ke bentuk "16 September 2026" (sesuai Surat Izin Santri resmi)
 */
export function formatSuratDateIndo(dateStr: string): string {
  const norm = normalizePerizinanDate(dateStr);
  if (!norm || !/^\d{4}-\d{2}-\d{2}$/.test(norm)) return dateStr || '-';
  const [y, m, d] = norm.split('-').map(Number);
  const monthName = BULAN_INDO_LIST[m - 1] || '';
  return `${d} ${monthName} ${y}`;
}

/**
 * Menyusun teks "Keperluan / Tujuan" pada Surat Izin Santri
 */
export function formatKeperluanTujuan(row: PerizinanRow): string {
  const extInfo = parsePerpanjanganInfo(row);
  const parts = [row.izin, row.keterangan, row.tujuan]
    .map((s) => String(s || '').trim())
    .filter((s) => Boolean(s) && s !== '-');

  if (extInfo.isExtended && extInfo.alasanPerpanjangan) {
    parts.push(`Perpanjangan: ${extInfo.alasanPerpanjangan}`);
  }

  // Hilangkan duplikasi kata yang sama persis
  const uniqueParts: string[] = [];
  for (const p of parts) {
    if (!uniqueParts.some((u) => u.toLowerCase() === p.toLowerCase())) {
      uniqueParts.push(p);
    }
  }
  return uniqueParts.join(' — ') || '-';
}

/**
 * Menghasilkan nama surat / nama file sesuai format "Nama Anak + Kelas"
 * Contoh: "Khosyi Arkana Wicaksono - 7A" atau "Khosyi Arkana Wicaksono - 7A.png"
 */
export function getSuratIzinFileName(
  row: Pick<PerizinanRow, 'nama' | 'kelas'>,
  extension?: 'png' | 'pdf'
): string {
  const cleanNama = cleanDisplayName(row.nama || 'Santri')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
  const cleanKelas = String(row.kelas || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
  const baseName = cleanKelas ? `${cleanNama} - ${cleanKelas}` : cleanNama;
  return extension ? `${baseName}.${extension}` : baseName;
}

export interface SingleSuratWhatsAppPayload {
  suratName: string;
  fileNamePng: string;
  fileNamePdf: string;
  text: string;
  waUrl: string;
}

/**
 * Menghasilkan pesan WhatsApp & tautan otomatis untuk pengiriman 1 Surat Izin Santri
 * dengan nama surat sesuai "Nama Anak + Kelas" (mendukung format Perpanjangan Masa Izin)
 */
export function generateSingleSuratWhatsAppPayload(
  row: PerizinanRow,
  phoneNumber: string = '',
  kasiKedisiplinan: string = 'Ust. Abdul Aziz',
  kabidKepengasuhan: string = 'Ust. Muhammad Awly Yusuf, S.Pd.'
): SingleSuratWhatsAppPayload {
  const suratName = getSuratIzinFileName(row);
  const fileNamePng = getSuratIzinFileName(row, 'png');
  const fileNamePdf = getSuratIzinFileName(row, 'pdf');
  const keperluanTujuan = formatKeperluanTujuan(row);
  const izinDariFormatted = formatSuratDateIndo(row.dariTanggal);
  const sampaiFormatted = formatSuratDateIndo(row.sampaiTanggal);
  const extInfo = parsePerpanjanganInfo(row);

  const headerTitle = extInfo.isExtended
    ? `*SURAT PERPANJANGAN IZIN SANTRI — ${suratName}*`
    : `*SURAT IZIN SANTRI — ${suratName}*`;

  const nomorLabel = extInfo.isExtended
    ? `${row.no} (Perpanjangan Ke-${extInfo.perpanjanganKe})`
    : `${row.no}`;

  const lines: string[] = [
    headerTitle,
    '*PESANTREN ISLAM INTERNASIONAL AL-ANDALUS*',
    '*BAGIAN KEDISIPLINAN*',
    '----------------------------------------',
    `📄 *Nama Surat* : ${suratName}`,
    `• *Nomor* : ${nomorLabel}`,
    `• *Nama* : ${row.nama}`,
    `• *Kelas* : ${row.kelas}`,
    `• *Kamar* : ${row.kamar}`,
    `• *Keperluan / Tujuan* : ${keperluanTujuan}`,
    `• *Izin Dari* : ${izinDariFormatted}`,
  ];

  if (extInfo.isExtended) {
    lines.push(
      `• *Batas Izin Semula* : ${formatSuratDateIndo(extInfo.sampaiTanggalAwal)}`
    );
    lines.push(`• *Diperpanjang Sampai* : *${sampaiFormatted}*`);
  } else {
    lines.push(`• *Sampai* : ${sampaiFormatted}`);
  }

  lines.push(
    '----------------------------------------',
    `*Kasi. Kedisiplinan* : ${kasiKedisiplinan}`,
    `*Kabid. Kepengasuhan* : ${kabidKepengasuhan}`,
    '',
    '*Catatan:*',
    '1. Surat izin ini sebagai bukti bahwa ananda diberikan izin pulang oleh pesantren',
    '2. Apabila melebihi batas waktu yang telah ditentukan, Bagian kedisiplinan berhak memberikan sanksi sesuai dengan ketentuan yang berlaku',
    '3. Bagi santri yang pulang dengan alasan sakit, wajib melampirkan surat dari dokter paling lambat 1x24 jam sejak surat izin diterbitkan',
    '4. Kasie kedisiplinan berhak memberikan kebijakan khusus terkait penanganan perizinan pulang santri'
  );

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
    suratName,
    fileNamePng,
    fileNamePdf,
    text,
    waUrl,
  };
}

/**
 * Menggambar Surat Izin Santri ke HTML5 Canvas beresolusi tinggi (persis desain resmi Bagian Kedisiplinan)
 * dengan tanda tangan asli Ust. Abdul Aziz & Ust. Muhammad Awly Yusuf, S.Pd. serta dukungan format Perpanjangan Izin.
 */
export async function renderSuratIzinToCanvasBlob(
  row: PerizinanRow,
  logoUrl: string,
  kasiKedisiplinan: string = 'Ust. Abdul Aziz',
  kabidKepengasuhan: string = 'Ust. Muhammad Awly Yusuf, S.Pd.'
): Promise<Blob> {
  const extInfo = parsePerpanjanganInfo(row);
  const scale = 2;
  const width = 760;
  const height = extInfo.isExtended ? 865 : 840;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context tidak tersedia.');
  }
  ctx.scale(scale, scale);

  // Background putih & border abu-abu tipis luar
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  const loadImageSafe = (src: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const [logoImg, sigAzizImg, sigAwlyImg] = await Promise.all([
    loadImageSafe(logoUrl),
    loadImageSafe(TTD_UST_AZIZ_DATA_URI),
    loadImageSafe(TTD_UST_AWLY_DATA_URI),
  ]);

  if (logoImg) {
    ctx.drawImage(logoImg, 42, 26, 56, 74);
    ctx.drawImage(logoImg, width - 98, 26, 56, 74);
  }

  // Kop Surat Tengah
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('PESANTREN ISLAM INTERNASIONAL AL-ANDALUS', width / 2, 56);
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('BAGIAN KEDISIPLINAN', width / 2, 84);

  // Garis tipis pemisah kop
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(28, 114);
  ctx.lineTo(width - 28, 114);
  ctx.stroke();

  // Judul SURAT IZIN SANTRI (atau SURAT PERPANJANGAN IZIN SANTRI)
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillText(
    extInfo.isExtended
      ? 'SURAT IZIN SANTRI (PERPANJANGAN MASA IZIN)'
      : 'SURAT IZIN SANTRI',
    width / 2,
    152
  );

  // Daftar baris data di dalam bingkai hijau
  const fields: Array<[string, string]> = [
    [
      'Nomor',
      extInfo.isExtended
        ? `${row.no || '-'} (Perpanjangan Ke-${extInfo.perpanjanganKe})`
        : String(row.no || '-'),
    ],
    ['Nama', String(row.nama || '-')],
    ['Kelas', String(row.kelas || '-')],
    ['Kamar', String(row.kamar || '-')],
    ['Keperluan / Tujuan', formatKeperluanTujuan(row)],
    ['Izin Dari', formatSuratDateIndo(row.dariTanggal)],
  ];

  if (extInfo.isExtended) {
    fields.push(['Batas Awal', formatSuratDateIndo(extInfo.sampaiTanggalAwal)]);
    fields.push(['Diperpanjang s/d', formatSuratDateIndo(row.sampaiTanggal)]);
  } else {
    fields.push(['Sampai', formatSuratDateIndo(row.sampaiTanggal)]);
  }

  // Bingkai Hijau (#52AD4E)
  const greenX = 28;
  const greenY = 176;
  const greenW = width - 56;
  const greenH = extInfo.isExtended ? 262 : 236;
  ctx.fillStyle = '#52AD4E';
  ctx.fillRect(greenX, greenY, greenW, greenH);

  // Kotak Putih di dalam Bingkai Hijau
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(greenX + 14, greenY + 14, greenW - 28, greenH - 28);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  let rowY = greenY + 42;
  for (const [label, val] of fields) {
    const isHighlight = label === 'Diperpanjang s/d';
    ctx.font = isHighlight
      ? 'bold 15px Arial, sans-serif'
      : '15px Arial, sans-serif';
    ctx.fillText(label, greenX + 30, rowY);
    ctx.fillText(`: ${val}`, greenX + 215, rowY);
    rowY += 27;
  }

  // Tabel Tanda Tangan (2 Kolom: Kasi. Kedisiplinan & Kabid. Kepengasuhan)
  const tableX = 28;
  const tableY = greenY + greenH + 22;
  const tableW = width - 56;
  const col1W = Math.round(tableW * 0.36);
  const col2W = tableW - col1W;
  const headerH = 34;
  const bodyH = 136;

  // Header Hijau Muda (#C5E0B4)
  ctx.fillStyle = '#C5E0B4';
  ctx.fillRect(tableX, tableY, tableW, headerH);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(tableX, tableY, col1W, headerH);
  ctx.strokeRect(tableX + col1W, tableY, col2W, headerH);
  ctx.strokeRect(tableX, tableY + headerH, col1W, bodyH);
  ctx.strokeRect(tableX + col1W, tableY + headerH, col2W, bodyH);

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText('Kasi. Kedisiplinan', tableX + col1W / 2, tableY + 23);
  ctx.fillText(
    'Kabid. Kepengasuhan',
    tableX + col1W + col2W / 2,
    tableY + 23
  );

  // Gambar Tanda Tangan Asli Ust. Abdul Aziz (Kiri)
  if (sigAzizImg) {
    const drawW = 148;
    const drawH = 42;
    const drawX = tableX + (col1W - drawW) / 2;
    const drawY = tableY + headerH + 34;
    ctx.drawImage(sigAzizImg, drawX, drawY, drawW, drawH);
  }

  // Gambar Tanda Tangan Asli Ust. Muhammad Awly Yusuf, S.Pd. (Kanan)
  if (sigAwlyImg) {
    const drawW = 220;
    const drawH = 68;
    const drawX = tableX + col1W + (col2W - drawW) / 2;
    const drawY = tableY + headerH + 20;
    ctx.drawImage(sigAwlyImg, drawX, drawY, drawW, drawH);
  }

  // Nama Pejabat Bergaris Bawah
  ctx.font = '15px Arial, sans-serif';
  ctx.fillStyle = '#000000';
  const kasiY = tableY + headerH + bodyH - 14;
  ctx.fillText(kasiKedisiplinan, tableX + col1W / 2, kasiY);
  const kasiW = ctx.measureText(kasiKedisiplinan).width;
  ctx.beginPath();
  ctx.moveTo(tableX + col1W / 2 - kasiW / 2, kasiY + 3);
  ctx.lineTo(tableX + col1W / 2 + kasiW / 2, kasiY + 3);
  ctx.stroke();

  ctx.fillText(kabidKepengasuhan, tableX + col1W + col2W / 2, kasiY);
  const kabidW = ctx.measureText(kabidKepengasuhan).width;
  ctx.beginPath();
  ctx.moveTo(tableX + col1W + col2W / 2 - kabidW / 2, kasiY + 3);
  ctx.lineTo(tableX + col1W + col2W / 2 + kabidW / 2, kasiY + 3);
  ctx.stroke();

  // Garis Putus-putus (Dotted Line) Pemisah
  const dotY = tableY + headerH + bodyH + 24;
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(28, dotY);
  ctx.lineTo(width - 28, dotY);
  ctx.stroke();
  ctx.restore();

  // Kotak Catatan (1 - 4)
  const catX = 28;
  const catY = dotY + 18;
  const catW = width - 56;
  const catH = 196;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(catX, catY, catW, catH);

  ctx.textAlign = 'left';
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText('Catatan:', catX + 12, catY + 26);

  ctx.font = '13.5px Arial, sans-serif';
  const notes = [
    '1. Surat izin ini sebagai bukti bahwa ananda diberikan izin pulang oleh pesantren',
    '2. Apabila melebihi batas waktu yang telah ditentukan, Bagian kedisiplinan berhak memberikan',
    '    sanksi sesuai dengan ketentuan yang berlaku',
    '3. Bagi santri yang pulang dengan alasan sakit, wajib melampirkan surat dari dokter paling',
    '    lambat 1x24 jam sejak surat izin diterbitkan',
    '4. Kasie kedisiplinan berhak memberikan kebijakan khusus terkait penanganan perizinan',
    '    pulang santri',
  ];
  let noteY = catY + 52;
  for (const line of notes) {
    ctx.fillText(line, catX + 46, noteY);
    noteY += 20;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal membuat gambar Surat Izin.'));
    }, 'image/png');
  });
}

