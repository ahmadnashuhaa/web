'use strict';
/**
 * Mode "teruskan": Anda meneruskan (forward) satu atau BEBERAPA pesan produk ke chat pribadi bot.
 * Bot menunggu sebentar sampai semua pesan tiba, lalu menyusun draft yang benar:
 *   - teks deskripsi        -> nama, harga, deskripsi produk
 *   - foto + keterangan pendek (mis. "Dusty Pink") -> foto & varian/warna produk itu
 * Tanpa Upstash, bot tidak bisa menunggu/menggabungkan (1 pesan = 1 draft).
 */
const config = require('./config');
const store = require('./store');
const { analyze, groupForwarded, renderProductMessage } = require('./product-draft');
const { esc, sleep } = require('./telegram-utils');

const TTL = 3600;
const MAX_DRAFTS = 8;
const isPhoto = (m) => Boolean(m.photo) || String((m.document && m.document.mime_type) || '').startsWith('image/');

async function collectBatch(ctx, item) {
  if (!store.enabled) return [item];

  const key = `fwd:${ctx.from.id}`;
  await store.push(key, JSON.stringify(item), TTL);
  await sleep(config.debounceMs);

  const raw = await store.list(key);
  if (!raw) return [item];

  const pushed = [];
  for (const r of raw) {
    try { pushed.push(JSON.parse(r)); } catch (_) { /* abaikan */ }
  }
  // Hanya pesan yang tiba PALING AKHIR yang menyusun hasil; yang lain berhenti.
  if (!pushed.length || pushed[pushed.length - 1].m !== item.m) return null;
  await store.del(key);

  const seen = new Set();
  return pushed.filter((it) => (seen.has(it.m) ? false : seen.add(it.m)));
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

  const items = await collectBatch(ctx, item);
  if (!items || !items.length) return;

  const groups = groupForwarded(items);
  const shown = groups.slice(0, MAX_DRAFTS);
  for (let i = 0; i < shown.length; i++) {
    const g = shown[i];
    const info = analyze({ rootText: g.rootText, commentTexts: g.notes, labels: g.photos.map((p) => p.label) });
    await ctx.reply(
      renderProductMessage({ mode: 'forward', info, photos: g.photos, nameKnown: Boolean(g.rootText), index: i + 1, total: groups.length }),
      { parse_mode: 'HTML', link_preview_options: { is_disabled: true } }
    );
  }
  if (groups.length > shown.length) {
    await ctx.reply(`…dan ${groups.length - shown.length} produk lain tidak ditampilkan. Teruskan dalam jumlah lebih kecil.`);
  }

  // Bonus: sebutkan chat_id sumber (berguna untuk SOURCE_CHAT_IDS).
  const sources = new Map();
  for (const it of items) if (it.s) sources.set(it.s.id, it.s.n);
  if (sources.size) {
    const lines = [...sources].map(([id, n]) => `• <b>${esc(n)}</b> — chat_id: <code>${id}</code>`);
    await ctx.reply(`ℹ️ Sumber pesan:\n${lines.join('\n')}`, { parse_mode: 'HTML' });
  }
}

module.exports = { handleForward };
