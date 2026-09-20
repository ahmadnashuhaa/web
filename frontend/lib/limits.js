'use strict';
/**
 * Pembatas pemakaian untuk bot publik:
 *  1) batas pesan per menit per pengguna (anti-spam),
 *  2) batas panggilan AI per pengguna per hari, dan batas total semua pengguna per hari
 *     (supaya kuota gratis Gemini tidak habis oleh satu orang).
 * Memakai Upstash bila tersedia (akurat antar-instance); kalau tidak, memakai memori (kasar tapi tetap jalan).
 */
const { AsyncLocalStorage } = require('async_hooks');
const config = require('./config');
const store = require('./store');

const als = new AsyncLocalStorage();
const mem = new Map();

const isAdmin = (uid) => Boolean(config.ownerId) && String(uid) === config.ownerId;

/** Tambah hitungan `key`, kembalikan angka hitungan saat ini. */
async function count(key, ttlSeconds) {
  if (store.enabled) {
    const n = await store.incr(key, ttlSeconds);
    if (typeof n === 'number') return n;
    return 0; // penyimpanan error -> jangan blokir pengguna
  }
  const now = Date.now();
  if (mem.size > 5000) for (const [k, v] of mem) if (v.exp < now) mem.delete(k);
  const e = mem.get(key);
  if (!e || e.exp < now) {
    mem.set(key, { n: 1, exp: now + ttlSeconds * 1000 });
    return 1;
  }
  e.n += 1;
  return e.n;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Middleware: hanya chat pribadi, batasi kecepatan, dan catat siapa pengguna saat ini untuk hitungan AI. */
function limiter() {
  return async (ctx, next) => {
    // Bot ini hanya melayani chat pribadi. Grup, channel, dan lainnya diabaikan.
    if (!ctx.chat || ctx.chat.type !== 'private' || !ctx.from) return;
    const uid = String(ctx.from.id);

    if (!isAdmin(uid)) {
      const minute = Math.floor(Date.now() / 60000);
      const n = await count(`rl:${uid}:${minute}`, 90);
      if (n > config.msgPerMinute) {
        if (n === config.msgPerMinute + 1) {
          try { await ctx.reply('⏳ Terlalu banyak pesan dalam satu menit. Tunggu sebentar lalu coba lagi.'); } catch (_) { /* abaikan */ }
        }
        return;
      }
    }
    return als.run({ uid, admin: isAdmin(uid) }, next);
  };
}

function friendly(message) {
  const err = new Error(message);
  err.friendly = true;
  return err;
}

/** Dipanggil sebelum setiap panggilan AI. Melempar error ramah bila jatah habis. */
async function consumeAi() {
  const ctx = als.getStore();
  if (!ctx || ctx.admin) return;
  const d = today();
  const mine = await count(`aiq:${ctx.uid}:${d}`, 90000);
  if (mine > config.aiPerUserPerDay) {
    throw friendly(`Jatah AI harian Anda (${config.aiPerUserPerDay} kali) sudah habis. Coba lagi besok. Fitur non-AI (convert, merge, split, dll.) tetap bisa dipakai.`);
  }
  const all = await count(`aiq:global:${d}`, 90000);
  if (all > config.aiGlobalPerDay) {
    throw friendly('Kuota AI gratis untuk hari ini sudah habis untuk semua pengguna. Coba lagi besok.');
  }
}

module.exports = { limiter, consumeAi, isAdmin };
