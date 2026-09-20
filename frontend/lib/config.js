'use strict';
/**
 * SEMUA pengaturan dibaca dari Environment Variables Vercel.
 * Tidak ada data rahasia yang boleh ditulis langsung di file ini.
 */
module.exports = {
  botToken: (process.env.BOT_TOKEN || '').trim(),
  // OPSIONAL: ID Telegram Anda sebagai admin (untuk /status dan bebas pembatas). Kosongkan kalau tidak perlu.
  ownerId: (process.env.OWNER_ID || '').trim(),
  webhookSecret: (process.env.WEBHOOK_SECRET || '').trim(),
  // Kunci Gemini API (GRATIS dari Google AI Studio) - dipakai /doc /study /code /file(teks) /product analyze /market
  aiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  // Nama model. Cek daftar model terbaru di Google AI Studio kalau default ini tidak ditemukan.
  aiModel: (process.env.AI_MODEL || 'gemini-flash-lite-latest').trim(),

  // ---- Pembatas pemakaian (penting untuk bot publik supaya kuota gratis tidak habis) ----
  // Maksimal pesan per pengguna per menit
  msgPerMinute: Number(process.env.MSG_PER_MINUTE) || 20,
  // Maksimal panggilan AI per pengguna per hari
  aiPerUserPerDay: Number(process.env.AI_PER_USER_PER_DAY) || 15,
  // Maksimal panggilan AI dari SEMUA pengguna per hari (samakan dengan kuota Gemini Anda, sisakan cadangan)
  aiGlobalPerDay: Number(process.env.AI_GLOBAL_PER_DAY) || 400,
};
