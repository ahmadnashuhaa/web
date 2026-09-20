'use strict';
const { Bot } = require('grammy');
const config = require('./config');
const { limiter } = require('./limits');
const { registerBasicCommands } = require('./basic-commands');
const { registerCommands } = require('./commands');

if (!config.botToken) {
  throw new Error('BOT_TOKEN belum diisi di Environment Variables Vercel.');
}

const bot = new Bot(config.botToken);

bot.use(limiter());              // hanya chat pribadi + batas kecepatan + batas jatah AI
registerBasicCommands(bot);      // /start /id /status (admin) + tangkap pesan yang di-forward
registerCommands(bot);           // /product /file /doc /study /code /market /help /menu /settings /history /cancel /undo + bahasa natural

bot.catch((err) => {
  console.error('[bot] error saat memproses update:', err && err.error ? err.error : err);
});

module.exports = { bot };
