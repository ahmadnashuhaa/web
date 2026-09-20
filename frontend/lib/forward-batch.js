'use strict';
/**
 * Mode "teruskan": Anda meneruskan (forward) satu atau BEBERAPA pesan produk ke chat pribadi bot.
 *   - teks deskripsi                       -> nama, harga, deskripsi produk
 *   - foto + keterangan pendek ("Dusty Pink") -> foto & varian/warna produk itu
 *
 * Telegram mengirim pesan satu per satu, jadi bot TIDAK menunggu. Setiap pesan yang tiba
 * langsung dimasukkan ke "sesi" lalu draft di chat ini DIPERBARUI (edit). Pesan yang datang
 * dalam 60 detik sejak pesan sebelumnya dianggap satu kiriman yang sama.
 */
const config = require('./config');
const store = require('./store');
const { analyze, groupForwarded, renderProductMessage } = require('./product-draft');
const { esc, editMessage } = require('./telegram-utils');

const TTL = 3600;
const SESSION_SECONDS = 60;
const MAX_DRAFTS = 8;
const isPhoto = (m) => Boolean(m.photo) || String((m.document && m.document.mime_type) || '').startsWith('image/');

const SEND_OPTS = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } };

function parseItems(raw) {
  const seen = new Set();
  const items = [];
  for (const r of raw || []) {
    try {
      const it = JSON.parse(r);
      if (!seen.has(it.m)) { seen.add(it.m); items.push(it); }
    } catch (_) { /* abaikan */ }
  }
  return items;
}

function renderGroups(items) {
  const groups = groupForwarded(items);
  const shown = groups.slice(0, MAX_DRAFTS);
  const texts = shown.map((g, i) => {
    const info = analyze({ rootText: g.rootText, commentTexts: g.notes, labels: g.photos.map((p) => p.label) });
    return renderProductMessage({ mode: 'forward', info, photos: g.photos, nameKnown: Boolean(g.rootText), index: i + 1, total: groups.length });
  });
  const sources = new Map();
  for (const it of items) if (it.s) sources.set(it.s.id, it.s.n);
  const sourceText = sources.size
    ? `ℹ️ Sumber pesan:\n${[...sources].map(([id, n]) => `• <b>${esc(n)}</b> → chat_id: <code>${id}</code>`).join('\n')}`
    : null;
  return { texts, sourceText, hidden: groups.length - shown.length };
}

/** Pastikan pesan ke-`slot` berisi `html`: edit kalau sudah ada, kirim baru kalau belum. */
async function syncSlot(ctx, ids, slot, html) {
  if (ids[slot] && (await editMessage(ctx.api, ctx.chat.id, ids[slot], html))) return;
  const sent = await ctx.api.sendMessage(ctx.chat.id, html, SEND_OPTS);
  ids[slot] = sent.message_id;
}

async function handleForward(ctx) {
  const msg = ctx.message;
  const fo = msg.forward_origin;
  const src = fo.chat || fo.sender_chat || null;
  const text = (msg.text || msg.caption || '').trim();
  const photo = isPhoto(msg);

  // Tidak ada isi produk (bukan teks, bukan foto): cukup beri tahu asal/ID-nya.
  if (!text && !photo) {
    if (src) {
      return ctx.reply(
        `📍 Pesan ini berasal dari: <b>${esc(src.title || src.username || 'chat')}</b>\nchat_id: <code>${src.id}</code>`,
        { parse_mode: 'HTML' }
      );
    }
    if (fo.sender_user) return ctx.reply(`User ID: ${fo.sender_user.id}`);
    return ctx.reply('Pengirim aslinya menyembunyikan identitas, chat_id tidak bisa dibaca.');
  }

  const item = {
    m: msg.message_id,
    t: photo ? 'photo' : 'text',
    x: text.slice(0, 3000),
    s: src ? { id: src.id, n: src.title || src.username || 'chat' } : null,
  };

  // Tanpa penyimpanan: tidak bisa menggabungkan -> 1 pesan = 1 draft.
  if (!store.enabled) {
    const r = renderGroups([item]);
    for (const t of r.texts) await ctx.api.sendMessage(ctx.chat.id, t, SEND_OPTS);
    if (r.sourceText) await ctx.api.sendMessage(ctx.chat.id, r.sourceText, SEND_OPTS);
    return;
  }

  const key = `fwd:${ctx.from.id}`;
  const metaKey = `fwdmeta:${ctx.from.id}`;

  // Sesi baru kalau pesan terakhir sudah lebih dari 60 detik yang lalu.
  let meta = null;
  try { meta = JSON.parse((await store.get(metaKey)) || 'null'); } catch (_) { meta = null; }
  const now = Date.now();
  if (!meta || now - meta.t > SESSION_SECONDS * 1000) {
    await store.del(key);
    meta = { ids: [], srcId: null };
  }

  await store.push(key, JSON.stringify(item), TTL);
  const items = parseItems(await store.list(key));
  const r = renderGroups(items.length ? items : [item]);

  const ids = meta.ids || [];
  for (let i = 0; i < r.texts.length; i++) await syncSlot(ctx, ids, i, r.texts[i]);

  let srcId = meta.srcId || null;
  if (r.sourceText) {
    const holder = { 0: srcId };
    await syncSlot(ctx, holder, 0, r.sourceText);
    srcId = holder[0];
  }
  if (r.hidden > 0) {
    await ctx.reply(`…dan ${r.hidden} produk lain tidak ditampilkan. Teruskan dalam jumlah lebih kecil.`);
  }

  await store.set(metaKey, JSON.stringify({ t: now, ids, srcId }), TTL);
}

module.exports = { handleForward };
