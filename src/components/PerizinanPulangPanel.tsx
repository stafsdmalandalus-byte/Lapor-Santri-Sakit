import React, { useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
  FileText,
  Printer,
  PlusCircle,
  Search,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Download,
  Trash2,
  CalendarRange,
  RotateCcw,
  UserCheck,
  Building2,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import {
  type MasterSantri,
  type DateRangeFilter,
  getTodayDateISO,
  getDynamicDatePresets,
} from '../utils/ukpSyncEngine';
import {
  type PerizinanRow,
  type PerizinanInput,
  KATEGORI_IZIN_OPTIONS,
  REKOMENDASI_OPTIONS,
  searchSantriForPerizinan,
  getIndonesianDayName,
  calculateDurationDays,
  getPerizinanStatus,
  calculatePerizinanOverview,
  filterPerizinanByDateAndName,
  generatePerizinanWhatsAppReport,
  generatePerizinanCsvReport,
  getPerizinanRowKey,
  formatSuratDateIndo,
  formatKeperluanTujuan,
  getSuratIzinFileName,
  generateSingleSuratWhatsAppPayload,
  renderSuratIzinToCanvasBlob,
  parsePerpanjanganInfo,
  TTD_UST_AZIZ_DATA_URI,
  TTD_UST_AWLY_DATA_URI,
} from '../utils/perizinanEngine';

interface PerizinanPulangPanelProps {
  masterData: MasterSantri[];
  perizinanList: PerizinanRow[];
  logoUrl: string;
  onAddPerizinan: (input: PerizinanInput) => Promise<PerizinanRow>;
  onMarkPerizinanReturned: (
    row: PerizinanRow,
    tibaTanggal: string,
    keteranganTiba: string
  ) => void;
  onExtendPerizinan: (
    row: PerizinanRow,
    sampaiTanggalBaru: string,
    sampaiJamBaru: string,
    alasanPerpanjangan: string
  ) => PerizinanRow;
  onDeletePerizinan: (row: PerizinanRow) => void;
}

type PerizinanSubTab = 'rekap' | 'wa' | 'input' | 'surat';
type PerizinanStatusFilter = 'ALL' | 'ACTIVE' | 'OVERDUE' | 'RETURNED';

export const PerizinanPulangPanel: React.FC<PerizinanPulangPanelProps> = ({
  masterData,
  perizinanList,
  logoUrl,
  onAddPerizinan,
  onMarkPerizinanReturned,
  onExtendPerizinan,
  onDeletePerizinan,
}) => {
  const [subTab, setSubTab] = useState<PerizinanSubTab>('rekap');
  const [statusFilter, setStatusFilter] =
    useState<PerizinanStatusFilter>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({
    startDate: '',
    endDate: '',
  });
  const [searchName, setSearchName] = useState<string>('');

  // State Surat Izin yang sedang dipilih untuk dicetak
  const [selectedSuratRow, setSelectedSuratRow] = useState<PerizinanRow | null>(
    () => perizinanList[0] || null
  );
  const [kasiKedisiplinan, setKasiKedisiplinan] = useState<string>(
    'Ust. Abdul Aziz'
  );
  const [kabidPengasuhan, setKabidPengasuhan] = useState<string>(
    'Ust. Muhammad Awly Yusuf, S.Pd.'
  );
  const [suratWaPhone, setSuratWaPhone] = useState<string>('');
  const [isSendingSuratWa, setIsSendingSuratWa] = useState<boolean>(false);

  // State Rekap WA Perizinan
  const [waFilterMode, setWaFilterMode] = useState<
    'ACTIVE_ONLY' | 'DATE_MATCH' | 'ALL'
  >('ACTIVE_ONLY');
  const [waTargetDate, setWaTargetDate] = useState<string>(() =>
    getTodayDateISO()
  );
  const [waPhoneNumber, setWaPhoneNumber] = useState<string>('');
  const [copiedWa, setCopiedWa] = useState<boolean>(false);

  // State Form Input Perizinan Baru
  const [santriQuery, setSantriQuery] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [nama, setNama] = useState<string>('');
  const [kelas, setKelas] = useState<string>('');
  const [gedung, setGedung] = useState<string>('');
  const [kamar, setKamar] = useState<string>('');
  const [pengasuh1, setPengasuh1] = useState<string>('');
  const [pengasuh2, setPengasuh2] = useState<string>('');
  const [izin, setIzin] = useState<string>('Berobat / Periksa');
  const [keterangan, setKeterangan] = useState<string>('');
  const [tujuan, setTujuan] = useState<string>('Dokter');
  const [rekomendasi, setRekomendasi] = useState<string>('Dokter');
  const [dariTanggal, setDariTanggal] = useState<string>(() =>
    getTodayDateISO()
  );
  const [dariJam, setDariJam] = useState<string>('08:00');
  const [sampaiTanggal, setSampaiTanggal] = useState<string>(() =>
    getTodayDateISO()
  );
  const [sampaiJam, setSampaiJam] = useState<string>('17:00');

  const todayISO = getTodayDateISO();
  const datePresets = getDynamicDatePresets();

  const santriSuggestions = useMemo(
    () => searchSantriForPerizinan(santriQuery, masterData).slice(0, 60),
    [santriQuery, masterData]
  );

  const filteredByDateAndName = useMemo(
    () => filterPerizinanByDateAndName(perizinanList, dateRange, searchName),
    [perizinanList, dateRange, searchName]
  );

  const stats = useMemo(
    () => calculatePerizinanOverview(filteredByDateAndName, todayISO),
    [filteredByDateAndName, todayISO]
  );

  const statusFilteredRows = useMemo(() => {
    return filteredByDateAndName.filter((row) => {
      const st = getPerizinanStatus(row, todayISO);
      if (statusFilter === 'ACTIVE') return st !== 'RETURNED';
      if (statusFilter === 'OVERDUE') return st === 'OVERDUE';
      if (statusFilter === 'RETURNED') return st === 'RETURNED';
      return true;
    });
  }, [filteredByDateAndName, statusFilter, todayISO]);

  const pieData = [
    {
      name: 'Sudah Kembali',
      key: 'RETURNED' as const,
      value: stats.returned,
      color: '#059669',
    },
    {
      name: 'Sedang Izin',
      key: 'ACTIVE' as const,
      value: Math.max(0, stats.activeOut - stats.overdue),
      color: '#d97706',
    },
    {
      name: 'Terlambat Kembali',
      key: 'OVERDUE' as const,
      value: stats.overdue,
      color: '#e11d48',
    },
  ];

  const chartData =
    stats.total > 0
      ? pieData.filter((d) => d.value > 0)
      : [{ name: 'Belum Ada Data', key: 'ALL', value: 1, color: '#e2e8f0' }];

  const waReport = useMemo(
    () =>
      generatePerizinanWhatsAppReport(
        perizinanList,
        waTargetDate,
        waFilterMode,
        waPhoneNumber,
        todayISO
      ),
    [perizinanList, waTargetDate, waFilterMode, waPhoneNumber, todayISO]
  );

  const handleSelectSantriProfile = (
    profile: ReturnType<typeof searchSantriForPerizinan>[number]
  ) => {
    setSantriQuery(profile.namaSantri);
    setNama(profile.namaSantri);
    setKelas(profile.kelas);
    setGedung(profile.gedung);
    setKamar(profile.kamar);
    setPengasuh1(profile.pengasuh1);
    setPengasuh2(profile.pengasuh2);
    setShowSuggestions(false);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: 'Pilih Nama Santri',
        text: 'Silakan ketik dan pilih Nama Santri terlebih dahulu.',
        confirmButtonColor: '#0B4627',
      });
      return;
    }
    if (!dariTanggal || !sampaiTanggal) {
      await Swal.fire({
        icon: 'warning',
        title: 'Tanggal Belum Lengkap',
        text: 'Silakan isi Dari Tanggal dan Sampai Tanggal izin pulang.',
        confirmButtonColor: '#0B4627',
      });
      return;
    }

    const newRow = await onAddPerizinan({
      nama,
      kelas: kelas || '-',
      gedung: gedung || '-',
      kamar: kamar || '-',
      izin,
      keterangan,
      tujuan,
      rekomendasi,
      dariTanggal,
      dariJam,
      sampaiTanggal,
      sampaiJam,
      pengasuh1: pengasuh1 || '-',
      pengasuh2: pengasuh2 || '-',
    });

    setSelectedSuratRow(newRow);
    setSantriQuery('');
    setNama('');
    setKelas('');
    setGedung('');
    setKamar('');
    setPengasuh1('');
    setPengasuh2('');
    setKeterangan('');

    const suratName = getSuratIzinFileName(newRow);
    const result = await Swal.fire({
      icon: 'success',
      title: `Izin Pulang Dicatat (Nomor #${newRow.no})`,
      html: `<div class="text-xs text-slate-600 space-y-1 text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
        <p><b>Nama Surat Otomatis:</b> <span class="font-mono text-emerald-800 font-bold">${suratName}</span></p>
        <p><b>Nama Santri:</b> ${newRow.nama} (${newRow.kelas})</p>
        <p><b>Kamar:</b> ${newRow.kamar} (${newRow.gedung})</p>
        <p><b>Keperluan / Tujuan:</b> ${formatKeperluanTujuan(newRow)}</p>
        <p><b>Jadwal Izin:</b> ${formatSuratDateIndo(newRow.dariTanggal)} s/d ${formatSuratDateIndo(newRow.sampaiTanggal)}</p>
      </div>`,
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: '📲 Kirim Surat ke WhatsApp',
      denyButtonText: '🖨️ Lihat & Cetak Surat Izin',
      cancelButtonText: 'Tutup',
      confirmButtonColor: '#059669',
      denyButtonColor: '#0B4627',
    });

    if (result.isConfirmed) {
      setSubTab('surat');
      await handleSendSingleSuratToWhatsApp(newRow);
    } else if (result.isDenied) {
      setSubTab('surat');
    }
  };

  const handleOpenMarkReturnedModal = async (row: PerizinanRow) => {
    const { value: formValues } = await Swal.fire({
      title: 'Catat Kedatangan Santri',
      html: `
        <div class="text-left space-y-3 text-xs">
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <p class="font-bold text-emerald-950">${row.nama} (${row.kelas})</p>
            <p class="text-slate-600">Batas Kembali: <b>${row.sampaiHari}, ${row.sampaiTanggal}</b></p>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Tanggal Tiba di Pesantren</label>
            <input id="swal-tiba-tanggal" type="date" value="${row.tibaTanggal || todayISO}" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Keterangan Kedatangan</label>
            <input id="swal-tiba-ket" type="text" value="${row.keteranganTiba || 'Tepat Waktu'}" placeholder="Contoh: Tepat Waktu / Diantar Wali" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs" />
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Simpan Kedatangan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#0B4627',
      preConfirm: () => {
        const tglEl = document.getElementById(
          'swal-tiba-tanggal'
        ) as HTMLInputElement | null;
        const ketEl = document.getElementById(
          'swal-tiba-ket'
        ) as HTMLInputElement | null;
        return {
          tibaTanggal: tglEl?.value || todayISO,
          keteranganTiba: ketEl?.value || 'Tepat Waktu',
        };
      },
    });

    if (formValues) {
      onMarkPerizinanReturned(
        row,
        formValues.tibaTanggal,
        formValues.keteranganTiba
      );
      await Swal.fire({
        icon: 'success',
        title: 'Kedatangan Tercatat',
        text: `${row.nama} telah ditandai kembali ke pondok pada ${formValues.tibaTanggal}.`,
        timer: 1600,
        showConfirmButton: false,
      });
    }
  };

  const handleOpenExtendPerizinanModal = async (row: PerizinanRow) => {
    const extInfo = parsePerpanjanganInfo(row);
    // Default tanggal perpanjangan: +2 hari dari hari ini atau dari sampaiTanggal
    const baseDateStr =
      row.sampaiTanggal && row.sampaiTanggal > todayISO
        ? row.sampaiTanggal
        : todayISO;
    const [by, bm, bd] = baseDateStr.split('-').map(Number);
    const nextDt = new Date(by, (bm || 1) - 1, (bd || 1) + 2);
    const defaultNextISO = `${nextDt.getFullYear()}-${String(nextDt.getMonth() + 1).padStart(2, '0')}-${String(nextDt.getDate()).padStart(2, '0')}`;

    const { value: formValues } = await Swal.fire({
      title: 'Perpanjang Masa Izin Pulang',
      html: `
        <div class="text-left space-y-3 text-xs">
          <div class="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
            <p class="font-bold text-amber-950">No. #${row.no} — ${row.nama} (${row.kelas} · ${row.kamar})</p>
            <p class="text-slate-600">Izin Dari: <b>${formatSuratDateIndo(row.dariTanggal)}</b></p>
            <p class="text-rose-700 font-semibold">Batas Kembali Semula: <b>${formatSuratDateIndo(extInfo.sampaiTanggalAwal || row.sampaiTanggal)}</b></p>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Perpanjang Sampai Tanggal</label>
              <input id="swal-ext-tanggal" type="date" value="${defaultNextISO}" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono" />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Sampai Jam</label>
              <input id="swal-ext-jam" type="time" value="${row.sampaiJam || '17:00'}" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono" />
            </div>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Alasan / Keterangan Perpanjangan</label>
            <input id="swal-ext-alasan" type="text" value="${extInfo.alasanPerpanjangan || ''}" placeholder="Contoh: Masih pemulihan / kontrol dokter lanjutan" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs" />
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '⏳ Simpan Perpanjangan & Perbarui Surat',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#d97706',
      preConfirm: () => {
        const tglEl = document.getElementById(
          'swal-ext-tanggal'
        ) as HTMLInputElement | null;
        const jamEl = document.getElementById(
          'swal-ext-jam'
        ) as HTMLInputElement | null;
        const alasanEl = document.getElementById(
          'swal-ext-alasan'
        ) as HTMLInputElement | null;
        return {
          sampaiTanggalBaru: tglEl?.value || defaultNextISO,
          sampaiJamBaru: jamEl?.value || '17:00',
          alasanPerpanjangan: alasanEl?.value || '',
        };
      },
    });

    if (formValues) {
      const updatedRow = onExtendPerizinan(
        row,
        formValues.sampaiTanggalBaru,
        formValues.sampaiJamBaru,
        formValues.alasanPerpanjangan
      );
      setSelectedSuratRow(updatedRow);
      const updatedExt = parsePerpanjanganInfo(updatedRow);
      const suratName = getSuratIzinFileName(updatedRow);

      const actionChoice = await Swal.fire({
        icon: 'success',
        title: `Masa Izin Diperpanjang (Ke-${updatedExt.perpanjanganKe})`,
        html: `<div class="text-xs text-slate-600 space-y-1 text-left bg-amber-50/70 p-3 rounded-xl border border-amber-200">
          <p><b>Nama Surat:</b> <span class="font-mono text-emerald-800 font-bold">${suratName}</span></p>
          <p><b>Santri:</b> ${updatedRow.nama} (${updatedRow.kelas} · ${updatedRow.kamar})</p>
          <p><b>Batas Awal:</b> ${formatSuratDateIndo(updatedExt.sampaiTanggalAwal)}</p>
          <p><b>Diperpanjang s/d:</b> <b class="text-emerald-800">${formatSuratDateIndo(updatedRow.sampaiTanggal)} (${updatedRow.durasi})</b></p>
          ${updatedExt.alasanPerpanjangan ? `<p><b>Keterangan Perpanjangan:</b> ${updatedExt.alasanPerpanjangan}</p>` : ''}
        </div>`,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '📲 Kirim Surat Perpanjangan ke WA',
        denyButtonText: '🖨️ Lihat & Cetak Surat Perpanjangan',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#059669',
        denyButtonColor: '#0B4627',
      });

      if (actionChoice.isConfirmed) {
        setSubTab('surat');
        await handleSendSingleSuratToWhatsApp(updatedRow);
      } else if (actionChoice.isDenied) {
        setSubTab('surat');
      }
    }
  };

  const handleCopyWaPerizinan = async () => {
    try {
      await navigator.clipboard.writeText(waReport.text);
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 2500);
      await Swal.fire({
        icon: 'success',
        title: 'Rekap Perizinan WA Disalin!',
        html: `<div class="text-left text-xs text-slate-600 space-y-2">
          <p>Ringkasan perizinan pulang santri (${waReport.count} santri) berhasil disalin dan siap ditempel ke grup WhatsApp:</p>
          <pre class="bg-slate-100 p-3 rounded-xl font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">${waReport.text}</pre>
        </div>`,
        confirmButtonColor: '#0B4627',
      });
    } catch {
      // ignore
    }
  };

  const handleDownloadCsv = () => {
    const csv = generatePerizinanCsvReport(
      statusFilteredRows,
      dateRange.startDate || 'Semua_Waktu'
    );
    const csvWithBom = '\uFEFF' + csv.csvContent;
    const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = csv.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintSurat = (targetRow?: PerizinanRow) => {
    const rowToPrint = targetRow || activeSurat;
    if (!rowToPrint) return;
    const prevTitle = document.title;
    // Set document.title sesuai "Nama Anak - Kelas" agar saat Save as PDF namanya otomatis sesuai
    document.title = getSuratIzinFileName(rowToPrint);
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1200);
  };

  const handleDownloadSuratImage = async (targetRow?: PerizinanRow) => {
    const row = targetRow || activeSurat;
    if (!row) return;
    const fileNamePng = getSuratIzinFileName(row, 'png');
    try {
      const blob = await renderSuratIzinToCanvasBlob(
        row,
        logoUrl,
        kasiKedisiplinan,
        kabidPengasuhan
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileNamePng;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const handleSendSingleSuratToWhatsApp = async (targetRow?: PerizinanRow) => {
    const row = targetRow || activeSurat;
    if (!row) return;
    setSelectedSuratRow(row);
    setIsSendingSuratWa(true);

    const payload = generateSingleSuratWhatsAppPayload(
      row,
      suratWaPhone,
      kasiKedisiplinan,
      kabidPengasuhan
    );

    try {
      const blob = await renderSuratIzinToCanvasBlob(
        row,
        logoUrl,
        kasiKedisiplinan,
        kabidPengasuhan
      );
      const file = new File([blob], payload.fileNamePng, { type: 'image/png' });

      // 1. Jika di HP / Browser yang mendukung Web Share API untuk file gambar, kirim langsung file "Nama - Kelas.png" ke WhatsApp
      const nav = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (
        typeof nav.share === 'function' &&
        typeof nav.canShare === 'function' &&
        nav.canShare({ files: [file] })
      ) {
        try {
          await nav.share({
            title: payload.suratName,
            text: payload.text,
            files: [file],
          });
          setIsSendingSuratWa(false);
          return;
        } catch {
          // Jika user membatalkan native share sheet, lanjutkan ke fallback unduh + buka WA
        }
      }

      // 2. Salin gambar Surat Izin ke Clipboard (agar bisa langsung Ctrl+V / Paste di WhatsApp Web/Desktop)
      let imageCopiedToClipboard = false;
      if (
        typeof navigator.clipboard !== 'undefined' &&
        typeof ClipboardItem !== 'undefined'
      ) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          imageCopiedToClipboard = true;
        } catch {
          // Fallback salin teks
          try {
            await navigator.clipboard.writeText(payload.text);
          } catch {
            // ignore
          }
        }
      }

      // 3. Unduh otomatis file Surat Izin dengan nama sesuai "Nama Anak - Kelas.png"
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = payload.fileNamePng;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // 4. Tampilkan konfirmasi dengan tombol langsung menuju WhatsApp (wa.me)
      await Swal.fire({
        icon: 'success',
        title: `Surat Siap Dikirim: ${payload.suratName}`,
        html: `<div class="text-left text-xs text-slate-600 space-y-2.5">
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
            <p class="font-bold text-emerald-950">📄 Nama File Surat: <span class="font-mono">${payload.fileNamePng}</span></p>
            <p class="text-slate-600">File gambar surat izin telah otomatis diunduh dengan nama <b>${payload.fileNamePng}</b>${imageCopiedToClipboard ? ' dan <b>disalin ke Clipboard</b> (bisa langsung tekan <b>Ctrl+V / Paste</b> di chat WhatsApp).' : '.'}</p>
          </div>
          <a
            href="${payload.waUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 no-underline shadow-xs"
          >
            <span>📲 Buka Chat WhatsApp &amp; Kirim Surat (${payload.suratName})</span>
          </a>
        </div>`,
        showConfirmButton: true,
        confirmButtonText: 'Selesai',
        confirmButtonColor: '#0B4627',
      });
    } finally {
      setIsSendingSuratWa(false);
    }
  };

  const activeSurat = selectedSuratRow || perizinanList[0] || null;

  return (
    <div className="space-y-5" data-testid="perizinan-pulang-panel">
      {/* Sub-Navigasi Fitur Perizinan Pulang (Khusus Admin Pengasuhan & Admin Pusat/SDM) */}
      <div className="bg-white rounded-2xl p-2 shadow-xs border border-slate-200/90 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="subtab-perizinan-rekap"
            onClick={() => setSubTab('rekap')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              subTab === 'rekap'
                ? 'bg-[#07361D] text-[#F5D000]'
                : 'text-slate-700 hover:bg-stone-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>📊 Rekap &amp; Pantauan Izin ({perizinanList.length})</span>
          </button>

          <button
            type="button"
            data-testid="subtab-perizinan-wa"
            onClick={() => setSubTab('wa')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              subTab === 'wa'
                ? 'bg-[#07361D] text-[#F5D000]'
                : 'text-slate-700 hover:bg-stone-100'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>💬 Rekap Izin ke WA</span>
          </button>

          <button
            type="button"
            data-testid="subtab-perizinan-input"
            onClick={() => setSubTab('input')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              subTab === 'input'
                ? 'bg-[#07361D] text-[#F5D000]'
                : 'text-slate-700 hover:bg-stone-100'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>📝 Catat Izin Pulang Baru</span>
          </button>

          <button
            type="button"
            data-testid="subtab-perizinan-surat"
            onClick={() => setSubTab('surat')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              subTab === 'surat'
                ? 'bg-[#07361D] text-[#F5D000]'
                : 'text-slate-700 hover:bg-stone-100'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>🖨️ Surat Izin Santri (Cetak)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleDownloadCsv}
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh CSV Perizinan</span>
        </button>
      </div>

      {/* SUB-TAB 1: REKAP & PANTAUAN IZIN PULANG */}
      {subTab === 'rekap' && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Rekapitulasi &amp; Pantauan Perizinan Pulang Santri
              </h3>
              <p className="text-xs text-slate-500">
                Khusus Mode Admin Pengasuhan &amp; SDM · Terintegrasi dengan struktur sheet <span className="font-mono">Perizinan</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('input')}
              className="min-h-[38px] px-3.5 py-2 rounded-xl bg-[#07361D] hover:bg-[#0B4627] text-[#F5D000] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Catat Santri Izin Pulang</span>
            </button>
          </div>

          {/* Filter Tanggal & Pencarian Nama Santri */}
          <div className="rounded-2xl bg-stone-50/90 border border-slate-200/80 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <CalendarRange className="w-3.5 h-3.5 text-emerald-700" />
                <span>Filter Tanggal Izin &amp; Pencarian Nama Santri</span>
              </div>
              {(dateRange.startDate || dateRange.endDate || searchName) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateRange({ startDate: '', endDate: '' });
                    setSearchName('');
                  }}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {datePresets.map((preset) => {
                const active =
                  dateRange.startDate === preset.startDate &&
                  dateRange.endDate === preset.endDate;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setDateRange({
                        startDate: preset.startDate,
                        endDate: preset.endDate,
                      })
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, startDate: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, endDate: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Cari Nama Santri / Kelas / Kamar
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Ketik nama santri..."
                    className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-7 py-1.5 text-xs"
                  />
                  {searchName && (
                    <button
                      type="button"
                      onClick={() => setSearchName('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4 Kartu Statistik Perizinan + PieChart */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`text-left rounded-2xl p-3.5 border transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-stone-50 hover:bg-stone-100 text-slate-900 border-slate-200'
              }`}
            >
              <span className="text-[11px] font-semibold opacity-80">
                Total Surat Izin
              </span>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                {stats.total}
              </p>
              <span className="text-[10px] opacity-75">Semua perizinan</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`text-left rounded-2xl p-3.5 border transition cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 border-amber-200'
              }`}
            >
              <span className="text-[11px] font-semibold">
                Sedang Izin Pulang
              </span>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                {stats.activeOut}
              </p>
              <span className="text-[10px]">Belum kembali ke pondok</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('OVERDUE')}
              className={`text-left rounded-2xl p-3.5 border transition cursor-pointer ${
                statusFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-rose-50/70 hover:bg-rose-100/70 text-rose-950 border-rose-200'
              }`}
            >
              <span className="text-[11px] font-semibold">
                Melewati Batas Izin
              </span>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                {stats.overdue}
              </p>
              <span className="text-[10px]">Perlu konfirmasi wali</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('RETURNED')}
              className={`text-left rounded-2xl p-3.5 border transition cursor-pointer ${
                statusFilter === 'RETURNED'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950 border-emerald-200'
              }`}
            >
              <span className="text-[11px] font-semibold">
                Sudah Tiba Kembali
              </span>
              <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                {stats.returned}
              </p>
              <span className="text-[10px]">
                Kembali ({stats.returnRate}%)
              </span>
            </button>
          </div>

          {/* Ringkasan Pie Chart */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-4">
            <div className="relative w-[84px] h-[84px] shrink-0 flex items-center justify-center">
              <PieChart width={84} height={84}>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={24}
                  outerRadius={38}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
              <span className="absolute text-[11px] font-bold font-mono">
                {stats.returnRate}%
              </span>
            </div>
            <div className="flex-1 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">
                Status Kepulangan Santri
              </p>
              <p>
                Klik tombol <strong>🖨️ Cetak Surat</strong> pada daftar di bawah untuk membuka <strong>Surat Izin Santri</strong> ber-logo resmi, atau klik <strong>✅ Catat Tiba</strong> saat santri kembali ke Pesantren.
              </p>
            </div>
          </div>

          {/* Daftar Baris Perizinan */}
          <div className="space-y-2.5 pt-2">
            {statusFilteredRows.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 bg-stone-50 rounded-2xl border border-slate-200/70">
                Tidak ada data perizinan santri pada filter ini.
              </div>
            ) : (
              statusFilteredRows.map((row, idx) => {
                const st = getPerizinanStatus(row, todayISO);
                const extInfo = parsePerpanjanganInfo(row);
                return (
                  <div
                    key={`${getPerizinanRowKey(row)}-${idx}`}
                    className={`rounded-2xl p-4 border transition ${
                      st === 'RETURNED'
                        ? 'bg-emerald-50/30 border-emerald-200/80'
                        : st === 'OVERDUE'
                        ? 'bg-rose-50/40 border-rose-300'
                        : 'bg-amber-50/40 border-amber-200/80'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">
                            No. {row.no}
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {row.nama}
                          </span>
                          <span className="text-xs text-slate-600">
                            ({row.kelas} · {row.kamar} · {row.gedung})
                          </span>
                          {st === 'RETURNED' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3" />
                              SUDAH TIBA ({row.tibaTanggal})
                            </span>
                          ) : st === 'OVERDUE' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-900 px-2 py-0.5 rounded-md">
                              <AlertTriangle className="w-3 h-3" />
                              LEWAT BATAS KEMBALI
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                              <Clock className="w-3 h-3" />
                              SEDANG IZIN PULANG
                            </span>
                          )}
                          {extInfo.isExtended && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-md border border-amber-300">
                              ⏳ DIPERPANJANG KE-{extInfo.perpanjanganKe} (Awal:{' '}
                              {extInfo.sampaiTanggalAwal})
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-800 mt-1">
                          <strong>Keperluan:</strong> {formatKeperluanTujuan(row)}
                          {row.rekomendasi
                            ? ` · Rekomendasi: ${row.rekomendasi}`
                            : ''}
                        </p>

                        <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
                          Jadwal: {row.dariHari}, {row.dariTanggal} ({row.dariJam || '08:00'}) s/d {row.sampaiHari}, {row.sampaiTanggal} ({row.sampaiJam || '17:00'}) · Durasi: <strong>{row.durasi}</strong>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Pengasuh 1: <strong>{row.pengasuh1}</strong> · Pengasuh 2: <strong>{row.pengasuh2}</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {st !== 'RETURNED' && (
                          <button
                            type="button"
                            data-testid={`btn-extend-izin-${row.no}`}
                            onClick={() => handleOpenExtendPerizinanModal(row)}
                            className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              st === 'OVERDUE'
                                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs ring-2 ring-amber-300'
                                : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                            }`}
                            title="Perpanjang Masa Izin & Perbarui Surat Izin"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Perpanjang Izin</span>
                          </button>
                        )}

                        <button
                          type="button"
                          data-testid={`btn-wa-surat-${row.no}`}
                          onClick={() => handleSendSingleSuratToWhatsApp(row)}
                          className="min-h-[34px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                          title={`Kirim Surat ${getSuratIzinFileName(row)} ke WhatsApp`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Kirim Surat ke WA</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`btn-print-surat-${row.no}`}
                          onClick={() => {
                            setSelectedSuratRow(row);
                            setSubTab('surat');
                          }}
                          className="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#07361D] hover:bg-[#0B4627] text-[#F5D000] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Lihat / Cetak Surat</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenMarkReturnedModal(row)}
                          className="min-h-[34px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>
                            {st === 'RETURNED' ? 'Edit Tiba' : 'Catat Tiba'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeletePerizinan(row)}
                          className="min-h-[34px] px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: REKAP PERIZINAN KE WHATSAPP */}
      {subTab === 'wa' && (
        <div
          data-testid="perizinan-wa-card"
          className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <MessageCircle className="w-4 h-4 text-emerald-700" />
                <span>Rekap Cepat Perizinan Pulang Santri ke WhatsApp</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kirim ringkasan daftar santri yang sedang izin pulang ke grup WhatsApp Pengasuhan / Pimpinan
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              {waReport.count} santri dalam rekap
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mode Rekap WA
              </label>
              <select
                value={waFilterMode}
                onChange={(e) =>
                  setWaFilterMode(
                    e.target.value as 'ACTIVE_ONLY' | 'DATE_MATCH' | 'ALL'
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="ACTIVE_ONLY">
                  Santri Sedang Izin Pulang (Belum Kembali)
                </option>
                <option value="DATE_MATCH">
                  Berdasarkan Tanggal Izin Tertentu
                </option>
                <option value="ALL">Semua Data Perizinan</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tanggal Referensi Laporan
              </label>
              <input
                type="date"
                value={waTargetDate}
                onChange={(e) => setWaTargetDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                No. WA Tujuan (Opsional)
              </label>
              <input
                type="tel"
                value={waPhoneNumber}
                onChange={(e) => setWaPhoneNumber(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          {/* Daftar Santri yang Masuk Rekap WA (Bisa Hapus / Tandai Kembali Sebelum Kirim WA) */}
          <div className="rounded-2xl bg-stone-50/90 border border-slate-200/80 p-4 space-y-2">
            <p className="text-xs font-bold text-slate-800">
              Daftar Santri pada Rekap WA Ini ({waReport.includedRows.length}{' '}
              Santri) — Periksa Sebelum Kirim
            </p>
            {waReport.includedRows.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500 bg-white rounded-xl border border-slate-200/60">
                Tidak ada santri pada filter rekap ini.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {waReport.includedRows.map((row, idx) => (
                  <div
                    key={`${getPerizinanRowKey(row)}-${idx}`}
                    className="rounded-xl bg-white border border-slate-200/80 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-mono font-bold text-slate-500 mr-1.5">
                        {idx + 1}.
                      </span>
                      <strong className="text-slate-900">{row.nama}</strong>{' '}
                      <span className="text-slate-500">
                        ({row.kelas} · {row.kamar})
                      </span>{' '}
                      — <span className="text-emerald-800">{row.izin}</span>
                      {row.keterangan ? ` (${row.keterangan})` : ''} ·{' '}
                      <span className="font-mono text-[11px]">
                        {row.dariTanggal} s/d {row.sampaiTanggal} ({row.durasi})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenExtendPerizinanModal(row)}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-600 text-amber-900 hover:text-white border border-amber-200 text-[11px] font-semibold transition cursor-pointer"
                      >
                        ⏳ Perpanjang
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenMarkReturnedModal(row)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-700 text-emerald-800 hover:text-white border border-emerald-200 text-[11px] font-semibold transition cursor-pointer"
                      >
                        Sudah Tiba
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePerizinan(row)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-[11px] font-semibold transition cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={waReport.waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Kirim Rekap Perizinan ke WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>

            <button
              type="button"
              onClick={handleCopyWaPerizinan}
              className="min-h-[42px] px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copiedWa ? (
                <>
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>Teks Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin Format Teks WA</span>
                </>
              )}
            </button>
          </div>

          <div className="rounded-2xl bg-emerald-50/50 border border-emerald-200/80 p-4">
            <p className="text-xs font-semibold text-emerald-900 mb-2">
              Pratinjau Pesan WhatsApp Perizinan Santri:
            </p>
            <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-emerald-100 max-h-96 overflow-y-auto">
              {waReport.text}
            </pre>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: FORM INPUT IZIN PULANG BARU */}
      {subTab === 'input' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90">
          <div className="pb-4 mb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Formulir Pencatatan Izin Pulang Santri &amp; Pembuatan Surat Izin
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Data santri diambil langsung dari sheet <strong className="font-mono text-emerald-800">Master_Data</strong> (database yang sama dengan Izin Sakit)
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
              Master_Data: {masterData.length} Santri
            </span>
          </div>

          <form onSubmit={handleSubmitForm} className="space-y-4">
            {/* Autocomplete Nama Santri dari Master_Data */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Cari &amp; Pilih Nama Santri (Dari Database <code className="font-mono text-emerald-800">Master_Data</code>)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  data-testid="input-perizinan-nama-santri"
                  value={santriQuery}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setSantriQuery(e.target.value);
                    setNama(e.target.value);
                    setShowSuggestions(true);
                  }}
                  placeholder="Ketik nama santri, kelas, atau asrama dari Master_Data..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 py-2.5 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
                {santriQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSantriQuery('');
                      setNama('');
                      setKelas('');
                      setGedung('');
                      setKamar('');
                      setPengasuh1('');
                      setPengasuh2('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showSuggestions && santriSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-2xl shadow-lg border border-slate-200 max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {santriSuggestions.map((item, i) => (
                    <button
                      key={`${item.nis}-${item.namaSantri}-${i}`}
                      type="button"
                      onClick={() => handleSelectSantriProfile(item)}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-emerald-50/70 transition flex items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {item.namaSantri}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          ID: <span className="font-mono">{item.nis}</span> · Kelas{' '}
                          <strong>{item.kelas}</strong> · Kamar/Asrama:{' '}
                          <strong>{item.kamar}</strong>
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Pilih
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info Otomatis: Kelas, Gedung, Kamar, Pengasuh 1 & 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-3.5 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Kelas / Rombel
                </label>
                <input
                  type="text"
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  placeholder="Otomatis..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Gedung Asrama
                </label>
                <input
                  type="text"
                  value={gedung}
                  onChange={(e) => setGedung(e.target.value)}
                  placeholder="Otomatis..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nama Kamar
                </label>
                <input
                  type="text"
                  value={kamar}
                  onChange={(e) => setKamar(e.target.value)}
                  placeholder="Otomatis..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                />
              </div>
              <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Pengasuh 1 / Guru Sakan
                  </label>
                  <input
                    type="text"
                    value={pengasuh1}
                    onChange={(e) => setPengasuh1(e.target.value)}
                    placeholder="Otomatis..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Pengasuh 2
                  </label>
                  <input
                    type="text"
                    value={pengasuh2}
                    onChange={(e) => setPengasuh2(e.target.value)}
                    placeholder="Otomatis..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Detail Keperluan Izin */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Izin (Kolom F)
                </label>
                <select
                  value={izin}
                  onChange={(e) => setIzin(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  {KATEGORI_IZIN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rekomendasi (Kolom I)
                </label>
                <select
                  value={rekomendasi}
                  onChange={(e) => setRekomendasi(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  {REKOMENDASI_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan Sakit / Detail Keperluan (Kolom G)
                </label>
                <input
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Contoh: Diare, demam, acara keluarga..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tujuan (Kolom H)
                </label>
                <input
                  type="text"
                  value={tujuan}
                  onChange={(e) => setTujuan(e.target.value)}
                  placeholder="Contoh: Dokter / Rumah Sakit / Rumah"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
            </div>

            {/* Waktu Dari & Sampai + Perhitungan Durasi Otomatis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/80">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-emerald-950">
                  Izin Dari Tanggal &amp; Jam (Hari:{' '}
                  {getIndonesianDayName(dariTanggal) || '-'})
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={dariTanggal}
                    onChange={(e) => setDariTanggal(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="time"
                    value={dariJam}
                    onChange={(e) => setDariJam(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-emerald-950">
                  Sampai Tanggal &amp; Jam (Hari:{' '}
                  {getIndonesianDayName(sampaiTanggal) || '-'})
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={sampaiTanggal}
                    onChange={(e) => setSampaiTanggal(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="time"
                    value={sampaiJam}
                    onChange={(e) => setSampaiJam(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 flex items-center justify-between text-xs pt-1 border-t border-emerald-200/60">
                <span className="text-emerald-900 font-medium">
                  Durasi Perizinan Otomatis:
                </span>
                <span className="font-mono font-bold text-emerald-950 bg-white px-3 py-1 rounded-lg border border-emerald-300">
                  {calculateDurationDays(dariTanggal, sampaiTanggal)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              data-testid="btn-submit-perizinan"
              className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-[#07361D] hover:bg-[#0B4627] text-[#F5D000] text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Simpan Perizinan &amp; Buat Surat Izin Santri</span>
            </button>
          </form>
        </div>
      )}

      {/* SUB-TAB 4: CETAK & KIRIM WA SURAT IZIN SANTRI (SESUAI DESAIN TERBARU BAGIAN KEDISIPLINAN AL-ANDALUS) */}
      {subTab === 'surat' && (
        <div className="space-y-4">
          {/* Toolbar Pilih Santri, Nama File Otomatis (Nama Anak + Kelas), & Kirim WA (Disembunyikan saat Print) */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 space-y-3 print:hidden">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Santri untuk Surat Izin:
                </label>
                <select
                  data-testid="select-surat-izin-santri"
                  value={activeSurat?.no || ''}
                  onChange={(e) => {
                    const found = perizinanList.find(
                      (r) => r.no === e.target.value
                    );
                    if (found) setSelectedSuratRow(found);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                >
                  {perizinanList.map((r, i) => (
                    <option key={`${r.no}-${i}`} value={r.no}>
                      No. {r.no} — {r.nama} ({r.kelas} · {r.kamar}) —{' '}
                      {formatKeperluanTujuan(r)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-56">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  No. WA Tujuan (Opsional)
                </label>
                <input
                  type="tel"
                  value={suratWaPhone}
                  onChange={(e) => setSuratWaPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            {activeSurat && (
              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="text-slate-600">
                    Nama Surat Otomatis (Nama Anak + Kelas):
                  </span>{' '}
                  <strong
                    data-testid="surat-auto-filename"
                    className="font-mono text-emerald-950 bg-white px-2 py-0.5 rounded border border-emerald-200"
                  >
                    {getSuratIzinFileName(activeSurat)}
                  </strong>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="btn-extend-active-surat"
                    onClick={() => handleOpenExtendPerizinanModal(activeSurat)}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>⏳ Perpanjang Masa Izin</span>
                  </button>

                  <button
                    type="button"
                    data-testid="btn-send-surat-wa"
                    disabled={isSendingSuratWa}
                    onClick={() => handleSendSingleSuratToWhatsApp(activeSurat)}
                    className="min-h-[38px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>
                      {isSendingSuratWa
                        ? 'Menyiapkan Surat...'
                        : `Kirim Surat Otomatis ke WA (${getSuratIzinFileName(activeSurat)})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="btn-download-surat-png"
                    onClick={() => handleDownloadSuratImage(activeSurat)}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 text-emerald-900 border border-emerald-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh {getSuratIzinFileName(activeSurat, 'png')}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="btn-print-official-surat"
                    onClick={() => handlePrintSurat(activeSurat)}
                    className="min-h-[38px] px-4 py-2 rounded-xl bg-[#07361D] hover:bg-[#0B4627] text-[#F5D000] text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak / PDF ({getSuratIzinFileName(activeSurat, 'pdf')})</span>
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Nama Kasi. Kedisiplinan (Pada Surat)
                </label>
                <input
                  type="text"
                  value={kasiKedisiplinan}
                  onChange={(e) => setKasiKedisiplinan(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Nama Kabid. Kepengasuhan (Pada Surat)
                </label>
                <input
                  type="text"
                  value={kabidPengasuhan}
                  onChange={(e) => setKabidPengasuhan(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                />
              </div>
            </div>
          </div>

          {/* KERTAS SURAT IZIN SANTRI (DENGAN TANDA TANGAN ASLI DARI PDF & DUKUNGAN FORMAT PERPANJANGAN IZIN) */}
          {activeSurat && (() => {
            const activeExtInfo = parsePerpanjanganInfo(activeSurat);
            return (
              <div
                id="printable-surat-izin"
                data-testid="printable-surat-izin"
                className="max-w-[740px] mx-auto bg-white p-6 sm:p-8 border border-slate-400 shadow-md print:shadow-none print:border print:border-slate-400 text-black font-sans"
              >
                {/* KOP SURAT DENGAN 2 LOGO DI KIRI & KANAN + GARIS TIPIS DI BAWAH */}
                <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-300">
                  <img
                    src={logoUrl}
                    alt="Logo Pesantren Al-Andalus"
                    referrerPolicy="no-referrer"
                    className="w-12 h-16 sm:w-14 sm:h-18 object-contain shrink-0"
                  />
                  <div className="text-center flex-1">
                    <h1 className="text-base sm:text-xl font-extrabold tracking-tight uppercase text-black leading-snug">
                      PESANTREN ISLAM INTERNASIONAL AL-ANDALUS
                    </h1>
                    <h2 className="text-base sm:text-xl font-extrabold uppercase text-black leading-snug">
                      BAGIAN KEDISIPLINAN
                    </h2>
                  </div>
                  <img
                    src={logoUrl}
                    alt="Logo Pesantren Al-Andalus"
                    referrerPolicy="no-referrer"
                    className="w-12 h-16 sm:w-14 sm:h-18 object-contain shrink-0"
                  />
                </div>

                {/* Judul SURAT IZIN SANTRI (Otomatis Berubah Jika Diperpanjang) */}
                <h3 className="text-center text-sm sm:text-base font-extrabold uppercase tracking-wide my-5 text-black">
                  {activeExtInfo.isExtended
                    ? 'SURAT IZIN SANTRI (PERPANJANGAN MASA IZIN)'
                    : 'SURAT IZIN SANTRI'}
                </h3>

                {/* Bingkai Hijau (#52AD4E) Berisi Kotak Putih Data Santri */}
                <div className="bg-[#52AD4E] p-3.5 sm:p-4 mb-6">
                  <div className="bg-white px-5 py-4 text-xs sm:text-[15px] text-black space-y-1.5">
                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-4 sm:col-span-3">Nomor</span>
                      <span className="col-span-8 sm:col-span-9">
                        :{' '}
                        {activeExtInfo.isExtended
                          ? `${activeSurat.no} (Perpanjangan Ke-${activeExtInfo.perpanjanganKe})`
                          : activeSurat.no}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-4 sm:col-span-3">Nama</span>
                      <span className="col-span-8 sm:col-span-9">
                        : {activeSurat.nama}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-4 sm:col-span-3">Kelas</span>
                      <span className="col-span-8 sm:col-span-9">
                        : {activeSurat.kelas}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-4 sm:col-span-3">Kamar</span>
                      <span className="col-span-8 sm:col-span-9">
                        : {activeSurat.kamar}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-4 sm:col-span-3">
                        Keperluan / Tujuan
                      </span>
                      <span className="col-span-8 sm:col-span-9">
                        : {formatKeperluanTujuan(activeSurat)}
                      </span>
                    </div>

                    <div className="grid grid-cols-12 items-baseline">
                      <span className="col-span-4 sm:col-span-3">Izin Dari</span>
                      <span className="col-span-8 sm:col-span-9">
                        : {formatSuratDateIndo(activeSurat.dariTanggal)}
                      </span>
                    </div>

                    {activeExtInfo.isExtended ? (
                      <>
                        <div className="grid grid-cols-12 items-baseline">
                          <span className="col-span-4 sm:col-span-3">
                            Batas Awal
                          </span>
                          <span className="col-span-8 sm:col-span-9">
                            : {formatSuratDateIndo(activeExtInfo.sampaiTanggalAwal)}
                          </span>
                        </div>
                        <div className="grid grid-cols-12 items-baseline font-bold">
                          <span className="col-span-4 sm:col-span-3">
                            Diperpanjang s/d
                          </span>
                          <span className="col-span-8 sm:col-span-9">
                            : {formatSuratDateIndo(activeSurat.sampaiTanggal)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="grid grid-cols-12 items-baseline">
                        <span className="col-span-4 sm:col-span-3">Sampai</span>
                        <span className="col-span-8 sm:col-span-9">
                          : {formatSuratDateIndo(activeSurat.sampaiTanggal)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabel Tanda Tangan Full-Width (Kasi. Kedisiplinan & Kabid. Kepengasuhan) */}
                <div className="mb-4">
                  <table className="w-full border-collapse border border-black text-xs sm:text-[15px] text-center">
                    <thead>
                      <tr className="bg-[#C5E0B4]">
                        <th className="border border-black py-1.5 px-3 font-bold w-[36%] text-black">
                          Kasi. Kedisiplinan
                        </th>
                        <th className="border border-black py-1.5 px-3 font-bold w-[64%] text-black">
                          Kabid. Kepengasuhan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-black pt-4 pb-2.5 px-3 align-bottom">
                          {/* Tanda Tangan Resmi Ust. Abdul Aziz dari PDF */}
                          <div className="h-20 flex items-center justify-center">
                            <img
                              src={TTD_UST_AZIZ_DATA_URI}
                              alt="Tanda Tangan Ust. Abdul Aziz"
                              className="h-11 sm:h-12 w-auto object-contain mx-auto select-none"
                            />
                          </div>
                          <p className="underline font-medium text-black mt-1">
                            {kasiKedisiplinan}
                          </p>
                        </td>
                        <td className="border border-black pt-4 pb-2.5 px-3 align-bottom">
                          {/* Tanda Tangan Resmi Ust. Muhammad Awly Yusuf, S.Pd. dari PDF */}
                          <div className="h-20 flex items-center justify-center">
                            <img
                              src={TTD_UST_AWLY_DATA_URI}
                              alt="Tanda Tangan Ust. Muhammad Awly Yusuf, S.Pd."
                              className="h-14 sm:h-16 w-auto object-contain mx-auto select-none"
                            />
                          </div>
                          <p className="underline font-medium text-black mt-1">
                            {kabidPengasuhan}
                          </p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Garis Putus-putus Pemisah */}
                <div className="border-b-[3px] border-dotted border-black my-4" />

                {/* Kotak Catatan (1 - 4 Sesuai Gambar Terbaru) */}
                <div className="border border-black p-4 text-xs sm:text-[13.5px] leading-snug text-black">
                  <p className="font-bold mb-2">Catatan:</p>
                  <ol className="list-decimal pl-8 space-y-1">
                    <li>
                      Surat izin ini sebagai bukti bahwa ananda diberikan izin pulang oleh pesantren
                    </li>
                    <li>
                      Apabila melebihi batas waktu yang telah ditentukan, Bagian kedisiplinan berhak memberikan sanksi sesuai dengan ketentuan yang berlaku
                    </li>
                    <li>
                      Bagi santri yang pulang dengan alasan sakit, wajib melampirkan surat dari dokter paling lambat 1x24 jam sejak surat izin diterbitkan
                    </li>
                    <li>
                      Kasie kedisiplinan berhak memberikan kebijakan khusus terkait penanganan perizinan pulang santri
                    </li>
                  </ol>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
