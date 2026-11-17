import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  deleteDoc,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  db,
  handleFirestoreError,
} from '../firebase';
import {
  cleanDisplayName,
  normalizeDateYYYYMMDD,
  normalizeRoleValue,
  type DataUKPRow,
  type LaporanMusyrifRow,
  type MasterSantri,
  type UserRoleRow,
} from './ukpSyncEngine';
import type { PerizinanRow } from './perizinanEngine';
import {
  getEffectiveSholatDate,
  isSholatRowPutih,
  normalizeSantriKey,
  type SholatInput,
  type SholatRow,
  type SholatStatus,
} from './sholatEngine';

export interface StaffAccessRow {
  email: string;
  nama: string;
  role: 'admin_pusat' | 'admin_pengasuhan' | 'user';
  allowedEmails?: string[];
}

export interface PortalCollectionsSnapshot {
  masterData: MasterSantri[];
  usersRoleList: UserRoleRow[];
  laporanList: LaporanMusyrifRow[];
  ukpList: DataUKPRow[];
  perizinanList: PerizinanRow[];
  sholatList: SholatRow[];
  staffAccessList: StaffAccessRow[];
}

export function toSafeFirestoreId(raw: string, prefix: string = 'DOC'): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 76);
  if (cleaned && /^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function toSafeStaffDocId(email: string): string {
  const cleaned = String(email || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return cleaned || `STAFF_${Date.now().toString(36)}`;
}

function clipStr(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function buildAllowedEmails(
  currentEmail?: string | null,
  staffEmails: string[] = []
): string[] {
  const set = new Set<string>();
  set.add(BOOTSTRAPPED_ADMIN_EMAIL);
  if (currentEmail) {
    const clean = normalizeEmail(currentEmail);
    if (clean) set.add(clean);
  }
  for (const em of staffEmails) {
    const clean = normalizeEmail(em);
    if (clean && clean.length <= 160) {
      set.add(clean);
    }
    if (set.size >= 30) break;
  }
  return Array.from(set).slice(0, 30);
}

function sanitizePrayerStatus(val: unknown): SholatStatus {
  const up = String(val || 'TEPAT').trim().toUpperCase();
  if (up === 'TELAT' || up === 'ALFA' || up === 'IZIN' || up === 'TEPAT') {
    return up;
  }
  return 'TEPAT';
}

function sanitizeDateRequired(val: unknown, fallback?: string): string {
  const norm = normalizeDateYYYYMMDD(String(val || ''));
  if (norm && norm.length >= 8) return norm.slice(0, 32);
  const raw = clipStr(val, 32);
  if (raw.length >= 8) return raw;
  return fallback || new Date().toISOString().slice(0, 10);
}

async function fetchExistingDocMetaMap(
  collectionName: string,
  isBootstrapped: boolean,
  emailLower: string
): Promise<Map<string, DocumentData>> {
  try {
    const q = isBootstrapped
      ? collection(db, collectionName)
      : query(
          collection(db, collectionName),
          where('allowedEmails', 'array-contains', emailLower)
        );
    const snap = await getDocs(q);
    const map = new Map<string, DocumentData>();
    snap.forEach((d) => {
      map.set(d.id, d.data());
    });
    return map;
  } catch {
    return new Map<string, DocumentData>();
  }
}

async function commitBatchOperations(
  ops: Array<(batch: ReturnType<typeof writeBatch>) => void>,
  pathContext: string
): Promise<void> {
  if (ops.length === 0) return;
  const CHUNK_SIZE = 380;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const apply of chunk) {
      apply(batch);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pathContext);
    }
  }
}

function mapDocToMasterSantri(data: DocumentData): MasterSantri {
  return {
    idSantri: String(data.idSantri || ''),
    namaSantri: cleanDisplayName(String(data.namaSantri || '')),
    kelas: String(data.kelas || ''),
    kamar: String(data.kamar || ''),
  };
}

function mapDocToUserRole(data: DocumentData): UserRoleRow {
  const namaUser = String(data.namaUser || '');
  const keterangan = String(data.keterangan || '');
  return {
    namaUser,
    nama: namaUser,
    role: normalizeRoleValue(String(data.role || 'user'), namaUser, keterangan),
    password: String(data.password || ''),
    keterangan,
  };
}

function mapDocToLaporan(data: DocumentData): LaporanMusyrifRow {
  return {
    idLaporan: String(data.idLaporan || ''),
    timestamp: String(data.timestamp || ''),
    tanggalLaporan: String(data.tanggalLaporan || ''),
    namaMusyrif: String(data.musrifPelapor || data.namaMusyrif || ''),
    idSantri: String(data.idSantri || ''),
    namaSantri: cleanDisplayName(String(data.namaSantri || '')),
    kelas: String(data.kelas || ''),
    kamar: String(data.kamar || ''),
    keluhanUtama: String(data.keluhanUtama || ''),
    statusPenanganan: String(data.statusPenanganan || 'MENUNGGU PENANGANAN'),
    tindakanUKP: String(data.tindakanUKP || ''),
    waktuUpdate: String(data.waktuUpdate || ''),
  };
}

function mapDocToDataUkp(data: DocumentData): DataUKPRow {
  return {
    idRow: String(data.idRow || ''),
    tanggalPemeriksaan: String(data.tanggalPemeriksaan || ''),
    nama: cleanDisplayName(String(data.namaSantri || data.nama || '')),
    keluhan: String(data.keluhan || '-'),
    tindakan: String(data.tindakan || ''),
  };
}

function mapDocToPerizinan(data: DocumentData): PerizinanRow {
  return {
    idPerizinan: String(data.idPerizinan || ''),
    no: String(data.no || ''),
    nama: cleanDisplayName(String(data.nama || '')),
    kelas: String(data.kelas || ''),
    gedung: String(data.gedung || ''),
    kamar: String(data.kamar || ''),
    izin: String(data.izin || ''),
    keterangan: String(data.keterangan || ''),
    tujuan: String(data.tujuan || ''),
    rekomendasi: String(data.rekomendasi || ''),
    dariTanggal: String(data.dariTanggal || ''),
    dariHari: String(data.dariHari || ''),
    dariJam: String(data.dariJam || ''),
    sampaiTanggal: String(data.sampaiTanggal || ''),
    sampaiHari: String(data.sampaiHari || ''),
    sampaiJam: String(data.sampaiJam || ''),
    durasi: String(data.durasi || ''),
    bulan: String(data.bulan || ''),
    pengasuh1: String(data.pengasuh1 || ''),
    pengasuh2: String(data.pengasuh2 || ''),
    walikelas: String(data.walikelas || ''),
    tibaTanggal: String(data.tibaTanggal || ''),
    keteranganTiba: String(data.keteranganTiba || ''),
    isExtended: Boolean(data.isExtended),
    sampaiTanggalAwal: data.sampaiTanggalAwal
      ? String(data.sampaiTanggalAwal)
      : undefined,
    alasanPerpanjangan: data.alasanPerpanjangan
      ? String(data.alasanPerpanjangan)
      : undefined,
    perpanjanganKe:
      typeof data.perpanjanganKe === 'number' ? data.perpanjanganKe : undefined,
  };
}

function mapDocToSholat(data: DocumentData): SholatRow {
  return {
    idSholat: String(data.idSholat || ''),
    tanggal: String(data.tanggal || ''),
    nis: String(data.nis || '-'),
    namaSantri: cleanDisplayName(String(data.namaSantri || '')),
    kelas: String(data.kelas || '-'),
    gedung: String(data.gedung || '-'),
    kamar: String(data.kamar || '-'),
    subuh: sanitizePrayerStatus(data.subuh),
    dzuhur: sanitizePrayerStatus(data.dzuhur),
    ashar: sanitizePrayerStatus(data.ashar),
    maghrib: sanitizePrayerStatus(data.maghrib),
    isya: sanitizePrayerStatus(data.isya),
    pencatat: String(data.pencatat || 'Admin Pengasuhan'),
    timestamp: String(data.timestamp || ''),
    keterangan: String(data.keterangan || 'AKTIF'),
  };
}

export function subscribePortalCollections(params: {
  userEmail: string;
  userUid: string;
  onUpdate: (partial: Partial<PortalCollectionsSnapshot>, ready: boolean) => void;
  onError?: (err: Error) => void;
}): Unsubscribe {
  const emailLower = normalizeEmail(params.userEmail);
  const isBootstrapped = emailLower === BOOTSTRAPPED_ADMIN_EMAIL;
  const unsubs: Unsubscribe[] = [];
  const loadedFlags = new Set<string>();

  const markLoaded = (
    key: string,
    partial: Partial<PortalCollectionsSnapshot>
  ) => {
    loadedFlags.add(key);
    params.onUpdate(partial, loadedFlags.size >= 4);
  };

  const makeScopedQuery = (colName: string) =>
    isBootstrapped
      ? collection(db, colName)
      : query(
          collection(db, colName),
          where('allowedEmails', 'array-contains', emailLower)
        );

  const reportError = (err: unknown, colName: string) => {
    try {
      handleFirestoreError(err, OperationType.LIST, colName);
    } catch (wrapped) {
      if (params.onError && wrapped instanceof Error) {
        params.onError(wrapped);
      }
    }
  };

  unsubs.push(
    onSnapshot(
      makeScopedQuery('master_santri'),
      (snap) => {
        const rows = snap.docs
          .map((d) => mapDocToMasterSantri(d.data()))
          .sort((a, b) => a.namaSantri.localeCompare(b.namaSantri));
        markLoaded('master_santri', { masterData: rows });
      },
      (err) => reportError(err, 'master_santri')
    )
  );

  unsubs.push(
    onSnapshot(
      makeScopedQuery('laporan_musyrif'),
      (snap) => {
        const rows = snap.docs
          .map((d) => mapDocToLaporan(d.data()))
          .sort((a, b) =>
            String(b.tanggalLaporan || '').localeCompare(
              String(a.tanggalLaporan || '')
            )
          );
        markLoaded('laporan_musyrif', { laporanList: rows });
      },
      (err) => reportError(err, 'laporan_musyrif')
    )
  );

  unsubs.push(
    onSnapshot(
      makeScopedQuery('data_ukp'),
      (snap) => {
        const rows = snap.docs.map((d) => mapDocToDataUkp(d.data()));
        markLoaded('data_ukp', { ukpList: rows });
      },
      (err) => reportError(err, 'data_ukp')
    )
  );

  unsubs.push(
    onSnapshot(
      makeScopedQuery('perizinan_pulang'),
      (snap) => {
        const rows = snap.docs
          .map((d) => mapDocToPerizinan(d.data()))
          .sort((a, b) => {
            const na = parseInt(String(a.no || '0'), 10) || 0;
            const nb = parseInt(String(b.no || '0'), 10) || 0;
            return nb - na;
          });
        markLoaded('perizinan_pulang', { perizinanList: rows });
      },
      (err) => reportError(err, 'perizinan_pulang')
    )
  );

  unsubs.push(
    onSnapshot(
      makeScopedQuery('sholat_records'),
      (snap) => {
        const rows = snap.docs
          .map((d) => mapDocToSholat(d.data()))
          .sort((a, b) =>
            String(b.timestamp || b.tanggal || '').localeCompare(
              String(a.timestamp || a.tanggal || '')
            )
          );
        markLoaded('sholat_records', { sholatList: rows });
      },
      (err) => reportError(err, 'sholat_records')
    )
  );

  // users_role dapat dibaca oleh seluruh tim yang email-nya terdaftar pada allowedEmails
  unsubs.push(
    onSnapshot(
      makeScopedQuery('users_role'),
      (snap) => {
        const rows = snap.docs.map((d) => mapDocToUserRole(d.data()));
        markLoaded('users_role', { usersRoleList: rows });
      },
      () => {
        // Jangan gagalkan UI jika pengguna belum terdaftar di allowedEmails
      }
    )
  );

  const staffQuery = isBootstrapped
    ? collection(db, 'staff_access')
    : query(
        collection(db, 'staff_access'),
        where('email', '==', emailLower)
      );
  unsubs.push(
    onSnapshot(
      staffQuery,
      (snap) => {
        const rows: StaffAccessRow[] = snap.docs.map((d) => {
          const data = d.data();
          const r = String(data.role || 'user');
          return {
            email: String(data.email || ''),
            nama: String(data.nama || ''),
            role:
              r === 'admin_pusat' || r === 'admin_pengasuhan' ? r : 'user',
            allowedEmails: Array.isArray(data.allowedEmails)
              ? data.allowedEmails.map((x: unknown) => normalizeEmail(String(x)))
              : [],
          };
        });
        params.onUpdate({ staffAccessList: rows }, loadedFlags.size >= 4);
      },
      () => {
        // ignore non-admin staff_access list errors
      }
    )
  );

  return () => {
    for (const u of unsubs) {
      try {
        u();
      } catch {
        // ignore
      }
    }
  };
}

function mergePencatatNames(prevName: string, nextName: string): string {
  const a = String(prevName || '').trim();
  const b = String(nextName || '').trim();
  if (!a) return clipStr(b || 'Admin Pengasuhan', 240);
  if (!b) return clipStr(a, 240);
  const parts = a
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.some((p) => p.toLowerCase() === b.toLowerCase())) {
    parts.push(b);
  }
  return clipStr(parts.join(', '), 240);
}

export async function saveSholatBatchToFirestore(params: {
  inputs: SholatInput[];
  existingSholatList: SholatRow[];
  uid: string;
  allowedEmails: string[];
}): Promise<SholatRow[]> {
  const { inputs, existingSholatList, uid, allowedEmails } = params;
  if (inputs.length === 0) return [];

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  const savedRows: SholatRow[] = [];
  const nowIso = new Date().toISOString();

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const tglNorm = sanitizeDateRequired(input.tanggal);
    const targetNameKey = normalizeSantriKey(input.namaSantri);

    const existingActive = existingSholatList.find(
      (r) =>
        !isSholatRowPutih(r) &&
        ((input.idSholat && r.idSholat === input.idSholat) ||
          (getEffectiveSholatDate(r) === tglNorm &&
            normalizeSantriKey(r.namaSantri) === targetNameKey))
    );

    const unlockedSet = new Set(input.unlockedPrayers || []);
    const resolvePrayer = (
      key: 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya',
      incomingVal: SholatStatus
    ): SholatStatus => {
      if (
        existingActive &&
        existingActive[key] === 'TELAT' &&
        !unlockedSet.has(key)
      ) {
        return 'TELAT';
      }
      return sanitizePrayerStatus(incomingVal);
    };

    const finalSubuh = resolvePrayer('subuh', input.subuh);
    const finalDzuhur = resolvePrayer('dzuhur', input.dzuhur);
    const finalAshar = resolvePrayer('ashar', input.ashar);
    const finalMaghrib = resolvePrayer('maghrib', input.maghrib);
    const finalIsya = resolvePrayer('isya', input.isya);

    const docId = existingActive
      ? toSafeFirestoreId(existingActive.idSholat, 'SHOLAT')
      : toSafeFirestoreId(
          input.idSholat ||
            `SHOLAT_${tglNorm.replace(/[^0-9]/g, '')}_${Date.now().toString(36)}_${i}`,
          'SHOLAT'
        );

    const pencatatMerged = existingActive
      ? mergePencatatNames(existingActive.pencatat, input.pencatat)
      : clipStr(input.pencatat || 'Admin Pengasuhan', 240);

    const rowObj: SholatRow = {
      idSholat: docId,
      tanggal: tglNorm,
      nis: clipStr(input.nis || existingActive?.nis || '-', 64) || '-',
      namaSantri: clipStr(input.namaSantri, 160),
      kelas: clipStr(input.kelas || existingActive?.kelas || '-', 40) || '-',
      gedung:
        clipStr(input.gedung || existingActive?.gedung || '-', 120) || '-',
      kamar: clipStr(input.kamar || existingActive?.kamar || '-', 120) || '-',
      subuh: finalSubuh,
      dzuhur: finalDzuhur,
      ashar: finalAshar,
      maghrib: finalMaghrib,
      isya: finalIsya,
      pencatat: pencatatMerged,
      timestamp: clipStr(nowIso, 64),
      keterangan: clipStr(existingActive?.keterangan || 'AKTIF', 240) || 'AKTIF',
    };
    savedRows.push(rowObj);

    const ref = doc(db, 'sholat_records', docId);
    // Cek real existence agar aman terhadap create vs update rules
    let existsInDb = Boolean(existingActive);
    if (!existsInDb) {
      try {
        const snap = await getDoc(ref);
        existsInDb = snap.exists();
      } catch {
        existsInDb = false;
      }
    }

    if (existsInDb) {
      ops.push((batch) => {
        batch.update(ref, {
          subuh: rowObj.subuh,
          dzuhur: rowObj.dzuhur,
          ashar: rowObj.ashar,
          maghrib: rowObj.maghrib,
          isya: rowObj.isya,
          pencatat: rowObj.pencatat,
          timestamp: rowObj.timestamp,
          keterangan: rowObj.keterangan,
          updatedAt: serverTimestamp(),
        });
      });
    } else {
      ops.push((batch) => {
        batch.set(ref, {
          ...rowObj,
          ownerUid: uid,
          allowedEmails,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    }
  }

  await commitBatchOperations(ops, 'sholat_records');
  return savedRows;
}

export async function deleteSholatFromFirestore(idSholat: string): Promise<void> {
  const docId = toSafeFirestoreId(idSholat, 'SHOLAT');
  try {
    await deleteDoc(doc(db, 'sholat_records', docId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `sholat_records/${docId}`
    );
  }
}

export async function resetSholatRangeInFirestore(
  rowsToUpdate: SholatRow[],
  keterangan: string
): Promise<void> {
  const cleanKet = clipStr(keterangan || 'DIPUTIHKAN', 240);
  const ops = rowsToUpdate.map((r) => {
    const docId = toSafeFirestoreId(r.idSholat, 'SHOLAT');
    const ref = doc(db, 'sholat_records', docId);
    return (batch: ReturnType<typeof writeBatch>) => {
      batch.update(ref, {
        keterangan: cleanKet,
        updatedAt: serverTimestamp(),
      });
    };
  });
  await commitBatchOperations(ops, 'sholat_records');
}

export async function saveLaporanToFirestore(params: {
  row: LaporanMusyrifRow;
  uid: string;
  allowedEmails: string[];
}): Promise<void> {
  const { row, uid, allowedEmails } = params;
  const docId = toSafeFirestoreId(row.idLaporan, 'LP');
  const ref = doc(db, 'laporan_musyrif', docId);
  try {
    const snap = await getDoc(ref);
    const payload = {
      idLaporan: docId,
      timestamp: clipStr(row.timestamp, 64),
      tanggalLaporan: sanitizeDateRequired(row.tanggalLaporan),
      musrifPelapor: clipStr(row.namaMusyrif || 'Musyrif', 120),
      idSantri: clipStr(row.idSantri || '-', 64),
      namaSantri: clipStr(row.namaSantri, 160),
      kelas: clipStr(row.kelas || '-', 40),
      kamar: clipStr(row.kamar || '-', 120),
      keluhanUtama: clipStr(row.keluhanUtama || '-', 500),
      statusPenanganan: clipStr(
        row.statusPenanganan || 'MENUNGGU PENANGANAN',
        240
      ),
      tindakanUKP: clipStr(row.tindakanUKP || '', 300),
      waktuUpdate: clipStr(row.waktuUpdate || '', 64),
    };
    const batch = writeBatch(db);
    if (snap.exists()) {
      batch.update(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(ref, {
        ...payload,
        ownerUid: uid,
        allowedEmails,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `laporan_musyrif/${docId}`
    );
  }
}

export async function deleteLaporanFromFirestore(
  idLaporan: string
): Promise<void> {
  const docId = toSafeFirestoreId(idLaporan, 'LP');
  try {
    await deleteDoc(doc(db, 'laporan_musyrif', docId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `laporan_musyrif/${docId}`
    );
  }
}

export async function savePerizinanToFirestore(params: {
  row: PerizinanRow;
  uid: string;
  allowedEmails: string[];
}): Promise<void> {
  const { row, uid, allowedEmails } = params;
  const docId = toSafeFirestoreId(
    row.idPerizinan || `IZN_${row.no}_${row.dariTanggal}`,
    'IZN'
  );
  const ref = doc(db, 'perizinan_pulang', docId);
  try {
    const snap = await getDoc(ref);
    const payload: Record<string, unknown> = {
      idPerizinan: docId,
      no: clipStr(row.no || '1', 32),
      nama: clipStr(row.nama, 160),
      kelas: clipStr(row.kelas || '-', 40),
      gedung: clipStr(row.gedung || '-', 120),
      kamar: clipStr(row.kamar || '-', 120),
      izin: clipStr(row.izin || '-', 120),
      keterangan: clipStr(row.keterangan || '-', 400),
      tujuan: clipStr(row.tujuan || '-', 240),
      rekomendasi: clipStr(row.rekomendasi || '-', 120),
      dariTanggal: sanitizeDateRequired(row.dariTanggal),
      dariHari: clipStr(row.dariHari || '', 32),
      dariJam: clipStr(row.dariJam || '', 20),
      sampaiTanggal: sanitizeDateRequired(row.sampaiTanggal),
      sampaiHari: clipStr(row.sampaiHari || '', 32),
      sampaiJam: clipStr(row.sampaiJam || '', 20),
      durasi: clipStr(row.durasi || '', 40),
      bulan: clipStr(row.bulan || '', 32),
      pengasuh1: clipStr(row.pengasuh1 || '', 120),
      pengasuh2: clipStr(row.pengasuh2 || '', 120),
      walikelas: clipStr(row.walikelas || '', 120),
      tibaTanggal: clipStr(row.tibaTanggal || '', 32),
      keteranganTiba: clipStr(row.keteranganTiba || '', 300),
    };
    if (typeof row.isExtended === 'boolean') {
      payload.isExtended = row.isExtended;
    }
    if (row.sampaiTanggalAwal) {
      payload.sampaiTanggalAwal = clipStr(row.sampaiTanggalAwal, 32);
    }
    if (row.alasanPerpanjangan) {
      payload.alasanPerpanjangan = clipStr(row.alasanPerpanjangan, 300);
    }
    if (typeof row.perpanjanganKe === 'number') {
      payload.perpanjanganKe = row.perpanjanganKe;
    }

    const batch = writeBatch(db);
    if (snap.exists()) {
      batch.update(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(ref, {
        ...payload,
        ownerUid: uid,
        allowedEmails,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `perizinan_pulang/${docId}`
    );
  }
}

export async function deletePerizinanFromFirestore(
  idPerizinan: string
): Promise<void> {
  const docId = toSafeFirestoreId(idPerizinan, 'IZN');
  try {
    await deleteDoc(doc(db, 'perizinan_pulang', docId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `perizinan_pulang/${docId}`
    );
  }
}

export async function saveMasterSantriToFirestore(params: {
  santri: MasterSantri;
  uid: string;
  allowedEmails: string[];
}): Promise<void> {
  const { santri, uid, allowedEmails } = params;
  const safeId = toSafeFirestoreId(
    santri.idSantri || santri.namaSantri,
    'SANTRI'
  ).slice(0, 64);
  const ref = doc(db, 'master_santri', safeId);
  try {
    const snap = await getDoc(ref);
    const batch = writeBatch(db);
    const payload = {
      idSantri: safeId,
      namaSantri: clipStr(santri.namaSantri, 160),
      kelas: clipStr(santri.kelas || '-', 40),
      kamar: clipStr(santri.kamar || '-', 120),
    };
    if (snap.exists()) {
      batch.update(ref, { ...payload, updatedAt: serverTimestamp() });
    } else {
      batch.set(ref, {
        ...payload,
        ownerUid: uid,
        allowedEmails,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `master_santri/${safeId}`
    );
  }
}

export async function saveUserRoleToFirestore(params: {
  user: UserRoleRow;
  uid: string;
  allowedEmails: string[];
}): Promise<void> {
  const { user, uid, allowedEmails } = params;
  const safeId = toSafeFirestoreId(user.namaUser, 'USR');
  const ref = doc(db, 'users_role', safeId);
  try {
    const snap = await getDoc(ref);
    const batch = writeBatch(db);
    const roleVal =
      user.role === 'admin_pusat' ||
      user.role === 'admin_pengasuhan' ||
      user.role === 'admin'
        ? user.role
        : 'user';
    if (snap.exists()) {
      batch.update(ref, {
        role: roleVal,
        password: clipStr(user.password, 128),
        keterangan: clipStr(user.keterangan || '-', 200),
        allowedEmails,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(ref, {
        namaUser: clipStr(user.namaUser, 120),
        role: roleVal,
        password: clipStr(user.password, 128),
        keterangan: clipStr(user.keterangan || '-', 200),
        ownerUid: uid,
        allowedEmails,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users_role/${safeId}`);
  }
}

export async function saveStaffAccessEmail(params: {
  email: string;
  nama: string;
  role: 'admin_pusat' | 'admin_pengasuhan' | 'user';
  uid: string;
  allowedEmails?: string[];
}): Promise<void> {
  const cleanEmail = normalizeEmail(params.email);
  if (!cleanEmail) return;
  const docId = toSafeStaffDocId(cleanEmail);
  const ref = doc(db, 'staff_access', docId);
  const staffAllowed = buildAllowedEmails(cleanEmail, params.allowedEmails || []);
  try {
    const snap = await getDoc(ref);
    const batch = writeBatch(db);
    if (snap.exists()) {
      batch.update(ref, {
        nama: clipStr(params.nama || cleanEmail, 120),
        role: params.role,
        allowedEmails: staffAllowed,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(ref, {
        email: clipStr(cleanEmail, 160),
        nama: clipStr(params.nama || cleanEmail, 120),
        role: params.role,
        ownerUid: params.uid,
        allowedEmails: staffAllowed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `staff_access/${docId}`);
  }
}

export async function deleteStaffAccessEmail(email: string): Promise<void> {
  const cleanEmail = normalizeEmail(email);
  const primaryId = toSafeStaffDocId(cleanEmail);
  const legacyId = toSafeFirestoreId(cleanEmail, 'STAFF');
  try {
    await deleteDoc(doc(db, 'staff_access', primaryId));
    if (legacyId !== primaryId) {
      try {
        await deleteDoc(doc(db, 'staff_access', legacyId));
      } catch {
        // ignore if legacy doc does not exist
      }
    }
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `staff_access/${primaryId}`
    );
  }
}

/**
 * Menyelaraskan daftar email Google tim (allowedEmails) ke seluruh dokumen yang sudah ada di Firestore
 * agar Admin/Ustadz dengan email berbeda langsung bisa membaca dan memperbarui data lama & baru.
 */
export async function syncAllowedEmailsAcrossAllCollections(params: {
  allowedEmails: string[];
  userEmail: string;
}): Promise<{ updatedCount: number }> {
  const emailLower = normalizeEmail(params.userEmail);
  const isBootstrapped = emailLower === BOOTSTRAPPED_ADMIN_EMAIL;
  const targetCollections = [
    'master_santri',
    'users_role',
    'laporan_musyrif',
    'data_ukp',
    'perizinan_pulang',
    'sholat_records',
    ...(isBootstrapped ? ['staff_access'] : []),
  ];

  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  let updatedCount = 0;
  const desiredKey = [...params.allowedEmails].sort().join(',');

  for (const colName of targetCollections) {
    const existingMap = await fetchExistingDocMetaMap(
      colName,
      isBootstrapped,
      emailLower
    );
    existingMap.forEach((data, docId) => {
      const currentList = Array.isArray(data.allowedEmails)
        ? data.allowedEmails.map((x: unknown) => normalizeEmail(String(x)))
        : [];
      const currentKey = [...currentList].sort().join(',');
      if (currentKey !== desiredKey) {
        const ref = doc(db, colName, docId);
        ops.push((b) =>
          b.update(ref, {
            allowedEmails: params.allowedEmails,
            updatedAt: serverTimestamp(),
          })
        );
        updatedCount++;
      }
    });
  }

  await commitBatchOperations(ops, 'sync_allowed_emails');
  return { updatedCount };
}

/**
 * Migrasi / sinkronisasi data dari Google Sheets ke Firestore dalam batch cepat
 */
export async function migrateSheetsSnapshotToFirestore(params: {
  masterData?: MasterSantri[];
  usersRoleList?: UserRoleRow[];
  laporanList?: LaporanMusyrifRow[];
  ukpList?: DataUKPRow[];
  perizinanList?: PerizinanRow[];
  sholatList?: SholatRow[];
  uid: string;
  userEmail: string;
  allowedEmails: string[];
  isAdminUser: boolean;
}): Promise<{ totalMigrated: number }> {
  const {
    masterData = [],
    usersRoleList = [],
    laporanList = [],
    ukpList = [],
    perizinanList = [],
    sholatList = [],
    uid,
    userEmail,
    allowedEmails,
    isAdminUser,
  } = params;

  const emailLower = normalizeEmail(userEmail);
  const isBootstrapped = emailLower === BOOTSTRAPPED_ADMIN_EMAIL;
  const ops: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  let totalMigrated = 0;

  if (isAdminUser && masterData.length > 0) {
    const existingMaster = await fetchExistingDocMetaMap(
      'master_santri',
      isBootstrapped,
      emailLower
    );
    masterData.forEach((s, idx) => {
      if (!s.namaSantri) return;
      const safeId = toSafeFirestoreId(
        s.idSantri || `${s.namaSantri}_${idx}`,
        'SANTRI'
      ).slice(0, 64);
      const ref = doc(db, 'master_santri', safeId);
      const payload = {
        idSantri: safeId,
        namaSantri: clipStr(s.namaSantri, 160),
        kelas: clipStr(s.kelas || '-', 40),
        kamar: clipStr(s.kamar || '-', 120),
        allowedEmails,
      };
      if (existingMaster.has(safeId)) {
        ops.push((b) =>
          b.update(ref, { ...payload, updatedAt: serverTimestamp() })
        );
      } else {
        ops.push((b) =>
          b.set(ref, {
            ...payload,
            ownerUid: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
      totalMigrated++;
    });
  }

  if (isAdminUser && usersRoleList.length > 0) {
    const existingUsers = await fetchExistingDocMetaMap(
      'users_role',
      isBootstrapped,
      emailLower
    );
    usersRoleList.forEach((u) => {
      const nama = clipStr(u.namaUser || u.nama, 120);
      if (!nama) return;
      const safeId = toSafeFirestoreId(nama, 'USR');
      const ref = doc(db, 'users_role', safeId);
      const roleVal =
        u.role === 'admin_pusat' ||
        u.role === 'admin_pengasuhan' ||
        u.role === 'admin'
          ? u.role
          : 'user';
      if (existingUsers.has(safeId)) {
        ops.push((b) =>
          b.update(ref, {
            role: roleVal,
            password: clipStr(u.password || '', 128),
            keterangan: clipStr(u.keterangan || '-', 200),
            allowedEmails,
            updatedAt: serverTimestamp(),
          })
        );
      } else {
        ops.push((b) =>
          b.set(ref, {
            namaUser: nama,
            role: roleVal,
            password: clipStr(u.password || '', 128),
            keterangan: clipStr(u.keterangan || '-', 200),
            ownerUid: uid,
            allowedEmails,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
      totalMigrated++;
    });
  }

  if (laporanList.length > 0) {
    const existingLaporan = await fetchExistingDocMetaMap(
      'laporan_musyrif',
      isBootstrapped,
      emailLower
    );
    laporanList.forEach((l, idx) => {
      if (!l.namaSantri) return;
      const safeId = toSafeFirestoreId(
        l.idLaporan || `LP_${l.tanggalLaporan}_${idx}`,
        'LP'
      );
      const ref = doc(db, 'laporan_musyrif', safeId);
      if (existingLaporan.has(safeId)) {
        ops.push((b) =>
          b.update(ref, {
            statusPenanganan: clipStr(
              l.statusPenanganan || 'MENUNGGU PENANGANAN',
              240
            ),
            tindakanUKP: clipStr(l.tindakanUKP || '', 300),
            waktuUpdate: clipStr(l.waktuUpdate || '', 64),
            updatedAt: serverTimestamp(),
          })
        );
      } else {
        ops.push((b) =>
          b.set(ref, {
            idLaporan: safeId,
            timestamp: clipStr(l.timestamp || '', 64),
            tanggalLaporan: sanitizeDateRequired(l.tanggalLaporan),
            musrifPelapor: clipStr(l.namaMusyrif || 'Musyrif', 120),
            idSantri: clipStr(l.idSantri || '-', 64),
            namaSantri: clipStr(l.namaSantri, 160),
            kelas: clipStr(l.kelas || '-', 40),
            kamar: clipStr(l.kamar || '-', 120),
            keluhanUtama: clipStr(l.keluhanUtama || '-', 500),
            statusPenanganan: clipStr(
              l.statusPenanganan || 'MENUNGGU PENANGANAN',
              240
            ),
            tindakanUKP: clipStr(l.tindakanUKP || '', 300),
            waktuUpdate: clipStr(l.waktuUpdate || '', 64),
            ownerUid: uid,
            allowedEmails,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
      totalMigrated++;
    });
  }

  if (isAdminUser && ukpList.length > 0) {
    const existingUkp = await fetchExistingDocMetaMap(
      'data_ukp',
      isBootstrapped,
      emailLower
    );
    ukpList.forEach((u, idx) => {
      if (!u.nama) return;
      const safeId = toSafeFirestoreId(u.idRow || `UKP_${idx + 1}`, 'UKP');
      const ref = doc(db, 'data_ukp', safeId);
      const payload = {
        tanggalPemeriksaan: sanitizeDateRequired(u.tanggalPemeriksaan),
        namaSantri: clipStr(u.nama, 160),
        tindakan: clipStr(u.tindakan || '-', 300),
        allowedEmails,
      };
      if (existingUkp.has(safeId)) {
        ops.push((b) =>
          b.update(ref, { ...payload, updatedAt: serverTimestamp() })
        );
      } else {
        ops.push((b) =>
          b.set(ref, {
            idRow: safeId,
            ...payload,
            ownerUid: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
      totalMigrated++;
    });
  }

  if (perizinanList.length > 0) {
    const existingPerizinan = await fetchExistingDocMetaMap(
      'perizinan_pulang',
      isBootstrapped,
      emailLower
    );
    perizinanList.forEach((p, idx) => {
      if (!p.nama) return;
      const safeId = toSafeFirestoreId(
        p.idPerizinan || `IZN_${p.no || idx + 1}_${p.dariTanggal}`,
        'IZN'
      );
      const ref = doc(db, 'perizinan_pulang', safeId);
      if (existingPerizinan.has(safeId)) {
        ops.push((b) =>
          b.update(ref, {
            tibaTanggal: clipStr(p.tibaTanggal || '', 32),
            keteranganTiba: clipStr(p.keteranganTiba || '', 300),
            sampaiTanggal: sanitizeDateRequired(p.sampaiTanggal),
            sampaiHari: clipStr(p.sampaiHari || '', 32),
            sampaiJam: clipStr(p.sampaiJam || '', 20),
            durasi: clipStr(p.durasi || '', 40),
            updatedAt: serverTimestamp(),
          })
        );
      } else {
        const docData: Record<string, unknown> = {
          idPerizinan: safeId,
          no: clipStr(p.no || String(idx + 1), 32),
          nama: clipStr(p.nama, 160),
          kelas: clipStr(p.kelas || '-', 40),
          gedung: clipStr(p.gedung || '-', 120),
          kamar: clipStr(p.kamar || '-', 120),
          izin: clipStr(p.izin || '-', 120),
          keterangan: clipStr(p.keterangan || '-', 400),
          tujuan: clipStr(p.tujuan || '-', 240),
          rekomendasi: clipStr(p.rekomendasi || '-', 120),
          dariTanggal: sanitizeDateRequired(p.dariTanggal),
          dariHari: clipStr(p.dariHari || '', 32),
          dariJam: clipStr(p.dariJam || '', 20),
          sampaiTanggal: sanitizeDateRequired(p.sampaiTanggal),
          sampaiHari: clipStr(p.sampaiHari || '', 32),
          sampaiJam: clipStr(p.sampaiJam || '', 20),
          durasi: clipStr(p.durasi || '', 40),
          bulan: clipStr(p.bulan || '', 32),
          pengasuh1: clipStr(p.pengasuh1 || '', 120),
          pengasuh2: clipStr(p.pengasuh2 || '', 120),
          walikelas: clipStr(p.walikelas || '', 120),
          tibaTanggal: clipStr(p.tibaTanggal || '', 32),
          keteranganTiba: clipStr(p.keteranganTiba || '', 300),
          ownerUid: uid,
          allowedEmails,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (typeof p.isExtended === 'boolean') docData.isExtended = p.isExtended;
        if (p.sampaiTanggalAwal)
          docData.sampaiTanggalAwal = clipStr(p.sampaiTanggalAwal, 32);
        if (p.alasanPerpanjangan)
          docData.alasanPerpanjangan = clipStr(p.alasanPerpanjangan, 300);
        if (typeof p.perpanjanganKe === 'number')
          docData.perpanjanganKe = p.perpanjanganKe;
        ops.push((b) => b.set(ref, docData));
      }
      totalMigrated++;
    });
  }

  if (sholatList.length > 0) {
    const existingSholat = await fetchExistingDocMetaMap(
      'sholat_records',
      isBootstrapped,
      emailLower
    );
    sholatList.forEach((r, idx) => {
      if (!r.namaSantri) return;
      const safeId = toSafeFirestoreId(
        r.idSholat || `SHOLAT_${r.tanggal}_${idx}`,
        'SHOLAT'
      );
      const ref = doc(db, 'sholat_records', safeId);
      if (existingSholat.has(safeId)) {
        ops.push((b) =>
          b.update(ref, {
            subuh: sanitizePrayerStatus(r.subuh),
            dzuhur: sanitizePrayerStatus(r.dzuhur),
            ashar: sanitizePrayerStatus(r.ashar),
            maghrib: sanitizePrayerStatus(r.maghrib),
            isya: sanitizePrayerStatus(r.isya),
            pencatat: clipStr(r.pencatat || 'Admin Pengasuhan', 240),
            timestamp: clipStr(r.timestamp || '', 64),
            keterangan: clipStr(r.keterangan || 'AKTIF', 240),
            updatedAt: serverTimestamp(),
          })
        );
      } else {
        ops.push((b) =>
          b.set(ref, {
            idSholat: safeId,
            tanggal: sanitizeDateRequired(r.tanggal),
            nis: clipStr(r.nis || '-', 64),
            namaSantri: clipStr(r.namaSantri, 160),
            kelas: clipStr(r.kelas || '-', 40),
            gedung: clipStr(r.gedung || '-', 120),
            kamar: clipStr(r.kamar || '-', 120),
            subuh: sanitizePrayerStatus(r.subuh),
            dzuhur: sanitizePrayerStatus(r.dzuhur),
            ashar: sanitizePrayerStatus(r.ashar),
            maghrib: sanitizePrayerStatus(r.maghrib),
            isya: sanitizePrayerStatus(r.isya),
            pencatat: clipStr(r.pencatat || 'Admin Pengasuhan', 240),
            timestamp: clipStr(r.timestamp || '', 64),
            keterangan: clipStr(r.keterangan || 'AKTIF', 240),
            ownerUid: uid,
            allowedEmails,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }
      totalMigrated++;
    });
  }

  await commitBatchOperations(ops, 'migration');
  return { totalMigrated };
}
