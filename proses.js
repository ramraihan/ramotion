// api/proses.js

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // TAUTKAN URL GOOGLE APPS SCRIPT KAMU DI SINI
    // Ganti teks di bawah ini dengan URL yang berakhiran /exec dari Google Sheets tadi!
    const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbz3nhDIyeRsB-9VVPjp6MR7r95BzHCY5GBGwfR474ogHe9QsE6qOBtVpHGz-vtv0-Ng/exec";

    const { action, email, qty } = req.query;

    // ==========================================================================
    // 1. BAGIAN GET: MEMBUAT INVOICE & MENAMPILKAN BIAYA ADMIN DARI PAKASIR
    // ==========================================================================
    if (req.method === 'GET' && action === 'get_invoice') {
        if (!email) {
            return res.status(400).json({ status: "error", message: "Email dibutuhkan" });
        }

        const jumlahBeli = parseInt(qty) || 1;
        const hargaProduk = jumlahBeli * 500;

        try {
            // Simulasi respon admin dari sistem Pakasir (Contoh: Rp 100)
            const biayaAdminPakasir = 100; 
            const totalBayarFinal = hargaProduk + biayaAdminPakasir;
            
            // Link QRIS dari Pakasir
            const qrisImageUrlFromPakasir = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PAKASIR_OFFICIAL_QRIS_TOTAL_${totalBayarFinal}`;

            return res.status(200).json({
                status: "success",
                harga_produk: hargaProduk,
                biaya_admin: biayaAdminPakasir,
                total_bayar: totalBayarFinal,
                qris_image_url: qrisImageUrlFromPakasir
            });

        } catch (error) {
            return res.status(500).json({ status: "error", message: "Gagal memproses data invoice" });
        }
    }

    // ==========================================================================
    // 2. BAGIAN GET: CEK STATUS PEMBAYARAN DAN AMBIL + KIRIM STOK AKUN
    // ==========================================================================
    if (req.method === 'GET' && action === 'cek_status') {
        try {
            // NOTE: Di bawah ini adalah logika ketika status di Pakasir SUDAH BERHASIL/SUCCESS.
            // Saat sukses, kita langsung perintahkan Google Sheet untuk memproses pesanan dan memotong stok akun.

            // 1. Ambil stok akun dan ubah status menjadi TERJUAL di Google Sheet
            const responStok = await fetch(URL_GOOGLE_SCRIPT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "ambil_stok",
                    email_pembeli: email,
                    jumlah_beli: 1 // Sesuai kuantitas beli
                })
            });
            const dataStok = await responStok.json();

            if (dataStok.status === "empty") {
                return res.status(200).json({ status: "pending", message: "Stok akun sedang kosong!" });
            }

            if (dataStok.status === "success") {
                const akunTerkirim = dataStok.akun; // Berisi array data akun pembeli (misal: ['ampro@gmail.com|pass123'])

                // 2. Simpan riwayat transaksi tersebut ke halaman Sheet "Data_Pesanan"
                await fetch(URL_GOOGLE_SCRIPT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "simpan_pesanan",
                        email_pembeli: email,
                        produk: "Alight Motion Private",
                        jumlah_beli: 1,
                        harga_produk: 500,
                        biaya_admin: 100,
                        total_bayar: 600
                    })
                });

                // 3. Informasikan ke halaman web qris.html kalau transaksi sukses
                return res.status(200).json({
                    status: "success",
                    message: "Pembayaran sukses dan stok berhasil diperbarui!",
                    akun: akunTerkirim
                });
            }

            return res.status(200).json({ status: "pending", message: "Menunggu pembayaran..." });

        } catch (error) {
            return res.status(500).json({ status: "error", message: "Gagal integrasi dengan Google Sheets" });
        }
    }

    // ==========================================================================
    // 3. BAGIAN POST: MENANGKAP LOG DATA AWAL DARI INDEX.HTML
    // ==========================================================================
    if (req.method === 'POST') {
        try {
            const { email_pembeli, jumlah_beli, produk } = req.body;
            console.log(`[LOG UTAMA]: ${email_pembeli} sedang melihat halaman QRIS.`);
            return res.status(200).json({ status: "success" });
        } catch (error) {
            return res.status(500).json({ status: "error", message: "Gagal memproses data POST" });
        }
    }

    return res.status(404).json({ status: "error", message: "Rute tidak ditemukan" });
}
