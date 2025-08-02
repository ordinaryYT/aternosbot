const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const express = require('express');

// === Express Web Server (for Render ping) ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('✅ Minecraft Bot is running on Render.'));
app.listen(PORT, () => {
  console.log(`🌐 Web server is listening on port ${PORT}`);
});

// === Minecraft Bot Configuration ===
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
  coords: "Shows my coordinates",
  dance: "Bot dances",
  sleep: "Sleeps",
  spawn: "Teleport you to spawn"
};

function startBot() {
  bot = mineflayer.createBot(config);

  bot.once('spawn', () => {
    console.log('✅ Bot connected.');

    // Jump every 15 seconds when idle
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

    // === Help Command ===
    if (cmd === 'help') {
      bot.chat("Available commands:");
      for (const c in commands) {
        bot.chat(`- ${c}: ${commands[c]}`);
      }
    }

    // === Coords Command ===
    if (cmd === 'coords') {
      const pos = bot.entity.position;
      bot.chat(`📍 My coords: X:${pos.x.toFixed(1)} Y:${pos.y.toFixed(1)} Z:${pos.z.toFixed(1)}`);
    }

    // === Dance Command ===
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

    // === Sleep Command ===
    if (cmd === 'sleep') {
      trySleep();
    }

    // === Teleport to Spawn Command ===
    if (message.toLowerCase() === 'diamond teleport me to spawn') {
      const spawnCoords = { x: 100, y: 64, z: -50 }; // Change to your spawn coords
      bot.chat(`/tp ${username} ${spawnCoords.x} ${spawnCoords.y} ${spawnCoords.z}`);
      bot.chat(`✅ Teleported ${username} to spawn!`);
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

  bot.on('end', () => {
    console.log("⚠️ Bot disconnected (end). Reconnecting immediately...");
    startBot(); // reconnect instantly
  });

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
