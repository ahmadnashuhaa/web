'use strict';
/**
 * /product tanpa AI (Master Prompt bagian 1-11, 26, 28, 33-34):
 *  - parseProductText : teks bebas/berlabel -> struktur PRODUCT / VARIANT / ATTRIBUTE
 *  - productsFromTable: baris csv/xlsx -> produk (baris dengan nama sama digabung jadi VARIAN, bukan produk baru)
 *  - validateProducts : cek duplikat, varian salah tempat, data kosong
 *  - normalizeProducts: rapikan hasil AI supaya bentuknya selalu sama
 *  - flattenForExport : ratakan untuk csv/xlsx
 * Prinsip: tidak mengarang data. Yang tidak jelas -> null + catatan.
 */
const { detectPrices, guessCategory } = require('./product-draft');

/* ---------- Kamus ---------- */
const COLOR_WORDS = new Set(
  ('hitam putih merah biru hijau kuning abu abu-abu coklat cokelat pink ungu oranye jingga krem cream navy maroon khaki olive beige silver gold emas perak tosca turkish ' +
    'mocca mocha mint lilac lavender salem peach burgundy magenta fuchsia fuschia mustard tan denim charcoal ivory nude sage terracotta ' +
    'black white red blue green yellow grey gray brown purple orange rose teal turquoise').split(/\s+/)
);
const COLOR_MODS = new Set(['dusty', 'dark', 'light', 'soft', 'baby', 'army', 'sage', 'muda', 'tua', 'pastel', 'neon', 'hot', 'sky', 'off', 'royal', 'midnight', 'old', 'deep']);
const SIZE_RX = /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-6]xl|all ?size|free ?size|std|standard|jumbo|small|medium|large|kecil|sedang|besar|regular|reguler|mini|extra large|extra small)$/i;
const NUM_SIZE_RX = /^(2\d|3\d|4\d|5\d)$/; // ukuran sepatu/celana 20-59
const STORAGE_RX = /^\d+\s?(gb|tb)$/i;
const MEASURE_RX = /^(\d+(?:[.,]\d+)?)\s?(ml|l|liter|g|gr|gram|kg|mg|cm|mm|m|watt|w|mah|inch|inci|")$/i;
const MATERIAL_WORDS = /\b(cotton|katun|wol|wool|linen|polyester|denim|satin|silk|sutra|leather|kulit|nylon|fleece|rayon|spandex|crepe|chiffon|sifon|jersey|canvas|kanvas|velvet|beludru|stainless|plastik|kayu|wood)\b/i;
const TEMP_RX = /^(hot|ice|iced|cold|panas|dingin|es)$/i;

const LABELS = {
  name: ['produk', 'product', 'nama', 'name', 'nama produk', 'product name'],
  category: ['kategori', 'category'],
  variant: ['varian', 'variant', 'variasi', 'pilihan', 'opsi', 'option', 'options'],
  color: ['warna', 'color', 'colour'],
  size: ['ukuran', 'size'],
  flavor: ['rasa', 'flavor', 'flavour', 'taste'],
  price: ['harga', 'price', 'hrg'],
  stock: ['stok', 'stock', 'qty', 'jumlah'],
  sku: ['sku', 'kode', 'kode produk', 'code'],
  desc: ['deskripsi', 'description', 'desc', 'keterangan'],
  material: ['bahan', 'material'],
  brand: ['brand', 'merek', 'merk'],
  weight: ['berat', 'weight'],
  type: ['tipe', 'type', 'jenis'],
};
const LABEL_LOOKUP = new Map();
for (const [key, words] of Object.entries(LABELS)) for (const w of words) LABEL_LOOKUP.set(w, key);

/* ---------- Util ---------- */
const stripBullet = (s) => s.replace(/^\s*(?:[-*•·▪◦]|\d{1,2}[.)])\s+/, '').trim();
const isBullet = (s) => /^\s*(?:[-*•·▪◦]|\d{1,2}[.)])\s+/.test(s);
const unquote = (s) => s.trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

function isColor(t) {
  const w = norm(t).split(' ');
  if (w.length === 1) return COLOR_WORDS.has(w[0]);
  if (w.length === 2) return (COLOR_MODS.has(w[0]) && COLOR_WORDS.has(w[1])) || (COLOR_WORDS.has(w[0]) && COLOR_MODS.has(w[1]));
  return false;
}
const isSize = (t) => SIZE_RX.test(t.trim()) || NUM_SIZE_RX.test(t.trim());
const isStorage = (t) => STORAGE_RX.test(t.trim());
const isMeasure = (t) => MEASURE_RX.test(t.trim());
const isSentence = (t) => (wordCount(t) >= 6 || (/[.!?]$/.test(t) && wordCount(t) >= 4)) && !isColor(t);

function measureKey(unit) {
  const u = unit.toLowerCase();
  if (['ml', 'l', 'liter'].includes(u)) return 'volume';
  if (['g', 'gr', 'gram', 'kg', 'mg'].includes(u)) return 'weight';
  if (['cm', 'mm', 'm'].includes(u)) return 'dimension';
  if (['watt', 'w'].includes(u)) return 'power';
  if (u === 'mah') return 'battery';
  return 'screen';
}

/** Jenis satu baris pendek tanpa label. */
function tokenType(t) {
  if (isColor(t)) return 'color';
  if (isStorage(t)) return 'storage';
  if (isSize(t)) return 'size';
  if (isMeasure(t)) return 'measure';
  if (TEMP_RX.test(t.trim())) return 'temperature';
  if (MATERIAL_WORDS.test(t) && wordCount(t) <= 3) return 'material';
  return 'unknown';
}

/** Baris berlabel "Kunci: nilai" (label harus dikenal, atau diakhiri ':' tanpa nilai). */
function parseLabel(line) {
  const m = stripBullet(line).match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{1,20}?)\s*[:=]\s*(.*)$/);
  if (!m) return null;
  const key = LABEL_LOOKUP.get(norm(m[1]));
  if (!key) {
    // "Model: X" dsb: label tak dikenal tapi jelas berpola kunci:nilai -> atribut generik
    if (m[2].trim() && wordCount(m[1]) <= 2 && !/https?/i.test(line)) return { key: 'attr', attrName: norm(m[1]), value: unquote(m[2]) };
    return null;
  }
  return { key, value: unquote(m[2]) };
}

const splitList = (v) =>
  v
    .split(/\s*(?:,|;|\/|&|\bdan\b|\band\b)\s*/i)
    .map((s) => cap(unquote(s)))
    .filter(Boolean);

/* ---------- Parser teks ---------- */
function newProduct(name) {
  return { name: name ? unquote(name) : null, description: null, category: null, variants: {}, attributes: {}, sku: null, price: null, stock: null, _measures: [], _catItems: [], _unknown: [] };
}
function addVariant(p, group, value) {
  const v = cap(value);
  p.variants[group] = p.variants[group] || [];
  if (!p.variants[group].some((x) => norm(x) === norm(v))) p.variants[group].push(v);
}

function assignLabel(p, key, value, notes, attrName) {
  if (!value) return;
  switch (key) {
    case 'name':
      break;
    case 'category': {
      const list = splitList(value);
      if (list.length === 1) p.category = list[0];
      else list.forEach((x) => addVariant(p, 'option', x));
      break;
    }
    case 'variant':
    case 'type':
    case 'flavor': {
      const group = key === 'flavor' ? 'flavor' : key === 'type' ? 'type' : 'option';
      splitList(value).forEach((x) => addVariant(p, group, x));
      break;
    }
    case 'color':
      splitList(value).forEach((x) => addVariant(p, 'color', x));
      break;
    case 'size':
      splitList(value).forEach((x) => addVariant(p, 'size', x));
      break;
    case 'price': {
      const prices = detectPrices(`harga ${value}`);
      const plain = Number(String(value).replace(/[^\d]/g, ''));
      if (prices.length) {
        const top = Math.max(...prices.map((x) => x.value)); // beberapa angka harga -> ambil yang tertinggi
        p.price = p.price != null && p.price !== '' ? Math.max(Number(p.price), top) : top;
        if (prices.length > 1) notes.push(`Ada beberapa angka harga untuk "${p.name}" → dipilih yang tertinggi (${top}), cek ulang.`);
      } else if (plain >= 1) p.price = plain;
      break;
    }
    case 'stock': {
      const n = Number(String(value).replace(/[^\d]/g, ''));
      if (Number.isFinite(n) && String(value).match(/\d/)) p.stock = n;
      break;
    }
    case 'sku':
      p.sku = value.split(/\s+/)[0];
      break;
    case 'desc':
      p.description = p.description ? `${p.description} ${value}` : value;
      break;
    case 'material':
    case 'brand':
    case 'weight':
      p.attributes[key] = value;
      break;
    case 'attr':
      p.attributes[attrName] = value;
      break;
    default:
      break;
  }
}

function finalizeProduct(p, notes) {
  // Ukuran/kapasitas: 1 nilai = atribut, >=2 nilai = varian (bagian 2 & 3)
  const byKey = {};
  for (const m of p._measures) (byKey[m.key] = byKey[m.key] || []).push(m.text);
  for (const [k, list] of Object.entries(byKey)) {
    if (list.length >= 2) list.forEach((x) => addVariant(p, k, x));
    else p.attributes[k] = list[0];
  }
  // "Kategori:" berisi daftar -> VARIAN (bagian 1); satu item saja -> kategori
  if (p._catItems.length === 1) p.category = p._catItems[0];
  else if (p._catItems.length >= 2) {
    p._catItems.forEach((x) => addVariant(p, 'option', x));
    notes.push(`"Kategori" di "${p.name || 'produk'}" berisi daftar pilihan (${p._catItems.join(', ')}) → saya baca sebagai VARIAN, bukan kategori/produk terpisah. Beri tahu saya kalau maksudnya lain.`);
  }
  if (p._unknown.length) {
    notes.push(`Jenis item ini tidak jelas: ${p._unknown.join(', ')} → dikelompokkan sebagai varian "option" dari "${p.name || 'produk'}". Periksa ulang.`);
  }
  if (!p.category && p.name) p.category = guessCategory(p.name);
  delete p._measures;
  delete p._catItems;
  delete p._unknown;
  return p;
}

/**
 * Teks -> { products, notes, clarification }.
 * Dukungan: input berlabel (Produk:/Kategori:/Varian:...), input polos (baris pertama = nama),
 * beberapa produk dipisah baris kosong, dan blok tanpa nama yang menempel ke produk sebelumnya.
 */
function parseProductText(text) {
  const notes = [];
  const products = [];
  let cur = null;
  let pending = null; // label berdaftar yang menunggu item ("Kategori:" lalu bullet)
  let pendingCount = 0;
  let blockStart = true;

  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const nextNonEmpty = (i) => {
    for (let k = i + 1; k < lines.length; k++) if (lines[k].trim()) return stripBullet(lines[k]);
    return '';
  };
  const start = (name) => {
    cur = newProduct(name);
    products.push(cur);
    pending = null;
    pendingCount = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) {
      if (pending && pendingCount > 0) pending = null;
      if (!pending) blockStart = true;
      continue;
    }
    const lab = parseLabel(raw);

    if (lab) {
      if (lab.key === 'name') {
        if (lab.value) start(lab.value);
        else pending = { key: 'name' };
        blockStart = false;
        continue;
      }
      if (!cur) start(null);
      if (lab.value) {
        assignLabel(cur, lab.key, lab.value, notes, lab.attrName);
        pending = null;
      } else {
        pending = { key: lab.key };
        pendingCount = 0;
      }
      blockStart = false;
      continue;
    }

    const line = unquote(stripBullet(raw));

    if (pending) {
      if (pending.key === 'name') {
        start(line);
        blockStart = false;
        continue;
      }
      if (pendingCount === 0 || isBullet(raw) || wordCount(line) <= 4) {
        if (!cur) start(null);
        if (pending.key === 'category') cur._catItems.push(cap(line));
        else assignLabel(cur, pending.key, line, notes);
        pendingCount++;
        continue;
      }
      pending = null;
    }

    // Baris harga polos: "Rp 25.000"
    const priceHit = detectPrices(line);
    if (priceHit.length && line.replace(/[\d.,\s]|rp|rb|ribu|jt|juta|k/gi, '').length < 3) {
      if (!cur) start(null);
      const top = Math.max(...priceHit.map((x) => x.value)); // beberapa harga -> ambil yang tertinggi
      if (cur.price === null || cur.price === undefined || cur.price === '') cur.price = top;
      else if (top > cur.price) cur.price = top;
      if (priceHit.length > 1 || cur.price !== top) notes.push(`Ada lebih dari satu harga untuk "${cur.name || 'produk'}" → dipilih yang tertinggi (${cur.price}), cek ulang.`);
      blockStart = false;
      continue;
    }

    const type = tokenType(line);
    const startsNew = blockStart || !cur;
    const variantLike = ['color', 'size', 'storage', 'measure', 'temperature'].includes(type);

    // Awal blok: nama produk baru, KECUALI barisnya jelas varian/atribut (menempel ke produk sebelumnya)
    if (startsNew) {
      if (cur && (variantLike || type === 'material')) {
        blockStart = false;
      } else if (isSentence(line) && cur) {
        cur.description = cur.description ? `${cur.description} ${line}` : line;
        blockStart = false;
        continue;
      } else {
        start(line);
        blockStart = false;
        continue;
      }
    }

    if (isSentence(line)) {
      cur.description = cur.description ? `${cur.description} ${line}` : line;
      continue;
    }

    const upperName = cur.name;
    switch (type) {
      case 'color':
        addVariant(cur, 'color', line);
        break;
      case 'size':
        addVariant(cur, 'size', line.toUpperCase() === line || line.length <= 3 ? line.toUpperCase() : line);
        break;
      case 'storage':
        addVariant(cur, 'storage', line.toUpperCase().replace(/\s+/g, ''));
        break;
      case 'temperature':
        addVariant(cur, 'temperature', line);
        break;
      case 'measure': {
        const m = line.match(MEASURE_RX);
        cur._measures.push({ key: measureKey(m[2]), text: line });
        break;
      }
      case 'material':
        cur.attributes.material = cap(line);
        break;
      default: {
        // Baris tak dikenal. Kalau setelahnya muncul varian (warna/ukuran) dan produk ini sudah punya varian,
        // kemungkinan besar ini NAMA PRODUK BARU (bagian 34).
        const nxtType = tokenType(nextNonEmpty(i));
        const hasVariants = Object.keys(cur.variants).length > 0;
        if (wordCount(line) >= 2 && hasVariants && ['color', 'size', 'storage'].includes(nxtType)) {
          notes.push(`"${line}" saya baca sebagai PRODUK BARU (bukan varian dari "${upperName}") karena diikuti daftar varian sendiri.`);
          start(line);
        } else {
          addVariant(cur, 'option', line);
          cur._unknown.push(cap(line));
        }
      }
    }
  }

  // Rapikan
  const out = [];
  for (const p of products) {
    if (!p.name && !Object.keys(p.variants).length && !p.description) continue;
    finalizeProduct(p, notes);
    if (!p.name) {
      p.name = null;
      notes.push('Ada data (varian/deskripsi) tanpa nama produk → lengkapi nama produknya.');
    }
    out.push(p);
  }
  // Gabungkan produk bernama sama (bagian 7: jangan duplikasi)
  const merged = [];
  for (const p of out) {
    const dup = p.name && merged.find((m) => norm(m.name) === norm(p.name));
    if (dup) {
      for (const [g, list] of Object.entries(p.variants)) list.forEach((v) => addVariant(dup, g, v));
      Object.assign(dup.attributes, p.attributes);
      dup.description = dup.description || p.description;
      dup.price = dup.price === null ? p.price : dup.price;
      notes.push(`Nama "${p.name}" muncul lebih dari sekali → digabung jadi 1 produk (tidak diduplikasi).`);
    } else merged.push(p);
  }
  return {
    products: merged,
    notes: [...new Set(notes)].slice(0, 8),
    clarification: merged.length ? null : 'Saya tidak menemukan nama produk di teks itu. Baris pertama tiap produk sebaiknya nama produknya, atau tulis "Produk: Nama". Bisa kirim ulang?',
  };
}

/* ---------- Tabel (csv/xlsx) ---------- */
const COLS = {
  name: ['name', 'nama', 'produk', 'product', 'nama produk', 'product name', 'title', 'judul'],
  category: ['category', 'kategori'],
  variant: ['variant', 'varian', 'variasi', 'option', 'pilihan', 'opsi'],
  color: ['color', 'colour', 'warna'],
  size: ['size', 'ukuran'],
  price: ['price', 'harga', 'harga jual', 'modal', 'harga grosir'],
  stock: ['stock', 'stok', 'qty', 'jumlah'],
  sku: ['sku', 'kode', 'kode produk', 'code'],
  desc: ['description', 'deskripsi', 'keterangan', 'desc'],
};
function mapColumns(headers) {
  const map = {};
  for (const h of headers) {
    const n = norm(h);
    for (const [key, words] of Object.entries(COLS)) if (words.includes(n) && !map[key]) map[key] = h;
  }
  return map;
}

/** Baris tabel -> produk. Baris dengan nama sama = VARIAN dari produk itu. Null kalau tidak ada kolom nama. */
function productsFromTable(rows) {
  if (!rows || !rows.length) return null;
  const headers = Object.keys(rows[0]);
  const col = mapColumns(headers);
  if (!col.name) return null;
  const known = new Set(Object.values(col));
  const notes = [];
  const byName = new Map();
  const seenRows = new Set();
  const priceSeen = new Map();

  for (const r of rows) {
    const name = String(r[col.name] ?? '').trim();
    if (!name) continue;
    const k = norm(name);
    let p = byName.get(k);
    if (!p) {
      p = newProduct(name);
      byName.set(k, p);
    }
    const sig = [k, norm(r[col.variant]), norm(r[col.color]), norm(r[col.size])].join('|');
    if (seenRows.has(sig) && (col.variant || col.color || col.size)) notes.push(`Baris ganda untuk "${name}" (varian sama) dilewati.`);
    seenRows.add(sig);
    if (col.category && String(r[col.category]).trim() && !p.category) p.category = String(r[col.category]).trim();
    if (col.desc && String(r[col.desc]).trim() && !p.description) p.description = String(r[col.desc]).trim();
    if (col.sku && String(r[col.sku]).trim() && !p.sku) p.sku = String(r[col.sku]).trim();
    if (col.variant && String(r[col.variant]).trim()) splitList(String(r[col.variant])).forEach((v) => addVariant(p, 'option', v));
    if (col.color && String(r[col.color]).trim()) splitList(String(r[col.color])).forEach((v) => addVariant(p, 'color', v));
    if (col.size && String(r[col.size]).trim()) splitList(String(r[col.size])).forEach((v) => addVariant(p, 'size', v));
    if (col.stock && String(r[col.stock]).trim() !== '') {
      const n = Number(String(r[col.stock]).replace(/[^\d.-]/g, ''));
      if (Number.isFinite(n)) p.stock = (p.stock || 0) + n;
    }
    if (col.price && String(r[col.price]).trim() !== '') {
      const n = Number(String(r[col.price]).replace(/[^\d]/g, ''));
      if (Number.isFinite(n) && n > 0) {
        const set = priceSeen.get(k) || new Set();
        set.add(n);
        priceSeen.set(k, set);
        p.price = n;
      }
    }
    for (const h of headers) {
      if (known.has(h)) continue;
      const v = String(r[h] ?? '').trim();
      if (v && !p.attributes[norm(h)]) p.attributes[norm(h)] = v;
    }
  }
  for (const [k, set] of priceSeen) {
    if (set.size > 1) {
      const p = byName.get(k);
      p.price = Math.max(...set); // harga berbeda antar baris -> ambil yang tertinggi
      notes.push(`Harga "${p.name}" berbeda antar baris (${[...set].join(', ')}) → dipilih yang tertinggi (${p.price}), cek ulang.`);
    }
  }
  const products = [...byName.values()].map((p) => finalizeProduct(p, notes));
  const ignored = headers.filter((h) => !known.has(h));
  if (ignored.length) notes.push(`Kolom lain dimasukkan sebagai atribut: ${ignored.slice(0, 6).join(', ')}.`);
  notes.push(`${rows.length} baris dibaca → ${products.length} produk (baris dengan nama sama digabung jadi varian).`);
  return { products, notes: [...new Set(notes)].slice(0, 8), clarification: null };
}

/* ---------- Normalisasi hasil AI ---------- */
function normalizeProducts(parsed) {
  const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.products) ? parsed.products : [];
  return list.map((p) => {
    let variants = p && p.variants;
    if (Array.isArray(variants)) variants = variants.length ? { option: variants.map(String) } : {};
    if (!variants || typeof variants !== 'object') variants = {};
    for (const k of Object.keys(variants)) {
      const v = variants[k];
      variants[k] = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
      if (!variants[k].length) delete variants[k];
    }
    const attrs = p && p.attributes && typeof p.attributes === 'object' && !Array.isArray(p.attributes) ? p.attributes : {};
    const num = (x) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
    return {
      name: p && p.name ? String(p.name) : null,
      description: p && p.description ? String(p.description) : null,
      category: p && p.category ? String(p.category) : null,
      variants,
      attributes: attrs,
      sku: p && p.sku ? String(p.sku) : null,
      price: num(p && p.price),
      stock: num(p && p.stock),
    };
  });
}

/* ---------- Validasi ---------- */
function validateProducts(products) {
  const errors = [];
  const warns = [];
  const infos = [];
  const names = new Map();
  const skus = new Map();
  if (!products.length) return { errors: ['Tidak ada produk yang bisa diperiksa.'], warns, infos };

  products.forEach((p, i) => {
    const label = p.name ? `"${p.name}"` : `produk #${i + 1}`;
    if (!p.name) errors.push(`Produk #${i + 1} tidak punya nama.`);
    else {
      const k = norm(p.name);
      if (names.has(k)) errors.push(`Nama produk ganda: ${label} muncul lebih dari sekali (harusnya 1 produk dengan varian).`);
      names.set(k, i);
      const t = tokenType(p.name);
      if (['color', 'size', 'storage', 'temperature'].includes(t)) {
        errors.push(`${label} terlihat seperti VARIAN (${t}), bukan produk. Kemungkinan salah tempat → masukkan ke produk induknya.`);
      }
    }
    if (p.sku) {
      const k = norm(p.sku);
      if (skus.has(k)) errors.push(`SKU ganda: ${p.sku} dipakai ${label} dan produk lain.`);
      skus.set(k, i);
    }
    for (const [g, list] of Object.entries(p.variants || {})) {
      const seen = new Set();
      for (const v of list) {
        if (seen.has(norm(v))) errors.push(`Varian ganda di ${label}: "${v}" (${g}).`);
        seen.add(norm(v));
        if (p.name && norm(v) === norm(p.name)) warns.push(`Varian "${v}" sama dengan nama produknya di ${label}.`);
      }
    }
    for (const [g, list] of Object.entries(p.variants || {})) {
      for (const v of list) {
        const other = names.get(norm(v));
        if (other !== undefined && other !== i) warns.push(`"${v}" ada sebagai varian di ${label} DAN sebagai produk sendiri → pilih salah satu.`);
      }
    }
    if (p.price === null) infos.push(`Harga kosong: ${label}.`);
    if (p.stock === null) infos.push(`Stok kosong: ${label}.`);
    if (!p.category) infos.push(`Kategori kosong: ${label}.`);
    if (!p.description) infos.push(`Deskripsi kosong: ${label}.`);
    if (!Object.keys(p.variants || {}).length) infos.push(`${label} tidak punya varian (tidak apa-apa kalau memang produk tunggal).`);
  });
  return { errors, warns, infos };
}

function renderValidation(v, productCount) {
  const L = [`🔍 Hasil validasi (${productCount} produk)`, ''];
  if (!v.errors.length && !v.warns.length) L.push('✅ Tidak ditemukan masalah struktur (duplikat, varian salah tempat, SKU ganda).');
  if (v.errors.length) {
    L.push('❌ Masalah:');
    v.errors.forEach((x) => L.push(`• ${x}`));
    L.push('');
  }
  if (v.warns.length) {
    L.push('⚠️ Perlu diperiksa:');
    v.warns.slice(0, 12).forEach((x) => L.push(`• ${x}`));
    if (v.warns.length > 12) L.push(`…dan ${v.warns.length - 12} lainnya`);
    L.push('');
  }
  if (v.infos.length) {
    L.push('ℹ️ Info (data kosong, bukan kesalahan):');
    v.infos.slice(0, 10).forEach((x) => L.push(`• ${x}`));
    if (v.infos.length > 10) L.push(`…dan ${v.infos.length - 10} lainnya`);
    L.push('');
  }
  L.push('Batasan: pemeriksaan hanya untuk data yang Anda kirim. Duplikasi terhadap katalog/website asli tidak bisa dicek oleh bot.');
  return L.join('\n');
}

/* ---------- Tampilan & ekspor ---------- */
function renderProductStructure(products, notes = [], via = null) {
  const L = [`📦 Hasil analisis: ${products.length} PRODUK${via ? ` (${via})` : ''}`, ''];
  products.forEach((p, i) => {
    L.push(`${i + 1}. ${p.name || '(tanpa nama)'}`);
    if (p.category) L.push(`   Kategori: ${p.category}`);
    if (p.description) L.push(`   Deskripsi: ${p.description}`);
    for (const [k, v] of Object.entries(p.variants || {})) if (v.length) L.push(`   Varian (${k}): ${v.join(', ')}`);
    for (const [k, v] of Object.entries(p.attributes || {})) L.push(`   Atribut (${k}): ${v}`);
    if (p.sku) L.push(`   SKU: ${p.sku}`);
    if (p.price != null) L.push(`   Harga: ${p.price}`);
    if (p.stock != null) L.push(`   Stok: ${p.stock}`);
    L.push('');
  });
  if (notes.length) {
    L.push('📝 Catatan:');
    notes.forEach((n) => L.push(`• ${n}`));
    L.push('');
  }
  L.push('Lanjut: /product validate · /product export [json|csv|xlsx]');
  return L.join('\n');
}

function flattenForExport(products) {
  return products.map((p) => ({
    name: p.name || '',
    category: p.category || '',
    description: p.description || '',
    sku: p.sku || '',
    price: p.price ?? '',
    stock: p.stock ?? '',
    variants: Object.entries(p.variants || {})
      .map(([k, v]) => `${k}: ${v.join(', ')}`)
      .join(' | '),
    attributes: Object.entries(p.attributes || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | '),
  }));
}

/** Impor JSON hasil /product export (atau daftar produk lain) kembali ke struktur produk. */
function productsFromJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return null;
  }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.products) ? data.products : null;
  if (!list || !list.length || list.some((x) => !x || typeof x !== 'object')) return null;
  if (!list.some((x) => x.name || x.nama)) return null;
  const products = normalizeProducts(list.map((x) => ({ ...x, name: x.name || x.nama })));
  return { products, notes: [], clarification: null };
}

module.exports = {
  parseProductText,
  productsFromTable,
  productsFromJson,
  normalizeProducts,
  validateProducts,
  renderValidation,
  renderProductStructure,
  flattenForExport,
  tokenType,
};
