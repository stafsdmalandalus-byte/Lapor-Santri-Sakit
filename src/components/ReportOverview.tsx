import React, { useState } from 'react';
import Swal from 'sweetalert2';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  RefreshCw,
  CalendarRange,
  RotateCcw,
  MessageCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import {
  type LaporanMusyrifRow,
  type DateRangeFilter,
  calculateReportOverview,
  buildReportStatusPieData,
  filterLaporanByDateRange,
  generateDailyWhatsAppReport,
  generateDailyHealthCsvReport,
  getTodayDateISO,
  getDynamicDatePresets,
} from '../utils/ukpSyncEngine';

export type ReportStatusFilter = 'ALL' | 'WAITING' | 'DONE';

interface ReportOverviewProps {
  laporanList: LaporanMusyrifRow[];
  activeFilter: ReportStatusFilter;
  onSelectFilter: (filter: ReportStatusFilter) => void;
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  lastSyncTime: string | null;
  onQuickSync?: () => void;
  mode?: 'FULL' | 'OVERVIEW_ONLY' | 'WA_ONLY';
}

export const ReportOverview: React.FC<ReportOverviewProps> = ({
  laporanList,
  activeFilter,
  onSelectFilter,
  dateRange,
  onDateRangeChange,
  lastSyncTime,
  onQuickSync,
  mode = 'FULL',
}) => {
  const [waTargetDate, setWaTargetDate] = useState<string>(() =>
    getTodayDateISO()
  );
  const [waPhoneNumber, setWaPhoneNumber] = useState<string>('');
  const [showWaPreview, setShowWaPreview] = useState<boolean>(true);
  const [copiedWa, setCopiedWa] = useState<boolean>(false);

  const datePresets = getDynamicDatePresets();
  const dateFilteredList = filterLaporanByDateRange(laporanList, dateRange);
  const stats = calculateReportOverview(dateFilteredList);
  const pieData = buildReportStatusPieData(dateFilteredList);
  const hasData = stats.total > 0;
  const isDateFiltered =
    dateRange.startDate.trim() !== '' || dateRange.endDate.trim() !== '';

  const dailyWaReport = generateDailyWhatsAppReport(
    laporanList,
    waTargetDate,
    waPhoneNumber
  );
  const dailyCsvReport = generateDailyHealthCsvReport(
    laporanList,
    waTargetDate
  );

  const chartData = hasData
    ? pieData
    : [
        {
          name: 'Belum Ada Data',
          key: 'ALL',
          value: 1,
          percentage: 0,
          color: '#e2e8f0',
        },
      ];

  const handleCopyWaReport = async () => {
    try {
      await navigator.clipboard.writeText(dailyWaReport.text);
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 2500);
      await Swal.fire({
        icon: 'success',
        title: 'Laporan Harian WA Disalin!',
        html: `<div class="text-left text-xs text-slate-600 space-y-2">
          <p>Format laporan harian tanggal <b>${dailyWaReport.formattedDate}</b> (${dailyWaReport.count} santri) siap ditempel ke grup WhatsApp Asrama / UKP:</p>
          <pre class="bg-slate-100 p-3 rounded-xl font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">${dailyWaReport.text}</pre>
        </div>`,
        confirmButtonColor: '#047857',
        confirmButtonText: 'Selesai',
      });
    } catch {
      // Fallback
    }
  };

  const handleDownloadDailyCsv = async () => {
    const csvWithBom = '\uFEFF' + dailyCsvReport.csvContent;
    const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = dailyCsvReport.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await Swal.fire({
      icon: 'success',
      title: 'Rekap Harian CSV Diunduh!',
      html: `<div class="text-left text-xs text-slate-600 space-y-1.5">
        <p>File <b>${dailyCsvReport.filename}</b> berhasil diunduh.</p>
        <p>Periode: <b>${dailyCsvReport.formattedDate}</b> · Total Insiden: <b>${dailyCsvReport.totalIncidents}</b> (Menunggu: <b>${dailyCsvReport.pendingCount}</b>, Tertangani: <b>${dailyCsvReport.resolvedCount}</b>)</p>
      </div>`,
      confirmButtonColor: '#047857',
      confirmButtonText: 'Tutup',
    });
  };

  const statusFilteredRows = dateFilteredList.filter((r) => {
    const isWait =
      r.statusPenanganan.trim().toUpperCase() === 'MENUNGGU PENANGANAN';
    if (activeFilter === 'WAITING') return isWait;
    if (activeFilter === 'DONE') return !isWait;
    return true;
  });

  if (mode === 'WA_ONLY') {
    return (
      <section
        aria-label="Laporan Cepat ke WA"
        data-testid="daily-whatsapp-report-card"
        className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/90 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Laporan Cepat Harian ke WhatsApp</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Format rekap otomatis laporan kesehatan santri siap kirim ke WhatsApp grup Asrama / UKP
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200/70 tabular-nums">
            {dailyWaReport.count} laporan ({dailyWaReport.formattedDate})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="wa-daily-date"
                className="block text-xs font-semibold text-slate-700"
              >
                Tanggal Laporan Harian
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setWaTargetDate(getTodayDateISO())}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md cursor-pointer"
                >
                  Hari Ini (Real-Time)
                </button>
                <button
                  type="button"
                  onClick={() => setWaTargetDate('')}
                  className="text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md cursor-pointer"
                >
                  Semua
                </button>
              </div>
            </div>
            <input
              id="wa-daily-date"
              type="date"
              value={waTargetDate}
              onChange={(e) => setWaTargetDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label
              htmlFor="wa-phone-number"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              No. WA Tujuan / UKP (Opsional)
            </label>
            <input
              id="wa-phone-number"
              type="tel"
              value={waPhoneNumber}
              onChange={(e) => setWaPhoneNumber(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Tombol Kirim Langsung ke WA & Salin Teks WA */}
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={dailyWaReport.waUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="btn-send-wa-daily"
            className="flex-1 min-h-[42px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Kirim Langsung ke WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80 shrink-0" />
          </a>

          <button
            type="button"
            onClick={handleCopyWaReport}
            className="min-h-[42px] px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
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

        {/* Pratinjau Format Pesan WhatsApp Harian */}
        <div className="rounded-2xl bg-emerald-50/50 border border-emerald-200/80 p-4">
          <p className="text-xs font-semibold text-emerald-900 mb-2">
            Pratinjau Pesan WhatsApp ({dailyWaReport.formattedDate}):
          </p>
          <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-xl border border-emerald-100 max-h-96 overflow-y-auto">
            {dailyWaReport.text}
          </pre>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Report Overview"
      data-testid="report-overview"
      className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200/90 mb-5"
    >
      {/* Header Bar Report Overview */}
      <div className="flex items-center justify-between gap-2 pb-3.5 mb-3.5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <ClipboardList className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Report Overview</span>
            <span aria-hidden="true">·</span>
            <span className="font-normal text-slate-500">
              Status Penanganan UKP
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantauan langsung laporan santri sakit di{' '}
            <span className="font-mono">Laporan_Musyrif</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadDailyCsv}
            data-testid="btn-download-csv-daily"
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#07361D] hover:bg-[#0B4627] text-[#F5D000] text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Unduh CSV Harian</span>
          </button>

          {onQuickSync && (
            <button
              type="button"
              onClick={onQuickSync}
              aria-label="Segarkan status laporan dari Data UKP"
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span>Refresh Status</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Rentang Tanggal (Pantauan Bulanan Musyrif) */}
      <div
        data-testid="report-overview-date-filter"
        className="mb-4 rounded-2xl bg-stone-50/90 border border-slate-200/80 p-3.5 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <CalendarRange className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Filter Rentang Tanggal (Pantauan Bulanan)</span>
          </div>
          {isDateFiltered && (
            <button
              type="button"
              onClick={() => onDateRangeChange({ startDate: '', endDate: '' })}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Tanggal</span>
            </button>
          )}
        </div>

        {/* Preset Rentang Bulanan / Harian (Real-Time) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {datePresets.map((preset) => {
            const isPresetActive =
              dateRange.startDate === preset.startDate &&
              dateRange.endDate === preset.endDate;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  onDateRangeChange({
                    startDate: preset.startDate,
                    endDate: preset.endDate,
                  })
                }
                aria-pressed={isPresetActive}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                  isPresetActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Input Dari Tanggal & Sampai Tanggal */}
        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
          <div>
            <label
              htmlFor="overview-start-date"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              Dari Tanggal
            </label>
            <input
              id="overview-start-date"
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                onDateRangeChange({
                  ...dateRange,
                  startDate: e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label
              htmlFor="overview-end-date"
              className="block text-[11px] font-medium text-slate-600 mb-1"
            >
              Sampai Tanggal
            </label>
            <input
              id="overview-end-date"
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                onDateRangeChange({
                  ...dateRange,
                  endDate: e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>
      </div>

      {/* 3 Count Badges Grid (Total Reports, Pending Reports, Resolved Reports) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* 1. Total Reports */}
        <button
          type="button"
          onClick={() => onSelectFilter('ALL')}
          aria-pressed={activeFilter === 'ALL'}
          data-testid="badge-total-reports"
          className={`text-left rounded-2xl p-3 sm:p-3.5 border transition cursor-pointer flex flex-col justify-between min-h-[88px] ${
            activeFilter === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-stone-50/90 hover:bg-stone-100/80 text-slate-900 border-slate-200/80'
          }`}
        >
          <div className="flex items-center justify-between gap-1 w-full">
            <span
              className={`text-[11px] font-semibold leading-tight ${
                activeFilter === 'ALL' ? 'text-slate-200' : 'text-slate-600'
              }`}
            >
              Total Laporan
            </span>
            <ClipboardList
              className={`w-3.5 h-3.5 shrink-0 ${
                activeFilter === 'ALL' ? 'text-emerald-400' : 'text-slate-400'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-2xl font-bold font-mono tabular-nums leading-none">
              {stats.total}
            </span>
            <span
              className={`text-[10px] font-medium whitespace-nowrap ${
                activeFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {isDateFiltered ? 'Periode ini' : 'Semua data'}
            </span>
          </div>
        </button>

        {/* 2. Pending Reports (MENUNGGU PENANGANAN) */}
        <button
          type="button"
          onClick={() => onSelectFilter('WAITING')}
          aria-pressed={activeFilter === 'WAITING'}
          data-testid="badge-pending-reports"
          className={`text-left rounded-2xl p-3 sm:p-3.5 border transition cursor-pointer flex flex-col justify-between min-h-[88px] ${
            activeFilter === 'WAITING'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-amber-50/70 hover:bg-amber-100/60 text-amber-950 border-amber-200/80'
          }`}
        >
          <div className="flex items-center justify-between gap-1 w-full">
            <span
              className={`text-[11px] font-semibold leading-tight ${
                activeFilter === 'WAITING' ? 'text-amber-100' : 'text-amber-800'
              }`}
            >
              Menunggu
            </span>
            <Clock
              className={`w-3.5 h-3.5 shrink-0 ${
                activeFilter === 'WAITING' ? 'text-white' : 'text-amber-600'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-2xl font-bold font-mono tabular-nums leading-none">
              {stats.pending}
            </span>
            <span
              className={`text-[10px] font-medium whitespace-nowrap ${
                activeFilter === 'WAITING' ? 'text-amber-100' : 'text-amber-700'
              }`}
            >
              Antrean UKP
            </span>
          </div>
        </button>

        {/* 3. Resolved Reports (SUDAH DITANGANI) */}
        <button
          type="button"
          onClick={() => onSelectFilter('DONE')}
          aria-pressed={activeFilter === 'DONE'}
          data-testid="badge-resolved-reports"
          className={`text-left rounded-2xl p-3 sm:p-3.5 border transition cursor-pointer flex flex-col justify-between min-h-[88px] ${
            activeFilter === 'DONE'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
              : 'bg-emerald-50/70 hover:bg-emerald-100/60 text-emerald-950 border-emerald-200/80'
          }`}
        >
          <div className="flex items-center justify-between gap-1 w-full">
            <span
              className={`text-[11px] font-semibold leading-tight ${
                activeFilter === 'DONE' ? 'text-emerald-100' : 'text-emerald-800'
              }`}
            >
              Ditangani
            </span>
            <CheckCircle2
              className={`w-3.5 h-3.5 shrink-0 ${
                activeFilter === 'DONE' ? 'text-white' : 'text-emerald-600'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-1">
            <span className="text-2xl font-bold font-mono tabular-nums leading-none">
              {stats.resolved}
            </span>
            <span
              className={`text-[10px] font-medium whitespace-nowrap ${
                activeFilter === 'DONE' ? 'text-emerald-100' : 'text-emerald-700'
              }`}
            >
              Selesai ({stats.resolutionRate}%)
            </span>
          </div>
        </button>
      </div>

      {/* Visualisasi Distribusi Status (Recharts PieChart: Pending vs Resolved) */}
      <div
        data-testid="report-status-pie-container"
        className="mt-3.5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-4"
      >
        <div className="relative w-[92px] h-[92px] shrink-0 flex items-center justify-center">
          <PieChart width={92} height={92}>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={27}
              outerRadius={42}
              paddingAngle={
                hasData && stats.pending > 0 && stats.resolved > 0 ? 4 : 0
              }
              stroke="none"
              isAnimationActive={false}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  className="cursor-pointer outline-none"
                  onClick={() => {
                    if (entry.key === 'WAITING' || entry.key === 'DONE') {
                      onSelectFilter(entry.key);
                    }
                  }}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${value ?? 0} Laporan`,
                String(name ?? ''),
              ]}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '11px',
                padding: '6px 10px',
              }}
            />
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xs font-bold font-mono tabular-nums text-slate-900 leading-none">
              {stats.resolutionRate}%
            </span>
            <span className="text-[9px] text-slate-500 mt-0.5">Selesai</span>
          </div>
        </div>

        {/* Detail Distribusi & Legend Interaktif */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800">
              Distribusi Status Kasus
            </span>
            {lastSyncTime && (
              <span className="text-[10px] font-mono tabular-nums text-slate-400 truncate">
                Sync: {lastSyncTime}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            {pieData.map((slice) => (
              <button
                key={slice.key}
                type="button"
                onClick={() => onSelectFilter(slice.key)}
                className="w-full flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              >
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span>{slice.name}</span>
                </span>
                <span className="font-mono text-slate-700 tabular-nums">
                  <strong>{slice.value}</strong> ({slice.percentage}%)
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Daftar Ringkas Laporan Sesuai Filter pada Mode OVERVIEW_ONLY */}
      {mode === 'OVERVIEW_ONLY' && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-800">
              Daftar Laporan Santri ({statusFilteredRows.length} Data)
            </p>
            <span className="text-[11px] text-slate-500">
              Filter:{' '}
              <strong>
                {activeFilter === 'WAITING'
                  ? 'Menunggu Penanganan'
                  : activeFilter === 'DONE'
                  ? 'Sudah Ditangani'
                  : 'Semua Status'}
              </strong>
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {statusFilteredRows.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 bg-stone-50/70 rounded-2xl border border-slate-200/60">
                Tidak ada data laporan pada filter ini.
              </div>
            ) : (
              statusFilteredRows.map((row, idx) => {
                const isWaiting =
                  row.statusPenanganan.trim().toUpperCase() ===
                  'MENUNGGU PENANGANAN';
                return (
                  <div
                    key={`${row.idLaporan}-${row.idSantri}-${idx}`}
                    className={`rounded-2xl p-3.5 border transition ${
                      isWaiting
                        ? 'bg-amber-50/40 border-amber-200/80'
                        : 'bg-emerald-50/40 border-emerald-200/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {row.namaSantri}{' '}
                          <span className="font-normal text-slate-500">
                            ({row.kelas} · {row.kamar})
                          </span>
                        </p>
                        <p className="text-xs text-slate-700 mt-1">
                          {row.keluhanUtama}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          isWaiting
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {isWaiting ? 'MENUNGGU' : 'DITANGANI'}
                      </span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>
                        Tindakan UKP:{' '}
                        <strong
                          className={
                            isWaiting ? 'text-amber-800' : 'text-emerald-800'
                          }
                        >
                          {row.tindakanUKP || 'Menunggu Pemeriksaan UKP'}
                        </strong>
                      </span>
                      <span className="font-mono text-[10px]">
                        {row.tanggalLaporan}
                        {row.namaMusyrif ? ` · Pelapor: ${row.namaMusyrif}` : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Fitur Laporan Cepat Langsung ke WhatsApp & Unduh CSV Harian (Mode FULL) */}
      {mode === 'FULL' && (
        <div
          data-testid="daily-whatsapp-report-card"
          className="mt-3.5 pt-3.5 border-t border-slate-100 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
              <MessageCircle className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Laporan Cepat Harian (WA &amp; CSV)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
              {dailyWaReport.count} laporan ({dailyWaReport.formattedDate})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="wa-daily-date"
                  className="block text-[11px] font-medium text-slate-600"
                >
                  Tanggal Laporan Harian
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setWaTargetDate(getTodayDateISO())}
                    className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded cursor-pointer"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaTargetDate('')}
                    className="text-[10px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer"
                  >
                    Semua
                  </button>
                </div>
              </div>
              <input
                id="wa-daily-date"
                type="date"
                value={waTargetDate}
                onChange={(e) => setWaTargetDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label
                htmlFor="wa-phone-number"
                className="block text-[11px] font-medium text-slate-600 mb-1"
              >
                No. WA Tujuan / UKP (Opsional)
              </label>
              <input
                id="wa-phone-number"
                type="tel"
                value={waPhoneNumber}
                onChange={(e) => setWaPhoneNumber(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={dailyWaReport.waUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="btn-send-wa-daily"
              className="flex-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Kirim WA</span>
              <ExternalLink className="w-3 h-3 opacity-80 shrink-0" />
            </a>

            <button
              type="button"
              onClick={handleCopyWaReport}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {copiedWa ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin WA</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowWaPreview((prev) => !prev)}
              aria-expanded={showWaPreview}
              className="min-h-[40px] px-2.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <span>Pratinjau</span>
              {showWaPreview ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {showWaPreview && (
            <div className="rounded-2xl bg-emerald-50/50 border border-emerald-200/80 p-3">
              <p className="text-[11px] font-semibold text-emerald-900 mb-1.5">
                Format Ringkas WhatsApp — Nama, Kelas &amp; Sakit ({dailyWaReport.formattedDate}):
              </p>
              <pre className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {dailyWaReport.text}
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
