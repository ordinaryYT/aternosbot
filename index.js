const mineflayer = require('mineflayer');
const express = require('express');

// === Express server to keep Render alive ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🟢 AFK bot is running.');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server listening on port ${PORT}`);
});

// === Mineflayer AFK bot ===
const bot = mineflayer.createBot({
  host: 'SlxshyNationCraft.aternos.me', // 🔁 Your Aternos server IP
  port: 25565,
  username: 'NoDiamondForYou',               // 🔁 Any username (no login if online-mode=false)
  version: '1.21.1'                     // 🔁 Must match your server version
});

bot.on('spawn', () => {
  console.log('✅ Bot connected.');

  // Send chat message every 60 seconds
  setInterval(() => {
    bot.chat('Still online... 🌐');
  }, 60000);

  // Jump every 15 seconds to stay active
  setInterval(() => {
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 500);
  }, 15000);
});

bot.on('kicked', (reason) => {
  console.log('⛔ Kicked:', reason);
});

bot.on('end', () => {
  console.log('🔁 Disconnected. Restarting...');
  process.exit(1);
});

bot.on('error', (err) => {
  console.log('❌ Bot error:', err);
});
