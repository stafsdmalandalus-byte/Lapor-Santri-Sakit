/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SholatStatus = 'TEPAT' | 'TELAT' | 'ALFA' | 'IZIN';

export interface SholatRow {
  idSholat: string;
  tanggal: string; // YYYY-MM-DD
  nis: string;
  namaSantri: string;
  kelas: string;
  gedung: string;
  kamar: string;
  subuh: SholatStatus;
  dzuhur: SholatStatus;
  ashar: SholatStatus;
  maghrib: SholatStatus;
  isya: SholatStatus;
  pencatat: string;
  timestamp: string;
  keterangan?: string; // Misal: "AKTIF" atau "DIPUTIHKAN (14/11/2026 oleh Admin Pengasuhan)"
}

export interface SholatInput {
  tanggal: string;
  nis: string;
  namaSantri: string;
  kelas: string;
  gedung: string;
  kamar: string;
  subuh: SholatStatus;
  dzuhur: SholatStatus;
  ashar: SholatStatus;
  maghrib: SholatStatus;
  isya: SholatStatus;
  pencatat: string;
}

const STORAGE_KEY_SHOLAT = 'alandalus_sholat_rekap_list_v1';

export const INITIAL_SHOLAT_DATA: SholatRow[] = [
  {
    idSholat: 'SHOLAT-001',
    tanggal: new Date().toISOString().slice(0, 10),
    nis: '1001',
    namaSantri: 'Ahmad Fauzan',
    kelas: '10-A',
    gedung: 'Abd al-Rahman al-Dakhil',
    kamar: 'Isybiliyyah - 1',
    subuh: 'TELAT',
    dzuhur: 'TEPAT',
    ashar: 'TEPAT',
    maghrib: 'TELAT',
    isya: 'TEPAT',
    pencatat: 'Ust. Muhammad Awly',
    timestamp: new Date().toISOString(),
    keterangan: 'AKTIF',
  },
  {
    idSholat: 'SHOLAT-002',
    tanggal: new Date().toISOString().slice(0, 10),
    nis: '1002',
    namaSantri: 'Ibrahim Al-Farisi',
    kelas: '11-B',
    gedung: 'Musa ibn Nusayr',
    kamar: 'Cordoba - 3',
    subuh: 'TEPAT',
    dzuhur: 'TELAT',
    ashar: 'TELAT',
    maghrib: 'TEPAT',
    isya: 'TEPAT',
    pencatat: 'Ust. Abdul Aziz',
    timestamp: new Date().toISOString(),
    keterangan: 'AKTIF',
  },
];

export function isSholatRowPutih(row: SholatRow): boolean {
  const ket = String(row.keterangan || '').toUpperCase();
  return ket.includes('PUTIH') || ket.includes('RESET');
}

export function getSavedSholatList(): SholatRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOLAT);
    if (!raw) return INITIAL_SHOLAT_DATA;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SHOLAT_DATA;
  } catch {
    return INITIAL_SHOLAT_DATA;
  }
}

export function saveSholatListLocally(list: SholatRow[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SHOLAT, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function createSholatRow(input: SholatInput): SholatRow {
  return {
    idSholat: `SHOLAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    tanggal: input.tanggal,
    nis: input.nis || '-',
    namaSantri: input.namaSantri,
    kelas: input.kelas || '-',
    gedung: input.gedung || '-',
    kamar: input.kamar || '-',
    subuh: input.subuh || 'TEPAT',
    dzuhur: input.dzuhur || 'TEPAT',
    ashar: input.ashar || 'TEPAT',
    maghrib: input.maghrib || 'TEPAT',
    isya: input.isya || 'TEPAT',
    pencatat: input.pencatat || 'Admin Pengasuhan',
    timestamp: new Date().toISOString(),
    keterangan: 'AKTIF',
  };
}

export function filterSholatByDateRange(
  list: SholatRow[],
  range: { startDate: string; endDate: string }
): SholatRow[] {
  const { startDate, endDate } = range;
  if (!startDate.trim() && !endDate.trim()) return list;

  return list.filter((row) => {
    const tgl = row.tanggal;
    if (!tgl) return false;
    if (startDate && tgl < startDate) return false;
    if (endDate && tgl > endDate) return false;
    return true;
  });
}
