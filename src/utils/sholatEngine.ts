/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  normalizeDateYYYYMMDD,
  normalizeDateRangeBounds,
} from './ukpSyncEngine';

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
  idSholat?: string;
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
  unlockedPrayers?: Array<'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya'>;
}

export interface SantriSholatSummary {
  namaSantri: string;
  nis: string;
  kelas: string;
  gedung: string;
  kamar: string;
  subuhTelat: number;
  dzuhurTelat: number;
  asharTelat: number;
  maghribTelat: number;
  isyaTelat: number;
  totalTelat: number;
  diputihkanRecords: number;
  tanggalTelatList: string[];
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

export function normalizeSantriKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function getEffectiveSholatDate(row: Pick<SholatRow, 'tanggal' | 'timestamp'>): string {
  const fromTgl = normalizeDateYYYYMMDD(row.tanggal || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromTgl)) return fromTgl;
  const fromTs = normalizeDateYYYYMMDD(row.timestamp || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromTs)) return fromTs;
  return fromTgl;
}

/**
 * Mencari data rekap sholat aktif (belum diputihkan) untuk santri dan tanggal yang sama.
 * Jika ada lebih dari 1 baris lama pada tanggal yang sama, status TELAT akan digabungkan (dikunci).
 */
export function findExistingSholatRecordForDate(
  list: SholatRow[],
  tanggal: string,
  namaSantri: string
): SholatRow | null {
  const safeList = Array.isArray(list) ? list : [];
  const targetDate = normalizeDateYYYYMMDD(tanggal || '');
  const targetName = normalizeSantriKey(namaSantri);
  if (!targetDate || !targetName) return null;

  const matchingRows = safeList.filter(
    (r) =>
      !isSholatRowPutih(r) &&
      getEffectiveSholatDate(r) === targetDate &&
      normalizeSantriKey(r.namaSantri) === targetName
  );

  if (matchingRows.length === 0) return null;

  const primary = matchingRows[0];
  const merged: SholatRow = { ...primary };

  for (const r of matchingRows) {
    if (r.subuh === 'TELAT') merged.subuh = 'TELAT';
    if (r.dzuhur === 'TELAT') merged.dzuhur = 'TELAT';
    if (r.ashar === 'TELAT') merged.ashar = 'TELAT';
    if (r.maghrib === 'TELAT') merged.maghrib = 'TELAT';
    if (r.isya === 'TELAT') merged.isya = 'TELAT';
  }

  return merged;
}

export function getSavedSholatList(preferEmptyIfUnset: boolean = false): SholatRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHOLAT);
    if (!raw) return preferEmptyIfUnset ? [] : INITIAL_SHOLAT_DATA;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.length > 0 || preferEmptyIfUnset ? parsed : INITIAL_SHOLAT_DATA;
    }
    return preferEmptyIfUnset ? [] : INITIAL_SHOLAT_DATA;
  } catch {
    return preferEmptyIfUnset ? [] : INITIAL_SHOLAT_DATA;
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
    idSholat:
      input.idSholat || `SHOLAT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

/**
 * Menambahkan atau memperbarui baris rekap sholat untuk santri & tanggal yang sama
 * agar tidak terjadi duplikasi baris pada tanggal yang sama.
 */
export function upsertSholatRowInList(
  list: SholatRow[],
  newRow: SholatRow
): SholatRow[] {
  const targetDate = getEffectiveSholatDate(newRow);
  const targetName = normalizeSantriKey(newRow.namaSantri);

  let foundIndex = -1;
  const filtered: SholatRow[] = [];

  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const isSameActiveRecord =
      !isSholatRowPutih(r) &&
      (r.idSholat === newRow.idSholat ||
        (getEffectiveSholatDate(r) === targetDate &&
          normalizeSantriKey(r.namaSantri) === targetName));

    if (isSameActiveRecord) {
      if (foundIndex === -1) {
        foundIndex = filtered.length;
        filtered.push({
          ...r,
          ...newRow,
          idSholat: r.idSholat,
        });
      }
      // Jika ada duplikat lama di tanggal & nama yang sama, lewati agar bersih menjadi 1 baris
    } else {
      filtered.push(r);
    }
  }

  if (foundIndex === -1) {
    return [newRow, ...filtered];
  }
  return filtered;
}

export function filterSholatByDateRange(
  list: SholatRow[],
  range: { startDate: string; endDate: string }
): SholatRow[] {
  const safeList = Array.isArray(list) ? list : [];
  const { start, end } = normalizeDateRangeBounds(range);
  if (!start && !end) return safeList;

  return safeList.filter((row) => {
    const tgl = getEffectiveSholatDate(row);
    if (!tgl || !/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return false;
    if (start && tgl < start) return false;
    if (end && tgl > end) return false;
    return true;
  });
}

export function formatSholatDateID(dateStr: string): string {
  const norm = normalizeDateYYYYMMDD(dateStr || '');
  if (!norm || !norm.trim()) return '-';
  const parts = norm.trim().split('-');
  if (parts.length !== 3) return dateStr;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  const mIdx = parseInt(parts[1], 10) - 1;
  const mName = months[mIdx] || parts[1];
  return `${parts[2]} ${mName} ${parts[0]}`;
}

export function formatRincianSholatTelat(st: {
  subuhTelat: number;
  dzuhurTelat: number;
  asharTelat: number;
  maghribTelat: number;
  isyaTelat: number;
}): string {
  const items: string[] = [];
  if (st.subuhTelat > 0) items.push(`Subuh (${st.subuhTelat}x)`);
  if (st.dzuhurTelat > 0) items.push(`Dzuhur (${st.dzuhurTelat}x)`);
  if (st.asharTelat > 0) items.push(`Ashar (${st.asharTelat}x)`);
  if (st.maghribTelat > 0) items.push(`Maghrib (${st.maghribTelat}x)`);
  if (st.isyaTelat > 0) items.push(`Isya (${st.isyaTelat}x)`);
  return items.length > 0 ? items.join(', ') : 'Tidak ada keterlambatan (0x)';
}

export function generateSholatWhatsAppReport(params: {
  summaries: SantriSholatSummary[];
  startDate: string;
  endDate: string;
  mode: 'ALL' | 'SINGLE';
  selectedSantriName?: string;
}): string {
  const { summaries, startDate, endDate, mode, selectedSantriName } = params;

  const periodeLabel =
    startDate && endDate
      ? startDate === endDate
        ? formatSholatDateID(startDate)
        : `${formatSholatDateID(startDate)} s/d ${formatSholatDateID(endDate)}`
      : startDate
      ? `Mulai ${formatSholatDateID(startDate)}`
      : endDate
      ? `Sampai ${formatSholatDateID(endDate)}`
      : 'Semua Tanggal';

  if (mode === 'SINGLE') {
    const targetKey = normalizeSantriKey(selectedSantriName || '');
    const st = summaries.find(
      (s) => normalizeSantriKey(s.namaSantri) === targetKey
    );

    if (!st) {
      return [
        '🕌 *REKAP KETERLAMBATAN SHOLAT SANTRI*',
        '*PESANTREN ISLAM INTERNASIONAL AL-ANDALUS*',
        `🗓️ *Periode:* ${periodeLabel}`,
        '',
        '_Pilih nama santri untuk melihat format laporan WhatsApp._',
      ].join('\n');
    }

    const rincianList: string[] = [];
    if (st.subuhTelat > 0) rincianList.push(`• *Subuh:* ${st.subuhTelat}x`);
    if (st.dzuhurTelat > 0) rincianList.push(`• *Dzuhur:* ${st.dzuhurTelat}x`);
    if (st.asharTelat > 0) rincianList.push(`• *Ashar:* ${st.asharTelat}x`);
    if (st.maghribTelat > 0) rincianList.push(`• *Maghrib:* ${st.maghribTelat}x`);
    if (st.isyaTelat > 0) rincianList.push(`• *Isya:* ${st.isyaTelat}x`);

    const lines = [
      '🕌 *LAPORAN REKAP KETERLAMBATAN SHOLAT SANTRI*',
      '*PESANTREN ISLAM INTERNASIONAL AL-ANDALUS*',
      '━━━━━━━━━━━━━━━━━━━━',
      `🗓️ *Rentang Tanggal:* ${periodeLabel}`,
      `👤 *Nama Santri:* ${st.namaSantri}`,
      `🏫 *Kelas:* ${st.kelas || '-'}`,
      `🏠 *Asrama / Kamar:* ${st.kamar || '-'}`,
      `📊 *Total Keseluruhan Telat:* *${st.totalTelat} Kali*`,
      '',
      '📌 *Rincian Sholat yang Telat:*',
      ...(rincianList.length > 0
        ? rincianList
        : ['• _Alhamdulillah, tidak ada keterlambatan (0x)_']),
      '',
      `📋 *Rekap 5 Waktu:* Subuh ${st.subuhTelat}x | Dzuhur ${st.dzuhurTelat}x | Ashar ${st.asharTelat}x | Maghrib ${st.maghribTelat}x | Isya ${st.isyaTelat}x`,
      ...(st.tanggalTelatList.length > 0
        ? [
            `📅 *Tanggal Tercatat:* ${st.tanggalTelatList
              .map(formatSholatDateID)
              .join(', ')}`,
          ]
        : []),
      '━━━━━━━━━━━━━━━━━━━━',
      '_Bidang Pengasuhan Pesantren Al-Andalus_',
    ];

    return lines.join('\n');
  }

  // Mode ALL (Keseluruhan Anak)
  const activeSummaries = summaries.filter((s) => s.totalTelat > 0);
  const targetList = activeSummaries.length > 0 ? activeSummaries : summaries;
  const grandTotalTelat = targetList.reduce((acc, cur) => acc + cur.totalTelat, 0);

  const lines: string[] = [
    '🕌 *REKAP KETERLAMBATAN SHOLAT SANTRI (KESELURUHAN)*',
    '*PESANTREN ISLAM INTERNASIONAL AL-ANDALUS*',
    '━━━━━━━━━━━━━━━━━━━━',
    `🗓️ *Rentang Tanggal:* ${periodeLabel}`,
    `👥 *Jumlah Santri:* ${targetList.length} Santri`,
    `📊 *Total Keseluruhan Keterlambatan:* *${grandTotalTelat} Kali*`,
    '━━━━━━━━━━━━━━━━━━━━',
  ];

  if (targetList.length === 0) {
    lines.push('');
    lines.push('_Tidak ada catatan keterlambatan sholat pada rentang tanggal ini._');
  } else {
    targetList.forEach((st, idx) => {
      lines.push('');
      lines.push(`${idx + 1}. *${st.namaSantri}*`);
      lines.push(`   • Kelas: ${st.kelas || '-'}`);
      lines.push(`   • Asrama / Kamar: ${st.kamar || '-'}`);
      lines.push(`   • Total Keseluruhan Telat: *${st.totalTelat} Kali*`);
      lines.push(`   • Sholat yang Telat: *${formatRincianSholatTelat(st)}*`);
    });
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('_Bidang Pengasuhan Pesantren Al-Andalus_');

  return lines.join('\n');
}

