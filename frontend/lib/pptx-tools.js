'use strict';
/**
 * Membuat file PowerPoint (.pptx) dari:
 *  - teks biasa / markdown  (textToSlides)       -> tanpa AI, gratis
 *  - tabel csv/xlsx/json    (rowsToSlides)       -> tanpa AI, gratis
 *  - daftar produk          (productsToSlides)   -> tanpa AI, gratis
 *  - JSON hasil AI          (deckFromAi)         -> dipakai /doc slides
 * Semua berujung ke satu bentuk "deck": { title, subtitle, slides: [{ title, bullets, notes, table }] }
 * lalu dirender oleh buildPptx().
 */
const PptxGenJS = require('pptxgenjs');

const MAX_SLIDES = 60;
const C = { navy: '14213D', accent: 'FCA311', ink: '1F2937', soft: '6B7280', line: 'E5E7EB', head: '14213D' };
const FONT = 'Calibri';

const clean = (s) => String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();

function cutWords(str, n) {
  const s = clean(str);
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf(' ');
  return (i > n * 0.6 ? cut.slice(0, i) : cut).replace(/[\s,;:\-–]+$/, '') + '…';
}

/* ---------- Teks -> slide ---------- */
const BULLET_RX = /^\s*(?:[-*•▪◦●]|\d+[.)])\s+/;
const looksLikeTitle = (l) => l.length <= 80 && !/[.!?;:,]$/.test(l);

function sentencesToBullets(par) {
  // Satu kalimat = satu poin. Kalimat yang sangat pendek digabung dengan kalimat berikutnya.
  const parts = clean(par).split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý0-9"“(])/).filter(Boolean);
  const out = [];
  let carry = '';
  for (const p of parts) {
    const t = carry ? `${carry} ${p}` : p;
    if (t.length < 30) { carry = t; continue; }
    out.push(t);
    carry = '';
  }
  if (carry) out.push(carry);
  return out;
}

function lineToBullets(l) {
  const marked = BULLET_RX.test(l);
  const t = l.replace(BULLET_RX, '').trim();
  if (!t) return [];
  // Baris bertanda poin dipertahankan utuh (kecuali sangat panjang); paragraf biasa dipecah per kalimat.
  return marked && t.length <= 240 ? [t] : sentencesToBullets(t);
}

/** Pecah slide yang kepenuhan menjadi beberapa slide (maks 6 poin / ~700 karakter). */
function chunkSlide(s) {
  const out = [];
  let cur = { title: s.title, bullets: [] };
  let chars = 0;
  for (const b of s.bullets) {
    if (cur.bullets.length && (cur.bullets.length >= 6 || chars + b.length > 700)) {
      out.push(cur);
      cur = { title: `${s.title} (lanjutan)`, bullets: [] };
      chars = 0;
    }
    cur.bullets.push(b);
    chars += b.length;
  }
  out.push(cur);
  return out;
}

function textToSlides(text, { title = '' } = {}) {
  const src = String(text || '').replace(/\r/g, '').trim();
  const lines = src.split('\n');
  const raw = [];
  const fallbackTitle = clean(title); // nama file: hanya dipakai kalau isi dokumen tidak punya judul
  let deckTitle = '';
  let subtitle = '';

  if (lines.some((l) => /^#{1,3}\s+\S/.test(l))) {
    // Mode markdown: tiap judul (#, ##, ###) = slide baru
    let cur = null;
    let firstH1Used = false;
    for (const l of lines) {
      const h = l.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
      if (h) {
        if (h[1] === '#' && !firstH1Used && !raw.length && !cur) { deckTitle = clean(h[2]); firstH1Used = true; continue; }
        cur = { title: clean(h[2]), bullets: [] };
        raw.push(cur);
      } else if (l.trim()) {
        if (!cur) { cur = { title: deckTitle || fallbackTitle || 'Pendahuluan', bullets: [] }; raw.push(cur); }
        cur.bullets.push(...lineToBullets(l));
      }
    }
  } else {
    // Mode teks biasa: blok dipisah baris kosong
    const blocks = src.split(/\n\s*\n/).map((b) => b.split('\n').map((x) => x.trim()).filter(Boolean)).filter((b) => b.length);
    if (blocks.length > 1 && blocks[0].length === 1 && looksLikeTitle(blocks[0][0])) deckTitle = blocks.shift()[0];
    let pending = null;
    let last = deckTitle || fallbackTitle || 'Isi';
    for (const b of blocks) {
      if (b.length === 1 && looksLikeTitle(b[0]) && !BULLET_RX.test(b[0])) { pending = b[0]; continue; }
      let t = pending;
      let body = b;
      if (!t && b.length >= 2 && looksLikeTitle(b[0]) && !BULLET_RX.test(b[0])) { t = b[0]; body = b.slice(1); }
      if (!t) t = `${last}`;
      pending = null;
      last = t;
      raw.push({ title: t, bullets: body.flatMap(lineToBullets) });
    }
    if (pending) raw.push({ title: pending, bullets: [] });
  }

  let slides = raw.filter((s) => s.bullets.length || s.title).flatMap(chunkSlide);
  let note = null;
  if (slides.length > MAX_SLIDES) { slides = slides.slice(0, MAX_SLIDES); note = `Presentasi dibatasi ${MAX_SLIDES} slide pertama.`; }
  return { deck: { title: deckTitle || fallbackTitle || (slides[0] && slides[0].title) || 'Presentasi', subtitle, slides }, note };
}

/* ---------- Tabel -> slide ---------- */
function rowsToSlides(rows, { title = 'Data' } = {}) {
  if (!rows || !rows.length) return { deck: { title, slides: [] }, note: null };
  const cols = Object.keys(rows[0]).slice(0, 6);
  const dropped = Object.keys(rows[0]).length - cols.length;
  const PER = 8;
  const slides = [];
  for (let i = 0; i < rows.length && slides.length < MAX_SLIDES; i += PER) {
    slides.push({
      title: rows.length > PER ? `${title} (${i + 1}-${Math.min(i + PER, rows.length)} dari ${rows.length})` : title,
      table: [cols, ...rows.slice(i, i + PER).map((r) => cols.map((c) => cutWords(r[c] === undefined || r[c] === null ? '' : String(r[c]), 60)))],
    });
  }
  const notes = [];
  if (dropped > 0) notes.push(`Hanya 6 kolom pertama yang ditampilkan (${dropped} kolom lain tidak ikut).`);
  if (rows.length > PER * MAX_SLIDES) notes.push(`Hanya ${PER * MAX_SLIDES} baris pertama yang dimuat.`);
  return { deck: { title, subtitle: `${rows.length} baris data`, slides }, note: notes.join(' ') || null };
}

/* ---------- Produk -> slide ---------- */
const LABEL_ID = { color: 'Warna', colour: 'Warna', size: 'Ukuran', storage: 'Penyimpanan', flavor: 'Rasa', option: 'Pilihan', options: 'Pilihan', material: 'Bahan', type: 'Tipe' };
const labelOf = (k) => LABEL_ID[String(k).toLowerCase()] || k.charAt(0).toUpperCase() + k.slice(1);
const rupiah = (n) => 'Rp' + String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function productsToSlides(products, { title = 'Katalog Produk' } = {}) {
  const list = (products || []).slice(0, MAX_SLIDES - 2);
  const overview = [];
  const PER = 8;
  for (let i = 0; i < list.length; i += PER) {
    overview.push({
      title: list.length > PER ? `Daftar produk (${i + 1}-${Math.min(i + PER, list.length)})` : 'Daftar produk',
      table: [['Produk', 'Kategori', 'Harga'], ...list.slice(i, i + PER).map((p) => [cutWords(p.name || '-', 50), p.category || '-', p.price != null && p.price !== '' && Number.isFinite(Number(p.price)) ? rupiah(p.price) : '-'])],
    });
  }
  const detail = list.map((p) => {
    const bullets = [];
    if (p.category) bullets.push(`Kategori: ${p.category}`);
    if (p.price != null && p.price !== '' && Number.isFinite(Number(p.price))) bullets.push(`Harga: ${rupiah(p.price)}`);
    if (p.stock != null && p.stock !== '') bullets.push(`Stok: ${p.stock}`);
    if (p.sku) bullets.push(`SKU: ${p.sku}`);
    for (const [k, v] of Object.entries(p.variants || {})) if (v && v.length) bullets.push(`${labelOf(k)}: ${v.join(', ')}`);
    for (const [k, v] of Object.entries(p.attributes || {})) if (v) bullets.push(`${labelOf(k)}: ${v}`);
    if (p.description) bullets.push(cutWords(p.description, 220));
    return { title: cutWords(p.name || 'Produk', 60), bullets };
  });
  const note = (products || []).length > list.length ? `Hanya ${list.length} produk pertama yang dimasukkan (batas ${MAX_SLIDES} slide).` : null;
  return { deck: { title, subtitle: `${list.length} produk`, slides: [...overview, ...detail] }, note };
}

/* ---------- JSON dari AI -> deck ---------- */
function deckFromAi(obj) {
  if (!obj || !Array.isArray(obj.slides)) return null;
  const slides = obj.slides
    .map((s) => ({
      title: cutWords(s && s.title, 90),
      bullets: (Array.isArray(s && s.bullets) ? s.bullets : []).map((b) => cutWords(b, 300)).filter(Boolean).slice(0, 8),
      notes: clean(s && s.notes).slice(0, 1500),
    }))
    .filter((s) => s.title || s.bullets.length)
    .slice(0, MAX_SLIDES);
  if (!slides.length) return null;
  return { title: cutWords(obj.title, 90) || slides[0].title, subtitle: cutWords(obj.subtitle, 120), slides };
}

/* ---------- Render ---------- */
function bodySize(bullets) {
  const total = bullets.reduce((n, b) => n + b.length, 0);
  return total <= 350 ? 24 : total <= 550 ? 22 : total <= 750 ? 20 : total <= 1100 ? 18 : 15;
}

async function buildPptx(deck) {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inci (16:9)
  pres.title = clean(deck.title) || 'Presentasi';
  pres.author = 'Dukion Bot';

  pres.defineSlideMaster({
    title: 'ISI',
    background: { color: 'FFFFFF' },
    objects: [{ rect: { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: C.navy }, line: { color: C.navy } } }],
    slideNumber: { x: 12.3, y: 6.95, w: 0.7, h: 0.3, fontFace: FONT, fontSize: 11, color: C.soft, align: 'right' },
  });

  // Slide judul
  const t = pres.addSlide();
  t.background = { color: C.navy };
  t.addShape(pres.ShapeType.rect, { x: 0.8, y: 3.75, w: 1.6, h: 0.08, fill: { color: C.accent }, line: { color: C.accent } });
  t.addText(clean(deck.title) || 'Presentasi', { x: 0.8, y: 1.5, w: 11.7, h: 2.1, fontFace: FONT, fontSize: 40, bold: true, color: 'FFFFFF', valign: 'bottom', fit: 'shrink' });
  if (deck.subtitle) t.addText(clean(deck.subtitle), { x: 0.8, y: 4.05, w: 11.7, h: 1.0, fontFace: FONT, fontSize: 20, color: 'D1D5DB', valign: 'top', fit: 'shrink' });

  for (const s of deck.slides) {
    const sl = pres.addSlide({ masterName: 'ISI' });
    sl.addText(clean(s.title) || ' ', { x: 0.8, y: 0.45, w: 11.7, h: 1.0, fontFace: FONT, fontSize: 30, bold: true, color: C.head, valign: 'middle', fit: 'shrink' });
    sl.addShape(pres.ShapeType.rect, { x: 0.8, y: 1.5, w: 1.2, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });

    if (s.table && s.table.length) {
      const header = s.table[0].map((h) => ({ text: clean(h), options: { bold: true, color: 'FFFFFF', fill: { color: C.navy } } }));
      const body = s.table.slice(1).map((r) => r.map((c) => ({ text: clean(c), options: { color: C.ink } })));
      sl.addTable([header, ...body], { x: 0.8, y: 1.9, w: 11.7, fontFace: FONT, fontSize: 16, border: { type: 'solid', pt: 0.75, color: C.line }, valign: 'middle', margin: 0.08 });
    } else if (s.bullets && s.bullets.length) {
      const size = bodySize(s.bullets);
      sl.addText(
        s.bullets.map((b) => ({ text: clean(b), options: { bullet: { indent: 22 }, breakLine: true, paraSpaceAfter: 10 } })),
        { x: 0.8, y: 1.85, w: 11.7, h: 4.9, fontFace: FONT, fontSize: size, color: C.ink, valign: 'top', fit: 'shrink' }
      );
    }
    if (s.notes) sl.addNotes(clean(s.notes));
  }
  const out = await pres.write({ outputType: 'nodebuffer' });
  return Buffer.from(out);
}

module.exports = { textToSlides, rowsToSlides, productsToSlides, deckFromAi, buildPptx, MAX_SLIDES };
