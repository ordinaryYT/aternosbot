const mineflayer = require('mineflayer');
const Vec3 = require('vec3');

let bot;
let isDancing = false;

const config = {
  host: 'SlxshyNationCraft.aternos.me',
  port: 38931,
  username: 'NoDiamondForYou',
  version: '1.21.1'
};

const commands = {
  help: "Shows all commands",
  coords: "Shows bot's coordinates",
  dance: "Bot jumps repeatedly for fun",
  sleep: "Tries to sleep in a nearby bed"
};

function startBot() {
  bot = mineflayer.createBot(config);

  bot.once('spawn', () => {
    console.log('✅ Bot connected.');

    // Jump every 15s unless sleeping or dancing
    setInterval(() => {
      if (!bot.isSleeping && !isDancing) {
        try {
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 500);
        } catch (err) {
          console.error('❌ Jump error:', err);
        }
      }
    }, 15000);
  });

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
      if (bot.isSleeping) {
        bot.chat("😴 I can't dance while sleeping!");
        return;
      }

      bot.chat("💃 Dancing!");
      isDancing = true;
      let jumps = 0;
      const danceInterval = setInterval(() => {
        if (jumps >= 10 || bot.isSleeping) {
          clearInterval(danceInterval);
          bot.setControlState('jump', false);
          bot.chat("🛑 Dance finished");
          isDancing = false;
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
      console.error('❌ Failed to sleep:', err);
      bot.chat("❌ Can't sleep: " + err.message);
    });
  }

  // RECONNECT ONLY AFTER KICK (5 MIN)
  bot.on('kicked', (reason) => {
    console.log('👢 Bot was kicked:', reason);
    console.log("⏳ Reconnecting in 5 minutes...");
    setTimeout(() => {
      console.log("🔁 Reconnecting after kick...");
      startBot();
    }, 5 * 60 * 1000); // 5 minutes
  });

  // IMMEDIATE RECONNECT ON DISCONNECT
  bot.on('end', () => {
    console.log("⚠️ Bot disconnected (end). Reconnecting immediately...");
    startBot();
  });

  // ERROR LOGGING ONLY
  bot.on('error', (err) => {
    console.error('❌ Bot error:', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('🛑 Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('🔥 Uncaught Exception:', err);
  });
}

startBot();
