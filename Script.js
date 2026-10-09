// ================================
// DATA ANTREAN
// ================================

let antrean = {
    T: [],
    CS: []
};

let nomorBerikutnya = {
    T: 1,
    CS: 1
};

let antreanDipanggil = 0;


// ================================
// JAM REALTIME
// ================================

function updateClock() {
    const clock = document.getElementById("clock");

    if (!clock) return;

    const sekarang = new Date();

    const jam = String(sekarang.getHours()).padStart(2, "0");
    const menit = String(sekarang.getMinutes()).padStart(2, "0");
    const detik = String(sekarang.getSeconds()).padStart(2, "0");

    clock.textContent = `${jam}:${menit}:${detik}`;
}

setInterval(updateClock, 1000);
updateClock();


// ================================
// AMBIL TIKET
// ================================

function ambilTiket() {

    const service = document.getElementById("service").value;

    // Membuat nomor antrean
    const nomor = nomorBerikutnya[service];

    nomorBerikutnya[service]++;

    // Format nomor menjadi 001, 002, 003
    const nomorFormat = String(nomor).padStart(3, "0");

    const nomorTiket = `${service}-${nomorFormat}`;

    // Masukkan ke antrean
    antrean[service].push(nomorTiket);

    // Tampilkan nomor tiket
    const ticketNumber = document.getElementById("ticketNumber");

    if (ticketNumber) {
        ticketNumber.textContent = nomorTiket;
    }

    // Tampilkan hasil tiket
    const ticketResult = document.getElementById("ticketResult");

    if (ticketResult) {
        ticketResult.style.display = "block";
    }

    // Update jumlah antrean
    updateTotalQueue();

    // Notifikasi
    alert(`Tiket berhasil diambil!\nNomor antrean Anda: ${nomorTiket}`);
}


// ================================
// PANGGIL ANTREAN BERIKUTNYA
// ================================

function panggilBerikutnya() {

    // Cek antrean Teller dan CS
    let nomorDipanggil = null;
    let serviceDipanggil = null;

    // Prioritas Teller
    if (antrean.T.length > 0) {

        nomorDipanggil = antrean.T.shift();
        serviceDipanggil = "Teller";

    } else if (antrean.CS.length > 0) {

        nomorDipanggil = antrean.CS.shift();
        serviceDipanggil = "Customer Service";

    } else {

        alert("Tidak ada antrean saat ini.");
        return;
    }

    antreanDipanggil++;

    // Tampilkan nomor yang dipanggil
    const currentNumber = document.getElementById("currentNumber");
    const currentService = document.getElementById("currentService");

    if (currentNumber) {
        currentNumber.textContent = nomorDipanggil;
    }

    if (currentService) {
        currentService.textContent =
            `Silakan menuju ${serviceDipanggil}`;
    }

    // Update total antrean
    updateTotalQueue();

    // Suara panggilan
    panggilDenganSuara(nomorDipanggil, serviceDipanggil);
}


// ================================
// HITUNG TOTAL ANTREAN
// ================================

function updateTotalQueue() {

    const total =
        antrean.T.length +
        antrean.CS.length;

    const totalQueue = document.getElementById("totalQueue");

    if (totalQueue) {
        totalQueue.textContent = total;
    }
}


// ================================
// SUARA PANGGILAN
// ================================

function panggilDenganSuara(nomor, layanan) {

    if (!("speechSynthesis" in window)) {
        return;
    }

    const teks =
        `Nomor antrean ${nomor}. Silakan menuju ${layanan}.`;

    const suara = new SpeechSynthesisUtterance(teks);

    suara.lang = "id-ID";
    suara.rate = 0.9;
    suara.pitch = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(suara);
}


// ================================
// RESET ANTREAN
// ================================

function resetAntrean() {

    antrean = {
        T: [],
        CS: []
    };

    nomorBerikutnya = {
        T: 1,
        CS: 1
    };

    antreanDipanggil = 0;

    document.getElementById("currentNumber").textContent = "T-000";
    document.getElementById("currentService").textContent =
        "Silakan menunggu panggilan";

    document.getElementById("ticketNumber").textContent = "-";

    updateTotalQueue();
}


// ================================
// INISIALISASI
// ================================

document.addEventListener("DOMContentLoaded", function () {

    updateClock();
    updateTotalQueue();

});