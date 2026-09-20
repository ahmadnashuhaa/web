'use strict';
const { Bot } = require('grammy');
const config = require('./config');
const { registerOwnerCommands } = require('./owner-commands');
const { registerCommands } = require('./commands');
const { registerCatalogWatcher } = require('./catalog-watcher');

if (!config.botToken) {
  throw new Error('BOT_TOKEN belum diisi di Environment Variables Vercel.');
}

const bot = new Bot(config.botToken);

registerOwnerCommands(bot);   // /start /id /status /broadcast + tangkap pesan yang di-forward
registerCommands(bot);        // /product /file /doc /study /code /market /help /menu /settings /history /cancel /undo + bahasa natural
registerCatalogWatcher(bot);  // pantau grup/channel produk

bot.catch((err) => {
  console.error('[bot] error saat memproses update:', err && err.error ? err.error : err);
});

module.exports = { bot };