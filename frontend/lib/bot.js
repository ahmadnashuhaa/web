'use strict';
const { Bot } = require('grammy');
const config = require('./config');
const { registerOwnerCommands } = require('./owner-commands');
const { registerCatalogWatcher } = require('./catalog-watcher');

if (!config.botToken) {
  throw new Error('BOT_TOKEN belum diisi di Environment Variables Vercel.');
}

const bot = new Bot(config.botToken);

registerOwnerCommands(bot);   // /start /id /status /broadcast
registerCatalogWatcher(bot);  // pantau grup/channel produk

bot.catch((err) => {
  console.error('[bot] error saat memproses update:', err && err.error ? err.error : err);
});

module.exports = { bot };
