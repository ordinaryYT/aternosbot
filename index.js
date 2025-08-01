const mineflayer = require('mineflayer');
const Vec3 = require('vec3');

const bot = mineflayer.createBot({
  host: 'SlxshyNationCraft.aternos.me',
  port: 38931,
  username: 'NoDiamondForYou',
  version: '1.21.1'
});

// Command list
const commands = {
  help: "Shows all commands",
  coords: "Shows bot's coordinates",
  dance: "Bot jumps repeatedly for fun",
  sleep: "Tries to sleep in a nearby bed"
};

bot.once('spawn', () => {
  console.log('✅ Bot connected.');

  // Keep jumping every 15s to prevent AFK kick
  setInterval(() => {
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 500);
  }, 15000);
});

// Chat command handler
bot.on('chat', (username, message) => {
  if (username === bot.username) return;

  const args = message.trim().split(' ');
  const cmd = args[0].toLowerCase();

  if (cmd === 'help') {
    bot.chat("Available commands:");
    for (const c in commands) {
      bot.chat(`- ${c}: ${commands[c]}`);
    }
  }

  if (cmd === 'coords') {
    const pos = bot.entity.position;
    bot.chat(`📍 My coords: X:${pos.x.toFixed(1)} Y:${pos.y.toFixed(1)} Z:${pos.z.toFixed(1)}`);
  }

  if (cmd === 'dance') {
    bot.chat("💃 Dancing!");
    let jumps = 0;
    const danceInterval = setInterval(() => {
      if (jumps >= 10) {
        clearInterval(danceInterval);
        bot.setControlState('jump', false);
        bot.chat("🛑 Dance finished");
      } else {
        bot.setControlState('jump', true);
        setTimeout(() => bot.setControlState('jump', false), 300);
        jumps++;
      }
    }, 600);
  }

  if (cmd === 'sleep') {
    trySleep();
  }
});

// Auto-sleep at night
bot.on('time', () => {
  const time = bot.time.timeOfDay;
  const isNight = time > 12541 && time < 23458;
  if (isNight && !bot.isSleeping) {
    trySleep();
  }
});

function trySleep() {
  const bed = bot.findBlock({
    matching: block => block.name.endsWith('_bed')
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
