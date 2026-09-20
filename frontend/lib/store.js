'use strict';
/**
 * Penyimpanan kecil (Upstash Redis lewat REST) untuk:
 *  - menggabungkan beberapa foto komentar jadi 1 notifikasi,
 *  - mengingat nama produk dari tiap thread komentar.
 * Kalau env-nya tidak ada, store.enabled = false dan bot tetap jalan (mode sederhana).
 */
const URL_BASE = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const enabled = Boolean(URL_BASE && TOKEN);

async function cmd(args) {
  const res = await fetch(URL_BASE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

// Error -> undefined (jangan sampai bot mati hanya karena penyimpanan bermasalah).
async function safe(args) {
  try {
    return await cmd(args);
  } catch (e) {
    console.error('[store]', e.message);
    return undefined;
  }
}

module.exports = {
  enabled,
  get: (k) => safe(['GET', k]),
  set: (k, v, ttl) => safe(['SET', k, String(v), 'EX', String(ttl)]),
  // Hasil: 'OK' (berhasil, kunci baru) | null (kunci sudah ada) | undefined (error)
  setNX: (k, v, ttl) => safe(['SET', k, String(v), 'EX', String(ttl), 'NX']),
  async push(k, v, ttl) {
    const n = await safe(['RPUSH', k, String(v)]);
    await safe(['EXPIRE', k, String(ttl)]);
    return n;
  },
  list: (k) => safe(['LRANGE', k, '0', '-1']),
  // Menambah penghitung +1 (untuk pembatas pemakaian). Kunci kedaluwarsa otomatis setelah `ttl` detik.
  async incr(k, ttl) {
    const n = await safe(['INCR', k]);
    if (n === 1) await safe(['EXPIRE', k, String(ttl)]);
    return n;
  },
  del: (k) => safe(['DEL', k]),
};
