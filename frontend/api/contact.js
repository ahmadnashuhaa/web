/**
 * api/contact.js
 *
 * Vercel Serverless Function — menangani POST dari form.js (fetch('/api/contact')).
 * Tidak butuh setup tambahan apa pun: begitu file ini ada di folder /api,
 * Vercel otomatis mengaktifkannya sebagai endpoint saat deploy.
 *
 * Yang dilakukan endpoint ini:
 * 1. Validasi data yang masuk (need wajib diisi).
 * 2. Catat submission ke Vercel Function Logs (Dashboard -> Deployments ->
 *    klik deployment -> tab "Logs") supaya setiap calon klien yang mengisi
 *    form tetap tercatat, walau mereka batal lanjut ke WhatsApp.
 * 3. Balas sukses ke frontend.
 *
 * CATATAN UNTUK PENGEMBANGAN LEBIH LANJUT (opsional, tidak wajib):
 * Saat ini submission HANYA muncul di Log Vercel (perlu dicek manual di
 * dashboard). Kalau nanti mau notifikasi otomatis (misal email atau
 * pesan Telegram tiap ada yang isi form), itu perlu layanan pihak
 * ketiga (contoh: Resend untuk email, atau Telegram Bot API) yang
 * butuh API key dari Anda sendiri -- saya bisa bantu pasang begitu
 * Anda punya akun & API key-nya.
 */

export default async function handler(req, res) {
  // Hanya terima method POST, tolak yang lain
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { need, budget, description } = req.body || {};

    // Validasi dasar: "need" wajib (sama seperti validasi di form.js)
    if (!need || typeof need !== 'string' || !need.trim()) {
      return res.status(400).json({ ok: false, error: 'Field "need" wajib diisi.' });
    }

    const submission = {
      need: need.trim(),
      budget: (budget || '').trim() || '(tidak diisi)',
      description: (description || '').trim() || '(tidak diisi)',
      receivedAt: new Date().toISOString(),
    };

    // Catat ke Vercel Function Logs -- cek di Dashboard > Deployments >
    // pilih deployment aktif > tab Logs, filter "/api/contact".
    console.log('[Contact Form Submission]', JSON.stringify(submission));

    return res.status(200).json({ ok: true, message: 'Submission received.' });
  } catch (err) {
    console.error('[Contact Form Error]', err);
    return res.status(500).json({ ok: false, error: 'Internal server error.' });
  }
}
