'use strict';
/**
 * Alat file GRATIS (tanpa AI, tanpa internet): baca, konversi, gabung/pecah PDF, zip, bandingkan, cari.
 * Semua fungsi bekerja pada Buffer/teks, jadi mudah diuji dan tidak bergantung pada Telegram.
 */
const pdfParse = require('pdf-parse/lib/pdf-parse.js'); // path langsung: menghindari bug debug-mode pdf-parse di serverless
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const docx = require('docx');

/* ---------- Jenis file ---------- */
function kindOf(name = '', mime = '') {
  const n = String(name).toLowerCase();
  const m = String(mime).toLowerCase();
  if (m === 'application/pdf' || /\.pdf$/.test(n)) return 'pdf';
  if (m.includes('wordprocessingml') || /\.docx$/.test(n)) return 'docx';
  if (m.includes('spreadsheetml') || m === 'application/vnd.ms-excel' || /\.(xlsx|xls)$/.test(n)) return 'xlsx';
  if (m.includes('presentationml') || /\.pptx$/.test(n)) return 'pptx';
  if (/\.csv$/.test(n) || m === 'text/csv') return 'csv';
  if (/\.json$/.test(n) || m === 'application/json') return 'json';
  if (/\.xml$/.test(n) || m === 'application/xml' || m === 'text/xml') return 'xml';
  if (/\.(md|markdown)$/.test(n)) return 'md';
  if (/\.(txt|log)$/.test(n) || m.startsWith('text/')) return 'txt';
  if (m.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/.test(n)) return 'image';
  return 'unknown';
}

const SUPPORTED_READ = 'txt, md, csv, json, xml, pdf, docx, pptx, xlsx/xls (gambar & PDF scan lewat AI/OCR)';

const TARGETS = {
  pdf: ['txt', 'md', 'docx'],
  docx: ['txt', 'md', 'pdf'],
  pptx: ['txt', 'md', 'docx', 'pdf'],
  txt: ['docx', 'pdf', 'md'],
  md: ['docx', 'pdf', 'txt'],
  xlsx: ['csv', 'json', 'txt'],
  csv: ['xlsx', 'json', 'txt'],
  json: ['csv', 'xlsx', 'txt'],
  xml: ['txt'],
  image: ['txt', 'md', 'docx', 'pdf'], // lewat OCR AI
};
const supportedTargets = (kind) => TARGETS[kind] || [];

/* ---------- Membaca teks ---------- */
function decodeXml(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function pptxText(buf) {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .map((f) => ({ f, m: f.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]));
  const out = [];
  for (const s of slides) {
    const xml = await zip.files[s.f].async('string');
    const paras = (xml.match(/<a:p[ >][\s\S]*?<\/a:p>/g) || [])
      .map((p) => decodeXml((p.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map((t) => t.replace(/<\/?a:t>/g, '')).join('')))
      .filter((t) => t.trim());
    out.push(`--- Slide ${s.m[1]} ---\n${paras.join('\n')}`);
  }
  return out.join('\n\n');
}

function sheetsToText(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  if (!wb.SheetNames.length) return '';
  return wb.SheetNames.map((n, i) => {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[n]);
    return wb.SheetNames.length > 1 ? `# Sheet: ${n}\n${csv}` : csv;
  }).join('\n');
}

/** Baca teks dari Buffer sesuai jenis file. Melempar error kalau file rusak. */
async function extractText(kind, buf) {
  switch (kind) {
    case 'txt':
    case 'md':
    case 'csv':
    case 'json':
    case 'xml':
      return buf.toString('utf8');
    case 'pdf':
      // PENTING: beri salinan Uint8Array, bukan Buffer. pdf-parse (pdf.js 1.10) salah membaca Buffer di Node modern
      // (Buffer.slice berbagi memori) dan menghasilkan error acak "bad XRef entry".
      return ((await pdfParse(new Uint8Array(buf))).text || '').trim();
    case 'docx':
      return ((await mammoth.extractRawText({ buffer: buf })).value || '').trim();
    case 'xlsx':
      return sheetsToText(buf).trim();
    case 'pptx':
      return (await pptxText(buf)).trim();
    default:
      throw new Error(`format ${kind} tidak didukung`);
  }
}

/* ---------- Teks -> PDF / DOCX ---------- */
async function textToPdf(text) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const W = 595.28;
  const H = 841.89;
  const margin = 56;
  const size = 11;
  const lead = 15;
  const maxW = W - margin * 2;
  const charset = new Set(font.getCharacterSet());
  const clean = (s) =>
    Array.from(s.replace(/\t/g, '    '))
      .map((ch) => {
        const cp = ch.codePointAt(0);
        if (charset.has(cp)) return ch;
        return cp < 32 ? '' : '?';
      })
      .join('');
  const width = (s) => font.widthOfTextAtSize(s, size);

  let page = pdf.addPage([W, H]);
  let y = H - margin;
  const drawLine = (line) => {
    if (y < margin) {
      page = pdf.addPage([W, H]);
      y = H - margin;
    }
    if (line) page.drawText(line, { x: margin, y, size, font });
    y -= lead;
  };

  for (const para of String(text).replace(/\r/g, '').split('\n')) {
    const p = clean(para);
    if (!p.trim()) {
      drawLine('');
      continue;
    }
    let line = '';
    for (const word of p.split(/ +/)) {
      let w = word;
      // kata yang lebih panjang dari lebar halaman: potong per huruf
      while (width(w) > maxW) {
        let cut = w.length;
        while (cut > 1 && width(w.slice(0, cut)) > maxW) cut--;
        if (line) {
          drawLine(line);
          line = '';
        }
        drawLine(w.slice(0, cut));
        w = w.slice(cut);
      }
      const test = line ? `${line} ${w}` : w;
      if (width(test) <= maxW) line = test;
      else {
        drawLine(line);
        line = w;
      }
    }
    if (line) drawLine(line);
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

async function textToDocx(text) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
  const H = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];
  const children = String(text)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => {
      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) return new Paragraph({ heading: H[h[1].length - 1], children: [new TextRun(h[2])] });
      const b = line.match(/^\s*[-*•]\s+(.*)$/);
      if (b) return new Paragraph({ bullet: { level: 0 }, children: [new TextRun(b[1])] });
      return new Paragraph({ children: [new TextRun(line)] });
    });
  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

/** Teks hasil PDF sering terpotong per baris; gabungkan baris yang jelas masih satu kalimat. */
function reflow(text) {
  const out = [];
  let cur = '';
  for (const raw of String(text).replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      if (cur) out.push(cur);
      cur = '';
      out.push('');
      continue;
    }
    if (!cur) {
      cur = line;
      continue;
    }
    if (/[.:;!?]$/.test(cur) || cur.length < 40 || /^([-*•]|\d+[.)])\s/.test(line)) {
      out.push(cur);
      cur = line;
    } else cur += ' ' + line;
  }
  if (cur) out.push(cur);
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/* ---------- Tabel ---------- */
function flattenCell(v) {
  return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
}
function jsonToRows(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error('JSON tidak valid');
  }
  if (!Array.isArray(data) && data && typeof data === 'object') {
    const arr = Object.values(data).find((v) => Array.isArray(v));
    if (arr) data = arr;
  }
  if (!Array.isArray(data) || !data.length || data.some((r) => r === null || typeof r !== 'object' || Array.isArray(r))) {
    throw new Error('JSON harus berupa daftar objek (contoh: [{"nama":"A","harga":1000}])');
  }
  return data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, flattenCell(v)])));
}
/** Baca csv/xlsx/json jadi array baris-objek (header = baris pertama). */
function tableRows(kind, buf) {
  if (kind === 'json') return jsonToRows(buf.toString('utf8'));
  const wb = kind === 'csv' ? XLSX.read(buf.toString('utf8'), { type: 'string' }) : XLSX.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('tidak ada sheet');
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}
function rowsToBuffer(rows, target) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (target === 'csv') return Buffer.from('\ufeff' + XLSX.utils.sheet_to_csv(ws), 'utf8');
  if (target === 'json') return Buffer.from(JSON.stringify(rows, null, 2), 'utf8');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/* ---------- Konversi ---------- */
/**
 * Ubah format file. Mengembalikan { buf, name, note } atau { error }.
 * opts.text: teks yang sudah dibaca sebelumnya (mis. hasil OCR untuk gambar).
 */
async function convertBuffer(kind, buf, target, opts = {}) {
  const base = (opts.baseName || 'hasil').replace(/\.[^.]+$/, '') || 'hasil';
  const allowed = supportedTargets(kind);
  if (kind === target) return { error: `File ini sudah berformat ${target}.` };
  if (!allowed.includes(target)) {
    return {
      error: allowed.length
        ? `File ${kind} belum bisa diubah ke ${target}. Yang bisa: ${allowed.join(', ')}.`
        : `Format ${kind} belum didukung untuk konversi.`,
    };
  }
  const getText = async () => (opts.text !== undefined ? opts.text : await extractText(kind, buf));

  if (['csv', 'xlsx', 'json'].includes(target)) {
    const rows = tableRows(kind, buf);
    if (!rows.length) return { error: 'Tabelnya kosong (tidak ada baris data di bawah header).' };
    return { buf: rowsToBuffer(rows, target), name: `${base}.${target}` };
  }
  if (kind === 'json' && target === 'txt') return { buf: Buffer.from(JSON.stringify(JSON.parse(buf.toString('utf8')), null, 2), 'utf8'), name: `${base}.txt` };

  if (target === 'md' && kind === 'docx') {
    const { value } = await mammoth.convertToMarkdown({ buffer: buf });
    return { buf: Buffer.from(value, 'utf8'), name: `${base}.md` };
  }

  const text = await getText();
  if (!text || !text.trim()) return { error: 'Tidak ada teks yang bisa dibaca dari file itu (mungkin hasil scan/gambar).' };
  const layoutNote = kind === 'pdf' || kind === 'docx' || kind === 'pptx' ? 'Hanya TEKS yang dipindahkan; tata letak, gambar, dan tabel tidak ikut.' : null;

  if (target === 'txt' || target === 'md') return { buf: Buffer.from(text, 'utf8'), name: `${base}.${target}`, note: layoutNote };
  if (target === 'docx') return { buf: await textToDocx(kind === 'pdf' ? reflow(text) : text), name: `${base}.docx`, note: layoutNote };
  if (target === 'pdf') return { buf: await textToPdf(text), name: `${base}.pdf`, note: layoutNote };
  return { error: `Konversi ke ${target} belum didukung.` };
}

/* ---------- PDF: gabung, pecah, sampul ---------- */
async function mergePdfs(buffers) {
  const out = await PDFDocument.create();
  for (const b of buffers) {
    const src = await PDFDocument.load(b);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save({ useObjectStreams: false }));
}

/** "1-3,5" -> [[0,1,2],[4]]  |  "each" -> satu halaman satu file  |  "per 5" -> tiap 5 halaman. */
function parseSplitSpec(spec, total) {
  const s = String(spec || '').trim().toLowerCase();
  if (!s) return { error: 'Sebutkan caranya, contoh: /file split 1-3,5  atau  /file split each  atau  /file split per 5' };
  if (/^(each|semua|tiap|setiap)/.test(s)) return { parts: Array.from({ length: total }, (_, i) => [i]) };
  const per = s.match(/^per\s+(\d+)$/);
  if (per) {
    const n = Number(per[1]);
    if (n < 1) return { error: 'Angka setelah "per" minimal 1.' };
    const parts = [];
    for (let i = 0; i < total; i += n) parts.push(Array.from({ length: Math.min(n, total - i) }, (_, k) => i + k));
    return { parts };
  }
  const parts = [];
  for (const tok of s.split(/[,\s]+/).filter(Boolean)) {
    const m = tok.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return { error: `Saya tidak paham "${tok}". Pakai format seperti 1-3,5` };
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a || b > total) return { error: `Rentang "${tok}" di luar batas. PDF ini punya ${total} halaman.` };
    parts.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i));
  }
  return parts.length ? { parts } : { error: 'Rentang halaman kosong.' };
}

async function splitPdf(buf, spec) {
  const src = await PDFDocument.load(buf);
  const total = src.getPageCount();
  const r = parseSplitSpec(spec, total);
  if (r.error) return { error: r.error };
  const files = [];
  for (const idx of r.parts) {
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, idx);
    pages.forEach((p) => out.addPage(p));
    const label = idx.length === 1 ? `hal-${idx[0] + 1}` : `hal-${idx[0] + 1}-${idx[idx.length - 1] + 1}`;
    files.push({ label, buf: Buffer.from(await out.save({ useObjectStreams: false })) });
  }
  return { files, total };
}

/** Tambahkan teks (sampul/halaman pembuka/penutup) ke sebuah file. */
async function addTextToFile(kind, buf, text, { atEnd = false, baseName = 'hasil' } = {}) {
  const base = baseName.replace(/\.[^.]+$/, '') || 'hasil';
  if (kind === 'pdf') {
    const extra = await textToPdf(text);
    const merged = await mergePdfs(atEnd ? [buf, extra] : [extra, buf]);
    return { buf: merged, name: `${base}.pdf` };
  }
  if (kind === 'txt' || kind === 'md') {
    const orig = buf.toString('utf8');
    const out = atEnd ? `${orig}\n\n${text}\n` : `${text}\n\n${orig}`;
    return { buf: Buffer.from(out, 'utf8'), name: `${base}.${kind}` };
  }
  if (kind === 'docx') {
    const orig = await extractText('docx', buf);
    const out = atEnd ? `${orig}\n\n${text}` : `${text}\n\n${orig}`;
    return { buf: await textToDocx(out), name: `${base}.docx`, note: 'File Word dibuat ulang: hanya teks yang dipertahankan (format/gambar asli tidak ikut).' };
  }
  return { error: `Menambah teks ke file ${kind} belum didukung (yang bisa: pdf, docx, txt, md).` };
}

/* ---------- Zip ---------- */
async function zipFiles(files) {
  const zip = new JSZip();
  const used = new Set();
  for (const f of files) {
    let n = f.name;
    let i = 2;
    while (used.has(n)) n = f.name.replace(/(\.[^.]+)?$/, `-${i++}$1`);
    used.add(n);
    zip.file(n, f.buf);
  }
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
}

/* ---------- Bandingkan & cari ---------- */
/** Bandingkan dua teks per baris. */
function diffLines(a, b) {
  const A = String(a).replace(/\r/g, '').split('\n').map((s) => s.trimEnd());
  const B = String(b).replace(/\r/g, '').split('\n').map((s) => s.trimEnd());
  const ops = [];
  if (A.length <= 1500 && B.length <= 1500) {
    const n = A.length;
    const m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) {
        ops.push({ t: ' ', s: A[i] });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ t: '-', s: A[i++] });
      else ops.push({ t: '+', s: B[j++] });
    }
    while (i < n) ops.push({ t: '-', s: A[i++] });
    while (j < m) ops.push({ t: '+', s: B[j++] });
  } else {
    // file besar: bandingkan sebagai himpunan baris (urutan diabaikan)
    const sa = new Set(A);
    const sb = new Set(B);
    A.forEach((s) => ops.push({ t: sb.has(s) ? ' ' : '-', s }));
    B.forEach((s) => {
      if (!sa.has(s)) ops.push({ t: '+', s });
    });
  }
  const removed = ops.filter((o) => o.t === '-' && o.s.trim()).length;
  const added = ops.filter((o) => o.t === '+' && o.s.trim()).length;
  const same = ops.filter((o) => o.t === ' ' && o.s.trim()).length;
  const denom = same + removed + added;
  return { ops, removed, added, same, similarity: denom ? Math.round((same / denom) * 100) : 100, approximate: A.length > 1500 || B.length > 1500 };
}

function searchText(text, query, max = 15) {
  const q = String(query).trim().replace(/^["']|["']$/g, '');
  const lines = String(text).replace(/\r/g, '').split('\n');
  const lower = q.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const collect = (pred) => {
    const hits = [];
    lines.forEach((l, i) => {
      if (pred(l.toLowerCase())) hits.push({ line: i + 1, text: l.trim() });
    });
    return hits;
  };
  let mode = 'frasa';
  let hits = collect((l) => l.includes(lower));
  if (!hits.length && words.length > 1) {
    mode = 'semua kata';
    hits = collect((l) => words.every((w) => l.includes(w)));
  }
  if (!hits.length && words.length > 1) {
    mode = 'salah satu kata';
    hits = collect((l) => words.some((w) => l.includes(w)));
  }
  return { total: hits.length, hits: hits.slice(0, max), mode };
}

/* ---------- Ringkasan ekstraktif (cadangan kalau AI tidak tersedia) ---------- */
const STOP = new Set(
  'yang dan di ke dari untuk pada dengan ini itu adalah atau juga dalam akan oleh sebagai karena tidak dapat bisa para ada lebih telah sudah saat serta agar bahwa the of and to in a is that for on with as by are was it be this an at from or which have has'.split(' ')
);
function extractiveSummary(text, n = 6) {
  const sentences = String(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 350);
  if (sentences.length <= n) return sentences;
  const freq = new Map();
  for (const w of String(text).toLowerCase().match(/[a-zà-ÿ]{3,}/g) || []) if (!STOP.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
  const scored = sentences.map((s, i) => {
    const ws = (s.toLowerCase().match(/[a-zà-ÿ]{3,}/g) || []).filter((w) => !STOP.has(w));
    const score = ws.reduce((a, w) => a + (freq.get(w) || 0), 0) / Math.sqrt(ws.length || 1);
    return { s, i, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

const prettySize = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

module.exports = {
  kindOf,
  supportedTargets,
  SUPPORTED_READ,
  extractText,
  convertBuffer,
  textToPdf,
  textToDocx,
  reflow,
  tableRows,
  mergePdfs,
  splitPdf,
  parseSplitSpec,
  addTextToFile,
  zipFiles,
  diffLines,
  searchText,
  extractiveSummary,
  prettySize,
};
