/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataUKPRow,
  LaporanInput,
  LaporanMusyrifRow,
  MasterSantri,
  UserRole,
  UserRoleRow,
} from './ukpSyncEngine';
import type { PerizinanRow } from './perizinanEngine';
import type { SholatInput, SholatRow } from './sholatEngine';

const TOKEN_STORAGE_KEY = 'alandalus_server_session_token_v1';

export function getSavedSessionToken(): string {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveSessionToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export class ServerApiUnavailableError extends Error {
  constructor(message: string = 'SERVER_API_UNAVAILABLE') {
    super(message);
    this.name = 'ServerApiUnavailableError';
  }
}

export function isServerApiUnavailableError(err: unknown): boolean {
  return (
    err instanceof ServerApiUnavailableError ||
    (err instanceof Error && err.message === 'SERVER_API_UNAVAILABLE')
  );
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getSavedSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();
  let data: unknown = null;

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      if (!contentType.includes('application/json')) {
        throw new ServerApiUnavailableError('SERVER_API_UNAVAILABLE');
      }
      throw new Error(`Invalid JSON response (${res.status})`);
    }
  }

  if (!res.ok) {
    if (res.status === 404 && !contentType.includes('application/json')) {
      throw new ServerApiUnavailableError('SERVER_API_UNAVAILABLE');
    }
    const errObj =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    throw new Error(
      String(
        errObj.error ||
          errObj.errorMessage ||
          `Request error (${res.status})`
      )
    );
  }

  if (!data || typeof data !== 'object') {
    throw new ServerApiUnavailableError('SERVER_API_UNAVAILABLE');
  }

  return data as T;
}

export interface ServerSessionInfo {
  namaUser: string;
  role: UserRole;
  keterangan: string;
  exp: number;
}

export interface DirectoryResponse {
  usersDirectory: UserRoleRow[];
  storageMode: 'firestore_and_sheet' | 'fast_server_and_sheet';
  hasGasUrl: boolean;
  lastSyncTime: string;
}

export interface BootstrapResponse {
  version: number;
  gasWebAppUrl: string;
  lastSyncTime: string;
  mirrorStatus: 'idle' | 'syncing' | 'synced' | 'queued';
  storageMode: 'firestore_and_sheet' | 'fast_server_and_sheet';
  masterData: MasterSantri[];
  laporanList: LaporanMusyrifRow[];
  ukpList: DataUKPRow[];
  perizinanList: PerizinanRow[];
  sholatList: SholatRow[];
  usersRoleList: UserRoleRow[];
}

export async function fetchDirectory(): Promise<DirectoryResponse> {
  const res = await apiFetch<Partial<DirectoryResponse>>('/api/directory');
  if (!Array.isArray(res.usersDirectory)) {
    throw new ServerApiUnavailableError('SERVER_API_UNAVAILABLE');
  }
  return {
    usersDirectory: res.usersDirectory,
    storageMode: res.storageMode || 'fast_server_and_sheet',
    hasGasUrl: Boolean(res.hasGasUrl),
    lastSyncTime: res.lastSyncTime || '',
  };
}

export async function checkServerSession(): Promise<{
  authenticated: boolean;
  user: ServerSessionInfo | null;
}> {
  const res = await apiFetch<{
    authenticated?: boolean;
    user?: ServerSessionInfo | null;
  }>('/api/auth/session');
  if (typeof res.authenticated !== 'boolean') {
    throw new ServerApiUnavailableError('SERVER_API_UNAVAILABLE');
  }
  return {
    authenticated: res.authenticated,
    user: res.user || null,
  };
}

export async function loginWithNameAndPassword(
  namaUser: string,
  password: string
): Promise<{
  valid: boolean;
  token?: string;
  session?: ServerSessionInfo;
  user?: UserRoleRow;
  errorMessage?: string;
}> {
  try {
    const res = await apiFetch<{
      valid: boolean;
      token?: string;
      session?: ServerSessionInfo;
      user?: UserRoleRow;
      errorMessage?: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ namaUser, password }),
    });
    if (res.valid && res.token) {
      saveSessionToken(res.token);
    }
    return res;
  } catch (err) {
    if (isServerApiUnavailableError(err)) {
      throw err;
    }
    return {
      valid: false,
      errorMessage:
        err instanceof Error
          ? err.message
          : 'Nama atau password tidak sesuai dengan data pada users_role.',
    };
  }
}

export async function logoutServerSession(): Promise<void> {
  saveSessionToken('');
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore
  }
}

export async function verifyUserPasswordServer(
  password: string
): Promise<boolean> {
  try {
    const res = await apiFetch<{ valid: boolean }>('/api/auth/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    return Boolean(res.valid);
  } catch {
    return false;
  }
}

export async function fetchBootstrapData(): Promise<BootstrapResponse> {
  const res = await apiFetch<Partial<BootstrapResponse>>('/api/bootstrap');
  if (!Array.isArray(res.masterData) && !Array.isArray(res.usersRoleList)) {
    throw new ServerApiUnavailableError('SERVER_API_UNAVAILABLE');
  }
  return {
    version: typeof res.version === 'number' ? res.version : 1,
    gasWebAppUrl: typeof res.gasWebAppUrl === 'string' ? res.gasWebAppUrl : '',
    lastSyncTime: typeof res.lastSyncTime === 'string' ? res.lastSyncTime : '',
    mirrorStatus: res.mirrorStatus || 'idle',
    storageMode: res.storageMode || 'fast_server_and_sheet',
    masterData: Array.isArray(res.masterData) ? res.masterData : [],
    laporanList: Array.isArray(res.laporanList) ? res.laporanList : [],
    ukpList: Array.isArray(res.ukpList) ? res.ukpList : [],
    perizinanList: Array.isArray(res.perizinanList) ? res.perizinanList : [],
    sholatList: Array.isArray(res.sholatList) ? res.sholatList : [],
    usersRoleList: Array.isArray(res.usersRoleList) ? res.usersRoleList : [],
  };
}

export async function pullSheetToServer(): Promise<{
  ok: boolean;
  lastSyncTime: string;
  counts: {
    masterData: number;
    laporanList: number;
    perizinanList: number;
    sholatList: number;
    usersRoleList: number;
  };
}> {
  return apiFetch('/api/sync/pull', { method: 'POST' });
}

export async function postLaporanServer(
  row: LaporanMusyrifRow,
  gasInput: LaporanInput
): Promise<{ ok: boolean; idLaporan: string }> {
  return apiFetch('/api/laporan', {
    method: 'POST',
    body: JSON.stringify({ row, gasInput }),
  });
}

export async function deleteLaporanServer(idLaporan: string): Promise<void> {
  await apiFetch(`/api/laporan/${encodeURIComponent(idLaporan)}`, {
    method: 'DELETE',
  });
}

export async function postSholatBatchServer(
  inputs: SholatInput[]
): Promise<{ ok: boolean; savedRows: SholatRow[] }> {
  return apiFetch('/api/sholat/batch', {
    method: 'POST',
    body: JSON.stringify({ inputs }),
  });
}

export async function deleteSholatServer(idSholat: string): Promise<void> {
  await apiFetch(`/api/sholat/${encodeURIComponent(idSholat)}`, {
    method: 'DELETE',
  });
}

export async function resetSholatRangeServer(
  startDate: string,
  endDate: string,
  keterangan: string
): Promise<void> {
  await apiFetch('/api/sholat/reset-range', {
    method: 'POST',
    body: JSON.stringify({ startDate, endDate, keterangan }),
  });
}

export async function postPerizinanServer(
  row: PerizinanRow
): Promise<{ ok: boolean; row: PerizinanRow }> {
  return apiFetch('/api/perizinan', {
    method: 'POST',
    body: JSON.stringify({ row }),
  });
}

export async function updatePerizinanServer(
  row: PerizinanRow,
  mode: 'tiba' | 'extend'
): Promise<void> {
  await apiFetch('/api/perizinan/update', {
    method: 'PATCH',
    body: JSON.stringify({ row, mode }),
  });
}

export async function deletePerizinanServer(row: PerizinanRow): Promise<void> {
  await apiFetch('/api/perizinan', {
    method: 'DELETE',
    body: JSON.stringify({ row }),
  });
}

export async function addMasterSantriServer(
  santri: MasterSantri
): Promise<void> {
  await apiFetch('/api/master-santri', {
    method: 'POST',
    body: JSON.stringify({ santri }),
  });
}

export async function addUserRoleServer(user: UserRoleRow): Promise<void> {
  await apiFetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ user }),
  });
}

export async function updateUserPasswordServer(
  namaUser: string,
  newPassword: string
): Promise<void> {
  await apiFetch('/api/users/password', {
    method: 'PATCH',
    body: JSON.stringify({ namaUser, newPassword }),
  });
}

export async function saveGasUrlServer(url: string): Promise<void> {
  await apiFetch('/api/settings/gas-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}
