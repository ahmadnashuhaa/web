'use strict';
const { GrammyError, HttpError } = require('grammy');
const config = require('./config');
const { sleep } = require('./telegram-utils');

/** Ubah error teknis Telegram menjadi kalimat yang mudah dipahami. */
function explainError(e) {
  if (e instanceof GrammyError) {
    const d = e.description || '';
    if (/chat not found/i.test(d)) return 'chat tidak ditemukan (chat_id salah, atau bot belum ditambahkan ke sana)';
    if (/kicked|not a member|forbidden: bot was blocked|bot is not a member/i.test(d)) return 'bot dikeluarkan / bukan anggota chat itu';
    if (/not enough rights|have no rights|CHAT_WRITE_FORBIDDEN|need administrator/i.test(d)) return 'bot tidak punya izin mengirim pesan (jadikan admin dengan izin "Post Messages")';
    if (/too many requests/i.test(d)) return 'kena batas kecepatan Telegram, coba lagi sebentar lagi';
    return d || `error ${e.error_code}`;
  }
  if (e instanceof HttpError) return 'gagal terhubung ke Telegram (masalah jaringan)';
  return (e && e.message) || 'error tidak diketahui';
}

async function sendOne(api, chatId, text) {
  try {
    return await api.sendMessage(chatId, text);
  } catch (e) {
    // Kena batas kecepatan -> tunggu sebentar lalu coba sekali lagi.
    if (e instanceof GrammyError && e.error_code === 429) {
      const wait = Math.min(((e.parameters && e.parameters.retry_after) || 2) * 1000, 5000);
      await sleep(wait);
      return api.sendMessage(chatId, text);
    }
    throw e;
  }
}

async function broadcastText(api, text) {
  const ok = [];
  const failed = [];
  for (const id of config.broadcastChatIds) {
    try {
      const res = await sendOne(api, id, text);
      const c = res && res.chat;
      ok.push({ id, name: (c && (c.title || (c.username && '@' + c.username))) || String(id) });
    } catch (e) {
      failed.push({ id, reason: explainError(e) });
    }
    await sleep(60); // jeda kecil agar tidak melanggar batas Telegram
  }
  return { ok, failed, total: config.broadcastChatIds.length };
}

function buildReport({ ok, failed, total }) {
  const L = [`📣 Hasil broadcast: berhasil ke ${ok.length} dari ${total} tujuan, gagal ke ${failed.length}.`];
  if (ok.length) {
    L.push('', '✅ Berhasil:');
    ok.forEach((o) => L.push(`• ${o.name} (${o.id})`));
  }
  if (failed.length) {
    L.push('', '❌ Gagal:');
    failed.forEach((f) => L.push(`• ${f.id} → ${f.reason}`));
  }
  return L.join('\n');
}

module.exports = { broadcastText, buildReport };
