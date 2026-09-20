'use strict';
const config = require('./config');

const esc = (s) =>
  String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const OPTS = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } };

/** Kirim pesan ke chat pribadi pemilik. Mengembalikan message_id, atau null kalau gagal. */
async function sendToOwner(api, html) {
  if (!config.ownerId) {
    console.error('OWNER_ID belum diisi.');
    return null;
  }
  try {
    const res = await api.sendMessage(config.ownerId, html, OPTS);
    return res && res.message_id ? res.message_id : null;
  } catch (e) {
    // Paling sering: Anda belum menekan /start di chat pribadi dengan bot.
    console.error('[sendToOwner] gagal:', e.description || e.message);
    return null;
  }
}

/** Ubah isi pesan yang sudah terkirim. true = berhasil (atau isinya memang sama). */
async function editMessage(api, chatId, messageId, html) {
  try {
    await api.editMessageText(chatId, messageId, html, OPTS);
    return true;
  } catch (e) {
    if (/not modified/i.test(e.description || '')) return true;
    console.error('[editMessage] gagal:', e.description || e.message);
    return false;
  }
}

async function notifyOwner(api, html) {
  return (await sendToOwner(api, html)) !== null;
}

module.exports = { esc, sleep, notifyOwner, sendToOwner, editMessage };
