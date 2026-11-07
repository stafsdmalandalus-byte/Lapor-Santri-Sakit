export const STANDALONE_HTML_CODE = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Portal Lapor Sakit Santri - Asrama Al Andalus</title>

  <!-- Tailwind CSS via CDN -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- SweetAlert2 via CDN -->
  <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

  <!-- Google Fonts: Plus Jakarta Sans & JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Plus Jakarta Sans', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            emerald: {
              50: '#ecfdf5',
              100: '#d1fae5',
              500: '#10b981',
              600: '#059669',
              700: '#047857',
              800: '#065f46',
              900: '#064e3b',
            }
          }
        }
      }
    };
  </script>
</head>
<body class="bg-stone-50 text-slate-800 min-h-screen flex flex-col justify-between antialiased selection:bg-emerald-600 selection:text-white">

  <!-- Main Container Mobile-First -->
  <main class="w-full max-w-md mx-auto px-4 pt-5 pb-10 flex-1">
    
    <!-- Header Portal Pesantren -->
    <header class="bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 text-white rounded-3xl p-6 shadow-lg shadow-emerald-900/15 mb-5 relative overflow-hidden">
      <div class="flex items-center gap-4">
        <!-- Ruang Logo Pesantren Al-Andalus -->
        <div class="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-md shrink-0 flex items-center justify-center">
          <img src="https://pesantren-alandalus.com/wp-content/uploads/2019/07/cropped-Andalus-logo-1.png" alt="Logo Pesantren Al-Andalus" class="w-full h-full object-contain" />
        </div>
        <div>
          <p class="text-xs font-semibold text-amber-300 tracking-wide">Pesantren Al-Andalus</p>
          <h1 class="text-lg font-bold leading-snug text-white">Portal Lapor Sakit Santri</h1>
          <p class="text-xs text-emerald-100/90 mt-0.5">Terintegrasi Unit Kesehatan Pesantren (UKP)</p>
        </div>
      </div>
    </header>

    <!-- Komponen Report Overview (Total, Pending, & Resolved Count Badges) -->
    <section aria-label="Report Overview" class="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 mb-5">
      <div class="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-100">
        <div>
          <h2 class="text-xs font-bold text-emerald-800">Report Overview · Status UKP</h2>
          <p class="text-[11px] text-slate-500">Ringkasan langsung sheet Laporan_Musyrif</p>
        </div>
        <button
          type="button"
          onclick="loadRingkasanLaporan()"
          class="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg transition"
        >
          Refresh
        </button>
      </div>
      <div class="grid grid-cols-3 gap-2.5">
        <div class="rounded-2xl bg-stone-50 border border-slate-200/80 p-3">
          <p class="text-[11px] font-semibold text-slate-600">Total Laporan</p>
          <p id="badgeTotal" class="text-2xl font-bold font-mono text-slate-900 mt-1">0</p>
          <p class="text-[10px] text-slate-500 mt-0.5">Semua data</p>
        </div>
        <div class="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-3">
          <p class="text-[11px] font-semibold text-amber-800">Menunggu</p>
          <p id="badgePending" class="text-2xl font-bold font-mono text-amber-900 mt-1">0</p>
          <p class="text-[10px] text-amber-700 mt-0.5">Antrean UKP</p>
        </div>
        <div class="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3">
          <p class="text-[11px] font-semibold text-emerald-800">Ditangani</p>
          <p id="badgeResolved" class="text-2xl font-bold font-mono text-emerald-900 mt-1">0</p>
          <p class="text-[10px] text-emerald-700 mt-0.5">Selesai UKP</p>
        </div>
      </div>
    </section>

    <!-- Card Form Pelaporan Musyrif -->
    <section class="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
      <div class="mb-5 pb-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-slate-900">Formulir Laporan Musyrif</h2>
          <p class="text-xs text-slate-500">Data otomatis masuk ke sheet Laporan_Musyrif</p>
        </div>
        <span id="statusBadgeData" class="text-xs font-mono text-emerald-700">Memuat data...</span>
      </div>

      <form id="formLaporSakit" class="space-y-4" novalidate>
        <!-- Tanggal Laporan (Kolom C) -->
        <div>
          <label for="tanggalLaporan" class="block text-xs font-semibold text-slate-700 mb-1.5">
            Tanggal Laporan <span class="text-rose-600">*</span>
          </label>
          <input
            type="date"
            id="tanggalLaporan"
            name="tanggalLaporan"
            required
            class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-500/20 font-mono"
          />
        </div>

        <!-- Autocomplete Nama Santri (Kolom A Master_Data -> Kolom F Laporan_Musyrif) -->
        <div class="relative">
          <label for="searchSantri" class="block text-xs font-semibold text-slate-700 mb-1.5">
            Nama Santri (Ketik untuk mencari) <span class="text-rose-600">*</span>
          </label>
          <div class="relative">
            <input
              type="text"
              id="searchSantri"
              autocomplete="off"
              placeholder="Cari nama santri atau ID..."
              required
              class="w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 py-2.5 text-sm text-slate-900 transition focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-500/20"
            />
            <button
              type="button"
              id="btnClearSantri"
              title="Hapus pilihan"
              class="hidden absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              ✕
            </button>
          </div>

          <!-- Dropdown Hasil Autocomplete -->
          <div
            id="dropdownSantri"
            class="hidden absolute z-30 mt-1.5 w-full max-h-60 overflow-y-auto rounded-2xl bg-white shadow-xl border border-slate-200 divide-y divide-slate-100"
          ></div>
        </div>

        <!-- Hidden Input ID_Santri (Kolom G Master_Data -> Kolom E Laporan_Musyrif) -->
        <input type="hidden" id="idSantri" name="idSantri" />
        <input type="hidden" id="namaSantri" name="namaSantri" />

        <!-- Grid Kelas (Kolom B) & Kamar (Kolom F) Otomatis Readonly -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="kelasSantri" class="block text-xs font-semibold text-slate-700 mb-1.5">
              Kelas (Otomatis)
            </label>
            <input
              type="text"
              id="kelasSantri"
              name="kelas"
              readonly
              placeholder="Terisi otomatis"
              class="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-600 cursor-not-allowed focus:outline-none"
            />
          </div>
          <div>
            <label for="kamarSantri" class="block text-xs font-semibold text-slate-700 mb-1.5">
              Kamar Asrama (Otomatis)
            </label>
            <input
              type="text"
              id="kamarSantri"
              name="kamar"
              readonly
              placeholder="Terisi otomatis"
              class="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-600 cursor-not-allowed focus:outline-none"
            />
          </div>
        </div>

        <!-- Info ID Santri Terkunci -->
        <div>
          <label for="idSantriDisplay" class="block text-xs font-semibold text-slate-700 mb-1.5">
            ID Santri (Kolom G Master_Data)
          </label>
          <input
            type="text"
            id="idSantriDisplay"
            readonly
            placeholder="Pilih nama santri di atas"
            class="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-mono text-slate-600 cursor-not-allowed focus:outline-none"
          />
        </div>

        <!-- Keluhan Utama (Kolom J Laporan_Musyrif) -->
        <div>
          <label for="keluhanUtama" class="block text-xs font-semibold text-slate-700 mb-1.5">
            Keluhan Utama / Gejala Sakit <span class="text-rose-600">*</span>
          </label>
          <textarea
            id="keluhanUtama"
            name="keluhanUtama"
            rows="3"
            required
            placeholder="Contoh: Demam sejak subuh 38.5C, pusing, dan batuk berdahak..."
            class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-emerald-600 focus:outline-none focus:ring-3 focus:ring-emerald-500/20"
          ></textarea>
        </div>

        <!-- Tombol Submit dengan Efek Hover & Loading Spinner -->
        <button
          type="submit"
          id="btnSubmit"
          class="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-semibold text-sm px-5 py-3 shadow-md shadow-emerald-900/10 transition flex items-center justify-center gap-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <!-- Loading Spinner (Hidden by default) -->
          <svg
            id="spinnerSubmit"
            class="hidden animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span id="textSubmit">Kirim Laporan Sakit</span>
        </button>
      </form>
    </section>
  </main>

  <!-- Custom Footer Sesuai Spesifikasi -->
  <footer class="w-full py-5 text-center border-t border-slate-200/70 bg-white">
    <p class="text-xs font-medium text-slate-500">Bidang Pengasuhan Pesantren Al-Andalus</p>
  </footer>

  <!-- Script Interaktif Frontend (Master_Data Autocomplete + Submit Laporan_Musyrif) -->
  <script>
    // URL Web App Google Apps Script (Jika di-host di luar Apps Script, isi URL Deployment di sini)
    const GAS_WEB_APP_URL = ""; 

    let masterSantriList = [];

    // Set default tanggal hari ini
    document.addEventListener("DOMContentLoaded", () => {
      const today = new Date().toISOString().split("T")[0];
      document.getElementById("tanggalLaporan").value = today;
      loadMasterDataSantri();
      loadRingkasanLaporan();
    });

    // Ambil ringkasan jumlah laporan (Total, Menunggu, Ditangani) untuk Report Overview
    function loadRingkasanLaporan() {
      if (typeof google !== "undefined" && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler((stats) => {
            if (!stats) return;
            document.getElementById("badgeTotal").textContent = stats.total || 0;
            document.getElementById("badgePending").textContent = stats.pending || 0;
            document.getElementById("badgeResolved").textContent = stats.resolved || 0;
          })
          .getRingkasanLaporan();
      }
    }

    // Ambil data santri dari sheet Master_Data (Kolom A, B, F, G)
    function loadMasterDataSantri() {
      const badge = document.getElementById("statusBadgeData");

      if (typeof google !== "undefined" && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler((data) => {
            masterSantriList = data || [];
            badge.textContent = masterSantriList.length + " Santri Aktif";
          })
          .withFailureHandler((err) => {
            badge.textContent = "Gagal memuat data";
            Swal.fire({
              icon: "error",
              title: "Gagal Memuat Master Data",
              text: err.message || "Periksa koneksi Google Sheets Anda.",
              confirmButtonColor: "#047857"
            });
          })
          .getMasterSantri();
      } else if (GAS_WEB_APP_URL) {
        fetch(GAS_WEB_APP_URL + "?action=getMasterSantri")
          .then((res) => res.json())
          .then((res) => {
            masterSantriList = res.data || [];
            badge.textContent = masterSantriList.length + " Santri Aktif";
          })
          .catch(() => {
            badge.textContent = "Mode Offline";
          });
      }
    }

    const searchInput = document.getElementById("searchSantri");
    const dropdown = document.getElementById("dropdownSantri");
    const btnClear = document.getElementById("btnClearSantri");

    // Event ketik pencarian Autocomplete
    searchInput.addEventListener("input", function () {
      const keyword = this.value.trim().toLowerCase();

      // Reset pilihan jika user mengubah teks
      document.getElementById("idSantri").value = "";
      document.getElementById("namaSantri").value = "";
      document.getElementById("kelasSantri").value = "";
      document.getElementById("kamarSantri").value = "";
      document.getElementById("idSantriDisplay").value = "";

      if (!keyword) {
        dropdown.classList.add("hidden");
        btnClear.classList.add("hidden");
        return;
      }

      btnClear.classList.remove("hidden");

      const filtered = masterSantriList.filter((item) =>
        item.namaSantri.toLowerCase().includes(keyword) ||
        item.idSantri.toLowerCase().includes(keyword) ||
        item.kelas.toLowerCase().includes(keyword) ||
        item.kamar.toLowerCase().includes(keyword)
      );

      renderDropdown(filtered);
    });

    function renderDropdown(items) {
      dropdown.innerHTML = "";
      if (items.length === 0) {
        dropdown.innerHTML = '<div class="p-3.5 text-xs text-slate-500 text-center">Nama santri tidak ditemukan di Master_Data</div>';
        dropdown.classList.remove("hidden");
        return;
      }

      items.slice(0, 10).forEach((santri) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "w-full text-left px-4 py-3 hover:bg-emerald-50 transition flex items-center justify-between";
        row.innerHTML = \`
          <div>
            <p class="text-sm font-semibold text-slate-900">\${santri.namaSantri}</p>
            <p class="text-xs text-slate-500">Kelas \${santri.kelas} · Kamar \${santri.kamar}</p>
          </div>
          <span class="text-xs font-mono text-emerald-700">\${santri.idSantri}</span>
        \`;
        row.addEventListener("click", () => pilihSantri(santri));
        dropdown.appendChild(row);
      });

      dropdown.classList.remove("hidden");
    }

    function pilihSantri(santri) {
      searchInput.value = santri.namaSantri;
      document.getElementById("namaSantri").value = santri.namaSantri;
      document.getElementById("idSantri").value = santri.idSantri;
      document.getElementById("idSantriDisplay").value = santri.idSantri;
      document.getElementById("kelasSantri").value = santri.kelas;
      document.getElementById("kamarSantri").value = santri.kamar;
      dropdown.classList.add("hidden");
      btnClear.classList.remove("hidden");
    }

    btnClear.addEventListener("click", () => {
      searchInput.value = "";
      document.getElementById("idSantri").value = "";
      document.getElementById("namaSantri").value = "";
      document.getElementById("idSantriDisplay").value = "";
      document.getElementById("kelasSantri").value = "";
      document.getElementById("kamarSantri").value = "";
      dropdown.classList.add("hidden");
      btnClear.classList.add("hidden");
      searchInput.focus();
    });

    // Submit Form ke Sheet Laporan_Musyrif
    document.getElementById("formLaporSakit").addEventListener("submit", function (e) {
      e.preventDefault();

      const payload = {
        tanggalLaporan: document.getElementById("tanggalLaporan").value,
        idSantri: document.getElementById("idSantri").value,
        namaSantri: document.getElementById("namaSantri").value,
        kelas: document.getElementById("kelasSantri").value,
        kamar: document.getElementById("kamarSantri").value,
        keluhanUtama: document.getElementById("keluhanUtama").value.trim(),
      };

      if (!payload.idSantri || !payload.namaSantri) {
        Swal.fire({
          icon: "warning",
          title: "Santri Belum Dipilih",
          text: "Silakan cari dan klik nama santri dari daftar Master_Data terlebih dahulu.",
          confirmButtonColor: "#047857"
        });
        return;
      }

      if (payload.keluhanUtama.length < 5) {
        Swal.fire({
          icon: "warning",
          title: "Keluhan Belum Lengkap",
          text: "Mohon tuliskan keluhan utama santri minimal 5 karakter.",
          confirmButtonColor: "#047857"
        });
        return;
      }

      // Aktifkan Loading Spinner & Kunci Tombol
      const btnSubmit = document.getElementById("btnSubmit");
      const spinner = document.getElementById("spinnerSubmit");
      const textSubmit = document.getElementById("textSubmit");
      btnSubmit.disabled = true;
      spinner.classList.remove("hidden");
      textSubmit.textContent = "Mengirim Laporan...";

      const selesaiLoading = () => {
        btnSubmit.disabled = false;
        spinner.classList.add("hidden");
        textSubmit.textContent = "Kirim Laporan Sakit";
      };

      if (typeof google !== "undefined" && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler((res) => {
            selesaiLoading();
            Swal.fire({
              icon: "success",
              title: "Laporan Berhasil Dikirim!",
              html: \`Data sakit <b>\${payload.namaSantri}</b> telah tercatat dengan ID <code>\${res.idLaporan}</code>.<br/>Status: <b>MENUNGGU PENANGANAN</b>\`,
              confirmButtonColor: "#047857"
            });
            document.getElementById("keluhanUtama").value = "";
            btnClear.click();
          })
          .withFailureHandler((err) => {
            selesaiLoading();
            Swal.fire({
              icon: "error",
              title: "Gagal Menyimpan Laporan",
              text: err.message || "Terjadi kesalahan saat menyimpan ke Google Sheets.",
              confirmButtonColor: "#047857"
            });
          })
          .simpanLaporanMusyrif(payload);
      } else if (GAS_WEB_APP_URL) {
        fetch(GAS_WEB_APP_URL, {
          method: "POST",
          body: JSON.stringify(payload),
        })
          .then((r) => r.json())
          .then((res) => {
            selesaiLoading();
            Swal.fire({
              icon: "success",
              title: "Laporan Berhasil Dikirim!",
              text: "ID Laporan: " + (res.idLaporan || "Tersimpan"),
              confirmButtonColor: "#047857"
            });
            document.getElementById("keluhanUtama").value = "";
            btnClear.click();
          })
          .catch((err) => {
            selesaiLoading();
            Swal.fire({
              icon: "error",
              title: "Gagal Mengirim",
              text: err.message,
              confirmButtonColor: "#047857"
            });
          });
      }
    });
  </script>
</body>
</html>`;

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * PORTAL LAPOR SAKIT SANTRI - PESANTREN AL-ANDALUS
 * File: Code.gs (Versi Maksimal - Auto-Detect Sheet, GET/POST/JSONP & Sync UKP)
 * ============================================================================
 * Struktur 4 Sheet pada Google Spreadsheet:
 * 1. Master_Data     : Nama_Santri (A), Kelas (B), Daftar_Kamar (F), ID_Santri (G)
 * 2. Laporan_Musyrif : ID_Laporan (A), Timestamp (B), Tanggal_Laporan (C),
 *                      musrif_pelapor (D), ID_Santri (E), Nama_Santri (F),
 *                      Kelas (G), Kamar (H), Keluhan_Utama (J),
 *                      Status_Penanganan (L), Tindakan_UKP (N), Waktu_Update (O)
 * 3. Data_UKP        : Tanggal_Pemeriksaan (D), Nama (E), Keluhan (G), Tindakan (P)
 * 4. users_role      : id_user (A - diabaikan), nama (B - untuk login & musrif_pelapor),
 *                      role [admin_pusat / admin_pengasuhan / user] (C),
 *                      password (D), keterangan (E)
 * ============================================================================
 */

const SHEET_MASTER = 'Master_Data';
const SHEET_LAPORAN = 'Laporan_Musyrif';
const SHEET_UKP = 'Data_UKP';
const SHEET_USERS = 'users_role';
const TIMEZONE = 'Asia/Jakarta';

/**
 * Helper: Mencari sheet secara pintar (tidak peka huruf besar/kecil, spasi, garis bawah _, atau tanda hubung -)
 * sehingga tab bernama "users_role", "users-role", "user_role", atau "role" tetap terbaca otomatis.
 */
function findSheetSmart_(ss, candidates) {
  if (!ss) return null;
  for (let i = 0; i < candidates.length; i++) {
    const exact = ss.getSheetByName(candidates[i]);
    if (exact) return exact;
  }
  const normKey = function(str) {
    return String(str || '').trim().toLowerCase().replace(/[-_\\s]+/g, '_');
  };
  const targetKeys = candidates.map(normKey);
  const allSheets = ss.getSheets();
  for (let s = 0; s < allSheets.length; s++) {
    const sKey = normKey(allSheets[s].getName());
    if (targetKeys.indexOf(sKey) !== -1) {
      return allSheets[s];
    }
  }
  return null;
}

/**
 * Helper: Menormalkan format tanggal dari Google Sheets ke YYYY-MM-DD
 */
function normalizeDateStr_(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, TIMEZONE, 'yyyy-MM-dd');
  }
  const s = String(val || '').trim();
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{4})/);
  if (dmy) {
    return dmy[3] + '-' + String(dmy[2]).padStart(2, '0') + '-' + String(dmy[1]).padStart(2, '0');
  }
  const ymd = s.match(/^(\\d{4})[\\/-](\\d{1,2})[\\/-](\\d{1,2})/);
  if (ymd) {
    return ymd[1] + '-' + String(ymd[2]).padStart(2, '0') + '-' + String(ymd[3]).padStart(2, '0');
  }
  return s;
}

/**
 * Helper: Mengirim respons JSON atau JSONP (?callback=...) agar bebas kendala CORS di semua browser
 */
function sendJsonResponse_(obj, e) {
  const jsonStr = JSON.stringify(obj);
  const cb = (e && e.parameter && e.parameter.callback)
    ? String(e.parameter.callback).replace(/[^a-zA-Z0-9_$.]/g, '')
    : '';
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + jsonStr + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 0. FUNGSI INISIALISASI OTOMATIS: setupSheetsOtomatis()
 *    Dapat dijalankan manual di Editor Apps Script atau dipanggil otomatis bila tab belum ada.
 */
function setupSheetsOtomatis() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sheet Master_Data
  let sMaster = findSheetSmart_(ss, [SHEET_MASTER, 'master-data', 'Master Data']);
  if (!sMaster) {
    sMaster = ss.insertSheet(SHEET_MASTER);
    sMaster.getRange(1, 1, 1, 7).setValues([[
      'Nama_Santri', 'Kelas', 'Wali_Kelas', 'Asrama', 'Musyrif', 'Daftar_Kamar', 'ID_Santri'
    ]]);
  }

  // 2. Sheet Laporan_Musyrif
  let sLaporan = findSheetSmart_(ss, [SHEET_LAPORAN, 'laporan-musyrif', 'Laporan Musyrif', 'laporan_musrif']);
  if (!sLaporan) {
    sLaporan = ss.insertSheet(SHEET_LAPORAN);
    sLaporan.getRange(1, 1, 1, 15).setValues([[
      'ID_Laporan', 'Timestamp', 'Tanggal_Laporan', 'musrif_pelapor', 'ID_Santri',
      'Nama_Santri', 'Kelas', 'Kamar', 'Gedung', 'Keluhan_Utama',
      'Suhu_Tubuh', 'Status_Penanganan', 'Petugas_UKP', 'Tindakan_UKP', 'Waktu_Update'
    ]]);
  }

  // 3. Sheet Data_UKP
  let sUKP = findSheetSmart_(ss, [SHEET_UKP, 'data-ukp', 'Data UKP']);
  if (!sUKP) {
    sUKP = ss.insertSheet(SHEET_UKP);
    const headersUKP = new Array(16).fill('');
    headersUKP[3] = 'Tanggal_Pemeriksaan'; // Kolom D
    headersUKP[4] = 'Nama';                // Kolom E
    headersUKP[6] = 'Keluhan';             // Kolom G
    headersUKP[15] = 'Tindakan';           // Kolom P
    sUKP.getRange(1, 1, 1, 16).setValues([headersUKP]);
  }

  // 4. Sheet users_role
  let sUsers = findSheetSmart_(ss, [SHEET_USERS, 'users-role', 'user_role', 'user-role', 'role']);
  if (!sUsers) {
    sUsers = ss.insertSheet(SHEET_USERS);
    sUsers.getRange(1, 1, 1, 5).setValues([[
      'id_user', 'nama', 'role', 'password', 'keterangan'
    ]]);
    sUsers.getRange(2, 1, 7, 5).setValues([
      ['USR-01', 'Admin Pusat', 'admin_pusat', 'admin123', 'Admin Pusat (Akses Penuh & Kode Script)'],
      ['USR-02', 'SDM', 'admin_pusat', 'admin123', 'Staf SDM & Admin Pusat (Akses Penuh & Kode Script)'],
      ['USR-03', 'Admin Pengasuhan', 'admin_pengasuhan', 'admin123', 'Admin Pengasuhan (Dashboard & Pantauan Santri)'],
      ['USR-04', 'Ust. Salman Al-Farisi', 'user', 'cordoba123', 'Asrama Cordoba'],
      ['USR-05', 'Ust. Haidar Azzam', 'user', 'granada123', 'Asrama Granada'],
      ['USR-06', 'Ust. Luqmanul Hakim', 'user', 'sevilla123', 'Asrama Sevilla'],
      ['USR-07', 'Ust. Abdurrahman Zufar', 'user', 'toledo123', 'Asrama Toledo & Malaga']
    ]);
  }

  Logger.log('Ke-4 Sheet (Master_Data, Laporan_Musyrif, Data_UKP, users_role) siap digunakan!');
}

/**
 * Handler Terpadu untuk GET dan POST
 */
function handleApiAction_(action, payload, e) {
  try {
    if (!action || action === 'getAllData') {
      return sendJsonResponse_({
        status: 'success',
        masterData: getMasterSantri(),
        laporanList: getLaporanMusyrif(),
        ukpList: getDataUKP(),
        usersRoleList: getUsersRole(),
        lastSyncTime: Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss')
      }, e);
    }

    if (action === 'getMasterSantri') {
      return sendJsonResponse_({
        status: 'success',
        data: getMasterSantri()
      }, e);
    }

    if (action === 'simpanLaporan') {
      const result = simpanLaporanMusyrif(payload);
      return sendJsonResponse_(result, e);
    }

    if (action === 'syncStatusUKP') {
      const updatedCount = syncStatusUKP();
      return sendJsonResponse_({
        status: 'success',
        updatedCount: updatedCount,
        laporanList: getLaporanMusyrif(),
        lastSyncTime: Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss')
      }, e);
    }

    if (action === 'updateUserPassword') {
      updatePasswordInSheet(payload.namaUser, payload.newPassword);
      return sendJsonResponse_({
        status: 'success',
        usersRoleList: getUsersRole()
      }, e);
    }

    if (action === 'addUserRole') {
      addUserRoleToSheet(payload);
      return sendJsonResponse_({
        status: 'success',
        usersRoleList: getUsersRole()
      }, e);
    }

    if (action === 'addMasterSantri') {
      addMasterSantriToSheet(payload);
      return sendJsonResponse_({
        status: 'success',
        masterData: getMasterSantri()
      }, e);
    }

    // Default fallback: kembalikan seluruh data 4 sheet
    return sendJsonResponse_({
      status: 'success',
      masterData: getMasterSantri(),
      laporanList: getLaporanMusyrif(),
      ukpList: getDataUKP(),
      usersRoleList: getUsersRole(),
      lastSyncTime: Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss')
    }, e);
  } catch (err) {
    return sendJsonResponse_({
      status: 'error',
      message: err && err.toString ? err.toString() : 'Unknown error in Code.gs'
    }, e);
  }
}

/**
 * 1. Endpoint GET (Mendukung pengambilan semua data 4 Sheet, aksi query payload, & JSONP)
 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || 'getAllData';

  if (action === 'ui') {
    try {
      return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('Portal Lapor Sakit Santri - Pesantren Al-Andalus')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (htmlErr) {
      return sendJsonResponse_({
        status: 'success',
        info: 'Web App API Code.gs aktif. Gunakan URL /exec ini di aplikasi Portal Lapor Sakit Santri.',
        masterData: getMasterSantri(),
        laporanList: getLaporanMusyrif(),
        ukpList: getDataUKP(),
        usersRoleList: getUsersRole()
      }, e);
    }
  }

  let payload = {};
  if (params.payload) {
    try {
      payload = JSON.parse(params.payload);
    } catch (parseErr) {
      payload = params;
    }
  } else {
    payload = params;
  }

  return handleApiAction_(action, payload, e);
}

/**
 * 2. Endpoint POST (Menyimpan Laporan, Menjalankan syncStatusUKP, Update users_role, atau getAllData)
 */
function doPost(e) {
  try {
    const rawContents = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const payload = JSON.parse(rawContents);
    const action = payload.action || (e && e.parameter && e.parameter.action) || 'simpanLaporan';
    return handleApiAction_(action, payload, e);
  } catch (err) {
    return sendJsonResponse_({
      status: 'error',
      message: err && err.toString ? err.toString() : 'Gagal memproses POST request'
    }, e);
  }
}

/**
 * 3. Membaca Sheet Master_Data (Kolom A: Nama_Santri, B: Kelas, F: Daftar_Kamar, G: ID_Santri)
 */
function getMasterSantri() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = findSheetSmart_(ss, [SHEET_MASTER, 'master-data', 'Master Data', 'data_santri']);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const maxCol = Math.max(7, sheet.getLastColumn());
    const allRows = sheet.getRange(1, 1, sheet.getLastRow(), maxCol).getDisplayValues();
    const headers = allRows[0].map(function(h) { return String(h || '').trim().toLowerCase(); });

    let idxNama = 0;
    let idxKelas = 1;
    let idxKamar = 5;
    let idxId = 6;

    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (!h) continue;
      if (h.indexOf('nama') !== -1 && h.indexOf('wali') === -1 && h.indexOf('musyrif') === -1) idxNama = c;
      else if (h === 'kelas' || h.indexOf('kelas') !== -1 && h.indexOf('wali') === -1) idxKelas = c;
      else if (h.indexOf('kamar') !== -1) idxKamar = c;
      else if (h.indexOf('id') !== -1) idxId = c;
    }

    const list = [];
    for (let i = 1; i < allRows.length; i++) {
      const row = allRows[i];
      const namaSantri = String(row[idxNama] || row[0] || '').trim();
      if (!namaSantri) continue;
      list.push({
        namaSantri: namaSantri,
        kelas: String(row[idxKelas] || row[1] || '').trim(),
        kamar: String(row[idxKamar] || row[5] || row[2] || '').trim(),
        idSantri: String(row[idxId] || row[6] || ('AND-' + String(i).padStart(3, '0'))).trim()
      });
    }
    return list;
  } catch (err) {
    return [];
  }
}

/**
 * 4. Membaca Sheet Laporan_Musyrif (Kolom A s/d O, mendukung deteksi kolom musrif_pelapor)
 */
function getLaporanMusyrif() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = findSheetSmart_(ss, [SHEET_LAPORAN, 'laporan-musyrif', 'Laporan Musyrif', 'laporan_musrif']);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const maxCol = Math.max(15, sheet.getLastColumn());
    const allRows = sheet.getRange(1, 1, sheet.getLastRow(), maxCol).getDisplayValues();
    const headers = allRows[0].map(function(h) { return String(h || '').trim().toLowerCase(); });

    let idxPelapor = 3; // Default Kolom D
    for (let c = 0; c < headers.length; c++) {
      if (headers[c].indexOf('musrif_pelapor') !== -1 || headers[c].indexOf('musyrif') !== -1 || headers[c].indexOf('pelapor') !== -1) {
        idxPelapor = c;
        break;
      }
    }

    const list = [];
    for (let i = 1; i < allRows.length; i++) {
      const r = allRows[i];
      const namaSantri = String(r[5] || '').trim();
      if (!namaSantri) continue;
      const pelaporVal = String(r[idxPelapor] || r[3] || '').trim();
      list.push({
        idLaporan: String(r[0] || ('LP-' + i)).trim(),
        timestamp: String(r[1] || '').trim(),
        tanggalLaporan: normalizeDateStr_(r[2]),
        namaMusyrif: pelaporVal,
        idSantri: String(r[4] || '').trim(),
        namaSantri: namaSantri,
        kelas: String(r[6] || '').trim(),
        kamar: String(r[7] || '').trim(),
        keluhanUtama: String(r[9] || '').trim(),
        statusPenanganan: String(r[11] || 'MENUNGGU PENANGANAN').trim(),
        tindakanUKP: String(r[13] || '').trim(),
        waktuUpdate: String(r[14] || '').trim()
      });
    }
    return list.reverse();
  } catch (err) {
    return [];
  }
}

/**
 * 5. Membaca Sheet Data_UKP (Kolom D, E, G, P)
 */
function getDataUKP() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = findSheetSmart_(ss, [SHEET_UKP, 'data-ukp', 'Data UKP', 'ukp']);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const maxCol = Math.max(16, sheet.getLastColumn());
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, maxCol).getDisplayValues();
    const list = [];
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const nama = String(r[4] || '').trim();
      if (!nama) continue;
      list.push({
        idRow: 'UKP-' + (i + 1),
        tanggalPemeriksaan: normalizeDateStr_(r[3]),
        nama: nama,
        keluhan: String(r[6] || '').trim(),
        tindakan: String(r[15] || '').trim()
      });
    }
    return list;
  } catch (err) {
    return [];
  }
}

/**
 * 6. Membaca Sheet users_role / users-role langsung dari Kolom "nama" (BUKAN Kolom A / id_user)
 */
function detectUsersRoleColumns_(allRows) {
  let headerRowIdx = 0;
  for (let rIdx = 0; rIdx < Math.min(3, allRows.length); rIdx++) {
    const rowLower = allRows[rIdx].map(function(cell) {
      return String(cell || '').trim().toLowerCase();
    });
    const hasKeyword = rowLower.some(function(h) {
      return (
        h === 'nama' ||
        h.indexOf('nama') !== -1 ||
        h.indexOf('user') !== -1 ||
        h.indexOf('role') !== -1 ||
        h.indexOf('pass') !== -1 ||
        h.indexOf('sandi') !== -1
      );
    });
    if (hasKeyword) {
      headerRowIdx = rIdx;
      break;
    }
  }

  const headers = allRows[headerRowIdx].map(function(h) {
    return String(h || '').trim().toLowerCase();
  });

  let idxId   = -1;
  let idxNama = -1;
  let idxRole = -1;
  let idxPass = -1;
  let idxKet  = -1;

  for (let c = 0; c < headers.length; c++) {
    const h = headers[c];
    if (!h) continue;
    if (
      h.indexOf('pass') !== -1 ||
      h.indexOf('sandi') !== -1 ||
      h.indexOf('pw') !== -1 ||
      h.indexOf('pin') !== -1
    ) {
      if (idxPass === -1) idxPass = c;
    } else if (
      h.indexOf('role') !== -1 ||
      h.indexOf('akses') !== -1 ||
      h.indexOf('level') !== -1 ||
      h.indexOf('jabatan') !== -1
    ) {
      if (idxRole === -1) idxRole = c;
    } else if (
      h === 'id' ||
      h === 'no' ||
      h === 'nomor' ||
      h === 'id_user' ||
      h === 'id user' ||
      h.indexOf('id_') !== -1
    ) {
      if (idxId === -1) idxId = c;
    } else if (
      h.indexOf('ket') !== -1 ||
      h.indexOf('asrama') !== -1 ||
      h.indexOf('gedung') !== -1
    ) {
      if (idxKet === -1) idxKet = c;
    } else if (
      h.indexOf('nama') !== -1 ||
      h.indexOf('user') !== -1 ||
      h.indexOf('musrif') !== -1 ||
      h.indexOf('musyrif') !== -1 ||
      h.indexOf('ustadz') !== -1
    ) {
      if (idxNama === -1) idxNama = c;
    }
  }

  // Fallback default bila sebagian header tidak terdeteksi
  if (idxNama === -1) idxNama = idxId === 0 ? 1 : 0;
  if (idxRole === -1) idxRole = idxNama === 1 ? 2 : 1;
  if (idxPass === -1) idxPass = 3;
  if (idxKet === -1) idxKet = 4;

  // Verifikasi berbasis isi baris data agar kolom angka/password (mis. 12345678 / 87654321) tidak tertukar dengan kolom nama
  const sampleRows = allRows.slice(headerRowIdx + 1, headerRowIdx + 8);
  const isColumnMostlyNumeric = function(colIdx) {
    let count = 0;
    let numCount = 0;
    for (let r = 0; r < sampleRows.length; r++) {
      const val = String((sampleRows[r] && sampleRows[r][colIdx]) || '').trim();
      if (!val) continue;
      count++;
      if (/^\\d{4,}$/.test(val)) numCount++;
    }
    return count > 0 && numCount >= Math.ceil(count / 2);
  };

  if (isColumnMostlyNumeric(idxNama)) {
    const numericCol = idxNama;
    for (let c = 0; c < headers.length; c++) {
      if (c === numericCol || c === idxId || c === idxRole) continue;
      const sampleVal = String((sampleRows[0] && sampleRows[0][c]) || '').trim();
      if (sampleVal && /[a-zA-Z]/.test(sampleVal) && !/^usr[-_]?\\d+$/i.test(sampleVal)) {
        idxNama = c;
        if (idxPass === -1 || idxPass === c || !String((sampleRows[0] && sampleRows[0][idxPass]) || '').trim()) {
          idxPass = numericCol;
        }
        break;
      }
    }
  }

  return {
    headerRowIdx: headerRowIdx,
    idxId: idxId,
    idxNama: idxNama,
    idxRole: idxRole,
    idxPass: idxPass,
    idxKet: idxKet
  };
}

function getUsersRole() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = findSheetSmart_(ss, [
      SHEET_USERS,
      'users-role',
      'user_role',
      'user-role',
      'users role',
      'role',
      'akun'
    ]);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const maxCol = Math.max(5, sheet.getLastColumn());
    const allRows = sheet.getRange(1, 1, sheet.getLastRow(), maxCol).getDisplayValues();
    const cols = detectUsersRoleColumns_(allRows);

    const list = [];
    for (let i = cols.headerRowIdx + 1; i < allRows.length; i++) {
      const r = allRows[i];
      const namaVal = String(
        r[cols.idxNama] !== undefined && String(r[cols.idxNama]).trim() !== ''
          ? r[cols.idxNama]
          : r[1] || r[0] || ''
      ).trim();
      if (!namaVal) continue;

      const rawRole = String(r[cols.idxRole] || 'user').trim().toLowerCase();
      const namaLower = namaVal.toLowerCase();
      const ketVal = String(r[cols.idxKet] || '').trim();
      const combined = rawRole + ' ' + namaLower + ' ' + ketVal.toLowerCase();
      let normalizedRole = 'user';
      if (
        combined.indexOf('pengasuhan') !== -1 ||
        combined.indexOf('kesantrian') !== -1 ||
        combined.indexOf('kepengrasuhan') !== -1
      ) {
        normalizedRole = 'admin_pengasuhan';
      } else if (
        combined.indexOf('pusat') !== -1 ||
        combined.indexOf('sdm') !== -1 ||
        combined.indexOf('hrd') !== -1 ||
        combined.indexOf('super') !== -1 ||
        combined.indexOf('utama') !== -1 ||
        rawRole.indexOf('admin') !== -1 ||
        namaLower.indexOf('admin') !== -1
      ) {
        normalizedRole = 'admin_pusat';
      }

      const passVal = String(
        r[cols.idxPass] !== undefined && String(r[cols.idxPass]).trim() !== ''
          ? r[cols.idxPass]
          : r[cols.idxRole] || ''
      ).trim();

      list.push({
        id_user: String(r[0] || '').trim(),
        nama: namaVal,
        namaUser: namaVal,
        role: normalizedRole,
        password: passVal,
        keterangan: ketVal
      });
    }
    return list;
  } catch (err) {
    return [];
  }
}

/**
 * 7. Menyimpan Laporan Baru ke Sheet Laporan_Musyrif (mengisi musrif_pelapor dari nama login)
 */
function simpanLaporanMusyrif(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = findSheetSmart_(ss, [SHEET_LAPORAN, 'laporan-musyrif', 'Laporan Musyrif', 'laporan_musrif']);
    if (!sheet) {
      setupSheetsOtomatis();
      sheet = findSheetSmart_(ss, [SHEET_LAPORAN]);
    }

    const now = new Date();
    const timestampStr = Utilities.formatDate(now, TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
    const todayDefault = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');
    const datePrefix = Utilities.formatDate(now, TIMEZONE, 'yyyyMMdd');
    const nextRow = sheet.getLastRow() + 1;
    const urutan = String(Math.max(1, nextRow - 1)).padStart(3, '0');
    const idLaporan = 'LP-' + datePrefix + '-' + urutan;

    const maxCol = Math.max(15, sheet.getLastColumn());
    const headers = sheet.getRange(1, 1, 1, maxCol).getDisplayValues()[0].map(function(h) {
      return String(h || '').trim().toLowerCase();
    });

    const namaPelapor = payload.musrif_pelapor || payload.namaMusyrif || '';
    const tglLaporan = normalizeDateStr_(payload.tanggalLaporan) || todayDefault;
    const newRow = new Array(maxCol).fill('');
    newRow[0]  = idLaporan;                          // Kolom A: ID_Laporan
    newRow[1]  = timestampStr;                       // Kolom B: Timestamp
    newRow[2]  = tglLaporan;                         // Kolom C: Tanggal_Laporan (YYYY-MM-DD)
    newRow[3]  = namaPelapor;                        // Kolom D: musrif_pelapor (Default)
    newRow[4]  = payload.idSantri || '';             // Kolom E: ID_Santri
    newRow[5]  = payload.namaSantri || '';           // Kolom F: Nama_Santri
    newRow[6]  = payload.kelas || '';                // Kolom G: Kelas
    newRow[7]  = payload.kamar || '';                // Kolom H: Kamar
    newRow[9]  = payload.keluhanUtama || '';         // Kolom J: Keluhan_Utama
    newRow[11] = 'MENUNGGU PENANGANAN';              // Kolom L: Status_Penanganan
    newRow[13] = '';                                 // Kolom N: Tindakan_UKP
    newRow[14] = '';                                 // Kolom O: Waktu_Update

    for (let c = 0; c < headers.length; c++) {
      if (headers[c].indexOf('musrif_pelapor') !== -1 || headers[c].indexOf('musyrif_pelapor') !== -1) {
        newRow[c] = namaPelapor;
      }
    }

    sheet.getRange(nextRow, 1, 1, maxCol).setValues([newRow]);

    return {
      status: 'success',
      idLaporan: idLaporan,
      timestamp: timestampStr,
      tanggalLaporan: tglLaporan,
      musrif_pelapor: namaPelapor
    };
  } finally {
    lock.releaseLock();
  }
}

function updatePasswordInSheet(namaUser, newPassword) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = findSheetSmart_(ss, [
    SHEET_USERS,
    'users-role',
    'user_role',
    'user-role',
    'users role',
    'role'
  ]);
  if (!sheet || sheet.getLastRow() < 2) return;

  const maxCol = Math.max(5, sheet.getLastColumn());
  const allRows = sheet.getRange(1, 1, sheet.getLastRow(), maxCol).getDisplayValues();
  const cols = detectUsersRoleColumns_(allRows);

  for (let i = cols.headerRowIdx + 1; i < allRows.length; i++) {
    const rowNama = String(allRows[i][cols.idxNama] || allRows[i][1] || '').trim().toLowerCase();
    if (rowNama === String(namaUser || '').trim().toLowerCase()) {
      sheet.getRange(i + 1, cols.idxPass + 1).setValue(newPassword);
      break;
    }
  }
}

function addUserRoleToSheet(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = findSheetSmart_(ss, [
    SHEET_USERS,
    'users-role',
    'user_role',
    'user-role',
    'users role',
    'role'
  ]);
  if (!sheet) {
    setupSheetsOtomatis();
    sheet = findSheetSmart_(ss, [SHEET_USERS]);
  }
  const maxCol = Math.max(5, sheet.getLastColumn());
  const allRows = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), maxCol).getDisplayValues();
  const cols = detectUsersRoleColumns_(allRows);
  const nextRow = sheet.getLastRow() + 1;
  const newRow = new Array(maxCol).fill('');
  if (cols.idxNama > 0) {
    newRow[0] = 'USR-' + String(Math.max(1, nextRow - 1)).padStart(2, '0');
  }
  newRow[cols.idxNama] = payload.namaUser || payload.nama || '';
  newRow[cols.idxRole] = payload.role || 'user';
  newRow[cols.idxPass] = payload.password || '';
  if (cols.idxKet < maxCol) {
    newRow[cols.idxKet] = payload.keterangan || '';
  }
  sheet.getRange(nextRow, 1, 1, maxCol).setValues([newRow]);
}

function addMasterSantriToSheet(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = findSheetSmart_(ss, [SHEET_MASTER, 'master-data', 'Master Data']);
  if (!sheet) {
    setupSheetsOtomatis();
    sheet = findSheetSmart_(ss, [SHEET_MASTER]);
  }
  const nextRow = sheet.getLastRow() + 1;
  const row = new Array(7).fill('');
  row[0] = payload.namaSantri || '';
  row[1] = payload.kelas || '';
  row[5] = payload.kamar || '';
  row[6] = payload.idSantri || '';
  sheet.getRange(nextRow, 1, 1, 7).setValues([row]);
}

/**
 * ============================================================================
 * 8. FUNGSI UTAMA SINKRONISASI UKP (TIME-DRIVEN TRIGGER): syncStatusUKP()
 * ============================================================================
 */
function syncStatusUKP() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetLaporan = findSheetSmart_(ss, [SHEET_LAPORAN, 'laporan-musyrif', 'Laporan Musyrif', 'laporan_musrif']);
  const sheetUKP = findSheetSmart_(ss, [SHEET_UKP, 'data-ukp', 'Data UKP', 'ukp']);

  if (!sheetLaporan || !sheetUKP) return 0;

  const lastRowLaporan = sheetLaporan.getLastRow();
  const lastRowUKP = sheetUKP.getLastRow();
  if (lastRowLaporan < 2 || lastRowUKP < 2) return 0;

  const dataLaporan = sheetLaporan.getRange(2, 1, lastRowLaporan - 1, 15).getDisplayValues();
  const dataUKP = sheetUKP.getRange(2, 1, lastRowUKP - 1, 16).getDisplayValues();
  const waktuSekarang = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
  let jumlahDiperbarui = 0;

  for (let i = 0; i < dataLaporan.length; i++) {
    const statusPenanganan = String(dataLaporan[i][11] || '').trim().toUpperCase();
    const namaSantriLaporan = String(dataLaporan[i][5] || '').trim().toLowerCase();
    const tglLaporan = normalizeDateStr_(dataLaporan[i][2]); // Kolom C: Tanggal_Laporan (YYYY-MM-DD)

    if (!namaSantriLaporan) continue;

    let ditemukanTindakanValid = false;
    let tindakanTerbaru = '';

    // Cari dari baris paling bawah ke atas di Data_UKP
    // WAJIB cocok Nama Santri (Kolom E) DAN Tanggal Pemeriksaan UKP (Kolom D) >= Tanggal Laporan (Kolom C)
    for (let j = dataUKP.length - 1; j >= 0; j--) {
      const namaSantriUKP = String(dataUKP[j][4] || '').trim().toLowerCase();
      const tglUKP        = normalizeDateStr_(dataUKP[j][3]); // Kolom D: Tanggal Pemeriksaan (YYYY-MM-DD)
      const tindakanUKP   = String(dataUKP[j][15] || '').trim(); // Kolom P: Tindakan

      const tanggalSesuai = (!tglLaporan || !tglUKP) ? true : (tglUKP >= tglLaporan);

      if (namaSantriUKP === namaSantriLaporan && tindakanUKP !== '' && tanggalSesuai) {
        ditemukanTindakanValid = true;
        tindakanTerbaru = tindakanUKP;
        break;
      }
    }

    const barisSheet = i + 2;

    if (ditemukanTindakanValid) {
      if (statusPenanganan === 'MENUNGGU PENANGANAN') {
        const statusBaru = 'SUDAH DITANGANI - ' + tindakanTerbaru;
        sheetLaporan.getRange(barisSheet, 12).setValue(statusBaru);
        sheetLaporan.getRange(barisSheet, 14).setValue(tindakanTerbaru);
        sheetLaporan.getRange(barisSheet, 15).setValue(waktuSekarang);
        jumlahDiperbarui++;
      }
    } else if (statusPenanganan !== 'MENUNGGU PENANGANAN') {
      // Koreksi otomatis jika sebelumnya terlanjur berubah jadi SUDAH DITANGANI gara-gara data UKP tanggal lama
      sheetLaporan.getRange(barisSheet, 12).setValue('MENUNGGU PENANGANAN');
      sheetLaporan.getRange(barisSheet, 14).setValue('');
      sheetLaporan.getRange(barisSheet, 15).setValue('');
      jumlahDiperbarui++;
    }
  }

  return jumlahDiperbarui;
}

/**
 * 9. Memasang Time-Driven Trigger Otomatis (Tiap 5 Menit)
 */
function pasangTriggerSyncUKP() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncStatusUKP') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('syncStatusUKP')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Time-Driven Trigger untuk syncStatusUKP() berhasil dipasang (setiap 5 menit).');
}
`;

