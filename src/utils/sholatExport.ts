/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  type SantriSholatSummary,
  type SholatRow,
  formatSholatDateID,
  formatRincianSholatTelat,
  isSholatRowPutih,
  normalizeSantriKey,
} from './sholatEngine';

import { normalizeDateRangeBounds } from './ukpSyncEngine';

export const DEFAULT_ALANDALUS_LOGO_URL =
  '/assets/aistudio/Logo_Al-Andalus_c7d889d5.png';

export interface SholatExportParams {
  summaries: SantriSholatSummary[];
  dailyRows: SholatRow[];
  startDate: string;
  endDate: string;
  mode: 'ALL' | 'SINGLE';
  selectedSantriName?: string;
  pencatatBySantri?: Map<string, string[]>;
  logoUrl?: string;
}

async function loadLogoAsPngDataUrl(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (typeof window === 'undefined' || !src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 256;
        const h = img.naturalHeight || img.height || 256;
        const canvas = document.createElement('canvas');
        const targetMax = 320;
        const scale = Math.min(2, targetMax / Math.max(w, h));
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: w,
          height: h,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function formatSholatPeriodeLabel(
  startDate: string,
  endDate: string
): string {
  const { start, end } = normalizeDateRangeBounds({ startDate, endDate });
  if (start && end) {
    return start === end
      ? formatSholatDateID(start)
      : `${formatSholatDateID(start)} s/d ${formatSholatDateID(end)}`;
  }
  if (start) return `Mulai ${formatSholatDateID(start)}`;
  if (end) return `Sampai ${formatSholatDateID(end)}`;
  return 'Semua Tanggal';
}

function formatAsramaDisplay(gedung?: string, kamar?: string): string {
  const cleanKamar = String(kamar || '').trim();
  const cleanGedung = String(gedung || '').trim();
  if (cleanKamar && cleanKamar !== '-' && cleanGedung && cleanGedung !== '-') {
    return `${cleanKamar} (${cleanGedung})`;
  }
  if (cleanKamar && cleanKamar !== '-') return cleanKamar;
  if (cleanGedung && cleanGedung !== '-') return cleanGedung;
  return '-';
}

function getExportTargets(params: SholatExportParams): {
  targetSummaries: SantriSholatSummary[];
  targetDailyRows: SholatRow[];
  periodeLabel: string;
  fileSuffix: string;
} {
  const { summaries, dailyRows, startDate, endDate, mode, selectedSantriName } =
    params;
  const { start, end } = normalizeDateRangeBounds({ startDate, endDate });
  const periodeLabel = formatSholatPeriodeLabel(start, end);
  const dateFilePart =
    start || end
      ? `${start || 'Awal'}_sd_${end || 'Akhir'}`
      : 'Semua_Tanggal';

  if (mode === 'SINGLE') {
    const targetKey = normalizeSantriKey(selectedSantriName || '');
    const matched = summaries.filter(
      (s) => normalizeSantriKey(s.namaSantri) === targetKey
    );
    const matchedDaily = dailyRows.filter(
      (r) => normalizeSantriKey(r.namaSantri) === targetKey
    );
    const safeName = (selectedSantriName || 'Santri')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return {
      targetSummaries: matched,
      targetDailyRows: matchedDaily,
      periodeLabel,
      fileSuffix: `${safeName}_${dateFilePart}`,
    };
  }

  return {
    targetSummaries: summaries,
    targetDailyRows: dailyRows,
    periodeLabel,
    fileSuffix: `Keseluruhan_${dateFilePart}`,
  };
}

export function exportSholatToExcel(params: SholatExportParams): {
  filename: string;
  rowCount: number;
} {
  const { targetSummaries, targetDailyRows, periodeLabel, fileSuffix } =
    getExportTargets(params);

  const wb = XLSX.utils.book_new();

  const headerMeta: Array<Array<string | number>> = [
    ['REKAP KETERLAMBATAN SHOLAT SANTRI — PESANTREN ISLAM INTERNASIONAL AL-ANDALUS'],
    ['Rentang Tanggal', periodeLabel],
    [
      'Jenis Rekap',
      params.mode === 'SINGLE'
        ? `Per Anak (${params.selectedSantriName || '-'})`
        : `Keseluruhan Santri (${targetSummaries.length} Santri)`,
    ],
    ['Dicetak Pada', new Date().toLocaleString('id-ID')],
    [],
    [
      'No',
      'Rentang Tanggal',
      'Nama Santri',
      'Kelas',
      'Asrama / Kamar',
      'Subuh (Telat)',
      'Dzuhur (Telat)',
      'Ashar (Telat)',
      'Maghrib (Telat)',
      'Isya (Telat)',
      'Total Keterlambatan',
      'Rincian Sholat Telat',
      'Tanggal Tercatat Telat',
      'Pencatat',
      'Status',
    ],
  ];

  const dataRows = targetSummaries.map((st, idx) => {
    const pencatatList =
      params.pencatatBySantri?.get(normalizeSantriKey(st.namaSantri)) || [];
    return [
      idx + 1,
      periodeLabel,
      st.namaSantri,
      st.kelas || '-',
      formatAsramaDisplay(st.gedung, st.kamar),
      st.subuhTelat,
      st.dzuhurTelat,
      st.asharTelat,
      st.maghribTelat,
      st.isyaTelat,
      st.totalTelat,
      formatRincianSholatTelat(st),
      st.tanggalTelatList.length > 0
        ? st.tanggalTelatList.map(formatSholatDateID).join(', ')
        : '-',
      pencatatList.length > 0 ? pencatatList.join(', ') : '-',
      st.diputihkanRecords > 0
        ? `DIPUTIHKAN (${st.diputihkanRecords}x)`
        : 'AKTIF',
    ];
  });

  const grandTotals = targetSummaries.reduce(
    (acc, cur) => ({
      subuh: acc.subuh + cur.subuhTelat,
      dzuhur: acc.dzuhur + cur.dzuhurTelat,
      ashar: acc.ashar + cur.asharTelat,
      maghrib: acc.maghrib + cur.maghribTelat,
      isya: acc.isya + cur.isyaTelat,
      total: acc.total + cur.totalTelat,
    }),
    { subuh: 0, dzuhur: 0, ashar: 0, maghrib: 0, isya: 0, total: 0 }
  );

  const footerRow: Array<string | number> =
    targetSummaries.length > 0
      ? [
          '',
          '',
          'TOTAL KESELURUHAN',
          '',
          '',
          grandTotals.subuh,
          grandTotals.dzuhur,
          grandTotals.ashar,
          grandTotals.maghrib,
          grandTotals.isya,
          grandTotals.total,
          formatRincianSholatTelat({
            subuhTelat: grandTotals.subuh,
            dzuhurTelat: grandTotals.dzuhur,
            asharTelat: grandTotals.ashar,
            maghribTelat: grandTotals.maghrib,
            isyaTelat: grandTotals.isya,
          }),
          '',
          '',
          '',
        ]
      : [];

  const wsSummaryData = [
    ...headerMeta,
    ...dataRows,
    ...(footerRow.length > 0 ? [footerRow] : []),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(wsSummaryData);
  wsSummary['!cols'] = [
    { wch: 5 },
    { wch: 24 },
    { wch: 26 },
    { wch: 12 },
    { wch: 24 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 14 },
    { wch: 12 },
    { wch: 19 },
    { wch: 36 },
    { wch: 28 },
    { wch: 24 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Rekap Akumulasi');

  // Sheet 2: Rincian Harian
  const dailyHeader: Array<Array<string | number>> = [
    ['LOG HARIAN KETERLAMBATAN SHOLAT SANTRI'],
    ['Rentang Tanggal', periodeLabel],
    [],
    [
      'No',
      'Tanggal',
      'Nama Santri',
      'Kelas',
      'Asrama / Kamar',
      'Subuh',
      'Dzuhur',
      'Ashar',
      'Maghrib',
      'Isya',
      'Pencatat',
      'Status / Keterangan',
    ],
  ];

  const dailyBody = targetDailyRows.map((r, idx) => [
    idx + 1,
    formatSholatDateID(r.tanggal),
    r.namaSantri,
    r.kelas || '-',
    formatAsramaDisplay(r.gedung, r.kamar),
    r.subuh,
    r.dzuhur,
    r.ashar,
    r.maghrib,
    r.isya,
    r.pencatat || '-',
    isSholatRowPutih(r) ? r.keterangan || 'DIPUTIHKAN' : r.keterangan || 'AKTIF',
  ]);

  const wsDaily = XLSX.utils.aoa_to_sheet([...dailyHeader, ...dailyBody]);
  wsDaily['!cols'] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 26 },
    { wch: 12 },
    { wch: 24 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 24 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Log Harian');

  const filename = `Rekap_Keterlambatan_Sholat_${fileSuffix}.xlsx`;
  XLSX.writeFile(wb, filename);
  return { filename, rowCount: targetSummaries.length };
}

export async function exportSholatToPdf(params: SholatExportParams): Promise<{
  filename: string;
  rowCount: number;
}> {
  const { targetSummaries, targetDailyRows, periodeLabel, fileSuffix } =
    getExportTargets(params);

  const logoAsset = await loadLogoAsPngDataUrl(
    params.logoUrl || DEFAULT_ALANDALUS_LOGO_URL
  );

  const doc = new jsPDF({
    orientation: params.mode === 'SINGLE' ? 'portrait' : 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const bannerHeight = 30;

  // Header Banner
  doc.setFillColor(7, 94, 84); // #075e54
  doc.rect(0, 0, pageWidth, bannerHeight, 'F');

  let titleX = 14;
  if (logoAsset) {
    const boxX = 12;
    const boxY = 4.5;
    const boxSize = 21;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(boxX, boxY, boxSize, boxSize, 2.5, 2.5, 'F');

    const pad = 1.6;
    const availW = boxSize - pad * 2;
    const availH = boxSize - pad * 2;
    const ratio = logoAsset.width / Math.max(1, logoAsset.height);
    let drawW = availW;
    let drawH = drawW / ratio;
    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * ratio;
    }
    const drawX = boxX + (boxSize - drawW) / 2;
    const drawY = boxY + (boxSize - drawH) / 2;
    doc.addImage(logoAsset.dataUrl, 'PNG', drawX, drawY, drawW, drawH);
    titleX = 37;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('REKAP KETERLAMBATAN SHOLAT SANTRI', titleX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    'Pesantren Islam Internasional Al-Andalus · Bidang Pengasuhan',
    titleX,
    18.5
  );
  doc.text(`Rentang Tanggal: ${periodeLabel}`, titleX, 24.5);

  const printedStr = `Dicetak: ${new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;
  doc.text(printedStr, pageWidth - 14, 24.5, { align: 'right' });

  const grandTotal = targetSummaries.reduce((acc, s) => acc + s.totalTelat, 0);

  if (params.mode === 'SINGLE' && targetSummaries.length > 0) {
    const st = targetSummaries[0];
    const pencatatList =
      params.pencatatBySantri?.get(normalizeSantriKey(st.namaSantri)) || [];

    // Kartu Identitas Santri (Per Anak)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 36, pageWidth - 28, 36, 3, 3, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('IDENTITAS & RINGKASAN SANTRI', 18, 43);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Nama Santri`, 18, 50);
    doc.setFont('helvetica', 'bold');
    doc.text(`: ${st.namaSantri}`, 52, 50);

    doc.setFont('helvetica', 'normal');
    doc.text(`Kelas / Asrama`, 18, 56);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `: Kelas ${st.kelas || '-'} · ${formatAsramaDisplay(st.gedung, st.kamar)}`,
      52,
      56
    );

    doc.setFont('helvetica', 'normal');
    doc.text(`Rentang Tanggal`, 18, 62);
    doc.setFont('helvetica', 'bold');
    doc.text(`: ${periodeLabel}`, 52, 62);

    doc.setFont('helvetica', 'normal');
    doc.text(`Total Telat`, 18, 68);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(190, 18, 60);
    doc.text(
      `: ${st.totalTelat} Kali (${formatRincianSholatTelat(st)})`,
      52,
      68
    );

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Pencatat: ${pencatatList.length > 0 ? pencatatList.join(', ') : '-'}`,
      14,
      78
    );

    autoTable(doc, {
      startY: 82,
      head: [
        [
          'Subuh Telat',
          'Dzuhur Telat',
          'Ashar Telat',
          'Maghrib Telat',
          'Isya Telat',
          'Total Keseluruhan Telat',
        ],
      ],
      body: [
        [
          `${st.subuhTelat}x`,
          `${st.dzuhurTelat}x`,
          `${st.asharTelat}x`,
          `${st.maghribTelat}x`,
          `${st.isyaTelat}x`,
          `${st.totalTelat} Kali`,
        ],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [7, 94, 84],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9,
      },
      bodyStyles: {
        halign: 'center',
        fontStyle: 'bold',
        fontSize: 10,
      },
    });

    const afterSummaryY =
      ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY || 105) + 8;

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Riwayat Harian pada Rentang Tanggal Ini:', 14, afterSummaryY);

    autoTable(doc, {
      startY: afterSummaryY + 3,
      head: [
        [
          'No',
          'Tanggal',
          'Subuh',
          'Dzuhur',
          'Ashar',
          'Maghrib',
          'Isya',
          'Pencatat',
          'Keterangan',
        ],
      ],
      body:
        targetDailyRows.length > 0
          ? targetDailyRows.map((r, i) => [
              i + 1,
              formatSholatDateID(r.tanggal),
              r.subuh,
              r.dzuhur,
              r.ashar,
              r.maghrib,
              r.isya,
              r.pencatat || '-',
              isSholatRowPutih(r) ? r.keterangan || 'DIPUTIHKAN' : 'AKTIF',
            ])
          : [['-', 'Belum ada catatan harian', '-', '-', '-', '-', '-', '-', '-']],
      theme: 'striped',
      headStyles: {
        fillColor: [15, 118, 110],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: { fontSize: 8.5 },
    });
  } else {
    // Mode Keseluruhan Anak
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(
      `Rekap Keseluruhan Santri (${targetSummaries.length} Santri) · Total Keseluruhan Keterlambatan: ${grandTotal} Kali`,
      14,
      38
    );

    const tableBody =
      targetSummaries.length > 0
        ? targetSummaries.map((st, idx) => {
            const pencatatList =
              params.pencatatBySantri?.get(
                normalizeSantriKey(st.namaSantri)
              ) || [];
            return [
              idx + 1,
              st.namaSantri,
              st.kelas || '-',
              formatAsramaDisplay(st.gedung, st.kamar),
              `${st.subuhTelat}`,
              `${st.dzuhurTelat}`,
              `${st.asharTelat}`,
              `${st.maghribTelat}`,
              `${st.isyaTelat}`,
              `${st.totalTelat}x`,
              formatRincianSholatTelat(st),
              pencatatList.length > 0 ? pencatatList.join(', ') : '-',
            ];
          })
        : [
            [
              '-',
              'Belum ada data keterlambatan pada rentang tanggal ini',
              '-',
              '-',
              '0',
              '0',
              '0',
              '0',
              '0',
              '0x',
              '-',
              '-',
            ],
          ];

    autoTable(doc, {
      startY: 42,
      head: [
        [
          'No',
          'Nama Santri',
          'Kelas',
          'Asrama / Kamar',
          'Subuh',
          'Dzuhur',
          'Ashar',
          'Maghrib',
          'Isya',
          'Total Telat',
          'Rincian Sholat Telat',
          'Pencatat',
        ],
      ],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [7, 94, 84],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
        valign: 'middle',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 9 },
        2: { halign: 'center', cellWidth: 16 },
        4: { halign: 'center', cellWidth: 13 },
        5: { halign: 'center', cellWidth: 14 },
        6: { halign: 'center', cellWidth: 13 },
        7: { halign: 'center', cellWidth: 15 },
        8: { halign: 'center', cellWidth: 12 },
        9: { halign: 'center', fontStyle: 'bold', cellWidth: 17 },
      },
    });
  }

  const totalPages = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Pesantren Islam Internasional Al-Andalus · Bidang Pengasuhan',
      14,
      pageHeight - 8
    );
    doc.text(
      `Halaman ${p} / ${totalPages}`,
      pageWidth - 14,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  const filename = `Rekap_Keterlambatan_Sholat_${fileSuffix}.pdf`;
  doc.save(filename);
  return { filename, rowCount: targetSummaries.length };
}
