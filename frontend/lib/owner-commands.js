'use strict';
/**
 * Perintah yang hanya boleh dijalankan PEMILIK (OWNER_ID), di chat pribadi dengan bot.
 * FITUR 2 = /broadcast
 */
const config = require('./config');
const store = require('./store');
const { esc } = require('./telegram-utils');
const { handleForward } = require('./forward-batch');
const { broadcastText, buildReport } = require('./broadcast');

const isOwner = (ctx) => Boolean(config.ownerId) && ctx.from && String(ctx.from.id) === config.ownerId;

const HELP = [
  'Halo! 👋 Bot Dukion Shop aktif.',
  '',
  'Perintah dasar (khusus pemilik):',
  '/broadcast &lt;pesan&gt; — kirim pesan teks ke semua channel/grup tujuan',
  '/id — lihat chat_id (ketik di grup, atau teruskan pesan channel ke sini)',
  '📥 Teruskan (forward) sebuah post produk ke chat ini → bot membuatkan draft kodenya',
  '/status — cek pengaturan bot',
  '/help — lihat daftar lengkap perintah (product/file/doc/study/code/market)',
  '',
  'Notifikasi produk baru dikirim otomatis ke chat ini.',
].join('\n');

function registerOwnerCommands(bot) {
  bot.command('start', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (!isOwner(ctx)) return ctx.reply('Maaf, bot ini bersifat pribadi.');
    return ctx.reply(HELP, { parse_mode: 'HTML' });
  });

  bot.command('id', async (ctx) => {
    if (!isOwner(ctx)) return;
    const chat = ctx.chat;
    const title = chat.title || 'chat pribadi';
    const text =
      `📍 <b>${esc(title)}</b>\nJenis: ${esc(chat.type)}\nchat_id: <code>${chat.id}</code>` +
      (chat.type === 'private' ? `\nUser ID Anda: <code>${ctx.from.id}</code>` : '');
    if (chat.type === 'private') return ctx.reply(text, { parse_mode: 'HTML' });
    // Di grup: kirim jawabannya lewat chat pribadi supaya grup tidak ramai.
    try {
      await ctx.api.sendMessage(config.ownerId, text, { parse_mode: 'HTML' });
    } catch (e) {
      console.error('[/id] gagal DM owner:', e.description || e.message);
    }
  });

  bot.command('status', async (ctx) => {
    if (ctx.chat.type !== 'private' || !isOwner(ctx)) return;
    const fmt = (arr) => (arr.length ? arr.map((x) => `• <code>${esc(x)}</code>`).join('\n') : '(kosong)');
    return ctx.reply(
      [
        '⚙️ <b>Status bot</b>',
        `Penyimpanan (Upstash): ${store.enabled ? '✅ aktif (foto album digabung jadi 1 notifikasi)' : '⚠️ belum dipasang (mode sederhana: 1 notifikasi per komentar)'}`,
        '',
        '<b>Grup/channel yang dipantau (SOURCE_CHAT_IDS):</b>',
        fmt(config.sourceChatIds),
        '',
        '<b>Tujuan broadcast (BROADCAST_CHAT_IDS):</b>',
        fmt(config.broadcastChatIds),
        '',
        'Ketik /settings untuk status fitur AI (product/file/doc/study/code).',
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  });

  bot.command('broadcast', async (ctx) => {
    if (ctx.chat.type !== 'private') return;
    if (!isOwner(ctx)) return ctx.reply('Maaf, perintah ini hanya untuk pemilik bot.');

    const text = (ctx.message.text || '').replace(/^\/broadcast(?:@\w+)?\s*/i, '').trim();
    if (!text) return ctx.reply('Cara pakai:\n/broadcast Isi pesan Anda di sini\n(boleh beberapa baris)');
    if (text.length > 4096) return ctx.reply('Pesan terlalu panjang (maksimal 4096 karakter).');
    if (!config.broadcastChatIds.length) {
      return ctx.reply('Daftar tujuan masih kosong. Isi BROADCAST_CHAT_IDS di Environment Variables Vercel dulu.');
    }

    await ctx.reply(`⏳ Mengirim ke ${config.broadcastChatIds.length} tujuan...`);
    const result = await broadcastText(ctx.api, text);
    return ctx.reply(buildReport(result));
  });

  // Owner meneruskan (forward) pesan ke bot -> ditangani forward-batch.js
  // (beberapa pesan yang diteruskan sekaligus digabung jadi produk yang benar).
  bot.on('message', async (ctx, next) => {
    if (ctx.chat.type === 'private' && isOwner(ctx) && ctx.message.forward_origin) {
      return handleForward(ctx);
    }
    return next();
  });
}

module.exports = { registerOwnerCommands };