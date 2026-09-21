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
  // BARU: angka polos dengan titik/koma ribuan TANPA "Rp", kata kunci, atau akhiran rb/jt.
  // Contoh yang sekarang tertangkap: "155.000", "1.250.000", "89,000".
  /(?<![\d.,])(\d{1,3}(?:[.,]\d{3}){1,3})(?!\d)/g,
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
        // `line` = seluruh baris tempat angka ditemukan (dipakai untuk membaca label "Grosir"/"Reseller")
        const start = text.lastIndexOf('\n', m.index) + 1;
        let end = text.indexOf('\n', m.index);
        if (end === -1) end = text.length;
        found.set(n, { snippet: m[0].replace(/\s+/g, ' ').trim(), line: text.slice(start, end) });
      }
    }
  }
  return [...found].map(([value, f]) => ({ value, snippet: f.snippet, line: f.line }));
}

/**
 * Bila ada beberapa angka harga (mis. Reseller & Grosir), pilih yang TERTINGGI.
 * Kembalikan { value, snippet, line, reason } atau null bila tidak ada harga.
 */
function pickPrice(prices) {
  if (!prices || !prices.length) return null;
  const top = prices.reduce((a, b) => (b.value > a.value ? b : a));
  return { ...top, reason: prices.length > 1 ? 'harga tertinggi' : null };
}

function stripPrices(line) {
  const order = [PRICE_PATTERNS[1], PRICE_PATTERNS[0], PRICE_PATTERNS[2], PRICE_PATTERNS[3]];
  return order.reduce((s, rx) => s.replace(rx, ''), line);
}

const rupiah = (n) => 'Rp' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Modal = harga grosir + markup 15%, dibulatkan ke atas ke kelipatan 500 terdekat. */
function computeModal(grosir) {
  return Math.ceil((grosir * 1.15) / 500) * 500;
}

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

// Kategori hanya ditebak dari JUDUL (isi deskripsi sering menyebut "hijab friendly" dsb. dan menyesatkan).
function guessCategory(title) {
  const scores = Object.entries(CATEGORY_WORDS)
    .map(([cat, words]) => [cat, countWords(title, words)])
    .sort((a, b) => b[1] - a[1]);
  if (scores[0][1] === 0 || scores[0][1] === scores[1][1]) return null; // tidak yakin
  return scores[0][0];
}

/* ---------- Nama, warna, deskripsi ---------- */
// Baris pembuka yang BUKAN nama produk: judul bagian ("Harga"), label harga, poin/bullet, atau link.
const NON_NAME_LINE = /^(?:[-*•▪◦●]|\d+[.)]\s)|^(?:harga|hrg|price|reseller|grosir|ecer|eceran|modal|katalog|deskripsi|detail|spesifikasi|karakter|material|bahan|ukuran|size|warna|varian|variant|color|colour|info|ready|note|catatan)\b|https?:\/\/|www\./i;

/** Nama = baris pertama, KECUALI baris itu judul bagian/label harga/bullet/link (maka nama dianggap tidak terbaca). */
function firstLine(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
}

function extractName(text) {
  const line = firstLine(text);
  if (!line || NON_NAME_LINE.test(line)) return null;
  const clean = stripPrices(line)
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*\b(?:grosir|reseller|ecer|harga|hrg|modal|price)\s*[:=@\-]?\s*$/i, '') // sisa label harga di ujung judul
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

// Baris yang BUKAN deskripsi: tabel ukuran, link, dsb.
const SKIP_LINE = /(https?:\/\/|www\.|lingkar|panjang|muat\s*bb|katalog|ukuran|^size\b|^(xs|s|m|l|\d?xl)\s*:?$|^(warna|varian|variant|color|colour)\s*[:\-])/i;

function cutWords(str, n) {
  if (str.length <= n) return str;
  const cut = str.slice(0, n);
  const i = cut.lastIndexOf(' ');
  return (i > n * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,;:\-–]+$/, '') + '…';
}

/** Ukuran produk seperti "175x75cm" / "175 x 75 cm" (hanya bila ada satuan atau kata "ukuran"). */
function extractSize(text) {
  const t = String(text || '');
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|m)\b/i) ||
    t.match(/ukuran\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)()/i);
  return m ? `${m[1]}x${m[2]}${m[3] ? m[3].toLowerCase() : ''}` : null;
}

// Baris yang hanya judul bagian / label kosong, mis. "Harga", "Karakter:", "Reseller: /pcs"
const HEADING_ONLY = /^(?:harga|hrg|price|karakter|keterangan|deskripsi|detail|spesifikasi|fitur|kelebihan|info)\s*:?$/i;

function extractDesc(text) {
  const src = String(text || '');
  const nameUsed = extractName(src) !== null; // baris pertama hanya dibuang kalau memang dipakai sebagai nama
  const lines = src
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(nameUsed ? 1 : 0)
    .filter((l) => !SKIP_LINE.test(l))
    .map((l) => {
      const hadPrice = detectPrices(l).length > 0;
      // Hanya ANGKA HARGANYA yang dicabut; sisa kalimat deskriptif dipertahankan.
      let t = stripPrices(l).replace(/\/\s*(?:pcs|pc|pack|lusin|kodi|meter|m)\b/gi, '');
      t = t.replace(/^\s*(?:[-*•▪◦●]|\d+[.)])\s+/, '').replace(/\s{2,}/g, ' ').trim();
      // Baris yang tersisa cuma label harga ("Reseller:", "Grosir:") -> buang
      if (hadPrice && t.replace(/[^\p{L}]/gu, '').split(/\s+/).join(' ').length === 0) return '';
      if (hadPrice && /^(?:reseller|grosir|ecer|eceran|retail|agen|harga|hrg|modal|price)?\s*[:=\-]?\s*$/i.test(t)) return '';
      return t.replace(/[\s:;,.]+$/, '');
    })
    .filter((l) => l && !HEADING_ONLY.test(l));
  const size = extractSize(src);
  const parts = size && !lines.some((l) => l.includes(size)) ? [`Ukuran ${size}`, ...lines] : lines;
  const d = cutWords(parts.join('. ').replace(/\s+/g, ' ').trim(), 160);
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

/** Keterangan foto yang pendek (1 baris, <= 40 huruf, bukan harga) dianggap NAMA WARNA/VARIAN. */
function isLabel(x) {
  const t = String(x || '').trim();
  return Boolean(t) && !t.includes('\n') && t.length <= 40 && detectPrices(t).length === 0;
}

/** Ringkas teks (post + komentar/catatan) + label foto menjadi info produk. */
function analyze({ rootText, commentTexts = [], labels = [] }) {
  const all = [rootText, ...commentTexts].filter(Boolean).join('\n');
  const name = extractName(rootText);
  const fromLabels = [...new Set(labels.filter(Boolean))].slice(0, 30);
  return {
    name,
    category: guessCategory(name || ''),
    prices: detectPrices(all),
    price: pickPrice(detectPrices(all)),
    variants: fromLabels.length ? fromLabels : extractVariants(all),
    variantsFromLabels: fromLabels.length > 0,
    desc: extractDesc(rootText),
  };
}

/** Pisahkan komentar (mode otomatis) menjadi daftar foto (+label) dan teks biasa. */
function splitComments(items) {
  const photos = [];
  const texts = [];
  for (const it of [...items].sort((a, b) => a.m - b.m)) {
    const x = String(it.x || '').trim();
    if (it.t === 'photo') {
      photos.push({ m: it.m, label: isLabel(x) ? x : null });
      if (x && !isLabel(x)) texts.push(x);
    } else if (x) texts.push(x);
  }
  return { photos, texts };
}

/**
 * Mode teruskan: kelompokkan pesan yang diteruskan sekaligus menjadi PRODUK.
 *  - teks/deskripsi          -> produk baru
 *  - foto berketerangan pendek -> foto + nama varian/warna milik produk itu
 *  - teks lanjutan sebelum ada foto -> catatan tambahan produk yang sama
 */
function groupForwarded(items) {
  const sorted = [...items].sort((a, b) => a.m - b.m);
  const groups = [];
  let cur = null;
  const fresh = () => {
    const g = { rootText: null, photos: [], notes: [] };
    groups.push(g);
    return g;
  };
  for (const it of sorted) {
    const x = String(it.x || '').trim();
    const photo = it.t === 'photo';
    if (photo && (!x || isLabel(x))) {
      if (!cur) cur = fresh();
      cur.photos.push({ m: it.m, label: x || null });
      continue;
    }
    if (cur && cur.rootText && cur.photos.length === 0) { cur.notes.push(x); continue; }
    if (cur && !cur.rootText) {
      cur.rootText = x;
      if (photo) cur.photos.push({ m: it.m, label: null });
      continue;
    }
    cur = fresh();
    cur.rootText = x;
    if (photo) cur.photos.push({ m: it.m, label: null });
  }
  return groups;
}

/* ---------- Draft kode ---------- */
function buildDraft(info, files) {
  const q = JSON.stringify;
  const list = files.length ? files : [PH.file];
  let modalLine;
  if (info.price) {
    const grosir = info.price.value;
    const modal = computeModal(grosir);
    const via = info.price.reason ? ` (dipilih dari ${info.prices.length} angka: ${info.price.reason})` : '';
    modalLine = `  "modal": ${modal}, // harga terbaca ${q(info.price.snippet)} = ${grosir}${via} → +15% dibulatkan = ${modal} - CEK ULANG`;
  } else {
    modalLine = `  "modal": ${q(PH.price)}, // harga tidak disebutkan di teks`;
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

function photoFiles(slug, photos) {
  const used = new Set();
  return photos.map((p, i) => {
    const base = p.label && /[a-z0-9]/i.test(p.label) ? `${slug}-${slugify(p.label)}` : `${slug}-${i + 1}`;
    let f = `${base}.jpg`;
    let n = 2;
    while (used.has(f)) f = `${base}-${n++}.jpg`;
    used.add(f);
    return f;
  });
}

function composeMessage(o, showList) {
  const {
    mode, // 'new' | 'forward' | 'update'
    info,
    photos = [],
    freshPhotoCount = 0,
    commentTexts = [],
    link = null,
    postHasPhoto = false,
    nameKnown = true,
    index = 1,
    total = 1,
  } = o;

  const list = photos.length ? photos : postHasPhoto ? [{ m: 0, label: null }] : [];
  const slug = slugify(info.name);
  const files = photoFiles(slug, list);

  const HEADERS = {
    new: '🆕 <b>Post produk baru terdeteksi</b>',
    forward: total > 1 ? `📥 <b>Draft produk ${index} dari ${total}</b>` : '📥 <b>Draft dari pesan yang Anda teruskan</b>',
    update: '📸 <b>Update foto/komentar untuk sebuah produk</b>',
  };
  const L = [HEADERS[mode] || HEADERS.update, ''];
  L.push(`📌 Nama (tebakan): <b>${esc(info.name && nameKnown ? info.name : nameKnown ? '(tidak terbaca → isi nama manual)' : '(tidak terbaca → teruskan juga post deskripsinya)')}</b>`);
  L.push(`🏷️ Kategori (tebakan): ${info.category ? esc(info.category) : 'belum yakin → isi manual'}`);

  if (info.prices.length === 0) {
    L.push('💰 Harga: tidak disebutkan → sengaja dikosongkan (tidak saya karang)');
  } else {
    const grosir = info.price.value;
    const modal = computeModal(grosir);
    L.push(`💰 Harga terdeteksi: <b>${rupiah(grosir)}</b> (dari teks "${esc(shorten(info.price.snippet, 40))}")`);
    if (info.price.reason) {
      L.push(`   ↳ dipilih dari ${info.prices.length} angka harga (${esc(info.price.reason)}). Angka lain:`);
      for (const p of info.prices.filter((x) => x.value !== grosir).slice(0, 4)) L.push(`   • ${rupiah(p.value)} ("${esc(shorten(p.snippet, 40))}")`);
    }
    L.push(`💸 Modal (harga + 15%): <b>${rupiah(modal)}</b> → cek dulu, sesuaikan bila perlu`);
  }
  if (info.variants) {
    L.push(`🎨 Varian/warna${info.variantsFromLabels ? ' (dari keterangan foto)' : ''}: ${esc(info.variants.join(', '))}`);
  }

  L.push('');
  const listPhotos = (withMsgId) => {
    if (!showList) {
      L.push('(daftar nama file dipersingkat karena terlalu panjang → lihat "gallery" di draft)');
      return;
    }
    list.slice(0, 20).forEach((p, i) => {
      const lab = p.label ? ` ← "${esc(p.label)}"` : '';
      const mid = withMsgId && p.m ? ` (pesan #${p.m})` : '';
      L.push(`${i + 1}. <code>${esc(files[i])}</code>${lab}${mid}`);
    });
    if (list.length > 20) L.push(`…dan ${list.length - 20} foto lainnya`);
  };
  if (mode === 'update') {
    L.push(`📷 Total foto sejauh ini: <b>${list.length}</b> <i>(pesan ini diperbarui otomatis tiap ada foto/komentar baru)</i>`);
    if (list.length) {
      L.push('Simpan foto ke folder <code>images/</code> dengan nama ini (urutan = urutan kirim di Telegram):');
      listPhotos(true);
    }
  } else if (mode === 'forward') {
    if (list.length) {
      L.push(`📷 Foto dalam kiriman ini: <b>${list.length}</b>. Simpan ke folder <code>images/</code> dengan nama ini:`);
      listPhotos(false);
    } else {
      L.push('📷 Tidak ada foto di kiriman ini. Isi nama file foto di draft secara manual.');
    }
  } else {
    L.push(
      list.length
        ? '📷 Post ini sendiri berisi foto (cek di Telegram).'
        : '📷 Belum ada foto di post ini. Foto biasanya ada di komentar → tunggu pesan "Update" berikutnya dari bot.'
    );
  }

  if (commentTexts.length) {
    L.push('');
    L.push('💬 Teks tambahan:');
    for (const t of commentTexts.slice(0, 5)) L.push(`• ${esc(shorten(t, 150))}`);
    if (commentTexts.length > 5) L.push(`…dan ${commentTexts.length - 5} teks lain`);
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

function renderProductMessage(o) {
  const full = composeMessage(o, true);
  return full.length > 3900 ? composeMessage(o, false) : full; // batas Telegram 4096 karakter
}

module.exports = { analyze, splitComments, groupForwarded, buildDraft, renderProductMessage, detectPrices, guessCategory, slugify, isLabel };