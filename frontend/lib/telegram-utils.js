'use strict';
const config = require('./config');

const esc = (s) =>
  String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Kirim pesan ke chat pribadi pemilik bot. Tidak pernah melempar error. */
async function notifyOwner(api, html) {
  if (!config.ownerId) {
    console.error('OWNER_ID belum diisi.');
    return false;
  }
  try {
    await api.sendMessage(config.ownerId, html, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
    return true;
  } catch (e) {
    // Paling sering: Anda belum menekan /start di chat pribadi dengan bot.
    console.error('[notifyOwner] gagal:', e.description || e.message);
    return false;
  }
}

module.exports = { esc, sleep, notifyOwner };
