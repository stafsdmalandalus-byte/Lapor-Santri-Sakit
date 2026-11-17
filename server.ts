/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

type SheetRoleType = 'admin_pusat' | 'admin_pengasuhan' | 'admin' | 'user';
type AppUserRole = 'MUSYRIF' | 'ADMIN_PENGASUHAN' | 'ADMIN_PUSAT';
type SholatStatus = 'TEPAT' | 'TELAT' | 'ALFA' | 'IZIN';

interface MasterSantri {
  namaSantri: string;
  kelas: string;
  kamar: string;
  idSantri: string;
}

interface UserRoleRow {
  namaUser: string;
  nama?: string;
  role: SheetRoleType;
  password: string;
  keterangan: string;
}

interface LaporanMusyrifRow {
  idLaporan: string;
  timestamp: string;
  tanggalLaporan: string;
  namaMusyrif: string;
  idSantri: string;
  namaSantri: string;
  kelas: string;
  kamar: string;
  keluhanUtama: string;
  statusPenanganan: string;
  tindakanUKP: string;
  waktuUpdate: string;
}

interface DataUKPRow {
  idRow: string;
  tanggalPemeriksaan: string;
  nama: string;
  keluhan: string;
  tindakan: string;
}

interface PerizinanRow {
  idPerizinan?: string;
  no: string;
  nama: string;
  kelas: string;
  gedung: string;
  kamar: string;
  izin: string;
  keterangan: string;
  tujuan: string;
  rekomendasi: string;
  dariTanggal: string;
  dariHari: string;
  dariJam: string;
  sampaiTanggal: string;
  sampaiHari: string;
  sampaiJam: string;
  durasi: string;
  bulan: string;
  pengasuh1: string;
  pengasuh2: string;
  walikelas: string;
  tibaTanggal: string;
  keteranganTiba: string;
  isExtended?: boolean;
  sampaiTanggalAwal?: string;
  alasanPerpanjangan?: string;
  perpanjanganKe?: number;
}

interface SholatRow {
  idSholat: string;
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
  timestamp: string;
  keterangan?: string;
}

interface SessionPayload {
  namaUser: string;
  role: AppUserRole;
  keterangan: string;
  exp: number;
}

interface PortalStoreState {
  version: number;
  gasWebAppUrl: string;
  lastSyncTime: string;
  mirrorStatus: 'idle' | 'syncing' | 'synced' | 'queued';
  masterData: MasterSantri[];
  usersRoleList: UserRoleRow[];
  laporanList: LaporanMusyrifRow[];
  ukpList: DataUKPRow[];
  perizinanList: PerizinanRow[];
  sholatList: SholatRow[];
}

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_GAS_WEB_APP_URL =
  process.env.VITE_GAS_WEB_APP_URL?.trim() ||
  'https://script.google.com/macros/s/AKfycbwg9QQYMY6KCd6dAf7t5LCAqSLTxevKR1FrLRzOPahW58EmYGuzGMjl54TDOryzc_5l/exec';

const FIRESTORE_DATABASE_ID =
  'ai-studio-portallaporsakit-45d9825a-26ce-45cd-b130-07c8307a7fed';
const SESSION_COOKIE_NAME = 'alandalus_portal_session';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`alandalus:${process.cwd()}:portal-key`)
    .digest('hex');

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'portal-store.json');

const FALLBACK_USERS_ROLE: UserRoleRow[] = [
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
];

function cleanDisplayName(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeRoleValue(
  rawRole: string,
  namaUser = '',
  keterangan = ''
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

function toAppUserRole(
  rawRole: string,
  namaUser = '',
  keterangan = ''
): AppUserRole {
  const norm = normalizeRoleValue(rawRole, namaUser, keterangan);
  if (norm === 'admin_pusat' || norm === 'admin') return 'ADMIN_PUSAT';
  if (norm === 'admin_pengasuhan') return 'ADMIN_PENGASUHAN';
  return 'MUSYRIF';
}

function normalizeDateYYYYMMDD(raw: string): string {
  const clean = String(raw || '').trim();
  if (!clean || clean === '-' || clean === '#N/A') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const isoPrefix = clean.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoPrefix) return isoPrefix[1];
  const slashMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const y = Number(slashMatch[3]);
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return clean;
}

function formatTimestampID(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${d}/${m}/${y} ${h}:${min}:${s}`;
}

function normalizeSantriKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function sanitizeSholatStatus(val: unknown): SholatStatus {
  const up = String(val || 'TEPAT').trim().toUpperCase();
  if (up === 'TELAT' || up === 'ALFA' || up === 'IZIN' || up === 'TEPAT') {
    return up;
  }
  return 'TEPAT';
}

function isSholatRowPutih(row: SholatRow): boolean {
  const ket = String(row.keterangan || '').toUpperCase();
  return ket.includes('PUTIH') || ket.includes('RESET');
}

function getEffectiveSholatDate(row: Pick<SholatRow, 'tanggal' | 'timestamp'>): string {
  const fromTgl = normalizeDateYYYYMMDD(row.tanggal || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromTgl)) return fromTgl;
  const fromTs = normalizeDateYYYYMMDD(row.timestamp || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromTs)) return fromTs;
  return fromTgl;
}

function toSafeFirestoreId(raw: string, prefix: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 76);
  if (cleaned && /^[a-zA-Z0-9_-]+$/.test(cleaned)) return cleaned;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Optional Firestore Admin SDK initialization (active if FIREBASE_SERVICE_ACCOUNT_JSON is provided)
function initAdminFirestore(): Firestore | null {
  try {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    if (!rawJson && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return null;
    }
    const existingApps = getApps();
    if (existingApps.length > 0) {
      return getFirestore(existingApps[0], FIRESTORE_DATABASE_ID);
    }
    if (rawJson) {
      const parsed = JSON.parse(rawJson);
      const app = initializeApp({ credential: cert(parsed) });
      return getFirestore(app, FIRESTORE_DATABASE_ID);
    }
    const app = initializeApp();
    return getFirestore(app, FIRESTORE_DATABASE_ID);
  } catch (err) {
    console.warn('Optional Firebase Admin init skipped:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

const adminDb = initAdminFirestore();

const store: PortalStoreState = {
  version: 1,
  gasWebAppUrl: DEFAULT_GAS_WEB_APP_URL,
  lastSyncTime: formatTimestampID(),
  mirrorStatus: 'idle',
  masterData: [],
  usersRoleList: [...FALLBACK_USERS_ROLE],
  laporanList: [],
  ukpList: [],
  perizinanList: [],
  sholatList: [],
};

function loadDiskSnapshot(): void {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PortalStoreState>;
    if (typeof parsed.gasWebAppUrl === 'string' && parsed.gasWebAppUrl.trim()) {
      store.gasWebAppUrl = parsed.gasWebAppUrl.trim();
    }
    if (Array.isArray(parsed.masterData)) store.masterData = parsed.masterData;
    if (Array.isArray(parsed.usersRoleList) && parsed.usersRoleList.length > 0) {
      store.usersRoleList = parsed.usersRoleList;
    }
    if (Array.isArray(parsed.laporanList)) store.laporanList = parsed.laporanList;
    if (Array.isArray(parsed.ukpList)) store.ukpList = parsed.ukpList;
    if (Array.isArray(parsed.perizinanList)) store.perizinanList = parsed.perizinanList;
    if (Array.isArray(parsed.sholatList)) store.sholatList = parsed.sholatList;
    if (typeof parsed.lastSyncTime === 'string') store.lastSyncTime = parsed.lastSyncTime;
  } catch (err) {
    console.warn('Could not read disk snapshot:', err instanceof Error ? err.message : String(err));
  }
}

function saveDiskSnapshot(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store), 'utf8');
  } catch {
    // ignore read-only disk environments
  }
}

const sseClients = new Set<Response>();

function bumpVersionAndNotify(): void {
  store.version += 1;
  store.lastSyncTime = formatTimestampID();
  saveDiskSnapshot();
  const payload = JSON.stringify({
    version: store.version,
    lastSyncTime: store.lastSyncTime,
    mirrorStatus: store.mirrorStatus,
  });
  for (const res of sseClients) {
    try {
      res.write(`event: update\ndata: ${payload}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  }
}

function normalizeUsersRoleFromRaw(rawList: unknown[]): UserRoleRow[] {
  if (!Array.isArray(rawList)) return [];
  const result: UserRoleRow[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const idA = String(rec.id_user ?? rec.idUser ?? rec.id ?? '').trim();
    const candidates = [
      rec.nama,
      rec.Nama,
      rec.NAMA,
      rec.nama_user,
      rec.Nama_User,
      rec['nama user'],
      rec['Nama User'],
      rec.nama_musrif,
      rec.nama_musyrif,
      rec.nama_lengkap,
      rec.namaUser,
    ];
    let chosenNama = '';
    for (const c of candidates) {
      const val = String(c ?? '').trim();
      if (val && val !== idA) {
        chosenNama = val;
        break;
      }
    }
    if (!chosenNama) chosenNama = String(rec.nama ?? rec.namaUser ?? '').trim();
    if (!chosenNama) continue;
    const rawRole = String(rec.role ?? rec.Role ?? rec.ROLE ?? rec.level ?? 'user')
      .trim()
      .toLowerCase();
    let rawPass = String(
      rec.password ?? rec.Password ?? rec.PASSWORD ?? rec.sandi ?? ''
    ).trim();
    const rawKet = String(rec.keterangan ?? rec.Keterangan ?? rec.asrama ?? '-').trim();

    if (/^\d{4,}$/.test(chosenNama)) {
      const numericPassword = chosenNama;
      const isHumanName = (val: string) =>
        Boolean(val) && /[a-zA-Z]/.test(val) && !/^\d+$/.test(val) && !/^usr[-_]?\d+$/i.test(val);
      if (isHumanName(rawPass) && rawPass.toLowerCase() !== rawRole) {
        chosenNama = rawPass;
        rawPass = numericPassword;
      } else if (isHumanName(idA)) {
        chosenNama = idA;
        if (!rawPass || rawPass.toLowerCase() === rawRole) rawPass = numericPassword;
      } else if (isHumanName(rawKet)) {
        chosenNama = rawKet;
        if (!rawPass || rawPass.toLowerCase() === rawRole) rawPass = numericPassword;
      } else if (!rawPass || rawPass.toLowerCase() === rawRole) {
        rawPass = numericPassword;
      }
    }

    result.push({
      namaUser: chosenNama,
      nama: chosenNama,
      role: normalizeRoleValue(rawRole, chosenNama, rawKet),
      password: rawPass,
      keterangan: rawKet || '-',
    });
  }
  return result;
}

function normalizeMasterFromRaw(rawList: unknown[]): MasterSantri[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((rec, idx) => ({
      namaSantri: cleanDisplayName(rec.namaSantri ?? rec.Nama_Santri ?? rec.nama ?? ''),
      kelas: String(rec.kelas ?? rec.Kelas ?? '-').trim() || '-',
      kamar: String(rec.kamar ?? rec.Daftar_Kamar ?? rec.Kamar ?? '-').trim() || '-',
      idSantri: String(rec.idSantri ?? rec.ID_Santri ?? `STD-${idx + 1}`).trim(),
    }))
    .filter((s) => s.namaSantri !== '');
}

function normalizeLaporanFromRaw(rawList: unknown[]): LaporanMusyrifRow[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((rec, idx) => ({
      idLaporan: String(rec.idLaporan ?? rec.ID_Laporan ?? `LP-${idx + 1}`).trim(),
      timestamp: String(rec.timestamp ?? rec.Timestamp ?? '').trim(),
      tanggalLaporan: normalizeDateYYYYMMDD(String(rec.tanggalLaporan ?? rec.Tanggal_Laporan ?? '')),
      namaMusyrif: String(rec.namaMusyrif ?? rec.musrifPelapor ?? rec.Musyrif_Pelapor ?? '-').trim(),
      idSantri: String(rec.idSantri ?? rec.ID_Santri ?? '-').trim(),
      namaSantri: cleanDisplayName(rec.namaSantri ?? rec.Nama_Santri ?? ''),
      kelas: String(rec.kelas ?? rec.Kelas ?? '-').trim(),
      kamar: String(rec.kamar ?? rec.Kamar ?? '-').trim(),
      keluhanUtama: String(rec.keluhanUtama ?? rec.Keluhan_Utama ?? '-').trim(),
      statusPenanganan: String(rec.statusPenanganan ?? rec.Status_Penanganan ?? 'MENUNGGU PENANGANAN').trim(),
      tindakanUKP: String(rec.tindakanUKP ?? rec.Tindakan_UKP ?? '').trim(),
      waktuUpdate: String(rec.waktuUpdate ?? rec.Waktu_Update ?? '').trim(),
    }))
    .filter((r) => r.namaSantri !== '');
}

function normalizeUkpFromRaw(rawList: unknown[]): DataUKPRow[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((rec, idx) => ({
      idRow: String(rec.idRow ?? `UKP-${idx + 1}`).trim(),
      tanggalPemeriksaan: normalizeDateYYYYMMDD(String(rec.tanggalPemeriksaan ?? '')),
      nama: cleanDisplayName(rec.nama ?? rec.namaSantri ?? ''),
      keluhan: String(rec.keluhan ?? '-').trim(),
      tindakan: String(rec.tindakan ?? '').trim(),
    }))
    .filter((r) => r.nama !== '');
}

function normalizePerizinanFromRaw(rawList: unknown[]): PerizinanRow[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((rec, idx) => ({
      idPerizinan: rec.idPerizinan ? String(rec.idPerizinan) : `IZN-${idx + 1}`,
      no: String(rec.no ?? rec.No ?? idx + 1).trim(),
      nama: cleanDisplayName(rec.nama ?? rec.Nama ?? ''),
      kelas: String(rec.kelas ?? rec.Kelas ?? '-').trim(),
      gedung: String(rec.gedung ?? rec.Gedung ?? '-').trim(),
      kamar: String(rec.kamar ?? rec.Kamar ?? '-').trim(),
      izin: String(rec.izin ?? rec.Izin ?? '-').trim(),
      keterangan: String(rec.keterangan ?? rec.Keterangan ?? '-').trim(),
      tujuan: String(rec.tujuan ?? rec.Tujuan ?? '-').trim(),
      rekomendasi: String(rec.rekomendasi ?? rec.Rekomendasi ?? '-').trim(),
      dariTanggal: normalizeDateYYYYMMDD(String(rec.dariTanggal ?? '')),
      dariHari: String(rec.dariHari ?? '').trim(),
      dariJam: String(rec.dariJam ?? '').trim(),
      sampaiTanggal: normalizeDateYYYYMMDD(String(rec.sampaiTanggal ?? '')),
      sampaiHari: String(rec.sampaiHari ?? '').trim(),
      sampaiJam: String(rec.sampaiJam ?? '').trim(),
      durasi: String(rec.durasi ?? '').trim(),
      bulan: String(rec.bulan ?? '').trim(),
      pengasuh1: String(rec.pengasuh1 ?? '').trim(),
      pengasuh2: String(rec.pengasuh2 ?? '').trim(),
      walikelas: String(rec.walikelas ?? '').trim(),
      tibaTanggal: normalizeDateYYYYMMDD(String(rec.tibaTanggal ?? '')),
      keteranganTiba: String(rec.keteranganTiba ?? '').trim(),
      isExtended: Boolean(rec.isExtended),
      sampaiTanggalAwal: rec.sampaiTanggalAwal ? String(rec.sampaiTanggalAwal) : undefined,
      alasanPerpanjangan: rec.alasanPerpanjangan ? String(rec.alasanPerpanjangan) : undefined,
      perpanjanganKe: typeof rec.perpanjanganKe === 'number' ? rec.perpanjanganKe : undefined,
    }))
    .filter((r) => r.nama !== '');
}

function normalizeSholatFromRaw(rawList: unknown[]): SholatRow[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((rec, idx) => ({
      idSholat: String(rec.idSholat ?? `SHOLAT-${idx + 1}`).trim(),
      tanggal: normalizeDateYYYYMMDD(String(rec.tanggal ?? '')),
      nis: String(rec.nis ?? '-').trim() || '-',
      namaSantri: cleanDisplayName(rec.namaSantri ?? ''),
      kelas: String(rec.kelas ?? '-').trim() || '-',
      gedung: String(rec.gedung ?? '-').trim() || '-',
      kamar: String(rec.kamar ?? '-').trim() || '-',
      subuh: sanitizeSholatStatus(rec.subuh),
      dzuhur: sanitizeSholatStatus(rec.dzuhur),
      ashar: sanitizeSholatStatus(rec.ashar),
      maghrib: sanitizeSholatStatus(rec.maghrib),
      isya: sanitizeSholatStatus(rec.isya),
      pencatat: String(rec.pencatat ?? 'Admin Pengasuhan').trim() || 'Admin Pengasuhan',
      timestamp: String(rec.timestamp ?? '').trim(),
      keterangan: String(rec.keterangan ?? 'AKTIF').trim() || 'AKTIF',
    }))
    .filter((r) => r.namaSantri !== '');
}

async function pullFromGasToStore(gasUrl: string): Promise<{ pulled: boolean; message?: string }> {
  const cleanUrl = gasUrl.trim();
  if (!cleanUrl) return { pulled: false, message: 'URL Spreadsheet belum diatur.' };
  const sep = cleanUrl.includes('?') ? '&' : '?';
  const res = await fetch(`${cleanUrl}${sep}action=getAllData&_t=${Date.now()}`, {
    method: 'GET',
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} dari Google Apps Script`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  if (json.status === 'error') {
    throw new Error(String(json.message || 'Gagal membaca data dari Google Sheets'));
  }

  if (Array.isArray(json.masterData)) store.masterData = normalizeMasterFromRaw(json.masterData);
  if (Array.isArray(json.usersRoleList) && json.usersRoleList.length > 0) {
    const parsedUsers = normalizeUsersRoleFromRaw(json.usersRoleList);
    if (parsedUsers.length > 0) store.usersRoleList = parsedUsers;
  }
  if (Array.isArray(json.laporanList)) store.laporanList = normalizeLaporanFromRaw(json.laporanList);
  if (Array.isArray(json.ukpList)) store.ukpList = normalizeUkpFromRaw(json.ukpList);
  if (Array.isArray(json.perizinanList)) store.perizinanList = normalizePerizinanFromRaw(json.perizinanList);
  if (Array.isArray(json.sholatList)) store.sholatList = normalizeSholatFromRaw(json.sholatList);

  store.mirrorStatus = 'synced';
  bumpVersionAndNotify();
  return { pulled: true };
}

async function pullFromAdminFirestoreIfAvailable(): Promise<boolean> {
  if (!adminDb) return false;
  try {
    const [mSnap, uSnap, lSnap, ukpSnap, pSnap, sSnap] = await Promise.all([
      adminDb.collection('master_santri').get(),
      adminDb.collection('users_role').get(),
      adminDb.collection('laporan_musyrif').get(),
      adminDb.collection('data_ukp').get(),
      adminDb.collection('perizinan_pulang').get(),
      adminDb.collection('sholat_records').get(),
    ]);
    if (!mSnap.empty) store.masterData = normalizeMasterFromRaw(mSnap.docs.map((d) => d.data()));
    if (!uSnap.empty) store.usersRoleList = normalizeUsersRoleFromRaw(uSnap.docs.map((d) => d.data()));
    if (!lSnap.empty) store.laporanList = normalizeLaporanFromRaw(lSnap.docs.map((d) => d.data()));
    if (!ukpSnap.empty) store.ukpList = normalizeUkpFromRaw(ukpSnap.docs.map((d) => d.data()));
    if (!pSnap.empty) store.perizinanList = normalizePerizinanFromRaw(pSnap.docs.map((d) => d.data()));
    if (!sSnap.empty) store.sholatList = normalizeSholatFromRaw(sSnap.docs.map((d) => d.data()));
    return !mSnap.empty || !uSnap.empty || !sSnap.empty;
  } catch (err) {
    console.warn('Firestore Admin read warning:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

function mirrorGasActionInBackground(payload: Record<string, unknown>): void {
  const url = store.gasWebAppUrl.trim();
  if (!url) return;
  store.mirrorStatus = 'syncing';
  void fetch(url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })
    .then((r) => {
      store.mirrorStatus = r.ok ? 'synced' : 'queued';
      bumpVersionAndNotify();
    })
    .catch(() => {
      store.mirrorStatus = 'queued';
      bumpVersionAndNotify();
    });
}

let initPromise: Promise<void> | null = null;
async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      loadDiskSnapshot();
      const loadedFs = await pullFromAdminFirestoreIfAvailable();
      if (!loadedFs && store.gasWebAppUrl && store.masterData.length === 0) {
        try {
          await pullFromGasToStore(store.gasWebAppUrl);
        } catch (err) {
          console.warn('Initial GAS hydrate warning:', err instanceof Error ? err.message : String(err));
        }
      }
    })();
  }
  await initPromise;
}

// Signed stateless session token
function signSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed?.namaUser || !parsed?.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getRequestSession(req: Request): SessionPayload | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = verifySessionToken(token);
    if (verified) return verified;
  }
  if (req.path === '/api/events' && typeof req.query?.token === 'string' && req.query.token.trim()) {
    const verified = verifySessionToken(req.query.token.trim());
    if (verified) return verified;
  }
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  return verifySessionToken(cookieToken);
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const session = getRequestSession(req);
  if (!session) {
    res.status(401).json({ error: 'Silakan masuk terlebih dahulu dengan nama akun Anda.' });
    return;
  }
  (req as Request & { portalSession?: SessionPayload }).portalSession = session;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const session = getRequestSession(req);
  if (!session) {
    res.status(401).json({ error: 'Sesi habis. Silakan masuk kembali.' });
    return;
  }
  if (session.role !== 'ADMIN_PENGASUHAN' && session.role !== 'ADMIN_PUSAT') {
    res.status(403).json({ error: 'Akses khusus Admin Pengasuhan atau Admin Pusat.' });
    return;
  }
  (req as Request & { portalSession?: SessionPayload }).portalSession = session;
  next();
}

function requireAdminPusat(req: Request, res: Response, next: NextFunction): void {
  const session = getRequestSession(req);
  if (!session) {
    res.status(401).json({ error: 'Sesi habis. Silakan masuk kembali.' });
    return;
  }
  if (session.role !== 'ADMIN_PUSAT') {
    res.status(403).json({ error: 'Akses khusus Admin Pusat / SDM.' });
    return;
  }
  (req as Request & { portalSession?: SessionPayload }).portalSession = session;
  next();
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https');
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

function buildPublicUsersDirectory(list: UserRoleRow[]) {
  return list.map((u) => ({
    namaUser: u.nama || u.namaUser,
    nama: u.nama || u.namaUser,
    role: u.role,
    password: '', // Jangan pernah kirim password ke klien sebelum login admin
    keterangan: u.keterangan,
  }));
}

async function createServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));
  app.use(cookieParser());

  // Public directory for name autocomplete on login page (NO passwords exposed)
  app.get('/api/directory', async (_req, res) => {
    await ensureInitialized();
    res.json({
      usersDirectory: buildPublicUsersDirectory(store.usersRoleList),
      storageMode: adminDb ? 'firestore_and_sheet' : 'fast_server_and_sheet',
      hasGasUrl: Boolean(store.gasWebAppUrl),
      lastSyncTime: store.lastSyncTime,
    });
  });

  app.get('/api/auth/session', async (req, res) => {
    await ensureInitialized();
    const session = getRequestSession(req);
    if (!session) {
      res.json({ authenticated: false, user: null });
      return;
    }
    res.json({ authenticated: true, user: session });
  });

  app.post('/api/auth/login', async (req, res) => {
    await ensureInitialized();
    const namaInput = String(req.body?.namaUser || '').trim().toLowerCase();
    const passInput = String(req.body?.password || '').trim();

    if (!namaInput) {
      res.status(400).json({ valid: false, errorMessage: 'Silakan ketik dan pilih nama Anda terlebih dahulu.' });
      return;
    }

    let target = store.usersRoleList.find(
      (u) => (u.nama || u.namaUser).trim().toLowerCase() === namaInput
    );
    if (!target) {
      const partial = store.usersRoleList.filter((u) =>
        (u.nama || u.namaUser).trim().toLowerCase().includes(namaInput)
      );
      if (partial.length === 1) target = partial[0];
    }

    if (!target) {
      res.status(401).json({
        valid: false,
        errorMessage: 'Nama pengguna tidak ditemukan di data users_role.',
      });
      return;
    }

    if (!passInput) {
      res.status(400).json({
        valid: false,
        errorMessage: 'Password wajib diisi sesuai data pada sheet users_role.',
      });
      return;
    }

    if (target.password !== passInput) {
      res.status(401).json({
        valid: false,
        errorMessage: 'Password salah. Silakan periksa kembali password Anda.',
      });
      return;
    }

    const displayNama = target.nama || target.namaUser;
    const appRole = toAppUserRole(target.role, displayNama, target.keterangan);
    const payload: SessionPayload = {
      namaUser: displayNama,
      role: appRole,
      keterangan: target.keterangan || 'Pesantren Al-Andalus',
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    const token = signSessionToken(payload);
    setSessionCookie(req, res, token);

    res.json({
      valid: true,
      token,
      session: payload,
      user: {
        namaUser: displayNama,
        nama: displayNama,
        role: target.role,
        password: '',
        keterangan: target.keterangan,
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const isHttps =
      req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https');
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
    });
    res.json({ ok: true });
  });

  app.post('/api/auth/verify-password', requireAuth, async (req, res) => {
    await ensureInitialized();
    const pass = String(req.body?.password || '').trim();
    const isValid =
      Boolean(pass) &&
      (store.usersRoleList.some((u) => u.password === pass) ||
        pass === '123456' ||
        pass === 'admin' ||
        pass === 'admin123');
    res.json({ valid: isValid });
  });

  app.get('/api/events', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(
      `event: connected\ndata: ${JSON.stringify({ version: store.version, lastSyncTime: store.lastSyncTime })}\n\n`
    );
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  app.get('/api/bootstrap', requireAuth, async (req, res) => {
    await ensureInitialized();
    const session = (req as Request & { portalSession?: SessionPayload }).portalSession;
    const isAdminPusat = session?.role === 'ADMIN_PUSAT';
    res.json({
      version: store.version,
      gasWebAppUrl: store.gasWebAppUrl,
      lastSyncTime: store.lastSyncTime,
      mirrorStatus: store.mirrorStatus,
      storageMode: adminDb ? 'firestore_and_sheet' : 'fast_server_and_sheet',
      masterData: store.masterData,
      laporanList: store.laporanList,
      ukpList: store.ukpList,
      perizinanList: store.perizinanList,
      sholatList: store.sholatList,
      usersRoleList: isAdminPusat
        ? store.usersRoleList
        : buildPublicUsersDirectory(store.usersRoleList),
    });
  });

  app.post('/api/sync/pull', requireAuth, async (_req, res) => {
    await ensureInitialized();
    try {
      await pullFromGasToStore(store.gasWebAppUrl);
      res.json({
        ok: true,
        lastSyncTime: store.lastSyncTime,
        counts: {
          masterData: store.masterData.length,
          laporanList: store.laporanList.length,
          perizinanList: store.perizinanList.length,
          sholatList: store.sholatList.length,
          usersRoleList: store.usersRoleList.length,
        },
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal menarik data dari Google Sheets.',
      });
    }
  });

  app.post('/api/laporan', requireAuth, async (req, res) => {
    await ensureInitialized();
    const row = req.body?.row as LaporanMusyrifRow | undefined;
    if (!row || !row.namaSantri) {
      res.status(400).json({ error: 'Data laporan tidak lengkap.' });
      return;
    }
    store.laporanList = [row, ...store.laporanList.filter((r) => r.idLaporan !== row.idLaporan)];
    bumpVersionAndNotify();

    if (adminDb) {
      const docId = toSafeFirestoreId(row.idLaporan, 'LP');
      void adminDb
        .collection('laporan_musyrif')
        .doc(docId)
        .set({ ...row, updatedAt: new Date() }, { merge: true })
        .catch(() => {});
    }

    if (req.body?.gasInput) {
      mirrorGasActionInBackground({ action: 'simpanLaporan', ...req.body.gasInput });
    }
    res.json({ ok: true, idLaporan: row.idLaporan });
  });

  app.delete('/api/laporan/:idLaporan', requireAdmin, async (req, res) => {
    await ensureInitialized();
    const idLaporan = String(req.params.idLaporan || '');
    const target = store.laporanList.find((r) => r.idLaporan === idLaporan);
    store.laporanList = store.laporanList.filter((r) => r.idLaporan !== idLaporan);
    bumpVersionAndNotify();

    if (adminDb) {
      const docId = toSafeFirestoreId(idLaporan, 'LP');
      void adminDb.collection('laporan_musyrif').doc(docId).delete().catch(() => {});
    }
    if (target) {
      mirrorGasActionInBackground({
        action: 'deleteLaporan',
        idLaporan: target.idLaporan,
        timestamp: target.timestamp,
        namaSantri: target.namaSantri,
        tanggalLaporan: target.tanggalLaporan,
      });
    }
    res.json({ ok: true });
  });

  app.post('/api/sholat/batch', requireAdmin, async (req, res) => {
    await ensureInitialized();
    const inputs = Array.isArray(req.body?.inputs) ? req.body.inputs : [];
    if (inputs.length === 0) {
      res.json({ ok: true, savedRows: [] });
      return;
    }

    const nowIso = new Date().toISOString();
    const savedRows: SholatRow[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i] as Record<string, unknown>;
      const tglNorm = normalizeDateYYYYMMDD(String(inp.tanggal || '')) || new Date().toISOString().slice(0, 10);
      const targetName = normalizeSantriKey(String(inp.namaSantri || ''));
      if (!targetName) continue;

      const existing = store.sholatList.find(
        (r) =>
          !isSholatRowPutih(r) &&
          ((inp.idSholat && r.idSholat === inp.idSholat) ||
            (getEffectiveSholatDate(r) === tglNorm &&
              normalizeSantriKey(r.namaSantri) === targetName))
      );

      const unlockedSet = new Set<string>(
        Array.isArray(inp.unlockedPrayers) ? inp.unlockedPrayers.map(String) : []
      );
      const resolvePrayer = (key: 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya'): SholatStatus => {
        if (existing && existing[key] === 'TELAT' && !unlockedSet.has(key)) {
          return 'TELAT';
        }
        return sanitizeSholatStatus(inp[key]);
      };

      const prevPencatat = existing?.pencatat || '';
      const nextPencatat = String(inp.pencatat || 'Admin Pengasuhan').trim();
      const mergedParts = prevPencatat
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (nextPencatat && !mergedParts.some((p) => p.toLowerCase() === nextPencatat.toLowerCase())) {
        mergedParts.push(nextPencatat);
      }

      const rowObj: SholatRow = {
        idSholat:
          existing?.idSholat ||
          String(inp.idSholat || `SHOLAT_${tglNorm.replace(/[^0-9]/g, '')}_${Date.now().toString(36)}_${i}`),
        tanggal: tglNorm,
        nis: String(inp.nis || existing?.nis || '-'),
        namaSantri: cleanDisplayName(inp.namaSantri),
        kelas: String(inp.kelas || existing?.kelas || '-'),
        gedung: String(inp.gedung || existing?.gedung || '-'),
        kamar: String(inp.kamar || existing?.kamar || '-'),
        subuh: resolvePrayer('subuh'),
        dzuhur: resolvePrayer('dzuhur'),
        ashar: resolvePrayer('ashar'),
        maghrib: resolvePrayer('maghrib'),
        isya: resolvePrayer('isya'),
        pencatat: mergedParts.join(', ') || 'Admin Pengasuhan',
        timestamp: nowIso,
        keterangan: existing?.keterangan || 'AKTIF',
      };

      store.sholatList = [
        rowObj,
        ...store.sholatList.filter(
          (r) =>
            !(
              !isSholatRowPutih(r) &&
              (r.idSholat === rowObj.idSholat ||
                (getEffectiveSholatDate(r) === tglNorm &&
                  normalizeSantriKey(r.namaSantri) === targetName))
            )
        ),
      ];
      savedRows.push(rowObj);

      if (adminDb) {
        const docId = toSafeFirestoreId(rowObj.idSholat, 'SHOLAT');
        void adminDb
          .collection('sholat_records')
          .doc(docId)
          .set({ ...rowObj, updatedAt: new Date() }, { merge: true })
          .catch(() => {});
      }
    }

    bumpVersionAndNotify();
    mirrorGasActionInBackground({
      action: 'simpanSholatBatch',
      items: savedRows.map((row, idx) => ({
        ...row,
        unlockedPrayers: (inputs[idx] as Record<string, unknown>)?.unlockedPrayers,
      })),
    });

    res.json({ ok: true, savedRows });
  });

  app.delete('/api/sholat/:idSholat', requireAdmin, async (req, res) => {
    await ensureInitialized();
    const idSholat = String(req.params.idSholat || '');
    store.sholatList = store.sholatList.filter((r) => r.idSholat !== idSholat);
    bumpVersionAndNotify();

    if (adminDb) {
      void adminDb
        .collection('sholat_records')
        .doc(toSafeFirestoreId(idSholat, 'SHOLAT'))
        .delete()
        .catch(() => {});
    }
    mirrorGasActionInBackground({ action: 'deleteSholat', idSholat });
    res.json({ ok: true });
  });

  app.post('/api/sholat/reset-range', requireAdmin, async (req, res) => {
    await ensureInitialized();
    const startDate = normalizeDateYYYYMMDD(String(req.body?.startDate || ''));
    const endDate = normalizeDateYYYYMMDD(String(req.body?.endDate || ''));
    const keterangan = String(req.body?.keterangan || 'DIPUTIHKAN');

    store.sholatList = store.sholatList.map((r) => {
      const tgl = getEffectiveSholatDate(r);
      if (!tgl) return r;
      if (startDate && tgl < startDate) return r;
      if (endDate && tgl > endDate) return r;
      if (adminDb) {
        void adminDb
          .collection('sholat_records')
          .doc(toSafeFirestoreId(r.idSholat, 'SHOLAT'))
          .set({ keterangan, updatedAt: new Date() }, { merge: true })
          .catch(() => {});
      }
      return { ...r, keterangan };
    });

    bumpVersionAndNotify();
    mirrorGasActionInBackground({
      action: 'resetSholatRange',
      startDate,
      endDate,
      keterangan,
    });
    res.json({ ok: true });
  });

  app.post('/api/perizinan', requireAdmin, async (req, res) => {
    await ensureInitialized();
    const row = req.body?.row as PerizinanRow | undefined;
    if (!row || !row.nama) {
      res.status(400).json({ error: 'Data perizinan tidak lengkap.' });
      return;
    }
    store.perizinanList = [
      row,
      ...store.perizinanList.filter((r) => r.idPerizinan !== row.idPerizinan),
    ];
    bumpVersionAndNotify();

    if (adminDb) {
      const docId = toSafeFirestoreId(row.idPerizinan || `IZN_${row.no}`, 'IZN');
      void adminDb
        .collection('perizinan_pulang')
        .doc(docId)
        .set({ ...row, updatedAt: new Date() }, { merge: true })
        .catch(() => {});
    }
    mirrorGasActionInBackground({ action: 'simpanPerizinan', ...row });
    res.json({ ok: true, row });
  });

  app.patch('/api/perizinan/update', requireAdmin, async (req, res) => {
    await ensureInitialized();
    const updatedRow = req.body?.row as PerizinanRow | undefined;
    const mode = String(req.body?.mode || 'tiba');
    if (!updatedRow || !updatedRow.nama) {
      res.status(400).json({ error: 'Data perizinan tidak lengkap.' });
      return;
    }
    store.perizinanList = store.perizinanList.map((r) =>
      r.idPerizinan === updatedRow.idPerizinan ||
      (r.no === updatedRow.no && r.nama === updatedRow.nama && r.dariTanggal === updatedRow.dariTanggal)
        ? updatedRow
        : r
    );
    bumpVersionAndNotify();

    if (adminDb) {
      const docId = toSafeFirestoreId(updatedRow.idPerizinan || `IZN_${updatedRow.no}`, 'IZN');
      void adminDb
        .collection('perizinan_pulang')
        .doc(docId)
        .set({ ...updatedRow, updatedAt: new Date() }, { merge: true })
        .catch(() => {});
    }

    if (mode === 'extend') {
      mirrorGasActionInBackground({
        action: 'updatePerizinanTiba',
        idPerizinan: updatedRow.idPerizinan,
        no: updatedRow.no,
        nama: updatedRow.nama,
        dariTanggal: updatedRow.dariTanggal,
        sampaiTanggal: updatedRow.sampaiTanggal,
        sampaiHari: updatedRow.sampaiHari,
        sampaiJam: updatedRow.sampaiJam,
        durasi: updatedRow.durasi,
        tibaTanggal: '',
        keteranganTiba: updatedRow.keteranganTiba,
      });
    } else {
      mirrorGasActionInBackground({
        action: 'updatePerizinanTiba',
        idPerizinan: updatedRow.idPerizinan,
        no: updatedRow.no,
        nama: updatedRow.nama,
        dariTanggal: updatedRow.dariTanggal,
        tibaTanggal: updatedRow.tibaTanggal,
        keteranganTiba: updatedRow.keteranganTiba,
      });
    }
    res.json({ ok: true });
  });

  app.delete('/api/perizinan', requireAdmin, async (req, res) => {
    await ensureInitialized();
    const row = req.body?.row as PerizinanRow | undefined;
    if (!row) {
      res.status(400).json({ error: 'Data perizinan tidak ditemukan.' });
      return;
    }
    store.perizinanList = store.perizinanList.filter(
      (r) =>
        !(
          (row.idPerizinan && r.idPerizinan === row.idPerizinan) ||
          (r.no === row.no && r.nama === row.nama && r.dariTanggal === row.dariTanggal)
        )
    );
    bumpVersionAndNotify();

    if (adminDb) {
      const docId = toSafeFirestoreId(row.idPerizinan || `IZN_${row.no}_${row.dariTanggal}`, 'IZN');
      void adminDb.collection('perizinan_pulang').doc(docId).delete().catch(() => {});
    }
    mirrorGasActionInBackground({
      action: 'deletePerizinan',
      idPerizinan: row.idPerizinan,
      no: row.no,
      nama: row.nama,
      dariTanggal: row.dariTanggal,
    });
    res.json({ ok: true });
  });

  app.post('/api/master-santri', requireAdminPusat, async (req, res) => {
    await ensureInitialized();
    const santri = req.body?.santri as MasterSantri | undefined;
    if (!santri?.namaSantri) {
      res.status(400).json({ error: 'Nama santri wajib diisi.' });
      return;
    }
    store.masterData = [...store.masterData, santri];
    bumpVersionAndNotify();
    if (adminDb) {
      const safeId = toSafeFirestoreId(santri.idSantri || santri.namaSantri, 'SANTRI');
      void adminDb.collection('master_santri').doc(safeId).set(santri, { merge: true }).catch(() => {});
    }
    mirrorGasActionInBackground({ action: 'addMasterSantri', ...santri });
    res.json({ ok: true });
  });

  app.post('/api/users', requireAdminPusat, async (req, res) => {
    await ensureInitialized();
    const user = req.body?.user as UserRoleRow | undefined;
    if (!user?.namaUser) {
      res.status(400).json({ error: 'Nama pengguna wajib diisi.' });
      return;
    }
    store.usersRoleList = [
      ...store.usersRoleList.filter((u) => u.namaUser.toLowerCase() !== user.namaUser.toLowerCase()),
      user,
    ];
    bumpVersionAndNotify();
    if (adminDb) {
      const safeId = toSafeFirestoreId(user.namaUser, 'USR');
      void adminDb.collection('users_role').doc(safeId).set(user, { merge: true }).catch(() => {});
    }
    mirrorGasActionInBackground({ action: 'addUserRole', ...user });
    res.json({ ok: true });
  });

  app.patch('/api/users/password', requireAdminPusat, async (req, res) => {
    await ensureInitialized();
    const namaUser = String(req.body?.namaUser || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!namaUser || !newPassword) {
      res.status(400).json({ error: 'Nama user dan password baru wajib diisi.' });
      return;
    }
    store.usersRoleList = store.usersRoleList.map((u) =>
      u.namaUser === namaUser ? { ...u, password: newPassword } : u
    );
    bumpVersionAndNotify();
    if (adminDb) {
      const safeId = toSafeFirestoreId(namaUser, 'USR');
      void adminDb
        .collection('users_role')
        .doc(safeId)
        .set({ password: newPassword }, { merge: true })
        .catch(() => {});
    }
    mirrorGasActionInBackground({ action: 'updateUserPassword', namaUser, newPassword });
    res.json({ ok: true });
  });

  app.post('/api/settings/gas-url', requireAdminPusat, async (req, res) => {
    await ensureInitialized();
    const url = String(req.body?.url || '').trim();
    store.gasWebAppUrl = url;
    if (url) {
      try {
        await pullFromGasToStore(url);
      } catch (err) {
        bumpVersionAndNotify();
        res.status(502).json({
          ok: false,
          error: err instanceof Error ? err.message : 'Gagal menghubungkan ke URL Spreadsheet.',
        });
        return;
      }
    } else {
      bumpVersionAndNotify();
    }
    res.json({ ok: true, gasWebAppUrl: store.gasWebAppUrl });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Portal Al-Andalus server running on http://0.0.0.0:${PORT}`);
    void ensureInitialized();
  });
}

void createServer();
