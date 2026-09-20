'use strict';
/**
 * Klien tipis untuk memanggil AI dari dalam bot (versi GRATIS: Google Gemini API, free tier).
 * Dipakai oleh /doc, /study, /code, /file (mode teks + OCR), /product analyze, dan /market research.
 *
 * Kalau GEMINI_API_KEY belum diisi, semua pemanggilan gagal dengan pesan yang RAMAH
 * (bukan stack trace teknis) → sesuai prinsip error handling di Master Prompt bagian 25.
 */
const config = require('./config');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_INLINE_BYTES = 14 * 1024 * 1024; // batas kirim file ke AI (base64 ~ +33%, limit request 20 MB)

function friendly(message) {
  const err = new Error(message);
  err.friendly = true;
  return err;
}

/** Panggilan mentah ke Gemini. `parts` = isi pesan pengguna (teks dan/atau file). */
async function generate(systemPrompt, parts, maxTokens) {
  if (!config.aiApiKey) {
    throw friendly('Fitur ini butuh AI tapi GEMINI_API_KEY belum diisi di Environment Variables Vercel.');
  }

  let res;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(config.aiModel)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.aiApiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        // x2 sebagai ruang cadangan kalau model memakai token "berpikir" sebelum menjawab
        generationConfig: { maxOutputTokens: maxTokens * 2 },
      }),
    });
  } catch (e) {
    throw friendly('Gagal terhubung ke layanan AI (masalah jaringan).');
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw friendly('Layanan AI mengembalikan jawaban yang tidak bisa dibaca. Coba lagi sebentar lagi.');
  }

  if (res.status === 429) {
    throw friendly('Kuota gratis AI sedang habis (batas per menit/per hari). Coba lagi nanti.');
  }
  if (data.error) {
    throw friendly(`Layanan AI menolak permintaan: ${data.error.message || data.error.status || 'error tidak diketahui'}`);
  }
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw friendly('Permintaan diblokir oleh filter keamanan layanan AI. Coba ubah isi teksnya.');
  }

  const out = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const text = out
    .map((p) => p.text || '')
    .join('\n')
    .trim();
  return text || '(AI tidak mengembalikan teks apa pun.)';
}

/** Panggil AI sekali (tanpa histori percakapan) dan kembalikan teks jawabannya. */
async function ask(systemPrompt, userText, { maxTokens = 1500, maxChars = 50000 } = {}) {
  return generate(systemPrompt, [{ text: String(userText).slice(0, maxChars) }], maxTokens);
}

/** Kirim gambar/PDF (base64) + instruksi ke AI → dipakai untuk OCR dokumen scan/foto. */
async function askWithFile(systemPrompt, userText, { mimeType, buffer }, { maxTokens = 3000 } = {}) {
  if (!buffer || buffer.length > MAX_INLINE_BYTES) {
    throw friendly('File terlalu besar untuk dibaca AI (maksimal sekitar 14 MB).');
  }
  return generate(
    systemPrompt,
    [{ inline_data: { mime_type: mimeType, data: buffer.toString('base64') } }, { text: String(userText) }],
    maxTokens
  );
}

const toSafe = (fn) => async (...args) => {
  try {
    return { ok: true, text: await fn(...args) };
  } catch (e) {
    return { ok: false, reason: e.friendly ? e.message : 'Terjadi kesalahan saat memproses dengan AI.' };
  }
};

/** Bungkus supaya errornya sudah dalam bentuk siap dikirim balik ke Telegram. */
const askSafe = toSafe(ask);
const askWithFileSafe = toSafe(askWithFile);

module.exports = { ask, askSafe, askWithFile, askWithFileSafe };
