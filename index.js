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
  host: 'server.ogdev.qzz.io',
  port: 41140,   
  username: 'Omg nut in my ass daddy',
  version: '1.21.1'
};

const commands = {

  
};

function startBot() {
  bot = mineflayer.createBot(config);

  bot.once('spawn', () => {
    console.log('✅ Bot connected.');

    // Restart every 3 hours
    setTimeout(() => {
      console.log("🔁 Restarting bot after 3 hours...");
      bot.quit(); // will trigger reconnect logic in bot.on('end')
    }, 3 * 60 * 60 * 1000);

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

    // === Help Command (only command that sends chat messages) ===
    if (cmd === 'help') {
      bot.chat("");
      for (const c in commands) {
        bot.chat(`- ${c}: ${commands[c]}`);
      }
    }

    // === Silent Coords Command ===
    if (cmd === 'coords') {
      // Silent: no chat output
    }

    // === Silent Dance Command ===
    if (cmd === 'dance') {
      if (bot.isSleeping) return;

      isDancing = true;
      let jumps = 0;
      const danceInterval = setInterval(() => {
        if (jumps >= 10 || bot.isSleeping) {
          clearInterval(danceInterval);
          bot.setControlState('jump', false);
          isDancing = false;
        } else {
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 300);
          jumps++;
        }
      }, 600);
    }

    // === Silent Sleep Command ===
    if (cmd === 'sleep') {
      trySleep();
    }

    // === Silent Teleport to Spawn Command ===
    if (message.toLowerCase() === 'diamond teleport me to spawn') {
      const spawnCoords = { x: 24278, y: 71, z: 25154 }; // Change to your spawn coords
      bot.chat(`/tp ${username} ${spawnCoords.x} ${spawnCoords.y} ${spawnCoords.z}`);
    }
  });

  // Auto sleep at night (silently)
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

    if (!bed) return;

    bot.sleep(bed).catch(() => {});
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
