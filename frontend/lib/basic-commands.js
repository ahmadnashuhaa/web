'use strict';
/**
 * Perintah dasar untuk SEMUA pengguna (chat pribadi): /start dan /id.
 * /status hanya untuk admin (OWNER_ID, opsional).
 */
const config = require('./config');
const store = require('./store');
const { esc } = require('./telegram-utils');
const { handleForward } = require('./forward-batch');
const { isAdmin } = require('./limits');

const HELP = [
  'Halo! 👋 Selamat datang di <b>Dukion Bot</b>.',
  '',
  'Yang bisa saya bantu:',
  '📦 /product → rapikan data produk (analisis, validasi, impor/ekspor)',
  '📁 /file → gabung, pecah, dan convert file (PDF, Word, Excel, PowerPoint); ambil teks dari dokumen',
  '📝 /doc /study /code → bantuan AI untuk dokumen, belajar, dan kode',
  '📽️ /doc slides → buat presentasi PowerPoint (.pptx) dari topik atau dokumen',
  '📈 /market → ringkasan pasar',
  '📥 Teruskan (forward) post produk ke sini → saya buatkan draft kodenya',
  '🆔 /id → lihat ID Telegram Anda',
  '📋 /menu atau /help → daftar lengkap perintah',
  '',
  '<b>Privasi:</b>',
  '• File dan riwayat hanya disimpan sementara (file dan bahan terakhir sekitar 1 jam, riwayat 24 jam). Ketik /cancel untuk menghapusnya sekarang.',
  '• Fitur AI memakai layanan Google Gemini versi gratis. Teks atau file yang Anda kirim untuk fitur AI dikirim ke Google dan, di versi gratis, bisa dipakai Google untuk meningkatkan produknya. Jangan kirim data rahasia atau pribadi.',
  `• Jatah AI: ${config.aiPerUserPerDay} kali per hari per pengguna.`,
].join('\n');

function registerBasicCommands(bot) {
  bot.command('start', async (ctx) => ctx.reply(HELP, { parse_mode: 'HTML' }));

  bot.command('id', async (ctx) =>
    ctx.reply(`🆔 User ID Anda: <code>${ctx.from.id}</code>\nchat_id: <code>${ctx.chat.id}</code>`, { parse_mode: 'HTML' })
  );

  bot.command('status', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    return ctx.reply(
      [
        '⚙️ <b>Status bot (admin)</b>',
        `Penyimpanan (Upstash): ${store.enabled ? '✅ aktif' : '⚠️ belum dipasang (pembatas pemakaian memakai memori sementara, kurang akurat)'}`,
        `AI (Gemini): ${config.aiApiKey ? `✅ aktif (<code>${esc(config.aiModel)}</code>)` : '⚠️ GEMINI_API_KEY belum diisi'}`,
        '',
        '<b>Pembatas pemakaian:</b>',
        `• Pesan per menit per pengguna: ${config.msgPerMinute}`,
        `• Jatah AI per pengguna per hari: ${config.aiPerUserPerDay}`,
        `• Jatah AI semua pengguna per hari: ${config.aiGlobalPerDay}`,
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  });

  // Pesan yang diteruskan (forward) dari siapa pun -> dibuat draft produk (data dipisah per pengguna).
  bot.on('message', async (ctx, next) => {
    if (ctx.message.forward_origin) return handleForward(ctx);
    return next();
  });
}

module.exports = { registerBasicCommands };
