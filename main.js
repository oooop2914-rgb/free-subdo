/**
 * File: frontend/main.js
 * Deskripsi: Logika interaksi form frontend Subdomain Maker (Vanilla JS)
 */

// Ganti URL ini dengan URL Worker Cloudflare Anda setelah di-deploy
const WORKER_API_URL = "https://subdomain-api.usernamekamu.workers.dev/api/create-subdomain";

const subdomainForm = document.getElementById("subdomainForm");
const subdomainInput = document.getElementById("subdomainInput");
const typeSelect = document.getElementById("typeSelect");
const contentInput = document.getElementById("contentInput");
const contentHelp = document.getElementById("contentHelp");
const proxyWrapper = document.getElementById("proxyWrapper");
const proxiedInput = document.getElementById("proxiedInput");
const submitButton = document.getElementById("submitButton");
const alertBox = document.getElementById("alertBox");

// Daftar placeholder dan petunjuk berdasarkan tipe record DNS
const RECORD_PLACEHOLDERS = {
  A: {
    placeholder: "192.0.2.1",
    help: "Masukkan alamat IPv4 valid (4 oktet angka 0-255).",
    showProxy: true
  },
  AAAA: {
    placeholder: "2001:0db8:85a3::8a2e:0370:7334",
    help: "Masukkan alamat IPv6 valid (mengandung titik dua ':').",
    showProxy: true
  },
  CNAME: {
    placeholder: "target.domainlain.com",
    help: "Masukkan hostname target yang valid (wajib memiliki titik dan TLD).",
    showProxy: true
  },
  TXT: {
    placeholder: "v=spf1 include:_spf.google.com ~all",
    help: "Masukkan teks antara 1-255 karakter. Proxy otomatis dinonaktifkan untuk TXT.",
    showProxy: false
  }
};

/**
 * Mengubah placeholder content dan visibilitas checkbox proxy saat tipe berubah
 */
function handleTypeChange() {
  const selectedType = typeSelect.value;
  const config = RECORD_PLACEHOLDERS[selectedType];

  if (!config) return;

  contentInput.placeholder = config.placeholder;
  contentHelp.textContent = config.help;

  if (config.showProxy) {
    proxyWrapper.classList.remove("hidden");
  } else {
    proxyWrapper.classList.add("hidden");
    proxiedInput.checked = false;
  }
}

typeSelect.addEventListener("change", handleTypeChange);

/**
 * Menampilkan kotak notifikasi sukses atau gagal
 */
function renderAlert(type, htmlContent) {
  alertBox.className = "alert-box " + (type === "success" ? "alert-success" : "alert-error");
  alertBox.innerHTML = htmlContent;
}

/**
 * Mengatur tombol ke mode loading atau normal
 */
function setSubmittingState(isLoading) {
  submitButton.disabled = isLoading;
  if (isLoading) {
    submitButton.innerHTML =
      'MEMPROSES<span class="blink-dot-1">.</span><span class="blink-dot-2">.</span><span class="blink-dot-3">.</span>';
  } else {
    submitButton.textContent = "BUAT SUBDOMAIN SEKARANG";
  }
}

/**
 * Handler pengiriman form pembuatan subdomain
 */
subdomainForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  alertBox.className = "alert-box hidden";

  const subdomain = subdomainInput.value.trim().toLowerCase();
  const type = typeSelect.value;
  const content = contentInput.value.trim();
  const proxied = type === "TXT" ? false : proxiedInput.checked;

  // Ambil token dari input tersembunyi yang dibuat oleh Cloudflare Turnstile
  const turnstileInput = document.querySelector('[name="cf-turnstile-response"]');
  const turnstileToken = turnstileInput ? turnstileInput.value : "";

  if (!turnstileToken) {
    renderAlert("error", "PERINGATAN: SILAKAN SELESAIKAN VERIFIKASI TURNSTILE TERLEBIH DAHULU.");
    return;
  }

  setSubmittingState(true);

  try {
    const response = await fetch(WORKER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subdomain,
        type,
        content,
        proxied,
        turnstileToken
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Gagal membuat subdomain.");
    }

    // Tampilkan hasil sukses
    renderAlert(
      "success",
      `BERHASIL! SUBDOMAIN AKTIF:<br/>
      RECORD: ${data.result.type} | ${data.result.name} &rarr; ${data.result.content}<br/>
      SISA KUOTA HARI INI: ${data.remaining}`
    );

    // Reset form & widget Turnstile setelah submit
    subdomainForm.reset();
    handleTypeChange();
    if (window.turnstile && typeof window.turnstile.reset === "function") {
      window.turnstile.reset();
    }
  } catch (err) {
    renderAlert(
      "error",
      `GAGAL: ${err.message || "Tidak dapat terhubung ke server Worker."}`
    );

    if (window.turnstile && typeof window.turnstile.reset === "function") {
      window.turnstile.reset();
    }
  } finally {
    setSubmittingState(false);
  }
});