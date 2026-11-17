import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import {
  Copy,
  Check,
  Download,
  Code2,
  FileCode,
  Terminal,
  CheckCircle2,
  Link2,
  RefreshCw,
  Unlink,
  Cloud,
  UserPlus,
  Trash2,
} from 'lucide-react';
import {
  STANDALONE_HTML_CODE,
  GOOGLE_APPS_SCRIPT_CODE,
} from '../utils/gasTemplates';
import { cleanGasWebAppUrl } from '../utils/gasClient';
import type { StaffAccessRow } from '../utils/firestoreSync';

interface SourceCodePanelProps {
  gasWebAppUrl: string;
  isSyncingGas: boolean;
  onSaveAndTestGasUrl: (url: string) => Promise<void>;
  onPullFromGasNow: () => Promise<void>;
  firebaseUserEmail?: string | null;
  staffAccessList?: StaffAccessRow[];
  isSyncingAccess?: boolean;
  onSyncStaffAccessNow?: () => Promise<void>;
  onAddStaffEmail?: (
    email: string,
    nama: string,
    role: 'admin_pusat' | 'admin_pengasuhan' | 'user'
  ) => Promise<void>;
  onRemoveStaffEmail?: (email: string) => Promise<void>;
}

export const SourceCodePanel: React.FC<SourceCodePanelProps> = ({
  gasWebAppUrl,
  isSyncingGas,
  onSaveAndTestGasUrl,
  onPullFromGasNow,
  firebaseUserEmail,
  staffAccessList = [],
  isSyncingAccess = false,
  onSyncStaffAccessNow,
  onAddStaffEmail,
  onRemoveStaffEmail,
}) => {
  const [selectedFile, setSelectedFile] = useState<'HTML' | 'GAS'>('GAS');
  const [copiedFile, setCopiedFile] = useState<'HTML' | 'GAS' | null>(null);
  const [urlInput, setUrlInput] = useState<string>(gasWebAppUrl);
  const [newStaffEmail, setNewStaffEmail] = useState<string>('');
  const [newStaffNama, setNewStaffNama] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<
    'admin_pusat' | 'admin_pengasuhan' | 'user'
  >('admin_pengasuhan');

  useEffect(() => {
    setUrlInput(gasWebAppUrl);
  }, [gasWebAppUrl]);

  const activeCode =
    selectedFile === 'HTML' ? STANDALONE_HTML_CODE : GOOGLE_APPS_SCRIPT_CODE;
  const activeFilename = selectedFile === 'HTML' ? 'Index.html' : 'Code.gs';

  const handleCopy = async (target: 'HTML' | 'GAS') => {
    const textToCopy =
      target === 'HTML' ? STANDALONE_HTML_CODE : GOOGLE_APPS_SCRIPT_CODE;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedFile(target);
      setTimeout(() => setCopiedFile(null), 2500);
      await Swal.fire({
        icon: 'success',
        title: `Kode ${target === 'HTML' ? 'Index.html' : 'Code.gs'} Disalin!`,
        text: 'Silakan tempel (paste) langsung ke editor Google Apps Script Anda.',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch {
      // Fallback
    }
  };

  const handleDownload = (target: 'HTML' | 'GAS') => {
    const content =
      target === 'HTML' ? STANDALONE_HTML_CODE : GOOGLE_APPS_SCRIPT_CODE;
    const filename = target === 'HTML' ? 'Index.html' : 'Code.gs';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanGasWebAppUrl(urlInput);
    if (!cleaned) {
      await Swal.fire({
        icon: 'warning',
        title: 'URL Web App Belum Diisi',
        text: 'Silakan tempel URL Web App Google Apps Script Anda (https://script.google.com/macros/s/.../exec).',
        confirmButtonColor: '#0B4627',
      });
      return;
    }
    setUrlInput(cleaned);
    await onSaveAndTestGasUrl(cleaned);
  };

  return (
    <div className="space-y-6" data-testid="source-code-panel">
      {/* Status Database Utama (Firebase Firestore) & Akses Email Tim */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-teal-200/90 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/70 mb-2">
              <Cloud className="w-3.5 h-3.5" />
              <span>Database Utama Real-Time (Firebase Firestore)</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Mode Hybrid: Database Cepat + Mirror Otomatis ke Spreadsheet
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Seluruh input kini tersimpan cepat &amp; real-time di <strong>Firestore</strong> ({firebaseUserEmail || '-'}), lalu otomatis disalin ke <strong>Google Spreadsheet</strong> di latar belakang tanpa membuat layar menunggu.
            </p>
          </div>
          {gasWebAppUrl && (
            <button
              type="button"
              onClick={onPullFromGasNow}
              disabled={isSyncingGas}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGas ? 'animate-spin' : ''}`} />
              <span>Tarik &amp; Impor Sheet → Cloud</span>
            </button>
          )}
        </div>

        {onAddStaffEmail && (
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Daftar Email Google Tim yang Diizinkan Login (Masing-Masing Admin/Ustadz Punya Email Sendiri)
                </p>
                <p className="text-[11px] text-slate-500">
                  Akun utama <code>stafsdm.alandalus@gmail.com</code> selalu memiliki akses penuh. Saat email tim ditambah/dihapus, hak akses data lama &amp; baru di Cloud otomatis disinkronkan.
                </p>
              </div>
              {onSyncStaffAccessNow && (
                <button
                  type="button"
                  onClick={onSyncStaffAccessNow}
                  disabled={isSyncingAccess}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-teal-50 text-teal-800 border border-teal-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAccess ? 'animate-spin' : ''}`} />
                  <span>{isSyncingAccess ? 'Menyelaraskan...' : 'Sinkronkan Akses Semua Data Cloud'}</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="email"
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                placeholder="email.ustadz@gmail.com"
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
              <input
                type="text"
                value={newStaffNama}
                onChange={(e) => setNewStaffNama(e.target.value)}
                placeholder="Nama Ustadz / Admin"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
              <div className="flex gap-1.5">
                <select
                  value={newStaffRole}
                  onChange={(e) =>
                    setNewStaffRole(
                      e.target.value as 'admin_pusat' | 'admin_pengasuhan' | 'user'
                    )
                  }
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800"
                >
                  <option value="admin_pengasuhan">Admin Pengasuhan</option>
                  <option value="user">Musyrif</option>
                  <option value="admin_pusat">Admin Pusat</option>
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newStaffEmail.trim()) return;
                    await onAddStaffEmail(
                      newStaffEmail.trim(),
                      newStaffNama.trim() || newStaffEmail.trim(),
                      newStaffRole
                    );
                    setNewStaffEmail('');
                    setNewStaffNama('');
                  }}
                  className="px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>

            {staffAccessList.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {staffAccessList.map((st) => (
                  <span
                    key={st.email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-800"
                  >
                    <span className="font-semibold">{st.nama || st.email}</span>
                    <span className="text-slate-500">({st.email})</span>
                    {onRemoveStaffEmail && (
                      <button
                        type="button"
                        onClick={() => onRemoveStaffEmail(st.email)}
                        className="text-rose-600 hover:text-rose-800 cursor-pointer"
                        title="Hapus akses"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            <div className="rounded-xl bg-amber-50/90 border border-amber-200 px-3 py-2 text-[11px] text-amber-950 space-y-1">
              <p className="font-bold">Checklist Wajib 1x Agar Semua Email Bisa Login di Vercel / Domain Sendiri:</p>
              <p>1. Buka <strong>Firebase Console → Authentication → Settings → Authorized domains</strong> lalu tambahkan domain web Anda (mis. <code>nama-app.vercel.app</code>).</p>
              <p>2. Jika memperbarui <code>Code.gs</code>, lakukan <strong>Deploy → Manage deployments → Edit (ikon pensil) → Version: New version → Deploy</strong>.</p>
            </div>
          </div>
        )}
      </div>

      {/* Koneksi Langsung Web App ke Google Sheets via URL Google Apps Script */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-200/90">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/70">
                <Link2 className="w-3.5 h-3.5" />
                <span>Sinkronisasi Real-Time Google Sheets</span>
              </div>
              {gasWebAppUrl ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>URL Script Tersimpan</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/70">
                  <span>Mode Data Lokal (Belum Terhubung ke URL /exec)</span>
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Hubungkan Aplikasi Ini dengan Google Spreadsheet Anda
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Tempel URL <strong>Web App Google Apps Script</strong> (<code className="font-mono">https://script.google.com/macros/s/.../exec</code>) di bawah ini agar semua input laporan Musyrif, password <code className="font-mono">users_role</code> / <code className="font-mono">users-role</code>, <code className="font-mono">Master_Data</code>, dan <code className="font-mono">Data_UKP</code> langsung tersinkron dua arah dengan Google Sheet Anda.
            </p>
          </div>

          {gasWebAppUrl && (
            <button
              type="button"
              onClick={onPullFromGasNow}
              disabled={isSyncingGas}
              data-testid="btn-pull-gas-now"
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncingGas ? 'animate-spin' : ''}`}
              />
              <span>Tarik Data Sheet Sekarang</span>
            </button>
          )}
        </div>

        <form
          onSubmit={handleConnectSubmit}
          noValidate
          className="mt-4 flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            data-testid="input-gas-webapp-url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Tempel URL Web App: https://script.google.com/macros/s/AKfycb.../exec"
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-500/20"
          />
          <button
            type="submit"
            disabled={isSyncingGas}
            data-testid="btn-save-gas-url"
            className="min-h-[42px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>
              {isSyncingGas
                ? 'Menyinkronkan...'
                : 'Simpan & Sinkronkan Google Sheet'}
            </span>
          </button>
          {gasWebAppUrl && (
            <button
              type="button"
              onClick={async () => {
                setUrlInput('');
                await onSaveAndTestGasUrl('');
              }}
              className="min-h-[42px] px-3.5 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Putuskan</span>
            </button>
          )}
        </form>
      </div>

      {/* Panduan 4 Langkah Pemasangan di Google Sheets & Google Apps Script */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90">
        <h3 className="text-base font-bold text-slate-900">
          Langkah-Langkah Agar Google Sheet Sinkron Otomatis
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Ikuti 4 langkah mudah berikut pada file Google Spreadsheet Pesantren Islam Internasional Al-Andalus:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <div className="rounded-2xl bg-stone-50 border border-slate-200/70 p-4">
            <p className="text-xs font-bold text-emerald-800">
              01. Buka Extensions → Apps Script
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Buka Google Sheet Anda, klik menu <strong>Extensions → Apps Script</strong>. Salin seluruh kode <code className="font-mono text-slate-900">Code.gs</code> di bawah ini ke dalam editor.
            </p>
          </div>

          <div className="rounded-2xl bg-stone-50 border border-slate-200/70 p-4">
            <p className="text-xs font-bold text-emerald-800">
              02. Jalankan setupSheetsOtomatis()
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Pilih fungsi <code className="font-mono text-slate-900">setupSheetsOtomatis</code> di toolbar atas Apps Script lalu klik <strong>Run</strong>. Ke-4 tab (<code className="font-mono">Master_Data</code>, <code className="font-mono">Laporan_Musyrif</code>, <code className="font-mono">Data_UKP</code>, <code className="font-mono">users_role</code>) otomatis dibuat!
            </p>
          </div>

          <div className="rounded-2xl bg-stone-50 border border-slate-200/70 p-4">
            <p className="text-xs font-bold text-emerald-800">
              03. Pasang Trigger syncStatusUKP()
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Jalankan fungsi <code className="font-mono text-slate-900">pasangTriggerSyncUKP()</code> sekali agar status UKP dari <code className="font-mono">Data_UKP</code> disinkronkan otomatis setiap 5 menit.
            </p>
          </div>

          <div className="rounded-2xl bg-stone-50 border border-slate-200/70 p-4">
            <p className="text-xs font-bold text-emerald-800">
              04. Deploy Web App &amp; Tempel URL
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Klik <strong>Deploy → New deployment → Web app</strong> (<em>Execute as: Me</em>, <em>Who has access: Anyone</em>). Salin URL <code className="font-mono">/exec</code> lalu tempel di kolom atas!
            </p>
          </div>
        </div>
      </div>

      {/* Kartu Unduh Paket Siap Upload ke Netlify / Cloudflare Pages */}
      <div className="bg-gradient-to-r from-[#07361D] via-[#0B4627] to-[#07361D] text-white rounded-3xl p-6 shadow-sm border border-[#D4AF37]/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-block text-[11px] font-bold bg-[#F5D000] text-[#07361D] px-2.5 py-0.5 rounded-md">
              Versi Ringkas 1-File (Anti Gagal Upload di Netlify &amp; Cloudflare)
            </span>
            <h3 className="text-base font-bold text-white">
              Unduh Paket Siap Upload (Seluruh Aplikasi + Logo Menyatu dalam 1 File <code className="font-mono">index.html</code>)
            </h3>
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              Agar tidak muncul error <em>&ldquo;We&apos;re having some trouble connecting you to Netlify&rdquo;</em>:
              <br />
              1. Buka Netlify atau <strong>Cloudflare Pages</strong> menggunakan <strong>Jendela Incognito / Mode Samaran (Ctrl + Shift + N)</strong> agar tidak diblokir ekstensi browser / AdBlock.
              <br />
              2. Unduh <strong>ZIP 1-File</strong> di samping (atau unduh file <strong>index.html Mandiri</strong>, masukkan ke dalam 1 folder kosong di laptop, lalu tarik <strong>folder</strong> tersebut ke kotak upload).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href="/netlify-dist-siap-upload.zip"
              download="netlify-dist-siap-upload.zip"
              data-testid="btn-download-netlify-zip"
              className="min-h-[44px] px-4 py-3 rounded-xl bg-[#F5D000] hover:bg-amber-300 text-[#07361D] text-xs font-extrabold transition flex items-center gap-2 shadow-sm no-underline cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh ZIP 1-File (Netlify/Cloudflare)</span>
            </a>

            <a
              href="/index-mandiri.html"
              download="index.html"
              data-testid="btn-download-standalone-html"
              className="min-h-[44px] px-4 py-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-white text-xs font-bold transition flex items-center gap-2 no-underline cursor-pointer"
            >
              <FileCode className="w-4 h-4" />
              <span>Unduh index.html Mandiri</span>
            </a>
          </div>
        </div>
      </div>

      {/* Code Viewer Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setSelectedFile('GAS')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                selectedFile === 'GAS'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>(1) Code.gs — Backend 4 Sheet &amp; syncStatusUKP()</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFile('HTML')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                selectedFile === 'HTML'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-4 h-4" />
              <span>(2) Index.html — Frontend Standalone</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(selectedFile)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {copiedFile === selectedFile ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Berhasil Disalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin Kode {activeFilename}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleDownload(selectedFile)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span>Unduh {activeFilename}</span>
            </button>
          </div>
        </div>

        {/* Highlight Spesifikasi yang Dipenuhi */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
          {selectedFile === 'HTML' ? (
            <>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Tailwind CSS via CDN
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                SweetAlert2 via CDN
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Autocomplete Master_Data + Readonly Kelas &amp; Kamar
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Footer Bidang Pengasuhan Pesantren Al-Andalus
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Otomatis Buat 4 Sheet (<code className="font-mono">setupSheetsOtomatis()</code>)
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                API Sinkronisasi 2 Arah (<code className="font-mono">doGet</code> &amp; <code className="font-mono">doPost</code>)
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Pencarian Bottom-Up <code className="font-mono">syncStatusUKP()</code>
              </span>
            </>
          )}
        </div>

        {/* Blok Kode */}
        <div className="rounded-2xl bg-slate-950 text-slate-100 p-4 overflow-x-auto max-h-[540px] overflow-y-auto border border-slate-800">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span>{activeFilename}</span>
            </span>
            <span>UTF-8 · Siap Tempel di Google Apps Script</span>
          </div>
          <pre className="text-xs font-mono leading-relaxed select-all">
            <code>{activeCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

