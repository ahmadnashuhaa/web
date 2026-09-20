'use strict';
/**
 * Pintu masuk (endpoint) yang dipanggil Telegram setiap ada pesan baru.
 * Alamatnya nanti: https://DOMAIN-ANDA.vercel.app/api/telegram-webhook
 */
const config = require('../lib/config');
const { bot } = require('../lib/bot');

let initPromise = null;
function ensureInit() {
  // bot.init() = bot "berkenalan" dengan Telegram (cukup sekali per instance)
  if (!initPromise) {
    initPromise = bot.init().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

module.exports = async (req, res) => {
  // Dibuka lewat browser (GET) -> tampilkan status saja.
  if (req.method !== 'POST') {
    return res
      .status(200)
      .send('Bot Telegram aktif. Alamat ini hanya menerima kiriman dari Telegram.');
  }

  // Keamanan: pastikan kiriman benar-benar dari Telegram (bukan orang iseng).
  if (!config.webhookSecret) {
    console.error('WEBHOOK_SECRET belum diisi di Environment Variables.');
    return res.status(500).send('Server belum dikonfigurasi (WEBHOOK_SECRET kosong).');
  }
  if (req.headers['x-telegram-bot-api-secret-token'] !== config.webhookSecret) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await ensureInit();
    await bot.handleUpdate(update);
  } catch (err) {
    // Tetap balas 200 supaya Telegram tidak mengirim ulang pesan yang sama berkali-kali.
    console.error('[webhook] error:', err && (err.stack || err.message || err));
  }
  return res.status(200).send('ok');
};
