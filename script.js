"use strict";

// ================================
// KONFIGURASI
// ================================

const LAYANAN = {
    T:  { nama: "Teller",           menitPerOrang: 4 },
    CS: { nama: "Customer Service", menitPerOrang: 8 }
};

const JAM_BUKA = 8;    // 08:00
const JAM_TUTUP = 15;  // 15:00
const STORAGE_KEY = "bankku-antrean-v2";
const THEME_KEY = "bankku-theme";
const SOUND_KEY = "bankku-sound";
const MAX_RIWAYAT = 8;
const MAX_TAMPIL = 6;

// ================================
// STATE
// ================================

function stateAwal() {
    return {
        hari: hariIni(),
        berikutnya: { T: 1, CS: 1 },     // nomor tiket selanjutnya
        antrean:    { T: [], CS: [] },   // nomor yang menunggu
        sekarang:   { T: null, CS: null },
        riwayat:    [],                  // { nomor, layanan, waktu }
        diterbitkan: 0,
        dilayani: 0
    };
}

let state = muat();
let suaraAktif = bacaStorage(SOUND_KEY) !== "off";

function hariIni() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function bacaStorage(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function tulisStorage(key, value) {
    try { localStorage.setItem(key, value); } catch { /* abaikan */ }
}

function muat() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return stateAwal();
        const data = JSON.parse(raw);
        // Antrean otomatis mulai dari nol di hari yang baru
        if (!data || data.hari !== hariIni()) return stateAwal();
        return { ...stateAwal(), ...data };
    } catch {
        return stateAwal();
    }
}

function simpan() {
    tulisStorage(STORAGE_KEY, JSON.stringify(state));
}

// ================================
// UTIL
// ================================

const $ = (id) => document.getElementById(id);

function formatNomor(kode, n) {
    return `${kode}-${String(n).padStart(3, "0")}`;
}

function kodeDari(nomor) {
    return nomor.split("-")[0];
}

function jamMenit(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function bump(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
}

// ================================
// JAM REALTIME & STATUS BUKA
// ================================

function updateClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");

    $("clock").textContent =
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    $("date").textContent = now.toLocaleDateString("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

    const menit = now.getHours() * 60 + now.getMinutes();
    const buka = menit >= JAM_BUKA * 60 && menit < JAM_TUTUP * 60;
    const pill = $("openStatus");
    pill.dataset.open = String(buka);
    $("openStatusText").textContent = buka ? "Buka" : "Tutup";

    // Ganti hari saat halaman dibiarkan terbuka semalaman
    if (state.hari !== hariIni()) {
        state = stateAwal();
        simpan();
        render();
    }
}

// ================================
// TOAST
// ================================

function toast(pesan, tipe = "info") {
    const wadah = $("toasts");
    const el = document.createElement("div");
    el.className = `toast ${tipe === "error" ? "error" : ""}`;
    el.textContent = pesan;
    wadah.appendChild(el);

    setTimeout(() => {
        el.classList.add("out");
        el.addEventListener("animationend", () => el.remove(), { once: true });
    }, 3200);
}

// ================================
// AMBIL TIKET
// ================================

function ambilTiket() {
    const dipilih = document.querySelector('input[name="service"]:checked');
    if (!dipilih) {
        toast("Pilih layanan terlebih dahulu.", "error");
        return;
    }

    const kode = dipilih.value;
    const nomor = formatNomor(kode, state.berikutnya[kode]);

    state.berikutnya[kode]++;
    state.antrean[kode].push(nomor);
    state.diterbitkan++;
    simpan();

    // Hitung sisa orang di depan dan estimasi tunggu
    const didepan = state.antrean[kode].length - 1;
    const estimasi = didepan * LAYANAN[kode].menitPerOrang;

    $("ticketNumber").textContent = nomor;
    $("ticketService").textContent = LAYANAN[kode].nama;
    $("ticketAhead").textContent =
        didepan === 0 ? "Anda berikutnya" : `${didepan} orang di depan Anda`;
    $("ticketEta").textContent =
        estimasi === 0 ? "Segera dipanggil" : `± ${estimasi} menit`;
    $("ticketResult").hidden = false;

    render();
    toast(`Tiket ${nomor} berhasil diambil`);
}

// ================================
// PANGGIL BERIKUTNYA (PER LOKET)
// ================================

function panggil(kode) {
    if (!state.antrean[kode].length) {
        toast(`Tidak ada antrean ${LAYANAN[kode].nama}.`, "error");
        return;
    }

    const nomor = state.antrean[kode].shift();
    state.sekarang[kode] = nomor;
    state.dilayani++;
    state.riwayat.unshift({ nomor, layanan: kode, waktu: Date.now() });
    state.riwayat = state.riwayat.slice(0, MAX_RIWAYAT);
    simpan();

    render();

    const el = $(`current${kode}`);
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");

    suaraPanggilan(nomor, kode);
}

function panggilUlang(kode) {
    const nomor = state.sekarang[kode];
    if (!nomor) {
        toast(`Belum ada nomor ${LAYANAN[kode].nama} yang dipanggil.`, "error");
        return;
    }
    suaraPanggilan(nomor, kode);
    toast(`Memanggil ulang ${nomor}`);
}

// ================================
// SUARA PANGGILAN
// ================================

function eja(nomor) {
    // "T-007" -> "Te, nol nol tujuh" agar terdengar jelas
    const [kode, angka] = nomor.split("-");
    const huruf = kode === "T" ? "Te" : "Ce Es";
    return `${huruf}, ${angka.split("").map((d) => (d === "0" ? "nol" : d)).join(" ")}`;
}

function suaraPanggilan(nomor, kode) {
    if (!suaraAktif || !("speechSynthesis" in window)) return;

    const teks = `Nomor antrean ${eja(nomor)}. Silakan menuju ${LAYANAN[kode].nama}.`;
    const u = new SpeechSynthesisUtterance(teks);
    u.lang = "id-ID";
    u.rate = 0.9;
    u.pitch = 1;

    // Pilih suara bahasa Indonesia bila tersedia
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("id"));
    if (voice) u.voice = voice;

    speechSynthesis.cancel();
    speechSynthesis.speak(u);
}

// ================================
// RESET
// ================================

function resetAntrean() {
    state = stateAwal();
    simpan();
    $("ticketResult").hidden = true;
    render();
    toast("Antrean telah direset");
}

// ================================
// RENDER
// ================================

function setTeks(id, nilai) {
    const el = $(id);
    if (el.textContent !== String(nilai)) {
        el.textContent = nilai;
        if (el.tagName === "STRONG") bump(el);
    }
}

function renderDaftar(kode) {
    const ul = $(`list${kode}`);
    ul.replaceChildren();

    const daftar = state.antrean[kode];
    if (!daftar.length) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "Tidak ada antrean";
        ul.appendChild(li);
        return;
    }

    daftar.slice(0, MAX_TAMPIL).forEach((nomor, i) => {
        const li = document.createElement("li");
        const strong = document.createElement("strong");
        strong.textContent = nomor;
        const span = document.createElement("span");
        span.textContent = `± ${(i + 1) * LAYANAN[kode].menitPerOrang} mnt`;
        li.append(strong, span);
        ul.appendChild(li);
    });

    if (daftar.length > MAX_TAMPIL) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = `+${daftar.length - MAX_TAMPIL} antrean lainnya`;
        ul.appendChild(li);
    }
}

function renderRiwayat() {
    const ol = $("history");
    ol.replaceChildren();

    if (!state.riwayat.length) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "Belum ada panggilan";
        ol.appendChild(li);
        return;
    }

    state.riwayat.forEach((r) => {
        const li = document.createElement("li");
        const strong = document.createElement("strong");
        strong.textContent = r.nomor;
        const nama = document.createElement("span");
        nama.textContent = `${LAYANAN[r.layanan].nama} · ${jamMenit(r.waktu)}`;
        li.append(strong, nama);
        ol.appendChild(li);
    });
}

function render() {
    const jmlT = state.antrean.T.length;
    const jmlCS = state.antrean.CS.length;

    setTeks("totalQueue", jmlT + jmlCS);
    setTeks("totalServed", state.dilayani);
    setTeks("totalIssued", state.diterbitkan);

    $("waitT").textContent = `${jmlT} menunggu`;
    $("waitCS").textContent = `${jmlCS} menunggu`;
    $("badgeT").textContent = `${jmlT} antre`;
    $("badgeCS").textContent = `${jmlCS} antre`;

    for (const kode of Object.keys(LAYANAN)) {
        const nomor = state.sekarang[kode];
        $(`current${kode}`).textContent = nomor || `${kode}-000`;
        $(`note${kode}`).textContent = nomor
            ? `Silakan menuju loket ${LAYANAN[kode].nama}`
            : "Belum ada panggilan";

        const btn = document.querySelector(`[data-call="${kode}"]`);
        btn.disabled = state.antrean[kode].length === 0;
        document.querySelector(`[data-recall="${kode}"]`).disabled = !nomor;

        renderDaftar(kode);
    }

    renderRiwayat();
}

// ================================
// TEMA & SUARA
// ================================

function terapkanTema(tema) {
    document.documentElement.dataset.theme = tema;
}

function toggleTema() {
    const gelap = document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme &&
            matchMedia("(prefers-color-scheme: dark)").matches);
    const baru = gelap ? "light" : "dark";
    terapkanTema(baru);
    tulisStorage(THEME_KEY, baru);
}

function renderSuara() {
    const btn = $("soundToggle");
    btn.textContent = suaraAktif ? "🔊 Suara aktif" : "🔇 Suara mati";
    btn.setAttribute("aria-pressed", String(suaraAktif));
}

// ================================
// INISIALISASI
// ================================

document.addEventListener("DOMContentLoaded", () => {

    const temaTersimpan = bacaStorage(THEME_KEY);
    if (temaTersimpan) terapkanTema(temaTersimpan);

    updateClock();
    setInterval(updateClock, 1000);
    renderSuara();
    render();

    $("takeBtn").addEventListener("click", ambilTiket);
    $("printBtn").addEventListener("click", () => window.print());
    $("themeToggle").addEventListener("click", toggleTema);

    document.querySelectorAll("[data-call]").forEach((b) =>
        b.addEventListener("click", () => panggil(b.dataset.call)));
    document.querySelectorAll("[data-recall]").forEach((b) =>
        b.addEventListener("click", () => panggilUlang(b.dataset.recall)));

    $("soundToggle").addEventListener("click", () => {
        suaraAktif = !suaraAktif;
        tulisStorage(SOUND_KEY, suaraAktif ? "on" : "off");
        if (!suaraAktif && "speechSynthesis" in window) speechSynthesis.cancel();
        renderSuara();
    });

    const dialog = $("confirmDialog");
    $("resetBtn").addEventListener("click", () => dialog.showModal());
    dialog.addEventListener("close", () => {
        if (dialog.returnValue === "ok") resetAntrean();
        dialog.returnValue = "";
    });

    // Sinkron antar tab: tab layar antrean & tab loket tetap seirama
    window.addEventListener("storage", (e) => {
        if (e.key === STORAGE_KEY) {
            state = muat();
            render();
        }
    });

    // Beberapa browser memuat daftar suara secara asinkron
    if ("speechSynthesis" in window) speechSynthesis.getVoices();
});
