const mineflayer = require('mineflayer');
const autoFish = require('mineflayer-auto-fish');

const bot = mineflayer.createBot({
  host: 'SlxshyNationCraft.aternos.me',
  port: 38931,
  username: 'NoDiamondForYou',
  version: '1.21.1'
});

bot.loadPlugin(autoFish);

// Store whether auto-fish is active
let fishing = false;

// Available commands
const commands = {
  help: "Shows all commands",
  fish: "Toggle auto-fishing on/off",
  sleep: "Manually try to sleep",
};

bot.on('spawn', () => {
  console.log('✅ Bot connected.');

  // Keep jumping every 15 seconds (AFK prevention)
  setInterval(() => {
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 500);
  }, 15000);
});

// Chat command handler
bot.on('chat', (username, message) => {
  if (username === bot.username) return; // Ignore itself

  const args = message.trim().split(' ');
  const cmd = args[0].toLowerCase();

  if (cmd === 'help') {
    bot.chat("Available commands:");
    for (const c in commands) {
      bot.chat(`- ${c}: ${commands[c]}`);
    }
  }

  if (cmd === 'fish') {
    fishing = !fishing;
    if (fishing) {
      bot.chat("🎣 Auto-fishing started.");
      bot.autoFish.start();
    } else {
      bot.chat("🛑 Auto-fishing stopped.");
      bot.autoFish.stop();
    }
  }

  if (cmd === 'sleep') {
    trySleep();
  }
});

// Auto sleep at night
bot.on('time', () => {
  const time = bot.time.timeOfDay;
  const isNight = time > 12541 && time < 23458;
  if (isNight && !bot.isSleeping) {
    trySleep();
  }
});

function trySleep() {
  const bed = bot.findBlock({
    matching: bot.registry.blocksByName.white_bed.id
  });
  if (!bed) {
    bot.chat("🛏 No bed nearby!");
    return;
  }
  bot.sleep(bed).then(() => {
    bot.chat("💤 Sleeping...");
  }).catch(err => {
    bot.chat("❌ Can't sleep: " + err.message);
  });
}

bot.on('end', () => {
  console.log('🔁 Disconnected. Restarting...');
  process.exit(1);
});

bot.on('error', (err) => {
  console.error('❌ Bot error:', err);
});
