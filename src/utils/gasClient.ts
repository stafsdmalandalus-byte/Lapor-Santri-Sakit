import {
  normalizeRoleValue,
  normalizeDateYYYYMMDD,
  type MasterSantri,
  type LaporanMusyrifRow,
  type DataUKPRow,
  type UserRoleRow,
  type LaporanInput,
} from './ukpSyncEngine';

const STORAGE_KEY_GAS_URL = 'alandalus_gas_webapp_url_v1';

// Jika ingin URL Google Apps Script tertanam permanen di semua perangkat (Netlify/HP Musyrif),
// isi DEFAULT_GAS_WEB_APP_URL di bawah ini atau set VITE_GAS_WEB_APP_URL di Environment Variables Netlify.
export const DEFAULT_GAS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbwg9QQYMY6KCd6dAf7t5LCAqSLTxevKR1FrLRzOPahW58EmYGuzGMjl54TDOryzc_5l/exec';

export interface GasAllDataResponse {
  status: 'success' | 'error';
  message?: string;
  masterData?: MasterSantri[];
  laporanList?: LaporanMusyrifRow[];
  ukpList?: DataUKPRow[];
  usersRoleList?: UserRoleRow[];
  lastSyncTime?: string;
}

/**
 * Membersihkan & menormalkan URL Web App Google Apps Script
 */
export function cleanGasWebAppUrl(rawUrl: string): string {
  let clean = String(rawUrl || '')
    .trim()
    .replace(/^["']+|["']+$/g, '');
  if (!clean) return '';

  // Hapus query string jika sudah ada (?action=...)
  const qIdx = clean.indexOf('?');
  if (qIdx !== -1) {
    clean = clean.slice(0, qIdx).trim();
  }

  // Jika user menempelkan URL /dev dari test deployment, ubah ke /exec agar tidak kena blokir CORS login Google
  if (clean.endsWith('/dev')) {
    clean = clean.slice(0, -4) + '/exec';
  }

  return clean;
}

export function getSavedGasUrl(): string {
  // 1. Cek apakah ada parameter ?gasUrl=... di URL browser (otomatis simpan ke localStorage)
  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('gasUrl') || params.get('scriptUrl');
      if (urlParam && urlParam.trim() !== '') {
        const cleanedParam = cleanGasWebAppUrl(urlParam);
        if (cleanedParam) {
          localStorage.setItem(STORAGE_KEY_GAS_URL, cleanedParam);
          return cleanedParam;
        }
      }
    } catch {
      // Abaikan jika gagal akses URLSearchParams / localStorage
    }
  }

  // 2. Cek localStorage di perangkat/browser ini (jika Admin pernah mengubah via UI)
  try {
    const savedLocal = cleanGasWebAppUrl(
      localStorage.getItem(STORAGE_KEY_GAS_URL) || ''
    );
    if (savedLocal) {
      return savedLocal;
    }
  } catch {
    // Abaikan
  }

  // 3. Cek Environment Variable (VITE_GAS_WEB_APP_URL di Netlify)
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GAS_WEB_APP_URL
      : undefined;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return cleanGasWebAppUrl(envUrl);
  }

  // 4. Gunakan DEFAULT_GAS_WEB_APP_URL yang tertanam di kode
  if (DEFAULT_GAS_WEB_APP_URL.trim() !== '') {
    return cleanGasWebAppUrl(DEFAULT_GAS_WEB_APP_URL);
  }

  return '';
}

export function saveGasUrl(url: string): void {
  try {
    const clean = cleanGasWebAppUrl(url);
    if (clean) {
      localStorage.setItem(STORAGE_KEY_GAS_URL, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY_GAS_URL);
    }
  } catch {
    // ignore storage errors
  }
}

export function isValidGasExecUrl(url: string): boolean {
  const clean = cleanGasWebAppUrl(url);
  return (
    clean.startsWith('https://script.google.com/macros/s/') &&
    clean.endsWith('/exec')
  );
}

/**
 * Menormalkan data users_role dari Google Sheets agar selalu mengambil dari kolom `nama`
 * (bukan `id_user` di Kolom A) serta mendukung 3 role (admin_pusat, admin_pengasuhan, user).
 */
export function normalizeUsersRoleList(rawList: unknown[]): UserRoleRow[] {
  if (!Array.isArray(rawList)) return [];
  const normalized: UserRoleRow[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;

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

    const idA = String(rec.id_user ?? rec.idUser ?? rec.id ?? '').trim();
    let chosenNama = '';

    for (const c of candidates) {
      const val = String(c ?? '').trim();
      if (val && val !== idA) {
        chosenNama = val;
        break;
      }
    }

    if (!chosenNama) {
      chosenNama = String(rec.nama ?? rec.namaUser ?? '').trim();
    }

    if (!chosenNama) continue;

    const rawRole = String(
      rec.role ?? rec.Role ?? rec.ROLE ?? rec.level ?? 'user'
    )
      .trim()
      .toLowerCase();
    let rawPass = String(
      rec.password ?? rec.Password ?? rec.PASSWORD ?? rec.sandi ?? ''
    ).trim();
    const rawKet = String(
      rec.keterangan ?? rec.Keterangan ?? rec.asrama ?? ''
    ).trim();

    // Jika chosenNama ternyata berisi angka murni (misal password "12345678" atau "87654321" akibat urutan kolom berbeda),
    // pulihkan nama asli dari kolom lain yang berisi huruf (rawPass, idA, atau rawKet) dan pindahkan angka tersebut ke password.
    if (/^\d{4,}$/.test(chosenNama)) {
      const numericPassword = chosenNama;
      const isHumanName = (val: string) =>
        Boolean(val) &&
        /[a-zA-Z]/.test(val) &&
        !/^\d+$/.test(val) &&
        !/^usr[-_]?\d+$/i.test(val);

      if (
        isHumanName(rawPass) &&
        rawPass.toLowerCase() !== rawRole
      ) {
        chosenNama = rawPass;
        rawPass = numericPassword;
      } else if (isHumanName(idA)) {
        chosenNama = idA;
        if (!rawPass || rawPass.toLowerCase() === rawRole) {
          rawPass = numericPassword;
        }
      } else if (isHumanName(rawKet)) {
        chosenNama = rawKet;
        if (!rawPass || rawPass.toLowerCase() === rawRole) {
          rawPass = numericPassword;
        }
      } else if (!rawPass || rawPass.toLowerCase() === rawRole) {
        rawPass = numericPassword;
      }
    }

    normalized.push({
      nama: chosenNama,
      namaUser: chosenNama,
      role: normalizeRoleValue(rawRole, chosenNama, rawKet),
      password: rawPass,
      keterangan: rawKet,
    });
  }

  return normalized;
}

function normalizeAllDataResponse(data: GasAllDataResponse): GasAllDataResponse {
  if (Array.isArray(data.usersRoleList)) {
    data.usersRoleList = normalizeUsersRoleList(data.usersRoleList);
  }
  if (Array.isArray(data.laporanList)) {
    data.laporanList = data.laporanList.map((r) => ({
      ...r,
      tanggalLaporan: normalizeDateYYYYMMDD(r.tanggalLaporan),
    }));
  }
  if (Array.isArray(data.ukpList)) {
    data.ukpList = data.ukpList.map((u) => ({
      ...u,
      tanggalPemeriksaan: normalizeDateYYYYMMDD(u.tanggalPemeriksaan),
    }));
  }
  return data;
}

function parseJsonOrExplainHtml<T>(rawText: string): T {
  const trimmed = rawText.trim();
  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<HTML')
  ) {
    if (
      trimmed.includes('accounts.google.com') ||
      trimmed.includes('ServiceLogin')
    ) {
      throw new Error(
        'Akses ditolak oleh Google (Halaman Login). Pastikan saat Deploy Web App di Google Apps Script, pilihan "Who has access" disetel ke "Anyone" (Siapa saja).'
      );
    }
    throw new Error(
      'Script mengembalikan halaman HTML, bukan JSON. Pastikan Anda sudah menempelkan kode Code.gs terbaru lalu klik Deploy → Manage deployments → Edit (ikon pensil) → Version: New version → Deploy.'
    );
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(
      'Respons dari Google Apps Script tidak berformat JSON yang valid. Pastikan kode Code.gs terbaru sudah di-deploy sebagai New version.'
    );
  }
}

/**
 * Fallback JSONP (<script>) untuk menembus pembatasan CORS redirect di browser tertentu
 */
function requestGasViaJsonp<T>(
  baseUrl: string,
  params: Record<string, string>,
  timeoutMs: number = 12000
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('JSONP hanya tersedia di browser.'));
      return;
    }

    const callbackName = `__gasCb_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const win = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');

    const cleanup = () => {
      try {
        delete win[callbackName];
      } catch {
        win[callbackName] = undefined;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          'Waktu koneksi ke Google Apps Script habis (Timeout). Periksa URL /exec dan pastikan "Who has access" diset ke "Anyone".'
        )
      );
    }, timeoutMs);

    win[callbackName] = (response: T) => {
      clearTimeout(timer);
      cleanup();
      resolve(response);
    };

    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(
        new Error(
          'Gagal terhubung ke Google Apps Script. Pastikan URL Web App berakhiran /exec dan akses diset ke "Anyone" (Siapa saja).'
        )
      );
    };

    const searchParams = new URLSearchParams({
      ...params,
      callback: callbackName,
      _t: String(Date.now()),
    });
    const separator = baseUrl.includes('?') ? '&' : '?';
    script.src = `${baseUrl}${separator}${searchParams.toString()}`;
    document.head.appendChild(script);
  });
}

/**
 * Mengambil seluruh data 4 sheet (Master_Data, Laporan_Musyrif, Data_UKP, users_role)
 * dari Web App Google Apps Script dengan 3 lapis fallback (GET -> POST -> JSONP)
 */
export async function fetchAllSheetsFromGas(
  gasUrl: string
): Promise<GasAllDataResponse> {
  const baseUrl = cleanGasWebAppUrl(gasUrl);
  if (!baseUrl) {
    throw new Error('URL Web App Google Apps Script masih kosong.');
  }
  if (
    baseUrl.includes('script.google.com/home/projects/') ||
    baseUrl.endsWith('/edit')
  ) {
    throw new Error(
      'URL yang Anda tempel adalah URL Editor Script (/edit). Silakan klik Deploy → New deployment → Web app lalu salin URL Web App yang berakhiran /exec.'
    );
  }

  let lastError: Error | null = null;

  // Lapis 1: Standard GET Fetch (?action=getAllData)
  try {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const targetUrl = `${baseUrl}${separator}action=getAllData&_t=${Date.now()}`;
    const response = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
    });
    if (response.ok) {
      const rawText = await response.text();
      const data = parseJsonOrExplainHtml<GasAllDataResponse>(rawText);
      if (data.status === 'error') {
        throw new Error(
          data.message || 'Terjadi kesalahan pada script Google Sheets.'
        );
      }
      return normalizeAllDataResponse(data);
    }
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
  }

  // Lapis 2: POST Fetch (text/plain tanpa CORS preflight)
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      redirect: 'follow',
      credentials: 'omit',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action: 'getAllData' }),
    });
    if (response.ok) {
      const rawText = await response.text();
      const data = parseJsonOrExplainHtml<GasAllDataResponse>(rawText);
      if (data.status === 'error') {
        throw new Error(
          data.message || 'Terjadi kesalahan pada script Google Sheets.'
        );
      }
      return normalizeAllDataResponse(data);
    }
  } catch (err) {
    if (!lastError) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // Lapis 3: JSONP Fallback (<script src="...?action=getAllData&callback=...">)
  try {
    const data = await requestGasViaJsonp<GasAllDataResponse>(baseUrl, {
      action: 'getAllData',
    });
    if (data.status === 'error') {
      throw new Error(
        data.message || 'Terjadi kesalahan pada script Google Sheets.'
      );
    }
    return normalizeAllDataResponse(data);
  } catch (jsonpErr) {
    throw (
      lastError ||
      (jsonpErr instanceof Error
        ? jsonpErr
        : new Error('Gagal menghubungi Web App Google Apps Script.'))
    );
  }
}

/**
 * Mengirim aksi ke Web App Google Apps Script dengan fallback otomatis (POST -> GET -> JSONP)
 */
export async function postActionToGas<T = Record<string, unknown>>(
  gasUrl: string,
  payload: Record<string, unknown>
): Promise<T> {
  const baseUrl = cleanGasWebAppUrl(gasUrl);
  const actionName = String(payload.action || 'simpanLaporan');
  let lastError: Error | null = null;

  // Lapis 1: POST dengan text/plain (bebas CORS preflight)
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      redirect: 'follow',
      credentials: 'omit',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const rawText = await response.text();
      return parseJsonOrExplainHtml<T>(rawText);
    }
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
  }

  // Lapis 2: GET dengan query payload JSON
  try {
    const params = new URLSearchParams({
      action: actionName,
      payload: JSON.stringify(payload),
      _t: String(Date.now()),
    });
    const separator = baseUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${baseUrl}${separator}${params.toString()}`, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
    });
    if (response.ok) {
      const rawText = await response.text();
      return parseJsonOrExplainHtml<T>(rawText);
    }
  } catch (err) {
    if (!lastError) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // Lapis 3: JSONP Fallback
  try {
    return await requestGasViaJsonp<T>(baseUrl, {
      action: actionName,
      payload: JSON.stringify(payload),
    });
  } catch (jsonpErr) {
    throw (
      lastError ||
      (jsonpErr instanceof Error
        ? jsonpErr
        : new Error('Gagal mengirim data ke Google Sheets.'))
    );
  }
}

export async function postLaporanToGas(
  gasUrl: string,
  input: LaporanInput
): Promise<{
  status: string;
  idLaporan?: string;
  row?: LaporanMusyrifRow;
  message?: string;
}> {
  return postActionToGas(gasUrl, {
    action: 'simpanLaporan',
    ...input,
  });
}

