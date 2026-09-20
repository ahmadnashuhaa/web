'use strict';
/**
 * Semua slash command (Master Prompt bagian 13-38) + bahasa natural + memori sesi.
 * Prinsip biaya: semua yang bisa dikerjakan TANPA AI dikerjakan kode biasa (gratis, cepat, pasti).
 * AI (Gemini gratis) hanya dipakai untuk pekerjaan bahasa: ringkas, parafrase, terjemah, kuis, dsb.
 *
 * Untuk semua pengguna, chat pribadi saja (dijaga oleh limits.js). Data tiap pengguna dipisah per user ID.
 */
const { InputFile, InlineKeyboard } = require('grammy');
const config = require('./config');
const store = require('./store');
const { esc } = require('./telegram-utils');
const ai = require('./ai-client');
const ft = require('./file-tools');
const pt = require('./product-tools');
const mk = require('./market');
const pptxTools = require('./pptx-tools');
const { slugify } = require('./product-draft');

const guard = (ctx) => Boolean(ctx.from) && ctx.chat && ctx.chat.type === 'private';

/* ============================================================
 * Teks bantuan
 * ============================================================ */
const MENU = [
  '📋 <b>Menu Dukion Bot</b>',
  '',
  '📦 <b>Product</b>',
  '/product analyze → pisahkan produk / varian / atribut',
  '/product validate · import · export [json|csv|xlsx|pptx]',
  '',
  '📁 <b>File</b> (kirim file dulu, lalu perintah → atau balas file-nya)',
  '/file extract · search · compare · list',
  '/file convert · merge · split · rename · compress · merge-text',
  '/file summarize · paraphrase · clean · translate',
  '',
  '📝 <b>Doc</b>',
  '/doc summarize · paraphrase · rewrite · grammar · translate',
  '/doc format · extract · outline · references · cite · convert',
  '📽️ <b>/doc slides</b> → buat presentasi PowerPoint (.pptx) dari topik atau dokumen',
  '',
  '🎓 <b>Study</b>',
  '/study explain · summarize · quiz · answer · flashcard · outline · research · cite · slides',
  '',
  '💻 <b>Code</b>',
  '/code explain · debug · review · refactor · convert · format · optimize · error',
  '',
  '📊 <b>Market</b>',
  '/market price · technical · compare · portfolio · news · research · fundamentals · summarize',
  '',
  '⚙️ <b>Utility</b>',
  '/settings · /history · /undo · /cancel · /help · /menu',
  '',
  'Bahasa biasa juga bisa: "ubah PDF ini jadi Word", "gabungkan dua file ini", "buat lebih formal", "buatkan presentasi tentang pemasaran digital 8 slide".',
  'Ketik perintahnya saja (mis. <code>/file</code>) untuk melihat sub-perintah dan contohnya.',
].join('\n');

const GROUP_HELP = {
  product: [
    '📦 <b>/product</b>',
    '/product analyze &lt;teks&gt; → analisis (atau balas teks/file)',
    '/product validate → periksa duplikat, varian salah tempat, data kosong',
    '/product import → impor dari file csv/xlsx/json (baris bernama sama = varian)',
    '/product export [json|csv|xlsx|pptx] → kirim hasil terakhir sebagai file (pptx = katalog, satu slide per produk)',
    'Contoh input: "Kaos Oversize", lalu baris warna/ukuran di bawahnya. Pisahkan produk dengan baris kosong.',
  ],
  file: [
    '📁 <b>/file</b> → kirim file lebih dulu (atau balas file), lalu:',
    '/file extract → ambil teks (gratis; gambar/scan memakai AI)',
    '/file search &lt;kata&gt; · /file compare · /file list',
    '/file convert &lt;format&gt; → pdf, docx, pptx, txt, md, csv, xlsx, json',
    '/file merge [nomor…|all] [teks sampul] · /file split &lt;1-3,5 | each | per 5&gt;',
    '/file rename &lt;nama&gt; · /file compress [all] · /file merge-text &lt;teks&gt; (awalan "akhir:" = di akhir)',
    '/file summarize · paraphrase · clean · translate &lt;bahasa&gt; → memakai AI',
    'Opsi hasil: tambahkan --docx / --pdf / --pptx / --txt untuk mendapat file.',
  ],
  doc: [
    '📝 <b>/doc</b> &lt;sub&gt; &lt;teks&gt; (atau balas teks/file)',
    'summarize · paraphrase · rewrite · grammar · translate &lt;bahasa&gt;',
    'format · extract · outline · references · cite · convert',
    '📽️ <code>/doc slides &lt;topik&gt; [8 slide]</code> → presentasi PowerPoint (atau balas dokumen/teks). Alias: /ppt, /slides, /presentasi',
    'Tambahkan instruksi setelah sub, mis. <code>/doc rewrite lebih formal</code> (saat membalas file).',
  ],
  study: ['🎓 <b>/study</b> &lt;sub&gt; &lt;teks/topik&gt;', 'explain · summarize · quiz · answer · flashcard · outline · research · cite · slides'],
  code: ['💻 <b>/code</b> &lt;sub&gt; &lt;kode&gt;', 'explain · debug · review · refactor · convert &lt;bahasa&gt; · format · optimize · error'],
  market: [
    '📊 <b>/market</b> &lt;sub&gt;',
    '/market price BBCA · technical AAPL · compare BBCA TLKM',
    '/market portfolio BBCA 40, TLKM 30, BTC 30',
    '/market news bitcoin · research BBCA · fundamentals BBCA (atau balas laporan keuangan)',
    '/market summarize (balas artikel/laporan)',
    'Simbol: saham IDX "BBCA", US "AAPL", kripto "BTC", indeks "IHSG", emas "emas", kurs "USDIDR".',
  ],
};

const NEEDS_STORE =
  'Fitur ini butuh penyimpanan sesi (Upstash Redis) yang belum dipasang, supaya bot bisa mengingat file yang Anda kirim. Cara paling mudah: balas (reply) file yang dimaksud dengan perintahnya.';

/* ============================================================
 * Util pengiriman
 * ============================================================ */
function splitMessage(text, max = 3800) {
  const chunks = [];
  let rest = String(text);
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = max;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function replyChunked(ctx, text) {
  for (const c of splitMessage(text)) await ctx.reply(c);
}

async function sendFile(ctx, buf, name, caption) {
  await ctx.replyWithDocument(new InputFile(buf, name), caption ? { caption: caption.slice(0, 1000) } : undefined);
}

/** Kirim teks; kalau panjang atau diminta format file, kirim sebagai file. */
async function deliverText(ctx, text, { fmt = null, base = 'hasil', limit = 3800 } = {}) {
  if (fmt === 'txt') return sendFile(ctx, Buffer.from(text, 'utf8'), `${base}.txt`);
  if (fmt === 'docx' || fmt === 'pdf' || fmt === 'pptx') {
    const r = await ft.convertBuffer('txt', Buffer.from(text, 'utf8'), fmt, { baseName: base });
    if (!r.error) return sendFile(ctx, r.buf, r.name);
  }
  if (text.length > 12000) {
    await sendFile(ctx, Buffer.from(text, 'utf8'), `${base}.txt`, 'Hasilnya panjang, jadi saya kirim sebagai file.');
    return;
  }
  return text.length > limit ? replyChunked(ctx, text) : ctx.reply(text);
}

/* ============================================================
 * Sesi: file terakhir, teks terakhir, riwayat, produk
 * ============================================================ */
const FILE_TTL = 3600;
const LAST_TTL = 3600;
const HIST_TTL = 86400;
const GROUP_GAP = 10 * 60 * 1000;
const K = {
  files: (u) => `files:${u}`,
  last: (u) => `lastctx:${u}`,
  hist: (u) => `cmdhist:${u}`,
  prod: (u) => `lastproduct:${u}`,
  prev: (u) => `prevproduct:${u}`,
  ack: (u) => `ack:${u}`,
  pend: (u) => `pendconv:${u}`,
};

function recordFromMessage(msg) {
  if (!msg) return null;
  if (msg.document) {
    return { m: msg.message_id, id: msg.document.file_id, n: msg.document.file_name || `file-${msg.message_id}`, mime: msg.document.mime_type || '', t: Date.now(), k: 'doc' };
  }
  if (msg.photo && msg.photo.length) {
    const p = msg.photo[msg.photo.length - 1];
    return { m: msg.message_id, id: p.file_id, n: `foto-${msg.message_id}.jpg`, mime: 'image/jpeg', t: Date.now(), k: 'photo' };
  }
  return null;
}

async function addFile(uid, rec) {
  if (store.enabled) await store.push(K.files(uid), JSON.stringify(rec), FILE_TTL);
}

async function listFiles(uid) {
  if (!store.enabled) return [];
  const raw = (await store.list(K.files(uid))) || [];
  const seen = new Set();
  const out = [];
  for (const r of raw) {
    try {
      const it = JSON.parse(r);
      if (!seen.has(it.m)) {
        seen.add(it.m);
        out.push(it);
      }
    } catch (_) { /* abaikan */ }
  }
  return out.sort((a, b) => a.t - b.t).slice(-12);
}

/** File yang dikirim berdekatan (jarak antar file <= 10 menit) dianggap satu sesi. */
function sessionGroup(files) {
  if (!files.length) return [];
  const g = [files[files.length - 1]];
  for (let i = files.length - 2; i >= 0; i--) {
    if (g[0].t - files[i].t <= GROUP_GAP) g.unshift(files[i]);
    else break;
  }
  return g;
}

async function setLast(uid, text) {
  if (store.enabled) await store.set(K.last(uid), JSON.stringify({ t: Date.now(), text: text.slice(0, 60000) }), LAST_TTL);
}
async function getLast(uid) {
  if (!store.enabled) return null;
  try {
    return JSON.parse((await store.get(K.last(uid))) || 'null');
  } catch (_) {
    return null;
  }
}

async function logHistory(uid, line) {
  if (!store.enabled) return;
  await store.push(K.hist(uid), JSON.stringify({ t: Date.now(), c: String(line).slice(0, 120) }), HIST_TTL);
}

async function saveProducts(uid, obj) {
  if (!store.enabled) return;
  const prev = await store.get(K.prod(uid));
  if (prev) await store.set(K.prev(uid), prev, HIST_TTL);
  await store.set(K.prod(uid), JSON.stringify(obj), HIST_TTL);
}
async function loadProducts(uid) {
  if (!store.enabled) return null;
  try {
    return JSON.parse((await store.get(K.prod(uid))) || 'null');
  } catch (_) {
    return null;
  }
}

/* ============================================================
 * Membaca isi file / pesan
 * ============================================================ */
function friendlyFileError(e) {
  const d = String((e && (e.description || e.message)) || '');
  if (/too big/i.test(d)) return 'File lebih besar dari 20 MB → itu batas unduhan bot Telegram. Kirim file yang lebih kecil.';
  return 'File belum dapat diunduh dari Telegram. Coba kirim ulang file-nya.';
}

async function downloadBuffer(ctx, rec) {
  const file = await ctx.api.getFile(rec.id);
  const res = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${file.file_path}`);
  if (!res.ok) throw new Error('unduh gagal');
  return Buffer.from(await res.arrayBuffer());
}

const OCR_SYSTEM =
  'Transkripsikan SELURUH teks yang terlihat pada gambar/dokumen ini apa adanya. Jangan meringkas dan jangan menambah komentar. ' +
  'Pertahankan urutan baca dan susunan baris/tabel sebisanya. Jika tidak ada teks sama sekali, tulis persis: [TIDAK ADA TEKS]';
const OCR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']);

async function ocr(buf, mime) {
  if (!OCR_MIMES.has(mime)) return { ok: false, reason: `Format gambar ${mime} belum bisa dibaca AI (yang bisa: JPG, PNG, WEBP, HEIC, PDF).` };
  const r = await ai.askWithFileSafe(OCR_SYSTEM, 'Transkripsikan isi dokumen ini.', { mimeType: mime, buffer: buf }, { maxTokens: 4000 });
  if (!r.ok) return { ok: false, reason: `Ini gambar/scan sehingga perlu AI (OCR). ${r.reason}` };
  if (/^\[TIDAK ADA TEKS\]/i.test(r.text)) return { ok: false, reason: 'Tidak ada teks yang terbaca di gambar/dokumen itu.' };
  return { ok: true, text: r.text };
}

/** Unduh + baca teks sebuah file. { ok, text, truncated, ocr, kind, buf } atau { ok:false, reason }. */
async function readRecord(ctx, rec, { limit = 50000, keepBuffer = false } = {}) {
  const kind = ft.kindOf(rec.n, rec.mime);
  if (kind === 'unknown') return { ok: false, reason: `Format "${rec.n}" belum bisa dibaca. Yang didukung: ${ft.SUPPORTED_READ}.` };
  let buf;
  try {
    buf = await downloadBuffer(ctx, rec);
  } catch (e) {
    return { ok: false, reason: friendlyFileError(e) };
  }
  let text = '';
  let usedOcr = false;
  if (kind === 'image') {
    const r = await ocr(buf, rec.mime || 'image/jpeg');
    if (!r.ok) return r;
    text = r.text;
    usedOcr = true;
  } else {
    try {
      text = await ft.extractText(kind, buf);
    } catch (e) {
      console.error('[readRecord]', kind, e && e.message);
      return { ok: false, reason: `File ${kind.toUpperCase()} itu tidak bisa dibuka (mungkin rusak atau diproteksi password).` };
    }
    if (!text.trim() && kind === 'pdf') {
      const r = await ocr(buf, 'application/pdf');
      if (!r.ok) return { ok: false, reason: `PDF ini tampaknya hasil scan (tidak ada teks). ${r.reason}` };
      text = r.text;
      usedOcr = true;
    }
  }
  if (!text.trim()) return { ok: false, reason: 'File itu tidak berisi teks yang bisa dibaca.' };
  const truncated = text.length > limit;
  return { ok: true, text: truncated ? text.slice(0, limit) : text, truncated, ocr: usedOcr, kind, buf: keepBuffer ? buf : undefined };
}

/** File yang dimaksud: file di pesan ini > file yang dibalas > file terbaru di sesi. */
async function findRecord(ctx, msg) {
  const own = recordFromMessage(msg);
  if (own) return own;
  const rep = msg && recordFromMessage(msg.reply_to_message);
  if (rep) return rep;
  const files = await listFiles(String(ctx.from.id));
  return files[files.length - 1] || null;
}

/**
 * Kumpulkan bahan kerja untuk tugas teks.
 * Aturan (bagian 20-21): file di pesan ini > balasan > teks di argumen > sesi terakhir.
 * Kalau bahan berasal dari file/balasan, sisa argumen = INSTRUKSI tambahan; kalau tidak, argumen = isi.
 */
async function gatherContent(ctx, msg, rest, { limit = 50000 } = {}) {
  const uid = String(ctx.from.id);
  let rec = recordFromMessage(msg);
  let source = rec ? 'msg' : null;
  const reply = msg && msg.reply_to_message;
  if (!rec && reply) {
    rec = recordFromMessage(reply);
    if (rec) source = 'reply';
    else if (reply.text || reply.caption) return { text: reply.text || reply.caption, instruction: rest || null, source: 'reply' };
  }
  if (rec) {
    const r = await readRecord(ctx, rec, { limit });
    if (!r.ok) return { error: r.reason };
    return { text: r.text, name: rec.n, truncated: r.truncated, instruction: rest || null, source, rec };
  }
  if (rest) return { text: rest, instruction: null, source: 'arg' };

  const last = await getLast(uid);
  const files = await listFiles(uid);
  const newest = files[files.length - 1];
  if (newest && (!last || newest.t > last.t)) {
    const r = await readRecord(ctx, newest, { limit });
    if (!r.ok) return { error: r.reason };
    return { text: r.text, name: newest.n, truncated: r.truncated, instruction: null, source: 'last', rec: newest };
  }
  if (last) return { text: last.text.slice(0, limit), instruction: null, source: 'last' };
  return { text: null };
}

const noContentMsg = (what) =>
  `Belum ada bahan untuk ${what}. Kirim file atau tempel teksnya, atau balas (reply) pesan/file yang dimaksud dengan perintahnya.`;

/* ============================================================
 * Prompt AI
 * ============================================================ */
const COMMON = ' Jangan mengarang fakta, angka, sumber, atau kutipan. Jika informasi kurang, sebutkan apa yang kurang. Jawab dalam Bahasa Indonesia kecuali diminta lain.';

const DOC = {
  summarize: 'Ringkas teks berikut dengan jelas dan padat: 1 kalimat inti, lalu poin-poin penting.',
  paraphrase: 'Parafrasekan teks berikut dengan kata-kata baru, MAKNA HARUS SAMA, tanpa menambah atau menghilangkan informasi. Tampilkan hasilnya saja.',
  rewrite: 'Tulis ulang teks berikut agar lebih jelas, rapi, dan profesional. Pertahankan makna dan fakta. Tampilkan hasilnya saja.',
  grammar: 'Perbaiki ejaan, tata bahasa, dan tanda baca teks berikut (PUEBI untuk Bahasa Indonesia). Tampilkan teks yang sudah diperbaiki, lalu daftar singkat perubahan penting.',
  translate: 'Terjemahkan teks berikut ke {lang}. Pertahankan makna, nada, dan format. Tampilkan terjemahannya saja.',
  format: 'Rapikan format teks berikut (judul, paragraf, daftar) tanpa mengubah isi. Tampilkan hasilnya saja.',
  extract: 'Ekstrak poin-poin kunci: fakta utama, angka/tanggal/nama penting, dan kesimpulan. Format daftar bernomor.',
  outline: 'Susun outline hierarkis (bab → subbab → poin) dari teks/topik berikut.',
  references:
    'Bantu menyusun daftar pustaka: (1) kalau teks sudah memuat referensi, rapikan ke format APA tanpa menambah data yang tidak ada; (2) kalau belum, tunjukkan klaim/bagian yang butuh rujukan dan sarankan KATA KUNCI pencarian serta JENIS sumber (mis. Google Scholar, Garuda, DOAJ). ' +
    'JANGAN mengarang judul, penulis, tahun, penerbit, atau DOI.',
  cite: 'Bantu format sitasi (APA 7 kecuali diminta lain) dari data yang diberikan. Pakai HANYA data yang ada; bagian yang tidak diketahui tulis [belum ada data]. Jangan mengarang sumber.',
};
DOC.citation = DOC.cite;

const STUDY = {
  explain: 'Jelaskan konsep berikut untuk pelajar dengan urutan: KONSEP (definisi sederhana) → CONTOH → PENJELASAN (kenapa begitu) → LATIHAN (1-2 soal singkat) → lalu tawarkan umpan balik atas jawaban mereka.',
  summarize: 'Ringkas materi berikut untuk belajar: poin utama, istilah penting + artinya, dan 3 hal yang paling sering ditanyakan.',
  quiz: 'Buat 5 soal latihan pilihan ganda (A-D) dari materi berikut, tingkat menengah. Beri kunci jawaban + alasan singkat di bagian akhir.',
  answer:
    'Bantu pengguna MEMAHAMI cara menjawab soal berikut dengan urutan: konsep → contoh → penjelasan → latihan → umpan balik. ' +
    'Jika ini soal latihan atau tugas pemrograman, JANGAN langsung memberi jawaban final: beri petunjuk bertahap dan ajak pengguna mencoba dulu. Jika pengguna sudah menulis jawaban, beri umpan balik.',
  flashcard: 'Buat 8-10 flashcard dari materi berikut. Format: "P: ..." lalu "J: ..." untuk tiap kartu.',
  outline: 'Susun outline belajar hierarkis dari materi/topik berikut.',
  research: 'Bantu susun kerangka penelitian dari topik berikut: latar belakang, rumusan masalah, tujuan, kajian pustaka (topik yang perlu dicari, TANPA mengarang sumber), metode, dan sistematika. Jangan mengarang referensi atau data.',
  cite: DOC.cite,
};

const CODE = {
  explain: 'Jelaskan kode berikut baris demi baris secara ringkas: tujuan, alur, dan bagian penting.',
  debug: 'Cari bug pada kode/error berikut. Urutan jawaban: 1) penyebab, 2) bagian yang bermasalah, 3) perbaikan (tampilkan kode yang diubah saja, jangan tulis ulang seluruh proyek), 4) kenapa perbaikan itu bekerja.',
  review: 'Review kode berikut: bug potensial, keamanan, keterbacaan, dan saran perbaikan, urut dari yang paling penting.',
  refactor: 'Refactor kode berikut agar lebih bersih TANPA mengubah perilaku dan sebanyak mungkin mempertahankan struktur/fungsi yang ada. Tampilkan hasil + ringkasan perubahan.',
  convert: 'Konversi kode berikut ke {lang}. Pertahankan logika dan perilaku; jelaskan singkat perbedaan penting. Tampilkan kode hasil.',
  format: 'Rapikan format kode berikut (indentasi, spasi, penamaan yang konsisten) tanpa mengubah perilaku. Tampilkan kode hasil saja.',
  optimize: 'Optimalkan kode berikut (kecepatan/memori/keterbacaan). Jelaskan apa yang diubah dan dampaknya. Pertahankan perilaku.',
  error: 'Jelaskan pesan error berikut dengan bahasa sederhana: artinya, penyebab paling umum, dan langkah memperbaikinya.',
};

const FILE_AI = {
  summarize: DOC.summarize,
  paraphrase: DOC.paraphrase,
  clean: 'Bersihkan teks hasil ekstraksi file berikut: hapus header/footer/nomor halaman berulang, sambung kata/kalimat yang terpotong, rapikan paragraf. Jangan mengubah isi. Tampilkan hasilnya saja.',
  translate: DOC.translate,
};

const PRODUCT_SYSTEM =
  'Kamu adalah pengurai data produk. Ikuti aturan: JANGAN menganggap 1 baris = 1 produk. Warna, ukuran, rasa, tipe, kapasitas, level, paket, kategori, dan pilihan adalah VARIAN/ATRIBUT dari produk induk, BUKAN produk baru. ' +
  'Kalau ada beberapa produk, tiap produk berdiri sendiri. Jangan mengarang harga, stok, SKU, atau nama. Data tidak ada → null. ' +
  'Jawab HANYA JSON tanpa teks lain dengan bentuk: {"products":[{"name":"","description":"","category":"","variants":{"color":[],"size":[]},"attributes":{},"sku":null,"price":null,"stock":null}],"clarification":null}. ' +
  'variants adalah objek: kunci = jenis varian (color, size, storage, flavor, option...), nilai = array. Jika struktur benar-benar ambigu dan bisa mengubah hasil, isi "clarification" dengan 1 pertanyaan singkat (opsi A/B) dan boleh kosongkan products.';

const MARKET_SUMMARY_SYSTEM =
  'Ringkas teks pasar/berita/laporan berikut. Pisahkan tegas: FAKTA (yang tertulis di teks), INTERPRETASI (penilaian penulis/analis, atau kesimpulan wajar), KETIDAKPASTIAN (hal yang tidak diketahui/perlu dicek). ' +
  'Jangan menambah data di luar teks, jangan memberi perintah membeli/menjual. Sebutkan tanggal/periode jika ada di teks.' + COMMON;

const RESEARCH_SYSTEM =
  'Kamu asisten riset pasar. Gunakan HANYA data pada pesan pengguna (harga, indikator, judul berita); dilarang menambah angka, berita, atau laporan keuangan dari ingatanmu. ' +
  'Susun jawaban dengan tiga bagian berjudul: FAKTA (ringkas dari data), INTERPRETASI (apa arti data itu secara netral, sebut hal yang mendukung DAN yang bertentangan), KETIDAKPASTIAN (apa yang tidak diketahui: fundamental, kondisi pasar, kualitas berita). ' +
  'Judul berita hanya petunjuk topik, bukan bukti isi artikel. Jangan memberi perintah/rekomendasi membeli atau menjual atau target harga.' + COMMON;

const FUNDAMENTALS_SYSTEM =
  'Analisis dokumen keuangan/perusahaan berikut HANYA dari isi dokumen. Susun bertahap: PROFIL BISNIS → PENDAPATAN → PROFITABILITAS → NERACA → ARUS KAS → VALUASI → PERTUMBUHAN → RISIKO → KATALIS → BERITA TERKAIT → KESIMPULAN FAKTA. ' +
  'Bagian yang tidak ada datanya di dokumen tulis "tidak ada di dokumen". Untuk tiap bagian pisahkan FAKTA (angka/kalimat dari dokumen), INTERPRETASI, dan KETIDAKPASTIAN. Sebut periode laporan. ' +
  'Jangan mengubah analisis menjadi perintah membeli atau menjual.' + COMMON;

/* ============================================================
 * Parsing perintah
 * ============================================================ */
function parseSub(rest, allowed) {
  const m = String(rest || '').trim().match(/^(\S+)\s*([\s\S]*)$/);
  if (!m) return { sub: null, rest: '' };
  const first = m[1].toLowerCase().replace(/^\//, '');
  if (allowed.includes(first)) return { sub: first, rest: m[2].trim() };
  return { sub: null, rest: String(rest).trim(), unknown: first };
}

function takeFlag(args) {
  const m = args.match(/(?:^|\s)--(file|txt|docx|pdf|pptx)\b/i);
  if (!m) return { fmt: null, args };
  const f = m[1].toLowerCase();
  return { fmt: f === 'file' ? 'docx' : f, args: args.replace(m[0], ' ').trim() };
}

const TARGET_WORDS = {
  pdf: 'pdf', docx: 'docx', doc: 'docx', word: 'docx', txt: 'txt', teks: 'txt', text: 'txt', md: 'md', markdown: 'md',
  csv: 'csv', xlsx: 'xlsx', excel: 'xlsx', xls: 'xlsx', json: 'json',
  pptx: 'pptx', ppt: 'pptx', powerpoint: 'pptx', slide: 'pptx', slides: 'pptx', presentasi: 'pptx',
};
function parseTarget(text) {
  const words = String(text || '').toLowerCase().match(/[a-z]+/g) || [];
  let t = null;
  for (const w of words) if (TARGET_WORDS[w]) t = TARGET_WORDS[w];
  return t;
}

function parseSelection(rest) {
  const toks = String(rest || '').trim().split(/\s+/).filter(Boolean);
  const picks = [];
  let all = false;
  let i = 0;
  for (; i < toks.length; i++) {
    if (/^\d+$/.test(toks[i])) picks.push(Number(toks[i]));
    else if (/^(all|semua)$/i.test(toks[i])) all = true;
    else break;
  }
  return { picks, all, leftover: toks.slice(i).join(' ').replace(/^(teks|dengan teks)\s*:?\s*/i, '').trim() };
}

const listGroupText = (group, olderCount) =>
  [
    '📎 File di sesi ini (urut kirim):',
    ...group.map((f, i) => `${i + 1}. ${f.n}`),
    ...(olderCount > 0 ? [`(+${olderCount} file lebih lama, di luar sesi ini)`] : []),
  ].join('\n');

/* ============================================================
 * /doc /study /code (+ /file summarize dsb.) → tugas AI
 * ============================================================ */
async function aiTask(ctx, msg, { table, sub, rest, label }) {
  let { fmt, args } = takeFlag(rest);
  let lang = null;
  if (sub === 'translate' || (table === CODE && sub === 'convert')) {
    const m = args.match(/^(\S+)\s*([\s\S]*)$/);
    if (!m) return ctx.reply(`Sebutkan bahasa tujuannya. Contoh: /${label} ${sub} ${table === CODE ? 'python' : 'inggris'}`);
    lang = m[1];
    args = m[2].trim();
  }
  const c = await gatherContent(ctx, msg, args);
  if (c.error) return ctx.reply(c.error);
  if (!c.text) return ctx.reply(noContentMsg(`/${label} ${sub}`));

  let system = table[sub].replace('{lang}', lang || '') + COMMON;
  if (c.instruction) system += `\n\nInstruksi tambahan dari pengguna (ikuti bila tidak bertentangan dengan aturan di atas): ${c.instruction}`;

  await ctx.reply('⏳ Sedang diproses...');
  const r = await ai.askSafe(system, c.text, { maxTokens: 2000 });
  let out;
  if (r.ok) {
    out = r.text;
  } else if (sub === 'summarize') {
    const s = ft.extractiveSummary(c.text, 6);
    if (!s.length) return ctx.reply(`${r.reason}\nSaya juga belum bisa membuat ringkasan sederhana dari teks sependek itu.`);
    out = `${r.reason}\n\nSebagai gantinya, ini ringkasan sederhana (memilih kalimat penting, tanpa AI):\n\n${s.map((x) => `• ${x}`).join('\n')}`;
  } else {
    return ctx.reply(r.reason);
  }
  if (c.truncated) out += `\n\n(Catatan: hanya bagian awal dokumen yang diproses karena sangat panjang.)`;
  const base = c.name ? `${c.name.replace(/\.[^.]+$/, '')}-${sub}` : `${label}-${sub}`;
  return deliverText(ctx, out, { fmt, base });
}

/* ============================================================
 * /doc slides → presentasi PowerPoint (AI menyusun isi, kode membuat file .pptx)
 * ============================================================ */
const DECK_ALIASES = ['slides', 'slide', 'ppt', 'pptx', 'powerpoint', 'presentasi'];

const deckSystem = ({ topicOnly, n }) =>
  'Kamu penyusun presentasi. ' +
  (topicOnly
    ? 'Susun presentasi tentang topik dari pengguna memakai pengetahuan umum yang aman. JANGAN mengarang angka statistik, nama orang/perusahaan, kutipan, atau sumber. Bila butuh data spesifik, tulis "[isi data]" agar pengguna melengkapi sendiri. '
    : 'Susun presentasi HANYA dari isi bahan yang diberikan. Jangan menambah fakta, angka, atau sumber di luar bahan. ') +
  `Jumlah slide isi: ${n ? `tepat ${n}` : '6 sampai 10'} (tidak termasuk slide judul). Tiap slide: judul singkat (maks 8 kata), 3 sampai 5 poin (maks 15 kata per poin, bukan paragraf), dan "notes" berisi catatan pembicara 1-2 kalimat. ` +
  'Slide pertama isi sebaiknya pembukaan/latar belakang dan slide terakhir kesimpulan atau langkah berikutnya. Gunakan bahasa yang sama dengan bahan/topik (default Bahasa Indonesia). ' +
  'Jawab HANYA JSON tanpa teks lain: {"title":"","subtitle":"","slides":[{"title":"","bullets":["",""],"notes":""}]}.';

async function deckCommand(ctx, msg, rest) {
  const uid = String(ctx.from.id);
  let args = takeFlag(rest).args;
  let n = null;
  const nm = args.match(/\b(\d{1,2})\s*(slide|slides|halaman|lembar)\b/i);
  if (nm) {
    n = Math.min(Math.max(Number(nm[1]), 3), 30);
    args = args.replace(nm[0], ' ').replace(/\s+/g, ' ').trim();
  }
  const c = await gatherContent(ctx, msg, args);
  if (c.error) return ctx.reply(c.error);
  if (!c.text) return ctx.reply(`Belum ada bahan untuk presentasi. Tulis topiknya (mis. /doc slides strategi pemasaran toko online 8 slide), atau kirim/balas file dokumennya.`);

  const topicOnly = c.source === 'arg' && c.text.length < 300 && !c.text.includes('\n');
  let system = deckSystem({ topicOnly, n });
  if (c.instruction) system += `\n\nInstruksi tambahan dari pengguna (ikuti bila tidak bertentangan dengan aturan di atas): ${c.instruction}`;

  await ctx.reply('⏳ Menyusun presentasi...');
  const r = await ai.askSafe(system + COMMON, topicOnly ? `Topik: ${c.text}` : `Bahan:\n${c.text}`, { maxTokens: 3500 });
  let deck = r.ok ? pptxTools.deckFromAi(parseJsonLoose(r.text)) : null;
  let note = null;
  if (!deck) {
    if (topicOnly) return ctx.reply(r.ok ? 'AI tidak memberi susunan yang bisa dibaca. Coba lagi, atau tulis topiknya lebih spesifik.' : r.reason);
    // Ada bahan berupa dokumen/teks: tetap bisa dibuatkan slide tanpa AI (kurang rapi, tapi gratis).
    const t = pptxTools.textToSlides(c.text, { title: c.name ? c.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') : '' });
    deck = t.deck;
    note = `${r.ok ? 'Hasil AI tidak bisa dibaca' : r.reason} Jadi slide dibuat otomatis dari teks tanpa AI (kurang rapi).`;
  }
  if (!deck.slides.length) return ctx.reply('Bahannya terlalu sedikit untuk dijadikan slide.');

  const buf = await pptxTools.buildPptx(deck);
  await logHistory(uid, `slides: ${deck.slides.length} slide`);
  const titles = deck.slides.slice(0, 12).map((s, i) => `${i + 1}. ${s.title}`).join('\n');
  const more = deck.slides.length > 12 ? `\n…dan ${deck.slides.length - 12} slide lainnya` : '';
  const cap = [
    `✅ Presentasi siap: ${deck.slides.length} slide isi + 1 slide judul`,
    titles + more,
    note,
    c.truncated ? 'Catatan: hanya bagian awal dokumen yang diproses karena sangat panjang.' : null,
    'Buka di PowerPoint, lalu ganti tampilan lewat Design → Themes bila perlu. Cek ulang isinya sebelum dipakai.',
  ].filter(Boolean).join('\n');
  return sendFile(ctx, buf, `${slugify(deck.title)}.pptx`, cap);
}

async function taskCommand(ctx, msg, group, table, rest) {
  const subs = Object.keys(table);
  const extra = group === 'doc' ? ['convert', ...DECK_ALIASES] : group === 'study' ? DECK_ALIASES : [];
  const { sub, rest: r, unknown } = parseSub(rest, [...subs, ...extra]);
  if (!sub) {
    const help = GROUP_HELP[group].join('\n');
    return ctx.reply(unknown ? `Sub-perintah "${unknown}" belum saya kenal.\n\n${help}` : help, { parse_mode: 'HTML' });
  }
  if (group === 'doc' && sub === 'convert') return fileConvert(ctx, msg, r);
  if (DECK_ALIASES.includes(sub)) return deckCommand(ctx, msg, r);
  return aiTask(ctx, msg, { table, sub: sub === 'citation' ? 'cite' : sub, rest: r, label: group });
}

/* ============================================================
 * /file
 * ============================================================ */
async function fileExtract(ctx, msg, rest) {
  const { fmt } = takeFlag(rest);
  const c = await gatherContent(ctx, msg, '', { limit: 500000 });
  if (c.error) return ctx.reply(c.error);
  if (!c.text) return ctx.reply(noContentMsg('mengambil teks'));
  const base = (c.name || 'teks').replace(/\.[^.]+$/, '') + '-teks';
  const head = c.rec && c.rec.n ? `📄 ${c.rec.n} → ${c.text.length.toLocaleString('id-ID')} karakter${c.truncated ? ' (dipotong)' : ''}\n\n` : '';
  if (fmt) return deliverText(ctx, c.text, { fmt, base });
  if (c.text.length <= 3500) return ctx.reply(head + c.text);
  await sendFile(ctx, Buffer.from(c.text, 'utf8'), `${base}.txt`, `${head}Teksnya panjang, jadi dikirim sebagai file.`.trim());
}

async function fileSearch(ctx, msg, rest) {
  if (!rest) return ctx.reply('Kata apa yang dicari? Contoh: /file search kesimpulan');
  const c = await gatherContent(ctx, msg, '', { limit: 1000000 });
  if (c.error) return ctx.reply(c.error);
  if (!c.text) return ctx.reply(noContentMsg('pencarian'));
  const r = ft.searchText(c.text, rest, 15);
  if (!r.total) return ctx.reply(`Tidak ada baris yang memuat "${rest}"${c.name ? ` di ${c.name}` : ''}.`);
  const L = [`🔎 "${rest}"${c.name ? ` di ${c.name}` : ''}: ${r.total} baris cocok (${r.mode})`, ''];
  r.hits.forEach((h) => L.push(`• baris ${h.line}: ${h.text.length > 160 ? h.text.slice(0, 157) + '…' : h.text}`));
  if (r.total > r.hits.length) L.push(`…dan ${r.total - r.hits.length} baris lain. Persempit kata kuncinya.`);
  return replyChunked(ctx, L.join('\n'));
}

/** Ambil `n` file dari sesi; kalau ambigu, tanyakan (bagian 20). Mengembalikan array atau null (sudah membalas). */
async function pickFromSession(ctx, rest, { min, max, autoMax, verb, cmd }) {
  if (!store.enabled) {
    await ctx.reply(NEEDS_STORE);
    return null;
  }
  const uid = String(ctx.from.id);
  const files = await listFiles(uid);
  const group = sessionGroup(files);
  const older = files.length - group.length;
  const sel = parseSelection(rest);
  let chosen;
  if (sel.picks.length) {
    chosen = sel.picks.map((i) => group[i - 1]);
    if (chosen.some((x) => !x)) {
      await ctx.reply(`Ada nomor yang tidak valid.\n\n${listGroupText(group, older)}`);
      return null;
    }
  } else if (sel.all) chosen = group;
  else if (group.length >= min && group.length <= (autoMax || max || min)) chosen = group;
  else if (group.length < min) {
    await ctx.reply(`Untuk ${verb} saya butuh minimal ${min} file, tetapi baru ada ${group.length} di sesi ini. Kirim file lainnya dulu.` + (older > 0 ? `\n(${older} file lama di luar sesi tidak ikut dihitung.)` : ''));
    return null;
  } else {
    await ctx.reply(`${listGroupText(group, older)}\n\nAda ${group.length} file → yang mana yang ${verb}? Contoh: /file ${cmd} 1 3${cmd === 'merge' ? '  (atau /file merge all untuk semuanya)' : ''}`);
    return null;
  }
  if (chosen.length < min || (max && chosen.length > max)) {
    await ctx.reply(`Untuk ${verb} dibutuhkan ${max && max === min ? `tepat ${min}` : `minimal ${min}`} file. Anda memilih ${chosen.length}.`);
    return null;
  }
  return { chosen, leftover: sel.leftover };
}

async function fileList(ctx) {
  if (!store.enabled) return ctx.reply(NEEDS_STORE);
  const files = await listFiles(String(ctx.from.id));
  if (!files.length) return ctx.reply('Belum ada file di sesi ini. Kirim file ke chat ini dulu.');
  const group = sessionGroup(files);
  return ctx.reply(`${listGroupText(group, files.length - group.length)}\n\nGunakan nomornya, mis. /file merge 1 3 · /file compare 1 2`);
}

async function fileCompare(ctx, msg, rest) {
  const p = await pickFromSession(ctx, rest, { min: 2, max: 2, verb: 'dibandingkan', cmd: 'compare' });
  if (!p) return;
  const [a, b] = p.chosen;
  const [ra, rb] = [await readRecord(ctx, a, { limit: 1000000 }), await readRecord(ctx, b, { limit: 1000000 })];
  if (!ra.ok) return ctx.reply(`${a.n}: ${ra.reason}`);
  if (!rb.ok) return ctx.reply(`${b.n}: ${rb.reason}`);
  const d = ft.diffLines(ra.text, rb.text);
  const L = [
    `🆚 ${a.n}  ↔  ${b.n}`,
    `Kemiripan: ${d.similarity}% · baris sama: ${d.same} · hanya di ${a.n}: ${d.removed} · hanya di ${b.n}: ${d.added}`,
  ];
  if (d.approximate) L.push('(File besar: urutan baris diabaikan, perbandingan perkiraan.)');
  L.push('');
  const changes = d.ops.filter((o) => o.t !== ' ' && o.s.trim());
  if (!changes.length) return ctx.reply(`${L[0]}\n\n✅ Isi teks kedua file identik.`);
  const shown = changes.slice(0, 25).map((o) => `${o.t === '-' ? '➖' : '➕'} ${o.s.length > 140 ? o.s.slice(0, 137) + '…' : o.s}`);
  L.push('➖ = hanya di file pertama · ➕ = hanya di file kedua', '', ...shown);
  if (changes.length > 25) {
    L.push(`…dan ${changes.length - 25} perbedaan lain (lengkap di file terlampir).`);
    await replyChunked(ctx, L.join('\n'));
    return sendFile(ctx, Buffer.from(d.ops.filter((o) => o.t !== ' ').map((o) => `${o.t} ${o.s}`).join('\n'), 'utf8'), 'perbedaan.txt');
  }
  return replyChunked(ctx, L.join('\n'));
}

const pdfErr = (e) =>
  /encrypt/i.test(String(e && e.message)) ? 'PDF itu diproteksi password, jadi tidak bisa diproses. Buka proteksinya dulu.' : 'PDF itu tidak bisa diproses (mungkin rusak).';

async function fileMerge(ctx, msg, rest) {
  const p = await pickFromSession(ctx, rest, { min: 2, max: 12, autoMax: 2, verb: 'digabung', cmd: 'merge' });
  if (!p) return;
  const cover = p.leftover;
  const bufs = [];
  const kinds = [];
  for (const r of p.chosen) {
    const kind = ft.kindOf(r.n, r.mime);
    kinds.push(kind);
    if (kind === 'unknown' || kind === 'image') return ctx.reply(`"${r.n}" tidak bisa digabung (format belum didukung untuk penggabungan). Yang bisa: PDF, DOCX, PPTX, TXT, MD.`);
  }
  await ctx.reply(`⏳ Menggabungkan ${p.chosen.length} file...`);
  const list = p.chosen.map((r, i) => `${i + 1}. ${r.n}`).join('\n');
  try {
    if (kinds.every((k) => k === 'pdf')) {
      for (const r of p.chosen) bufs.push(await downloadBuffer(ctx, r));
      let out = await ft.mergePdfs(bufs);
      if (cover) out = (await ft.addTextToFile('pdf', out, cover, { baseName: 'gabungan' })).buf;
      return sendFile(ctx, out, 'gabungan.pdf', `✅ Digabung${cover ? ' + halaman pembuka' : ''}:\n${list}`);
    }
    // campuran: gabungkan TEKS-nya
    const parts = [];
    for (const r of p.chosen) {
      const x = await readRecord(ctx, r, { limit: 2000000 });
      if (!x.ok) return ctx.reply(`${r.n}: ${x.reason}`);
      parts.push(`${p.chosen.length > 1 ? `--- ${r.n} ---\n\n` : ''}${x.text}`);
    }
    let text = parts.join('\n\n');
    if (cover) text = `${cover}\n\n${text}`;
    const plain = kinds.every((k) => k === 'txt' || k === 'md');
    const out = plain ? { buf: Buffer.from(text, 'utf8'), name: 'gabungan.txt' } : { buf: await ft.textToDocx(text), name: 'gabungan.docx' };
    return sendFile(ctx, out.buf, out.name, `✅ Digabung (hanya teks; format asli tidak dipertahankan karena jenis file berbeda):\n${list}`);
  } catch (e) {
    console.error('[merge]', e && e.message);
    return ctx.reply(pdfErr(e));
  }
}

async function fileSplit(ctx, msg, rest) {
  const rec = await findRecord(ctx, msg);
  if (!rec) return ctx.reply('Kirim PDF-nya dulu (atau balas PDF-nya), lalu /file split 1-3,5  ·  /file split each  ·  /file split per 5');
  if (ft.kindOf(rec.n, rec.mime) !== 'pdf') return ctx.reply(`Split saat ini hanya untuk PDF. "${rec.n}" bukan PDF.`);
  try {
    const buf = await downloadBuffer(ctx, rec);
    const r = await ft.splitPdf(buf, rest);
    if (r.error) return ctx.reply(r.error);
    const base = rec.n.replace(/\.[^.]+$/, '');
    const files = r.files.map((f) => ({ name: `${base}-${f.label}.pdf`, buf: f.buf }));
    if (files.length <= 4) {
      for (const f of files) await sendFile(ctx, f.buf, f.name);
      return ctx.reply(`✅ Dipecah menjadi ${files.length} file (dari ${r.total} halaman).`);
    }
    const zip = await ft.zipFiles(files);
    return sendFile(ctx, zip, `${base}-split.zip`, `✅ Dipecah menjadi ${files.length} PDF (dari ${r.total} halaman), dikemas dalam satu ZIP.`);
  } catch (e) {
    console.error('[split]', e && e.message);
    return ctx.reply(/too big/i.test(String(e && e.description)) ? friendlyFileError(e) : pdfErr(e));
  }
}

async function fileRename(ctx, msg, rest) {
  const rec = await findRecord(ctx, msg);
  if (!rec) return ctx.reply('Kirim file-nya dulu (atau balas file-nya), lalu /file rename nama-baru');
  const name = rest.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim();
  if (!name) return ctx.reply('Nama barunya apa? Contoh: /file rename laporan-final');
  const ext = (rec.n.match(/\.[^.]+$/) || [''])[0];
  const final = /\.[A-Za-z0-9]{1,5}$/.test(name) ? name : name + ext;
  try {
    const buf = await downloadBuffer(ctx, rec);
    return sendFile(ctx, buf, final, `✅ ${rec.n} → ${final}`);
  } catch (e) {
    return ctx.reply(friendlyFileError(e));
  }
}

async function fileCompress(ctx, msg, rest) {
  const sel = parseSelection(rest);
  let recs;
  if (sel.all || sel.picks.length) {
    const p = await pickFromSession(ctx, rest, { min: 1, max: 12, verb: 'dikompres', cmd: 'compress' });
    if (!p) return;
    recs = p.chosen;
  } else {
    const rec = await findRecord(ctx, msg);
    if (!rec) return ctx.reply('Kirim file-nya dulu (atau balas file-nya), lalu /file compress. Untuk banyak file sekaligus: /file compress all');
    recs = [rec];
  }
  try {
    const files = [];
    let before = 0;
    for (const r of recs) {
      const buf = await downloadBuffer(ctx, r);
      before += buf.length;
      files.push({ name: r.n, buf });
    }
    const zip = await ft.zipFiles(files);
    const kinds = recs.map((r) => ft.kindOf(r.n, r.mime));
    const already = kinds.some((k) => ['pdf', 'docx', 'xlsx', 'pptx', 'image'].includes(k));
    const name = recs.length === 1 ? recs[0].n.replace(/\.[^.]+$/, '') + '.zip' : 'kompres.zip';
    const saved = before ? Math.round((1 - zip.length / before) * 100) : 0;
    return sendFile(
      ctx,
      zip,
      name,
      `🗜️ ${ft.prettySize(before)} → ${ft.prettySize(zip.length)} (${saved >= 0 ? 'hemat' : 'lebih besar'} ${Math.abs(saved)}%).` +
        (already && saved < 10 ? '\nCatatan: PDF/DOCX/XLSX/PPTX/gambar sudah terkompresi, jadi ZIP hanya menghemat sedikit. Mengecilkan resolusi gambar butuh alat khusus yang belum ada di bot ini.' : '')
    );
  } catch (e) {
    return ctx.reply(friendlyFileError(e));
  }
}

async function fileMergeText(ctx, msg, rest) {
  if (!rest) return ctx.reply('Teks apa yang mau ditambahkan? Contoh:\n/file merge-text Laporan Penelitian 2026\n(awalan "akhir:" untuk menaruhnya di bagian akhir file)');
  const rec = await findRecord(ctx, msg);
  if (!rec) return ctx.reply('Kirim file-nya dulu (atau balas file-nya), lalu /file merge-text <teks>.');
  const atEnd = /^(akhir|di akhir|end)\s*:/i.test(rest);
  const text = rest.replace(/^(akhir|di akhir|end)\s*:\s*/i, '');
  try {
    const kind = ft.kindOf(rec.n, rec.mime);
    const buf = await downloadBuffer(ctx, rec);
    const r = await ft.addTextToFile(kind, buf, text, { atEnd, baseName: rec.n });
    if (r.error) return ctx.reply(r.error);
    return sendFile(ctx, r.buf, r.name, `✅ Teks ditambahkan di ${atEnd ? 'akhir' : 'awal'} file.${r.note ? '\n' + r.note : ''}`);
  } catch (e) {
    return ctx.reply(/too big/i.test(String(e && e.description)) ? friendlyFileError(e) : pdfErr(e));
  }
}

async function convertRecord(ctx, rec, target) {
  const kind = ft.kindOf(rec.n, rec.mime);
  const allowed = ft.supportedTargets(kind);
  if (!allowed.length) return ctx.reply(`Format "${rec.n}" belum didukung untuk konversi. Yang bisa dibaca: ${ft.SUPPORTED_READ}.`);
  if (!allowed.includes(target)) return ctx.reply(`File ${kind.toUpperCase()} belum bisa diubah ke ${target.toUpperCase()}. Yang bisa: ${allowed.map((x) => x.toUpperCase()).join(', ')}.`);
  let buf;
  try {
    buf = await downloadBuffer(ctx, rec);
  } catch (e) {
    return ctx.reply(friendlyFileError(e));
  }
  try {
    let opts = { baseName: rec.n };
    if (kind === 'image') {
      await ctx.reply('⏳ Membaca teks dari gambar (OCR)...');
      const o = await ocr(buf, rec.mime || 'image/jpeg');
      if (!o.ok) return ctx.reply(o.reason);
      opts = { baseName: rec.n, text: o.text };
    }
    let r = await ft.convertBuffer(kind, buf, target, opts);
    if (r.error && kind === 'pdf' && /Tidak ada teks/.test(r.error)) {
      await ctx.reply('PDF ini tampaknya hasil scan. ⏳ Mencoba membaca dengan OCR...');
      const o = await ocr(buf, 'application/pdf');
      if (!o.ok) return ctx.reply(o.reason);
      r = await ft.convertBuffer('txt', Buffer.from(o.text), target, { baseName: rec.n });
    }
    if (r.error) return ctx.reply(r.error);
    return sendFile(ctx, r.buf, r.name, `✅ ${rec.n} → ${r.name}${r.note ? '\n' + r.note : ''}`);
  } catch (e) {
    console.error('[convert]', e && e.message);
    return ctx.reply(/JSON/.test(String(e && e.message)) ? e.message : `File itu belum bisa dikonversi ke ${target.toUpperCase()} (isinya mungkin rusak atau tidak sesuai).`);
  }
}

async function fileConvert(ctx, msg, rest) {
  const rec = await findRecord(ctx, msg);
  if (!rec) return ctx.reply('Kirim file-nya dulu (atau balas file-nya), lalu /file convert docx  ·  atau /file convert pdf docx (dari → ke).');
  const target = parseTarget(rest);
  if (!target) {
    const kind = ft.kindOf(rec.n, rec.mime);
    const opts = ft.supportedTargets(kind);
    if (!opts.length) return ctx.reply(`Format "${rec.n}" belum didukung untuk konversi.`);
    if (store.enabled) await store.set(K.pend(String(ctx.from.id)), JSON.stringify(rec), 600);
    const kb = new InlineKeyboard();
    opts.forEach((o, i) => {
      kb.text(o.toUpperCase(), `cv:${o}`);
      if (i % 3 === 2) kb.row();
    });
    return ctx.reply(`Mau diubah menjadi apa? (${rec.n})`, { reply_markup: kb });
  }
  return convertRecord(ctx, rec, target);
}

async function fileCommand(ctx, msg, rest) {
  const AI = Object.keys(FILE_AI);
  const OWN = ['extract', 'search', 'compare', 'convert', 'merge', 'split', 'rename', 'compress', 'merge-text', 'list'];
  const { sub, rest: r, unknown } = parseSub(rest, [...AI, ...OWN]);
  if (!sub) {
    const help = GROUP_HELP.file.join('\n');
    return ctx.reply(unknown ? `Sub-perintah "${unknown}" belum saya kenal.\n\n${help}` : help, { parse_mode: 'HTML' });
  }
  if (AI.includes(sub)) return aiTask(ctx, msg, { table: FILE_AI, sub, rest: r, label: 'file' });
  const map = { extract: fileExtract, search: fileSearch, compare: fileCompare, convert: fileConvert, merge: fileMerge, split: fileSplit, rename: fileRename, compress: fileCompress, 'merge-text': fileMergeText, list: fileList };
  return map[sub](ctx, msg, r);
}

/* ============================================================
 * /product
 * ============================================================ */
function parseJsonLoose(text) {
  const t = String(text || '').replace(/```json|```/gi, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a === -1 || b <= a) return null;
  try {
    return JSON.parse(t.slice(a, b + 1));
  } catch (_) {
    return null;
  }
}

async function loadTable(ctx, rec) {
  const kind = ft.kindOf(rec.n, rec.mime);
  if (!['csv', 'xlsx', 'json'].includes(kind)) return null;
  const buf = await downloadBuffer(ctx, rec);
  if (kind === 'json') return pt.productsFromJson(buf.toString('utf8')) || null;
  return pt.productsFromTable(ft.tableRows(kind, buf));
}

async function productAnalyze(ctx, msg, rest, { importOnly = false } = {}) {
  const uid = String(ctx.from.id);
  let result = null;
  let via = null;

  // 1) File tabel/JSON -> impor langsung (gratis, tanpa AI)
  const rec = recordFromMessage(msg) || recordFromMessage(msg && msg.reply_to_message) || (!rest ? (await listFiles(uid)).slice(-1)[0] : null);
  if (rec && ['csv', 'xlsx', 'json'].includes(ft.kindOf(rec.n, rec.mime))) {
    try {
      result = await loadTable(ctx, rec);
    } catch (e) {
      return ctx.reply(friendlyFileError(e));
    }
    if (result) via = `impor dari ${rec.n}`;
  }
  if (importOnly && !rec && !rest) {
    return ctx.reply('Kirim file produk (csv/xlsx/json) lalu /product import → atau balas file-nya. Kolom yang dikenali: nama, kategori, varian, warna, ukuran, harga, stok, sku, deskripsi. Baris dengan nama sama akan digabung jadi VARIAN dari satu produk.');
  }

  // 2) Teks -> AI (kalau tersedia), cadangan: aturan sederhana
  if (!result) {
    const c = await gatherContent(ctx, msg, rest, { limit: 30000 });
    if (c.error) return ctx.reply(c.error);
    if (!c.text) return ctx.reply('Kirim data produknya, mis.:\n\nKaos Oversize\nHitam\nPutih\nS\nM\nL\n\n(pisahkan beberapa produk dengan baris kosong). Atau balas pesan/file yang berisi data produk.');
    const rule = pt.parseProductText(c.text);
    if (config.aiApiKey && !importOnly) {
      await ctx.reply('⏳ Menganalisis struktur produk...');
      const r = await ai.askSafe(PRODUCT_SYSTEM + (c.instruction ? ` Instruksi pengguna: ${c.instruction}` : ''), c.text, { maxTokens: 2500 });
      const parsed = r.ok ? parseJsonLoose(r.text) : null;
      if (parsed && parsed.clarification && !(parsed.products || []).length) return ctx.reply(`❓ ${parsed.clarification}`);
      if (parsed && Array.isArray(parsed.products) && parsed.products.length) {
        const products = pt.normalizeProducts(parsed);
        const notes = [];
        if (parsed.clarification) notes.push(`Pertanyaan AI: ${parsed.clarification}`);
        if (rule.products.length && rule.products.length !== products.length) {
          notes.push(`Pembacaan aturan sederhana menemukan ${rule.products.length} produk, AI menemukan ${products.length} → mohon periksa jumlah produknya.`);
        }
        result = { products, notes, clarification: null };
        via = 'dianalisis AI';
      }
    }
    if (!result) {
      if (rule.clarification) return ctx.reply(rule.clarification);
      result = rule;
      via = 'mode sederhana, tanpa AI';
      if (config.aiApiKey && !importOnly) result.notes.unshift('AI sedang tidak tersedia/tidak memberi hasil yang valid, jadi dipakai pembacaan berbasis aturan. Periksa hasilnya lebih teliti.');
    }
  }

  if (!result.products.length) return ctx.reply(result.clarification || 'Tidak ada produk yang ditemukan di data itu.');
  await saveProducts(uid, { t: Date.now(), products: result.products });
  await logHistory(uid, `product ${importOnly ? 'import' : 'analyze'}: ${result.products.length} produk`);
  const v = pt.validateProducts(result.products);
  const notes = [...result.notes];
  if (v.errors.length) notes.push(`Ada ${v.errors.length} masalah struktur → jalankan /product validate untuk detailnya.`);
  return replyChunked(ctx, pt.renderProductStructure(result.products, notes, via));
}

async function productValidate(ctx, msg, rest) {
  const uid = String(ctx.from.id);
  let products = null;
  const rec = recordFromMessage(msg) || recordFromMessage(msg && msg.reply_to_message);
  const hasInput = Boolean(rec) || Boolean(rest) || Boolean(msg && msg.reply_to_message);
  if (hasInput) {
    let r = null;
    if (rec && ['csv', 'xlsx', 'json'].includes(ft.kindOf(rec.n, rec.mime))) {
      try {
        r = await loadTable(ctx, rec);
      } catch (e) {
        return ctx.reply(friendlyFileError(e));
      }
    }
    if (!r) {
      const c = await gatherContent(ctx, msg, rest, { limit: 30000 });
      if (c.error) return ctx.reply(c.error);
      r = pt.productsFromJson(c.text || '') || pt.parseProductText(c.text || '');
    }
    products = r.products;
  } else {
    const saved = await loadProducts(uid);
    products = saved && saved.products;
    if (!products) return ctx.reply('Belum ada data produk untuk diperiksa. Jalankan /product analyze dulu, atau kirim teks/file produknya bersama /product validate.');
  }
  await logHistory(uid, `product validate: ${products.length} produk`);
  return replyChunked(ctx, pt.renderValidation(pt.validateProducts(products), products.length));
}

async function productExport(ctx, rest) {
  const uid = String(ctx.from.id);
  const saved = await loadProducts(uid);
  if (!saved || !saved.products || !saved.products.length) {
    return ctx.reply(store.enabled ? 'Belum ada hasil produk untuk diekspor. Jalankan /product analyze atau /product import dulu.' : `Ekspor butuh penyimpanan sesi. ${NEEDS_STORE}`);
  }
  const f = (String(rest).toLowerCase().match(/\b(json|csv|xlsx|excel|pptx|ppt|powerpoint)\b/) || [])[1] || 'json';
  const fmt = f === 'excel' ? 'xlsx' : /^(ppt|powerpoint)$/.test(f) ? 'pptx' : f;
  const stamp = new Date().toISOString().slice(0, 10);
  let buf;
  let extraNote = '';
  if (fmt === 'json') buf = Buffer.from(JSON.stringify({ products: saved.products }, null, 2), 'utf8');
  else if (fmt === 'pptx') {
    const r = pptxTools.productsToSlides(saved.products, { title: 'Katalog Produk' });
    buf = await pptxTools.buildPptx(r.deck);
    extraNote = ` Satu slide per produk (tanpa foto).${r.note ? ' ' + r.note : ''}`;
  } else {
    const XLSX = require('xlsx');
    const ws = XLSX.utils.json_to_sheet(pt.flattenForExport(saved.products));
    if (fmt === 'csv') buf = Buffer.from('\ufeff' + XLSX.utils.sheet_to_csv(ws), 'utf8');
    else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Produk');
      buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }
  }
  await logHistory(uid, `product export ${fmt}`);
  return sendFile(ctx, buf, `produk-${stamp}.${fmt}`, `✅ ${saved.products.length} produk diekspor (${fmt.toUpperCase()}).${extraNote}`);
}

async function productCommand(ctx, msg, rest) {
  const { sub, rest: r, unknown } = parseSub(rest, ['analyze', 'validate', 'import', 'export']);
  if (sub === 'analyze') return productAnalyze(ctx, msg, r);
  if (sub === 'import') return productAnalyze(ctx, msg, r, { importOnly: true });
  if (sub === 'validate') return productValidate(ctx, msg, r);
  if (sub === 'export') return productExport(ctx, r);
  if (r) return productAnalyze(ctx, msg, r); // "/product <teks>" langsung dianalisis
  const help = GROUP_HELP.product.join('\n');
  return ctx.reply(unknown ? `Sub-perintah "${unknown}" belum saya kenal.\n\n${help}` : help, { parse_mode: 'HTML' });
}

/* ============================================================
 * /market
 * ============================================================ */
const firstToken = (s) => String(s || '').trim().split(/\s+/)[0] || '';

async function withSeries(ctx, input, fn) {
  try {
    const s = await mk.fetchSeries(input);
    return await fn(s);
  } catch (e) {
    if (e && e.code) return ctx.reply(mk.friendlyError(e, input));
    throw e;
  }
}

async function marketCommand(ctx, msg, rest) {
  const uid = String(ctx.from.id);
  const { sub, rest: r, unknown } = parseSub(rest, ['price', 'news', 'research', 'compare', 'summarize', 'fundamentals', 'technical', 'portfolio']);
  if (!sub) {
    const help = GROUP_HELP.market.join('\n');
    return ctx.reply(unknown ? `Sub-perintah "${unknown}" belum saya kenal.\n\n${help}` : help, { parse_mode: 'HTML' });
  }
  await logHistory(uid, `market ${sub} ${r}`.trim());

  if (sub === 'price' || sub === 'technical') {
    const sym = firstToken(r);
    if (!sym) return ctx.reply(`Simbol apa? Contoh: /market ${sub} BBCA  ·  AAPL  ·  BTC  ·  IHSG`);
    return withSeries(ctx, sym, (s) => ctx.reply(sub === 'price' ? mk.renderPrice(s) : mk.renderTechnical(s)));
  }

  if (sub === 'compare') {
    const syms = r.split(/\s*(?:,|;|\bvs\b|\bdan\b|\s)\s*/i).filter(Boolean);
    if (syms.length < 2 || syms.length > 4) return ctx.reply('Sebutkan 2–4 simbol. Contoh: /market compare BBCA BBRI  ·  /market compare BTC ETH');
    const res = await Promise.allSettled(syms.map((x) => mk.fetchSeries(x)));
    const ok = res.filter((x) => x.status === 'fulfilled').map((x) => x.value);
    const bad = syms.filter((_, i) => res[i].status === 'rejected');
    if (ok.length < 2) return ctx.reply(mk.friendlyError(res.find((x) => x.status === 'rejected').reason, bad.join(', ')));
    return ctx.reply(mk.renderCompare(ok) + (bad.length ? `\n\nTidak ditemukan: ${bad.join(', ')}` : ''));
  }

  if (sub === 'portfolio') {
    const p = mk.parsePortfolio(r);
    if (p.error) return ctx.reply(p.error);
    const res = await Promise.allSettled(p.items.map((it) => mk.fetchSeries(it.sym)));
    const rows = p.items.map((item, i) => ({ item, s: res[i].status === 'fulfilled' ? res[i].value : null }));
    if (rows.every((x) => !x.s)) return ctx.reply(mk.friendlyError(res[0].reason, p.items.map((i) => i.sym).join(', ')));
    return ctx.reply(mk.renderPortfolio(rows, p));
  }

  if (sub === 'news') {
    const q = r || '';
    if (!q) return ctx.reply('Berita tentang apa? Contoh: /market news BBCA  ·  /market news bitcoin  ·  /market news suku bunga BI');
    try {
      return await ctx.reply(mk.renderNews(q, await mk.fetchNews(q)));
    } catch (e) {
      return ctx.reply('Belum bisa mengambil berita saat ini. Coba lagi nanti.');
    }
  }

  if (sub === 'research') {
    const sym = firstToken(r);
    if (!sym) return ctx.reply('Simbol apa? Contoh: /market research BBCA');
    let s;
    try {
      s = await mk.fetchSeries(sym);
    } catch (e) {
      return ctx.reply(mk.friendlyError(e, sym));
    }
    let news = [];
    try {
      news = await mk.fetchNews(`${s.name} ${sym}`.slice(0, 80), 6);
    } catch (_) { /* berita opsional */ }
    await ctx.reply(mk.renderPrice(s));
    if (!config.aiApiKey) return ctx.reply(mk.renderTechnical(s) + (news.length ? '\n\n' + mk.renderNews(sym, news) : ''));
    await ctx.reply('⏳ Menyusun riset dari data di atas...');
    const a = await ai.askSafe(RESEARCH_SYSTEM, mk.factsForAi(s, news), { maxTokens: 1800 });
    if (!a.ok) return ctx.reply(`${a.reason}\n\n${mk.renderTechnical(s)}`);
    await replyChunked(ctx, `${a.text}\n\n⚠️ ${mk.DISCLAIMER}`);
    if (news.length) await ctx.reply(mk.renderNews(sym, news));
    return;
  }

  if (sub === 'fundamentals') {
    const looksSymbol = /^[\w.^=\-&/]{1,14}$/.test(r) && !(msg && msg.reply_to_message) && !recordFromMessage(msg);
    if (looksSymbol) return withSeries(ctx, r, (s) => ctx.reply(mk.renderFundamentalsSnapshot(s, r)));
    const c = await gatherContent(ctx, msg, r, { limit: 60000 });
    if (c.error) return ctx.reply(c.error);
    if (!c.text) return ctx.reply('Kirim laporan keuangannya (PDF/teks) lalu balas dengan /market fundamentals → atau ketik simbolnya (mis. /market fundamentals BBCA) untuk data yang tersedia.');
    await ctx.reply('⏳ Menyusun analisis dari dokumen...');
    const a = await ai.askSafe(FUNDAMENTALS_SYSTEM + (c.instruction ? `\nFokus tambahan dari pengguna: ${c.instruction}` : ''), c.text, { maxTokens: 2500 });
    if (!a.ok) return ctx.reply(a.reason);
    return replyChunked(ctx, `${a.text}\n\nSumber: dokumen yang Anda kirim${c.name ? ` (${c.name})` : ''}. Bukan saran investasi.`);
  }

  if (sub === 'summarize') {
    const c = await gatherContent(ctx, msg, r);
    if (c.error) return ctx.reply(c.error);
    if (!c.text) return ctx.reply(noContentMsg('/market summarize'));
    await ctx.reply('⏳ Merangkum...');
    const a = await ai.askSafe(MARKET_SUMMARY_SYSTEM + (c.instruction ? `\nInstruksi tambahan: ${c.instruction}` : ''), c.text, { maxTokens: 1800 });
    if (!a.ok) {
      const s = ft.extractiveSummary(c.text, 6);
      return ctx.reply(`${a.reason}${s.length ? `\n\nRingkasan sederhana tanpa AI (kalimat penting dari teks):\n${s.map((x) => `• ${x}`).join('\n')}` : ''}`);
    }
    return replyChunked(ctx, a.text);
  }
}

/* ============================================================
 * Utility
 * ============================================================ */
async function settingsCommand(ctx) {
  const uid = String(ctx.from.id);
  const files = await listFiles(uid);
  const L = [
    '⚙️ <b>Pengaturan & status</b>',
    '',
    `🤖 AI (Gemini gratis): ${config.aiApiKey ? `✅ aktif (model <code>${esc(config.aiModel)}</code>)` : '⚠️ belum aktif → isi GEMINI_API_KEY di Vercel'}`,
    `💾 Penyimpanan sesi (Upstash): ${store.enabled ? '✅ aktif' : '⚠️ belum dipasang → merge/compare/export/undo butuh ini'}`,
    `📎 File di sesi ini: ${files.length}`,
    '',
    '<b>Bisa dipakai TANPA AI (gratis penuh):</b> file extract/search/compare/convert/merge/split/rename/compress/merge-text, product analyze(mode sederhana)/validate/import/export, market price/technical/compare/portfolio/news.',
    '<b>Butuh AI:</b> summarize, paraphrase, rewrite, grammar, translate, study, code, OCR gambar/scan, market research/fundamentals/summarize.',
    '',
    'Batas: file yang bisa diunduh bot maksimal 20 MB. Kuota AI gratis terbatas per hari.',
  ];
  return ctx.reply(L.join('\n'), { parse_mode: 'HTML' });
}

async function historyCommand(ctx) {
  if (!store.enabled) return ctx.reply(`Riwayat butuh penyimpanan sesi. ${NEEDS_STORE}`);
  const raw = (await store.list(K.hist(String(ctx.from.id)))) || [];
  const items = raw.map((r) => { try { return JSON.parse(r); } catch (_) { return null; } }).filter(Boolean).slice(-15).reverse();
  if (!items.length) return ctx.reply('Belum ada riwayat perintah (disimpan 24 jam).');
  const fmt = (t) => new Date(t).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  return ctx.reply(['🕘 Riwayat terakhir (24 jam):', ...items.map((i) => `• ${fmt(i.t)} → ${i.c}`)].join('\n'));
}

async function cancelCommand(ctx) {
  const uid = String(ctx.from.id);
  if (store.enabled) {
    await store.del(K.files(uid));
    await store.del(K.last(uid));
    await store.del(K.pend(uid));
    await store.del(`fwd:${uid}`);
    await store.del(`fwdmeta:${uid}`);
  }
  return ctx.reply('✅ Proses/sesi dibatalkan: daftar file dan teks terakhir dilupakan. Hasil produk tetap tersimpan (pakai /undo untuk kembali ke hasil sebelumnya).');
}

async function undoCommand(ctx) {
  const uid = String(ctx.from.id);
  if (!store.enabled) return ctx.reply(`Undo butuh penyimpanan sesi. ${NEEDS_STORE}`);
  const prev = await store.get(K.prev(uid));
  if (!prev) {
    return ctx.reply('Belum ada perubahan yang bisa dibatalkan. /undo mengembalikan hasil /product analyze atau import ke versi sebelumnya. Operasi file tidak mengubah file asli Anda, jadi tidak perlu di-undo.');
  }
  await store.set(K.prod(uid), prev, HIST_TTL);
  await store.del(K.prev(uid));
  let n = '?';
  try { n = JSON.parse(prev).products.length; } catch (_) { /* abaikan */ }
  await logHistory(uid, 'undo produk');
  return ctx.reply(`↩️ Dikembalikan ke hasil produk sebelumnya (${n} produk). Lihat dengan /product export.`);
}

/* ============================================================
 * Peta perintah, alias, bahasa natural
 * ============================================================ */
const ALIAS = {
  parafrase: ['doc', 'paraphrase'], paraphrase: ['doc', 'paraphrase'], ringkas: ['doc', 'summarize'], rangkum: ['doc', 'summarize'], summarize: ['doc', 'summarize'],
  terjemah: ['doc', 'translate'], terjemahkan: ['doc', 'translate'], translate: ['doc', 'translate'], grammar: ['doc', 'grammar'],
  convert: ['file', 'convert'], konversi: ['file', 'convert'], gabung: ['file', 'merge'], merge: ['file', 'merge'], split: ['file', 'split'], pisah: ['file', 'split'],
  rename: ['file', 'rename'], compress: ['file', 'compress'], kompres: ['file', 'compress'], compare: ['file', 'compare'], bandingkan: ['file', 'compare'],
  search: ['file', 'search'], cari: ['file', 'search'], extract: ['file', 'extract'], ekstrak: ['file', 'extract'],
  quiz: ['study', 'quiz'], kuis: ['study', 'quiz'], jelaskan: ['study', 'explain'], flashcard: ['study', 'flashcard'], debug: ['code', 'debug'],
  slides: ['doc', 'slides'], slide: ['doc', 'slides'], ppt: ['doc', 'slides'], pptx: ['doc', 'slides'], powerpoint: ['doc', 'slides'], presentasi: ['doc', 'slides'],
  analyze: ['product', 'analyze'], analisis: ['product', 'analyze'], validate: ['product', 'validate'], harga: ['market', 'price'],
};

async function route(ctx, msg, cmd, rest) {
  const uid = String(ctx.from.id);
  switch (cmd) {
    case 'help':
    case 'menu':
      return ctx.reply(MENU, { parse_mode: 'HTML' });
    case 'settings':
      return settingsCommand(ctx);
    case 'history':
      return historyCommand(ctx);
    case 'cancel':
      return cancelCommand(ctx);
    case 'undo':
      return undoCommand(ctx);
    case 'product':
      return productCommand(ctx, msg, rest);
    case 'file':
      return fileCommand(ctx, msg, rest);
    case 'doc':
      return taskCommand(ctx, msg, 'doc', DOC, rest);
    case 'study':
      return taskCommand(ctx, msg, 'study', STUDY, rest);
    case 'code':
      return taskCommand(ctx, msg, 'code', CODE, rest);
    case 'market':
      return marketCommand(ctx, msg, rest);
    default:
      break;
  }
  const a = ALIAS[cmd];
  if (a) {
    const line = `${a[1]} ${rest}`.trim();
    if (a[0] === 'doc') return taskCommand(ctx, msg, 'doc', DOC, line);
    if (a[0] === 'study') return taskCommand(ctx, msg, 'study', STUDY, line);
    if (a[0] === 'code') return taskCommand(ctx, msg, 'code', CODE, line);
    if (a[0] === 'file') return fileCommand(ctx, msg, line);
    if (a[0] === 'product') return productCommand(ctx, msg, line);
    if (a[0] === 'market') return marketCommand(ctx, msg, line);
  }
  return ctx.reply(`Perintah /${cmd} belum saya kenal.\n\n${MENU}`, { parse_mode: 'HTML' });
}

/** Kalimat biasa -> perintah setara (bagian 22). Mengembalikan null kalau bukan perintah. */
const NL = [
  // Presentasi: "buatkan presentasi tentang ...", "jadikan file ini presentasi 10 slide". (Kata "pptx" = konversi biasa, ditangani aturan convert di bawah.)
  {
    rx: /^(buat(kan)?|bikin(kan)?|susun(kan)?|jadikan|ubah|ringkas(kan)?|rangkum)\b.*\b(presentasi|power ?point|slides?|ppt)\b/i,
    run: (c, m, t) => {
      const kw = t.match(/\b(presentasi|power ?point|slides?|ppt)\b/i);
      const after = t.slice(kw.index + kw[0].length).replace(/^\s*(tentang|mengenai|soal|dari|untuk|:)\s*/i, '').trim();
      return deckCommand(c, m, after);
    },
  },
  { rx: /^(ubah|convert|konversi|jadikan|ganti format|simpan sebagai)\b/i, when: (t) => Boolean(parseTarget(t)), run: (c, m, t) => fileConvert(c, m, t) },
  { rx: /^(gabung(kan)?|satukan|merge)\b/i, run: (c, m, t) => fileMerge(c, m, (t.match(/teks\s*:\s*([\s\S]+)$/i) || [, ''])[1]) },
  { rx: /^(pisah(kan)?|pecah(kan)?|split)\b/i, run: (c, m, t) => fileSplit(c, m, t.replace(/^\S+\s*(halaman|pdf|file)?\s*/i, '')) },
  { rx: /^(bandingkan|compare)\b/i, run: (c, m) => fileCompare(c, m, '') },
  { rx: /^(kompres|compress|kecilkan)\b/i, run: (c, m) => fileCompress(c, m, '') },
  { rx: /^(ganti nama|rename)\b/i, run: (c, m, t) => fileRename(c, m, t.replace(/^(ganti nama|rename)\s*(file\s*)?(ini\s*)?(jadi|menjadi|ke)?\s*/i, '')) },
  { rx: /^(ekstrak|extract|ambil)\s+teks\b/i, run: (c, m) => fileExtract(c, m, '') },
  { rx: /^(tambahkan|tambah)\b.*\b(cover|sampul|halaman pembuka|teks)\b/i, run: (c, m, t) => fileMergeText(c, m, t.replace(/^[^:]*:\s*/, '')) },
  { rx: /^(cari|temukan|search)\b.*\b(di|dalam|in)\s+(file|dokumen|pdf|teks)/i, run: (c, m, t) => fileSearch(c, m, t.replace(/^\S+\s+/, '').replace(/\s+(di|dalam|in)\s+(file|dokumen|pdf|teks).*$/i, '')) },
  { rx: /^jelaskan\b.*\b(isi|file|dokumen)\b/i, run: (c, m) => aiTask(c, m, { table: FILE_AI, sub: 'summarize', rest: '', label: 'file' }) },
  { rx: /^(ringkas|rangkum|summarize)\b/i, run: (c, m, t) => aiTask(c, m, { table: DOC, sub: 'summarize', rest: t.replace(/^\S+\s*/, ''), label: 'doc' }) },
  { rx: /^(parafrase|parafrasekan|paraphrase)\b/i, run: (c, m, t) => aiTask(c, m, { table: DOC, sub: 'paraphrase', rest: t.replace(/^\S+\s*/, ''), label: 'doc' }) },
  { rx: /^(terjemahkan|terjemah|translate)\b/i, run: (c, m, t) => aiTask(c, m, { table: DOC, sub: 'translate', rest: t.replace(/^\S+\s*(ke\s+)?/i, ''), label: 'doc' }) },
  { rx: /^(buat|jadikan|tulis ulang|ubah).*\b(formal|rapi|profesional|singkat|jelas)\b/i, run: (c, m, t) => aiTask(c, m, { table: DOC, sub: 'rewrite', rest: t, label: 'doc' }) },
  { rx: /^(perbaiki|cek)\b.*\b(grammar|tata bahasa|ejaan)\b/i, run: (c, m) => aiTask(c, m, { table: DOC, sub: 'grammar', rest: '', label: 'doc' }) },
  { rx: /^(buat(kan)?)\s+(outline|kerangka)\b/i, run: (c, m, t) => aiTask(c, m, { table: DOC, sub: 'outline', rest: t.replace(/^\S+\s+\S+\s*/, ''), label: 'doc' }) },
  { rx: /^(buat(kan)?)\s+(soal|kuis|quiz)\b/i, run: (c, m, t) => aiTask(c, m, { table: STUDY, sub: 'quiz', rest: t.replace(/^\S+\s+\S+\s*/, ''), label: 'study' }) },
  { rx: /^(buat(kan)?)\s+flashcard\b/i, run: (c, m, t) => aiTask(c, m, { table: STUDY, sub: 'flashcard', rest: t.replace(/^\S+\s+\S+\s*/, ''), label: 'study' }) },
  { rx: /^jelaskan\b/i, run: (c, m, t) => aiTask(c, m, { table: STUDY, sub: 'explain', rest: t.replace(/^\S+\s*/, ''), label: 'study' }) },
  { rx: /^(bantu\s+)?(debug|perbaiki kode|cari bug)\b/i, run: (c, m, t) => aiTask(c, m, { table: CODE, sub: 'debug', rest: t.replace(/^(bantu\s+)?\S+(\s+kode|\s+bug)?\s*/i, ''), label: 'code' }) },
  { rx: /^(analisis|analisa)\s+produk\b/i, run: (c, m, t) => productAnalyze(c, m, t.replace(/^\S+\s+\S+\s*/, '')) },
  { rx: /^(harga|cek harga)\s+\S+/i, run: (c, m, t) => marketCommand(c, m, 'price ' + t.replace(/^(cek\s+)?harga\s+/i, '')) },
];

function matchNatural(text) {
  const t = String(text || '').trim();
  return NL.find((n) => n.rx.test(t) && (!n.when || n.when(t))) || null;
}

/* ============================================================
 * Pemasangan ke bot
 * ============================================================ */
const wrap = (ctx, fn) =>
  Promise.resolve()
    .then(fn)
    .catch(async (e) => {
      console.error('[commands] error:', e && (e.stack || e.message || e));
      try {
        await ctx.reply('Maaf, ada kendala saat memproses permintaan itu. Coba lagi, atau kirim ulang file/teksnya.');
      } catch (_) { /* abaikan */ }
    });

function registerCommands(bot) {
  bot.on('message', async (ctx, next) => {
    if (!guard(ctx)) return next();
    const msg = ctx.message;
    const uid = String(ctx.from.id);
    const raw = msg.text || msg.caption || '';
    const rec = recordFromMessage(msg);

    // Catat file/foto yang dikirim (juga yang bercaption perintah) supaya bisa dipakai perintah berikutnya.
    if (rec) await addFile(uid, rec);

    const cm = raw.match(/^\/([A-Za-z0-9_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
    if (cm) return wrap(ctx, () => route(ctx, msg, cm[1].toLowerCase(), (cm[2] || '').trim()));

    // Bahasa natural (dengan file di pesan yang sama, atau membalas file/teks)
    if (raw) {
      const nat = matchNatural(raw);
      if (nat) return wrap(ctx, () => nat.run(ctx, msg, raw.trim()));
    }

    // File tanpa perintah: beri tahu diterima (sekali per rentetan file) + tombol aksi cepat.
    if (rec && msg.document) {
      const first = store.enabled ? await store.setNX(K.ack(uid), '1', 20) : 'OK';
      if (first === null) return; // sudah di-ack untuk rentetan ini
      const kb = new InlineKeyboard().text('📝 Ringkas', 'act:sum').text('📄 Ambil teks', 'act:ext').text('🔄 Convert', 'act:cv');
      return ctx.reply(`📎 File diterima: ${rec.n}\nMau diapakan? Pilih tombol, atau ketik perintah (mis. /file merge, /file split, /file convert).`, { reply_markup: kb });
    }
    if (rec) return; // foto: cukup dicatat

    // Teks biasa: simpan sebagai "bahan terakhir" untuk perintah berikutnya.
    if (raw && store.enabled) await setLast(uid, raw);
    return next();
  });

  bot.callbackQuery(/^cv:(\w+)$/, async (ctx) => {
    if (!ctx.from) return ctx.answerCallbackQuery();
    await ctx.answerCallbackQuery();
    const uid = String(ctx.from.id);
    let rec = null;
    try { rec = JSON.parse((await store.get(K.pend(uid))) || 'null'); } catch (_) { rec = null; }
    if (!rec) rec = (await listFiles(uid)).slice(-1)[0];
    if (!rec) return ctx.reply('File-nya sudah tidak tersimpan. Kirim ulang file, lalu /file convert.');
    return wrap(ctx, () => convertRecord(ctx, rec, ctx.match[1]));
  });

  bot.callbackQuery(/^act:(sum|ext|cv)$/, async (ctx) => {
    if (!ctx.from) return ctx.answerCallbackQuery();
    await ctx.answerCallbackQuery();
    const a = ctx.match[1];
    if (a === 'sum') return wrap(ctx, () => aiTask(ctx, null, { table: FILE_AI, sub: 'summarize', rest: '', label: 'file' }));
    if (a === 'ext') return wrap(ctx, () => fileExtract(ctx, null, ''));
    return wrap(ctx, () => fileConvert(ctx, null, ''));
  });
}

module.exports = { registerCommands, _test: { matchNatural, parseSub, parseTarget, parseSelection, takeFlag, sessionGroup, parseJsonLoose, route } };
