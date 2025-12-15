const mineflayer = require('mineflayer');
const express = require('express');

// === Express (Render ping) ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('✅ Minecraft bot alive'));
app.listen(PORT, () => console.log(`🌐 Web server on ${PORT}`));

// === Bot State ===
let bot;
let reconnectDelay = 5000; // start with 5s
let isDancing = false;

// === Config ===
const config = {
  host: 'server.ogdev.qzz.io',
  port: 41140,
  username: 'OGDev_AFK', // ⚠️ FIXED
  version: '1.21.1',
  keepAlive: true,
  checkTimeoutInterval: 60 * 1000,
};

// === Start Bot ===
function startBot() {
  console.log(`🔌 Connecting... (delay=${reconnectDelay}ms)`);

  bot = mineflayer.createBot(config);

  bot.once('spawn', () => {
    console.log('✅ Bot spawned');

    reconnectDelay = 5000; // reset delay on success

    // Restart every 3 hours (clean)
    setTimeout(() => {
      console.log('🔁 Scheduled restart');
      bot.quit('Scheduled restart');
    }, 3 * 60 * 60 * 1000);

    startAntiAFK();
  });

  bot.on('kicked', (reason) => {
    console.warn('👢 Kicked:', reason);
  });

  bot.on('end', () => {
    console.log(`⚠️ Disconnected. Reconnecting in ${reconnectDelay / 1000}s...`);

    setTimeout(startBot, reconnectDelay);

    reconnectDelay = Math.min(reconnectDelay * 1.5, 60000); // cap at 1 min
  });

  bot.on('error', (err) => {
    console.error('❌ Bot error:', err.message);
  });
}

// === Anti-AFK (randomized) ===
function startAntiAFK() {
  setInterval(() => {
    if (!bot || bot.isSleeping || isDancing) return;

    const actions = [
      () => bot.setControlState('jump', true),
      () => bot.look(Math.random() * Math.PI * 2, 0),
      () => bot.setControlState('forward', true),
    ];

    const action = actions[Math.floor(Math.random() * actions.length)];
    action();

    setTimeout(() => {
      bot.clearControlStates();
    }, 400 + Math.random() * 600);
  }, 12000 + Math.random() * 8000);
}

// === Auto sleep ===
botSleepLoop = setInterval(() => {
  if (!bot || bot.isSleeping) return;
  const time = bot.time?.timeOfDay;
  if (time > 12541 && time < 23458) {
    const bed = bot.findBlock({
      matching: b => b.name.endsWith('_bed'),
      maxDistance: 6,
    });
    if (bed) bot.sleep(bed).catch(() => {});
  }
}, 15000);

// === Safety ===
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// === Start ===
startBot();
