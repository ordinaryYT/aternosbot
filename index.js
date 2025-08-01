const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
  host: 'SlxshyNationCraft.aternos.me', // 🔁 Replace with your Aternos IP
  port: 25565,
  username: 'Server',        // 🔁 Choose any username
  version: '1.21.1'
});

bot.on('spawn', () => {
  console.log('✅ Bot connected.');

  setInterval(() => {
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 500);
  }, 15000);
});

bot.on('end', () => {
  console.log('🔁 Disconnected. Restarting...');
  process.exit(1); // Let Render restart it
});

bot.on('error', (err) => {
  console.error('❌ Bot error:', err);
});
