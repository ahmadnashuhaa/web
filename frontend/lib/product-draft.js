'use strict';
/**
 * Membaca teks post/komentar lalu membuat DRAFT produk format RAW_PRODUCTS.
 * Prinsip: hanya mengisi yang EKSPLISIT ada di teks. Sisanya placeholder "ISI_MANUAL_...".
 */
const { esc } = require('./telegram-utils');

const PH = {
  price: 'ISI_MANUAL_HARGA_DI_SINI',
  category: 'ISI_MANUAL_KATEGORI',
  desc: 'ISI_MANUAL_DESKRIPSI',
  name: 'ISI_MANUAL_NAMA_PRODUK',
  file: 'ISI_MANUAL_NAMA_FILE_FOTO.jpg',
  variant: 'ISI_MANUAL_WARNA',
};

/* ---------- Harga ---------- */
const MULT = { rb: 1e3, ribu: 1e3, k: 1e3, jt: 1e6, juta: 1e6 };
const PRICE_PATTERNS = [
  /rp\.?\s*(\d[\d.,]*)\s*(rb|ribu|k|jt|juta)?(?![a-z])/gi,
  /(?:harga|hrg|modal|price)\s*[:=-]?\s*(?:rp\.?\s*)?(\d[\d.,]*)\s*(rb|ribu|k|jt|juta)?(?![a-z])/gi,
  /(?<![\w.,])(\d[\d.,]*)\s*(rb|ribu|k|jt|juta)(?![a-z])/gi,
];

function toNumber(raw, suffix) {
  const s = String(raw).replace(/[.,]+$/, '');
  if (suffix) {
    const mult = MULT[suffix.toLowerCase()];
    // "1,5jt" / "1.5jt" = desimal ; "150.000rb" = pemisah ribuan
    const n = /^\d+[.,]\d{1,2}$/.test(s) ? parseFloat(s.replace(',', '.')) : parseFloat(s.replace(/[.,]/g, ''));
    return n * mult;
  }
  return parseFloat(s.replace(/[.,]/g, ''));
}

function detectPrices(text) {
  const found = new Map();
  for (const rx of PRICE_PATTERNS) {
    for (const m of String(text || '').matchAll(rx)) {
      const n = toNumber(m[1], m[2]);
      if (Number.isFinite(n) && n >= 1000 && n <= 50000000 && !found.has(n)) {
        found.set(n, m[0].replace(/\s+/g, ' ').trim());
      }
    }
  }
  return [...found].map(([value, snippet]) => ({ value, snippet }));
}

function stripPrices(line) {
  const order = [PRICE_PATTERNS[1], PRICE_PATTERNS[0], PRICE_PATTERNS[2]];
  return order.reduce((s, rx) => s.replace(rx, ''), line);
}

const rupiah = (n) => 'Rp' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/* ---------- Kategori ---------- */
const CATEGORY_WORDS = {
  Dress: ['dress', 'gamis', 'abaya', 'kaftan', 'tunik', 'terusan', 'longdress', 'long dress', 'maxi', 'midi'],
  Pants: ['celana', 'pants', 'kulot', 'jeans', 'legging', 'cargo', 'palazzo', 'trousers', 'jogger'],
  Hijab: ['hijab', 'jilbab', 'pashmina', 'pasmina', 'bergo', 'khimar', 'kerudung', 'scarf', 'segi empat', 'segiempat', 'ciput'],
  Accessories: ['aksesoris', 'aksesori', 'accessories', 'bros', 'brooch', 'kalung', 'gelang', 'anting', 'cincin', 'tas', 'dompet', 'ikat rambut', 'bandana', 'pin'],
};

function countWords(text, words) {
  const t = String(text || '').toLowerCase();
  let n = 0;
  for (const w of words) n += (t.match(new RegExp(`(?<![a-z])${w}(?![a-z])`, 'g')) || []).length;
  return n;
}

function guessCategory(all, title) {
  const scores = Object.entries(CATEGORY_WORDS)
    .map(([cat, words]) => [cat, countWords(all, words) + countWords(title, words) * 2])
    .sort((a, b) => b[1] - a[1]);
  if (scores[0][1] === 0 || scores[0][1] === scores[1][1]) return null; // tidak yakin
  return scores[0][0];
}

/* ---------- Nama, warna, deskripsi ---------- */
function extractName(text) {
  const line = String(text || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
  const clean = stripPrices(line)
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[\s:;,.\-–—]+$/, '')
    .trim()
    .slice(0, 80);
  return clean || null;
}

function extractVariants(text) {
  const m = String(text || '').match(/^\s*(?:warna|color|colour|varian|variant)\s*[:\-]\s*(.+)$/im);
  if (!m) return null;
  const list = m[1]
    .split(/\s*(?:,|\/|&|;|\bdan\b|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .slice(0, 15);
  return list.length ? list : null;
}

function extractDesc(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(1)
    .filter((l) => detectPrices(l).length === 0 && !/^(warna|color|colour|varian|variant)\s*[:\-]/i.test(l));
  const d = lines.join(' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  return d || null;
}

function slugify(s) {
  return (
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'produk'
  );
}

/** Ringkas semua teks (post + komentar) menjadi info produk. */
function analyze({ rootText, commentTexts = [] }) {
  const all = [rootText, ...commentTexts].filter(Boolean).join('\n');
  const name = extractName(rootText);
  return {
    name,
    category: guessCategory(all, name || ''),
    prices: detectPrices(all),
    variants: extractVariants(all),
    desc: extractDesc(rootText),
  };
}

/* ---------- Draft kode ---------- */
function buildDraft(info, files) {
  const q = JSON.stringify;
  const list = files.length ? files : [PH.file];
  let modalLine;
  if (info.prices.length === 1) {
    modalLine = `  "modal": ${info.prices[0].value}, // dari teks: ${q(info.prices[0].snippet)} - PASTIKAN ini memang harga modal`;
  } else {
    const why = info.prices.length ? 'ada beberapa angka di teks, pilih sendiri' : 'harga tidak disebutkan di teks';
    modalLine = `  "modal": ${q(PH.price)}, // ${why}`;
  }
  return [
    '{',
    '  "id": "p-XX", // ganti XX dengan nomor urut produk berikutnya',
    `  "name": ${q(info.name || PH.name)},`,
    `  "category": ${q(info.category || PH.category)}, // Dress | Pants | Hijab | Accessories`,
    `  "desc": ${q(info.desc || PH.desc)},`,
    modalLine,
    `  "mainImage": ${q(list[0])},`,
    `  "gallery": ${q(list)},`,
    `  "variants": ${q(info.variants || [PH.variant])},`,
    '  "isDiscontinue": false,',
    '  "featured": false',
    '},',
  ].join('\n');
}

/* ---------- Pesan untuk pemilik (HTML Telegram) ---------- */
function shorten(s, n) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

function renderProductMessage(o) {
  const {
    mode, // 'new' | 'forward' | 'update'
    info,
    photoMsgIds = [],
    freshPhotoCount = 0,
    commentTexts = [],
    link = null,
    postHasPhoto = false,
    nameKnown = true,
  } = o;

  const slug = slugify(info.name);
  const photoCount = mode === 'update' ? photoMsgIds.length : (postHasPhoto ? 1 : 0);
  const files = Array.from({ length: photoCount }, (_, i) => `${slug}-${i + 1}.jpg`);

  const L = [];
  const HEADERS = {
    new: '🆕 <b>Post produk baru terdeteksi</b>',
    forward: '📥 <b>Draft dari pesan yang Anda teruskan</b>',
    update: '📸 <b>Update foto/komentar untuk sebuah produk</b>',
  };
  L.push(HEADERS[mode] || HEADERS.update);
  L.push('');
  L.push(`📌 Nama (tebakan): <b>${esc(nameKnown && info.name ? info.name : '(tidak terbaca — buka thread-nya di Telegram)')}</b>`);
  L.push(`🏷️ Kategori (tebakan): ${info.category ? esc(info.category) : 'belum yakin → isi manual'}`);

  if (info.prices.length === 0) {
    L.push('💰 Harga: tidak disebutkan → sengaja dikosongkan (tidak saya karang)');
  } else if (info.prices.length === 1) {
    L.push(`💰 Harga terdeteksi: <b>${rupiah(info.prices[0].value)}</b> (dari teks "${esc(shorten(info.prices[0].snippet, 40))}") — cek dulu apakah ini harga modal`);
  } else {
    L.push('💰 Ada beberapa angka harga di teks, saya tidak menebak mana yang modal:');
    for (const p of info.prices.slice(0, 5)) L.push(`   • ${rupiah(p.value)} ("${esc(shorten(p.snippet, 40))}")`);
  }
  if (info.variants) L.push(`🎨 Warna terdeteksi: ${esc(info.variants.join(', '))}`);

  L.push('');
  if (mode === 'forward') {
    L.push(
      postHasPhoto
        ? '📷 Pesan ini berisi foto. Simpan sendiri fotonya dari Telegram ke folder <code>images/</code>, lalu sesuaikan nama file di draft.'
        : '📷 Foto tidak dihitung otomatis pada mode teruskan. Simpan sendiri foto produk dari Telegram ke folder <code>images/</code>, lalu isi nama file di draft.'
    );
  } else if (mode === 'new') {
    L.push(
      postHasPhoto
        ? '📷 Post ini sendiri berisi foto (cek di Telegram).'
        : '📷 Belum ada foto di post ini. Foto biasanya ada di komentar — tunggu pesan "Update" berikutnya dari bot.'
    );
  } else {
    L.push(`📷 Foto baru: <b>${freshPhotoCount}</b> • Total foto sejauh ini: <b>${photoMsgIds.length}</b>`);
    if (photoMsgIds.length) {
      L.push('Simpan foto ke folder <code>images/</code> dengan nama ini (urutan = urutan kirim di Telegram):');
      photoMsgIds.slice(0, 20).forEach((id, i) => L.push(`${i + 1}. <code>${esc(files[i])}</code> ← foto ke-${i + 1} (pesan #${id})`));
      if (photoMsgIds.length > 20) L.push(`…dan ${photoMsgIds.length - 20} foto lainnya`);
    }
  }

  if (commentTexts.length) {
    L.push('');
    L.push('💬 Teks di komentar:');
    for (const t of commentTexts.slice(0, 5)) L.push(`• ${esc(shorten(t, 150))}`);
    if (commentTexts.length > 5) L.push(`…dan ${commentTexts.length - 5} komentar lain`);
  }
  if (link) {
    L.push('');
    L.push(`🔗 <a href="${esc(link)}">Buka di Telegram</a>`);
  }
  L.push('');
  L.push('🔒 <i>Belum ada yang berubah di website. Anda yang memutuskan: salin draft ini → tempel ke RAW_PRODUCTS → simpan foto ke images/ → deploy.</i>');
  L.push('');
  L.push('<b>Draft (ketuk kotak kode untuk menyalin):</b>');
  L.push(`<pre><code class="language-javascript">${esc(buildDraft(info, files))}</code></pre>`);
  return L.join('\n');
}

module.exports = { analyze, buildDraft, renderProductMessage, detectPrices, guessCategory, slugify };
