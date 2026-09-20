'use strict';
/**
 * SEMUA pengaturan dibaca dari Environment Variables Vercel.
 * Tidak ada data rahasia yang boleh ditulis langsung di file ini.
 */
function parseList(value) {
  return String(value || '')
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  botToken: (process.env.BOT_TOKEN || '').trim(),
  ownerId: (process.env.OWNER_ID || '').trim(),
  webhookSecret: (process.env.WEBHOOK_SECRET || '').trim(),
  // chat_id grup/channel yang DIPANTAU untuk produk baru
  sourceChatIds: parseList(process.env.SOURCE_CHAT_IDS),
  // chat_id channel/grup TUJUAN /broadcast
  broadcastChatIds: parseList(process.env.BROADCAST_CHAT_IDS),
  // Jeda tunggu (ms) untuk menggabungkan foto album jadi 1 notifikasi
  debounceMs: Number(process.env.DEBOUNCE_MS) || 5000,
  // Kunci Gemini API (GRATIS dari Google AI Studio) - dipakai /doc /study /code /file(teks) /product analyze/validate
  aiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  // Nama model. Cek daftar model terbaru di Google AI Studio kalau default ini tidak ditemukan.
  aiModel: (process.env.AI_MODEL || 'gemini-flash-lite-latest').trim(),
};
