'use strict';
const esc = (s) =>
  String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const OPTS = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } };

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

module.exports = { esc, sleep, editMessage };
