'use strict';
/**
 * FITUR 1 — memantau grup/channel sumber produk, lalu mengirim DRAFT ke chat pribadi pemilik.
 * TIDAK ada satu pun proses ke website. Hanya notifikasi.
 */
const config = require('./config');
const store = require('./store');
const { analyze, splitComments, renderProductMessage } = require('./product-draft');
const { notifyOwner, sleep } = require('./telegram-utils');

const TTL = 30 * 24 * 3600; // simpan data thread 30 hari
const isSource = (id) => config.sourceChatIds.includes(String(id));
const isPhoto = (m) => Boolean(m.photo) || String((m.document && m.document.mime_type) || '').startsWith('image/');

function threadLink(chatId, firstMsgId, rootId) {
  const s = String(chatId);
  if (!s.startsWith('-100') || !firstMsgId) return null;
  return `https://t.me/c/${s.slice(4)}/${firstMsgId}?thread=${rootId}`;
}

/** Notifikasi "produk baru" dari teks/caption post. */
async function announceNewPost(api, text, postHasPhoto) {
  const info = analyze({ rootText: text });
  await notifyOwner(api, renderProductMessage({ mode: 'new', info, postHasPhoto }));
}

/** Kirim ringkasan update (foto + teks komentar) untuk satu produk. */
async function sendUpdate(api, { chatId, rootId, rootText, items, freshItems }) {
  const sorted = [...items].sort((a, b) => a.m - b.m);
  const { photos, texts } = splitComments(sorted);
  const info = analyze({ rootText, commentTexts: texts, labels: photos.map((p) => p.label) });
  const html = renderProductMessage({
    mode: 'update',
    info,
    nameKnown: Boolean(rootText),
    photos,
    freshPhotoCount: freshItems.filter((i) => i.t === 'photo').length,
    commentTexts: texts,
    link: threadLink(chatId, (photos[0] ? photos[0].m : sorted[0].m), rootId),
  });
  await notifyOwner(api, html);
}

/** Tentukan apakah pesan ini komentar pada post produk. */
async function resolveRoot(msg) {
  const rt = msg.reply_to_message;
  if (rt && rt.is_automatic_forward) {
    return { rootId: rt.message_id, rootText: rt.text || rt.caption || null };
  }
  const thread = msg.message_thread_id;
  if (thread && store.enabled) {
    const raw = await store.get(`root:${msg.chat.id}:${thread}`);
    if (raw) {
      try {
        return { rootId: thread, rootText: JSON.parse(raw).text || null };
      } catch (_) { /* abaikan */ }
    }
  }
  return null;
}

async function handleComment(ctx) {
  const msg = ctx.message;
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || '';
  const photo = isPhoto(msg);
  if (!photo && !text) return;
  if (!photo && text.startsWith('/')) return;

  const root = await resolveRoot(msg);
  if (!root) return; // obrolan biasa, bukan komentar produk
  const { rootId, rootText } = root;

  const item = { m: msg.message_id, t: photo ? 'photo' : 'text', x: text.trim().slice(0, 500) };

  // Mode sederhana (tanpa penyimpanan): 1 notifikasi per komentar.
  if (!store.enabled) {
    return sendUpdate(ctx.api, { chatId, rootId, rootText, items: [item], freshItems: [item] });
  }

  // Mode lengkap: kumpulkan dulu, tunggu sebentar, hanya komentar TERAKHIR yang mengirim ringkasan.
  const key = `thr:${chatId}:${rootId}`;
  await store.push(key, JSON.stringify(item), TTL);
  await sleep(config.debounceMs);

  const raw = await store.list(key);
  if (!raw) return sendUpdate(ctx.api, { chatId, rootId, rootText, items: [item], freshItems: [item] });

  const seen = new Set();
  const items = [];
  for (const r of raw) {
    try {
      const it = JSON.parse(r);
      if (!seen.has(it.m)) { seen.add(it.m); items.push(it); }
    } catch (_) { /* abaikan */ }
  }
  if (!items.length || items[items.length - 1].m !== item.m) return; // ada yang lebih baru, biar dia yang kirim

  const repKey = `rep:${chatId}:${rootId}`;
  const reported = Number(await store.get(repKey)) || 0;
  const freshItems = items.slice(reported);
  if (!freshItems.length) return;
  await store.set(repKey, items.length, TTL);

  await sendUpdate(ctx.api, { chatId, rootId, rootText, items, freshItems });
}

async function handleGroupMessage(ctx) {
  const msg = ctx.message;
  if (!isSource(msg.chat.id)) return;

  // Post channel yang otomatis diteruskan ke grup diskusi = "post produk baru".
  if (msg.is_automatic_forward) {
    const text = msg.text || msg.caption || '';
    if (store.enabled) await store.set(`root:${msg.chat.id}:${msg.message_id}`, JSON.stringify({ text }), TTL);
    const originChat = (msg.forward_origin && msg.forward_origin.chat && msg.forward_origin.chat.id) || (msg.forward_from_chat && msg.forward_from_chat.id);
    // Kalau channel asalnya juga dipantau langsung, notifikasinya sudah dikirim lewat channel_post (hindari dobel).
    if (text && !(originChat && isSource(originChat))) {
      await announceNewPost(ctx.api, text, isPhoto(msg));
    }
    return;
  }
  return handleComment(ctx);
}

async function handleChannelPost(ctx) {
  const msg = ctx.channelPost;
  if (!isSource(msg.chat.id)) return;
  const text = msg.text || msg.caption || '';
  if (!text) return; // foto tanpa keterangan / bagian album -> abaikan
  if (store.enabled) {
    const first = await store.setNX(`np:${msg.chat.id}:${msg.message_id}`, '1', 7 * 24 * 3600);
    if (first === null) return; // sudah pernah diproses
  }
  await announceNewPost(ctx.api, text, isPhoto(msg));
}

function registerCatalogWatcher(bot) {
  bot.on('channel_post', handleChannelPost);
  bot.on('message', handleGroupMessage);
}

module.exports = { registerCatalogWatcher };
