'use strict';
/**
 * /market → informasi pasar dari sumber GRATIS, tanpa mengarang data (Master Prompt bagian 18-19, 28).
 *  - Harga & riwayat  : Yahoo Finance chart endpoint (tidak resmi, tanpa API key; bisa tertunda)
 *  - Berita           : Google News RSS
 *  - Indikator        : dihitung sendiri di sini dari riwayat harga (bukan dari AI)
 * Setiap hasil membawa: sumber, waktu data, dan keterbatasannya.
 */
const UA = 'Mozilla/5.0 (compatible; DukionBot/1.1)';

const DISCLAIMER =
  'Sumber: Yahoo Finance (layanan tidak resmi). Data bisa TERTUNDA dan tidak dijamin real-time/akurat → cek ke sumber resmi bursa/broker sebelum mengambil keputusan. Ini informasi, bukan saran membeli/menjual.';

/* ---------- Simbol ---------- */
const ALIAS = {
  btc: 'BTC-USD', bitcoin: 'BTC-USD', eth: 'ETH-USD', ethereum: 'ETH-USD', bnb: 'BNB-USD', sol: 'SOL-USD', solana: 'SOL-USD',
  xrp: 'XRP-USD', doge: 'DOGE-USD', dogecoin: 'DOGE-USD', ada: 'ADA-USD', usdt: 'USDT-USD',
  ihsg: '^JKSE', jkse: '^JKSE', lq45: '^JKLQ45', sp500: '^GSPC', 's&p500': '^GSPC', nasdaq: '^IXIC', dow: '^DJI', nikkei: '^N225', hangseng: '^HSI',
  emas: 'GC=F', gold: 'GC=F', minyak: 'CL=F', oil: 'CL=F', perak: 'SI=F',
  usdidr: 'IDR=X', 'usd/idr': 'IDR=X', dolar: 'IDR=X', eurusd: 'EURUSD=X', 'eur/usd': 'EURUSD=X',
};

/** Kandidat simbol Yahoo untuk input pengguna. Saham IDX 4 huruf dicoba ".JK" dulu. */
function symbolCandidates(input) {
  const raw = String(input || '').trim();
  if (!raw) return [];
  const a = ALIAS[raw.toLowerCase()];
  if (a) return [a];
  const up = raw.toUpperCase();
  if (/^[A-Z]{4}$/.test(up)) return [`${up}.JK`, up];
  return [up];
}

/* ---------- Ambil data ---------- */
async function getJson(url, ms = 9000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
    if (res.status === 429) {
      const e = new Error('rate');
      e.code = 'RATE';
      throw e;
    }
    if (!res.ok) {
      const e = new Error(`http ${res.status}`);
      e.code = res.status === 404 ? 'NOTFOUND' : 'HTTP';
      throw e;
    }
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') {
      const t = new Error('timeout');
      t.code = 'TIMEOUT';
      throw t;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Ubah JSON Yahoo menjadi seri harga yang rapi. Dipisah supaya bisa diuji tanpa internet. */
function parseChart(json) {
  const r = json && json.chart && json.chart.result && json.chart.result[0];
  if (!r) {
    const desc = json && json.chart && json.chart.error && json.chart.error.description;
    const e = new Error(desc || 'tidak ada data');
    e.code = 'NOTFOUND';
    throw e;
  }
  const meta = r.meta || {};
  const ts = r.timestamp || [];
  const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  const bars = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close ? q.close[i] : null;
    if (typeof c === 'number' && Number.isFinite(c)) bars.push({ t: ts[i], c, v: q.volume ? q.volume[i] : null });
  }
  if (bars.length < 2) {
    const e = new Error('riwayat harga terlalu sedikit');
    e.code = 'NOTFOUND';
    throw e;
  }
  const last = bars[bars.length - 1];
  return {
    symbol: meta.symbol,
    name: meta.longName || meta.shortName || meta.symbol,
    currency: meta.currency || '',
    exchange: meta.fullExchangeName || meta.exchangeName || '',
    type: meta.instrumentType || '',
    price: typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : last.c,
    time: meta.regularMarketTime || last.t,
    high52: typeof meta.fiftyTwoWeekHigh === 'number' ? meta.fiftyTwoWeekHigh : null,
    low52: typeof meta.fiftyTwoWeekLow === 'number' ? meta.fiftyTwoWeekLow : null,
    bars,
  };
}

async function fetchSeries(input, range = '1y') {
  const cands = symbolCandidates(input);
  if (!cands.length) {
    const e = new Error('simbol kosong');
    e.code = 'EMPTY';
    throw e;
  }
  let lastErr;
  for (const sym of cands) {
    for (const host of ['query1', 'query2']) {
      try {
        const json = await getJson(`https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d`);
        return parseChart(json);
      } catch (e) {
        lastErr = e;
        if (e.code === 'NOTFOUND') break; // host lain tidak akan beda; coba kandidat simbol berikutnya
      }
    }
  }
  throw lastErr || new Error('gagal');
}

/** Pesan ramah untuk error pengambilan data. */
function friendlyError(e, what) {
  if (e && e.code === 'NOTFOUND' || (e && e.code === 'EMPTY')) return `Data untuk "${what}" tidak ditemukan. Coba format lain: saham IDX "BBCA" atau "BBCA.JK", saham US "AAPL", kripto "BTC" atau "BTC-USD", indeks "IHSG".`;
  if (e && e.code === 'RATE') return 'Sumber data sedang membatasi permintaan. Coba lagi beberapa menit lagi.';
  if (e && e.code === 'TIMEOUT') return 'Sumber data terlalu lama merespons. Coba lagi sebentar lagi.';
  return 'Belum bisa mengambil data dari sumber pasar saat ini (layanan gratis ini kadang menolak permintaan dari server). Coba lagi nanti.';
}

/* ---------- Indikator (dihitung sendiri) ---------- */
const closesOf = (s) => s.bars.map((b) => b.c);

function sma(arr, n) {
  if (arr.length < n) return null;
  let sum = 0;
  for (let i = arr.length - n; i < arr.length; i++) sum += arr[i];
  return sum / n;
}
function emaSeries(arr, n) {
  if (arr.length < n) return [];
  const k = 2 / (n + 1);
  let e = arr.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const out = [e];
  for (let i = n; i < arr.length; i++) {
    e = arr[i] * k + e * (1 - k);
    out.push(e);
  }
  return out;
}
function rsi(arr, n = 14) {
  if (arr.length <= n) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = arr[i] - arr[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  for (let i = n + 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}
function macd(arr) {
  const e12 = emaSeries(arr, 12);
  const e26 = emaSeries(arr, 26);
  if (!e26.length) return null;
  const offset = e12.length - e26.length;
  const line = e26.map((v, i) => e12[i + offset] - v);
  const sig = emaSeries(line, 9);
  if (!sig.length) return null;
  const m = line[line.length - 1];
  const s = sig[sig.length - 1];
  return { macd: m, signal: s, hist: m - s };
}
/** Perubahan % sejak `days` hari kalender lalu (null kalau riwayat tidak cukup). */
function changeSince(series, days) {
  const lastBar = series.bars[series.bars.length - 1];
  const target = lastBar.t - days * 86400;
  if (series.bars[0].t > target + 4 * 86400) return null;
  let ref = null;
  for (const b of series.bars) {
    if (b.t <= target) ref = b;
    else break;
  }
  if (!ref) return null;
  return (lastBar.c / ref.c - 1) * 100;
}
function annualVol(series) {
  const c = closesOf(series);
  const rets = [];
  for (let i = 1; i < c.length; i++) rets.push(Math.log(c[i] / c[i - 1]));
  if (rets.length < 20) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
  const years = (series.bars[series.bars.length - 1].t - series.bars[0].t) / 31557600;
  const perYear = years > 0 ? rets.length / years : 252;
  return sd * Math.sqrt(perYear) * 100;
}
function maxDrawdown(series) {
  let peak = -Infinity;
  let mdd = 0;
  for (const { c } of series.bars) {
    peak = Math.max(peak, c);
    mdd = Math.min(mdd, c / peak - 1);
  }
  return mdd * 100;
}
function ytd(series) {
  const lastBar = series.bars[series.bars.length - 1];
  const yr = new Date(lastBar.t * 1000).getUTCFullYear();
  const start = Date.UTC(yr, 0, 1) / 1000;
  const ref = series.bars.find((b) => b.t >= start);
  if (!ref || ref === lastBar || series.bars[0].t > start + 7 * 86400) return null;
  return (lastBar.c / ref.c - 1) * 100;
}

function metrics(series) {
  const c = closesOf(series);
  const last = series.price;
  const prev = c.length >= 2 ? c[c.length - 2] : null;
  return {
    last,
    dayChange: prev ? (c[c.length - 1] / prev - 1) * 100 : null,
    sma20: sma(c, 20),
    sma50: sma(c, 50),
    sma200: sma(c, 200),
    rsi14: rsi(c, 14),
    macd: macd(c),
    r1m: changeSince(series, 30),
    r3m: changeSince(series, 91),
    r6m: changeSince(series, 182),
    r1y: changeSince(series, 365),
    ytd: ytd(series),
    vol: annualVol(series),
    mdd: maxDrawdown(series),
    hi: series.high52 ?? Math.max(...c),
    lo: series.low52 ?? Math.min(...c),
  };
}

/* ---------- Format ---------- */
const num = (n, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? '→' : n.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: n !== 0 && Math.abs(n) < 100 ? Math.min(d, 2) : 0 }));
const dec = (n, d = 1) => n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n) => (n === null || n === undefined || !Number.isFinite(n) ? 'n/a' : `${n >= 0 ? '+' : ''}${dec(n, 2)}%`);
function when(sec) {
  try {
    return new Date(sec * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
  } catch (_) {
    return new Date(sec * 1000).toISOString();
  }
}
const ageNote = (sec) => {
  const h = (Date.now() / 1000 - sec) / 3600;
  return h > 30 ? ` → data terakhir sudah ${Math.round(h / 24)} hari lalu (pasar mungkin tutup/libur atau data tertunda)` : '';
};
const head = (s) => `${s.name} (${s.symbol})${s.exchange ? ' · ' + s.exchange : ''}`;

function renderPrice(s) {
  const m = metrics(s);
  return [
    `📊 ${head(s)}`,
    `Harga terakhir: ${num(s.price)} ${s.currency}${m.dayChange !== null ? ` (${pct(m.dayChange)} dari penutupan sebelumnya di data)` : ''}`,
    `Rentang 52 minggu: ${num(m.lo)} – ${num(m.hi)} ${s.currency}`,
    `Perubahan: 1 bln ${pct(m.r1m)} · 3 bln ${pct(m.r3m)} · 6 bln ${pct(m.r6m)} · 1 thn ${pct(m.r1y)}`,
    `Waktu data: ${when(s.time)}${ageNote(s.time)}`,
    '',
    `⚠️ ${DISCLAIMER}`,
  ].join('\n');
}

function renderTechnical(s) {
  const m = metrics(s);
  const L = [`📈 Analisis teknikal: ${head(s)}`, `Waktu data: ${when(s.time)}${ageNote(s.time)} · Periode: ${s.bars.length} hari bursa/perdagangan terakhir (harian)`, '', 'FAKTA (dihitung dari harga penutupan harian):'];
  L.push(`• Harga: ${num(s.price)} ${s.currency}`);
  L.push(`• SMA20: ${num(m.sma20)} · SMA50: ${num(m.sma50)} · SMA200: ${m.sma200 === null ? 'n/a (riwayat kurang dari 200 hari)' : num(m.sma200)}`);
  L.push(`• RSI(14): ${m.rsi14 === null ? 'n/a' : dec(m.rsi14, 1)}`);
  if (m.macd) L.push(`• MACD(12,26,9): garis ${num(m.macd.macd, 4)}, sinyal ${num(m.macd.signal, 4)}, histogram ${num(m.macd.hist, 4)}`);
  L.push(`• Rentang 52 minggu: ${num(m.lo)} – ${num(m.hi)}${m.hi > m.lo ? ` (harga di ${Math.round(((s.price - m.lo) / (m.hi - m.lo)) * 100)}% dari rentang)` : ''}`);
  L.push(`• Volatilitas tahunan (perkiraan): ${m.vol === null ? 'n/a' : dec(m.vol, 1) + '%'} · Penurunan maksimum 1 thn: ${dec(m.mdd, 1)}%`);

  const read = [];
  if (m.sma50 !== null) read.push(`Harga ${s.price >= m.sma50 ? 'di atas' : 'di bawah'} SMA50.`);
  if (m.sma200 !== null) read.push(`Harga ${s.price >= m.sma200 ? 'di atas' : 'di bawah'} SMA200.`);
  if (m.sma20 !== null && m.sma50 !== null) read.push(`SMA20 ${m.sma20 >= m.sma50 ? 'di atas' : 'di bawah'} SMA50.`);
  if (m.rsi14 !== null) read.push(m.rsi14 >= 70 ? 'RSI ≥ 70: secara konvensional disebut area jenuh beli.' : m.rsi14 <= 30 ? 'RSI ≤ 30: secara konvensional disebut area jenuh jual.' : 'RSI di zona tengah (30–70).');
  if (m.macd) read.push(`Histogram MACD ${m.macd.hist >= 0 ? 'positif' : 'negatif'}.`);
  L.push('', 'POSISI RELATIF (hasil membandingkan angka di atas):');
  read.forEach((x) => L.push(`• ${x}`));
  L.push('', 'KETIDAKPASTIAN: indikator teknikal hanya menggambarkan pergerakan harga masa lalu dan sering memberi sinyal palsu; tidak memperhitungkan fundamental, berita, atau kondisi pasar. Ini bukan rekomendasi beli/jual.', '', `⚠️ ${DISCLAIMER}`);
  return L.join('\n');
}

function renderCompare(list) {
  const ms = list.map((s) => ({ s, m: metrics(s) }));
  const row = (label, f) => `${label.padEnd(14)}${ms.map((x) => String(f(x)).padEnd(18)).join('')}`;
  const L = ['🆚 Perbandingan', ''];
  L.push(row('', (x) => x.s.symbol));
  L.push(row('Harga', (x) => `${num(x.s.price)} ${x.s.currency}`));
  L.push(row('1 bln', (x) => pct(x.m.r1m)));
  L.push(row('3 bln', (x) => pct(x.m.r3m)));
  L.push(row('6 bln', (x) => pct(x.m.r6m)));
  L.push(row('1 thn', (x) => pct(x.m.r1y)));
  L.push(row('YTD', (x) => pct(x.m.ytd)));
  L.push(row('RSI(14)', (x) => (x.m.rsi14 === null ? 'n/a' : dec(x.m.rsi14, 1))));
  L.push(row('vs SMA50', (x) => (x.m.sma50 === null ? 'n/a' : pct((x.s.price / x.m.sma50 - 1) * 100))));
  L.push(row('Volatilitas', (x) => (x.m.vol === null ? 'n/a' : dec(x.m.vol, 1) + '%')));
  L.push(row('Maks. turun', (x) => `${dec(x.m.mdd, 1)}%`));
  L.push('');
  const cur = new Set(list.map((s) => s.currency));
  if (cur.size > 1) L.push(`Catatan: mata uang berbeda (${[...cur].join(', ')}) → bandingkan persentase, bukan harga.`);
  L.push(`Waktu data: ${list.map((s) => `${s.symbol} ${when(s.time)}`).join(' | ')}`);
  L.push('', `⚠️ ${DISCLAIMER}`);
  return L.join('\n');
}

/** "BBCA 40, TLKM 30, BTC 30" -> [{sym, w}] */
function parsePortfolio(text) {
  const items = [];
  for (const part of String(text || '').split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)) {
    const m = part.match(/^(\S+?)\s*[:=\s]\s*(\d+(?:[.,]\d+)?)\s*%?$/);
    if (m) items.push({ sym: m[1], w: parseFloat(m[2].replace(',', '.')) });
    else if (/^\S+$/.test(part)) items.push({ sym: part, w: null });
    else return { error: `Saya tidak paham "${part}". Format: /market portfolio BBCA 40, TLKM 30, BTC 30` };
  }
  if (!items.length) return { error: 'Tulis daftar aset, contoh: /market portfolio BBCA 40, TLKM 30, BTC 30 (angka = bobot %)' };
  if (items.length > 8) return { error: 'Maksimal 8 aset sekaligus.' };
  const withW = items.filter((x) => x.w !== null);
  if (withW.length && withW.length !== items.length) return { error: 'Isi bobot untuk SEMUA aset, atau kosongkan semuanya (bobot dibagi rata).' };
  const total = withW.length ? items.reduce((a, b) => a + b.w, 0) : 0;
  if (withW.length && total <= 0) return { error: 'Total bobot harus lebih dari 0.' };
  items.forEach((x) => {
    x.w = withW.length ? (x.w / total) * 100 : 100 / items.length;
  });
  return { items, normalized: withW.length > 0 && Math.abs(total - 100) > 0.5, total };
}

function renderPortfolio(rows, parsed) {
  const L = ['🧺 Ringkasan portofolio (bobot yang Anda tentukan)', ''];
  let wsum = { r1m: 0, r3m: 0, r1y: 0 };
  let cov = { r1m: 0, r3m: 0, r1y: 0 };
  for (const { item, s } of rows) {
    if (!s) {
      L.push(`• ${item.sym} (${item.w.toFixed(0)}%): data tidak tersedia`);
      continue;
    }
    const m = metrics(s);
    L.push(`• ${s.symbol} → ${item.w.toFixed(1)}% · 1 bln ${pct(m.r1m)} · 3 bln ${pct(m.r3m)} · 1 thn ${pct(m.r1y)} · volatilitas ${m.vol === null ? 'n/a' : dec(m.vol, 0) + '%'}`);
    for (const k of Object.keys(wsum)) {
      if (m[k] !== null) {
        wsum[k] += (item.w / 100) * m[k];
        cov[k] += item.w / 100;
      }
    }
  }
  L.push('');
  const fmt = (k) => (cov[k] > 0.999 ? pct(wsum[k]) : cov[k] > 0 ? `${pct(wsum[k] / cov[k])} (hanya ${(cov[k] * 100).toFixed(0)}% bobot punya data)` : 'n/a');
  L.push('Perkiraan kinerja gabungan (rata-rata tertimbang, anggap bobot tetap sejak awal periode):');
  L.push(`• 1 bln ${fmt('r1m')} · 3 bln ${fmt('r3m')} · 1 thn ${fmt('r1y')}`);
  const top = [...rows].sort((a, b) => b.item.w - a.item.w)[0];
  L.push(`• Aset terbesar: ${top.item.sym} (${top.item.w.toFixed(1)}%) · Jumlah aset: ${rows.length}`);
  if (parsed.normalized) L.push(`• Total bobot yang Anda tulis ${parsed.total.toFixed(1)}% → saya normalkan ke 100%.`);
  const cur = new Set(rows.filter((r) => r.s).map((r) => r.s.currency));
  L.push('', 'KETERBATASAN: mengabaikan kurs antar mata uang' + (cur.size > 1 ? ` (${[...cur].join(', ')})` : '') + ', dividen, biaya, dan penyeimbangan ulang. Hanya menggambarkan masa lalu; bukan saran investasi.');
  L.push('', `⚠️ ${DISCLAIMER}`);
  return L.join('\n');
}

function renderFundamentalsSnapshot(s, symbolInput) {
  const m = metrics(s);
  const isIdx = /\.JK$/i.test(s.symbol);
  const links = isIdx
    ? '• Laporan keuangan emiten IDX: idx.co.id (menu Perusahaan Tercatat → Laporan Keuangan)\n• Peraturan/pengawas: ojk.go.id'
    : '• Laporan resmi (perusahaan AS): sec.gov/edgar\n• Halaman Investor Relations perusahaan yang bersangkutan';
  return [
    `🏢 ${head(s)} → data yang tersedia di bot`,
    `Waktu data: ${when(s.time)}${ageNote(s.time)}`,
    `• Harga terakhir: ${num(s.price)} ${s.currency}`,
    `• Rentang 52 minggu: ${num(m.lo)} – ${num(m.hi)}`,
    `• Perubahan 1 thn: ${pct(m.r1y)} · Volatilitas tahunan (perkiraan): ${m.vol === null ? 'n/a' : dec(m.vol, 1) + '%'}`,
    '',
    'TIDAK tersedia di bot ini (sengaja tidak dikarang): pendapatan, laba, neraca, arus kas, valuasi (PER/PBV), utang, dividen.',
    '',
    'Ambil dari sumber resmi:',
    links,
    '',
    `Cara lanjut: kirim laporan keuangannya (PDF/teks) lalu reply dengan /market fundamentals → saya susun analisis bertahap (bisnis → pendapatan → profitabilitas → neraca → arus kas → valuasi → pertumbuhan → risiko) hanya dari isi dokumen itu, dengan FAKTA, INTERPRETASI, dan KETIDAKPASTIAN dipisah.`,
    '',
    `⚠️ ${DISCLAIMER}`,
  ].join('\n');
}

/* ---------- Berita (Google News RSS) ---------- */
function decode(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}
function parseNewsRss(xml, max = 8) {
  const items = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const pick = (tag) => {
      const r = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return r ? decode(r[1]) : '';
    };
    let title = pick('title');
    const source = pick('source');
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    if (!title) continue;
    items.push({ title, source, link: pick('link'), date: pick('pubDate') });
    if (items.length >= max) break;
  }
  return items;
}
async function fetchNews(query, max = 8) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctl.signal });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return parseNewsRss(await res.text(), max);
  } finally {
    clearTimeout(timer);
  }
}
function renderNews(query, items) {
  if (!items.length) return `Tidak ada berita ditemukan untuk "${query}". Coba kata kunci lain (mis. nama perusahaan).`;
  const L = [`📰 Berita terkait "${query}" (Google News, ${items.length} teratas)`, ''];
  items.forEach((it, i) => {
    let d = '';
    try {
      d = it.date ? new Date(it.date).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }) : '';
    } catch (_) {
      d = '';
    }
    L.push(`${i + 1}. ${it.title}`);
    L.push(`   ${[it.source, d].filter(Boolean).join(' · ')}`);
    if (it.link) L.push(`   ${it.link}`);
  });
  L.push('', 'Catatan: ini hanya judul & tautan dari agregator berita; isi dan keakuratannya tidak diverifikasi bot. Baca artikel aslinya.');
  return L.join('\n');
}

/** Ringkasan fakta untuk diberikan ke AI (hanya data nyata yang sudah kita ambil). */
function factsForAi(s, newsItems) {
  const m = metrics(s);
  const L = [
    `Instrumen: ${head(s)}; mata uang ${s.currency}`,
    `Waktu data: ${when(s.time)} (sumber Yahoo Finance, bisa tertunda)`,
    `Harga: ${num(s.price)}; 52-minggu: ${num(m.lo)}–${num(m.hi)}`,
    `Perubahan: 1bln ${pct(m.r1m)}, 3bln ${pct(m.r3m)}, 6bln ${pct(m.r6m)}, 1thn ${pct(m.r1y)}, YTD ${pct(m.ytd)}`,
    `SMA20 ${num(m.sma20)}, SMA50 ${num(m.sma50)}, SMA200 ${num(m.sma200)}; RSI14 ${m.rsi14 === null ? 'n/a' : dec(m.rsi14, 1)}`,
    `Volatilitas tahunan ${m.vol === null ? 'n/a' : dec(m.vol, 1) + '%'}; penurunan maksimum 1 thn ${dec(m.mdd, 1)}%`,
    '',
    'Judul berita terbaru (Google News):',
    ...(newsItems.length ? newsItems.map((n, i) => `${i + 1}. ${n.title} (${n.source || 'sumber tidak diketahui'})`) : ['(tidak ada berita ditemukan)']),
  ];
  return L.join('\n');
}

module.exports = {
  DISCLAIMER,
  symbolCandidates,
  parseChart,
  fetchSeries,
  friendlyError,
  metrics,
  sma,
  rsi,
  macd,
  emaSeries,
  changeSince,
  renderPrice,
  renderTechnical,
  renderCompare,
  parsePortfolio,
  renderPortfolio,
  renderFundamentalsSnapshot,
  parseNewsRss,
  fetchNews,
  renderNews,
  factsForAi,
};
