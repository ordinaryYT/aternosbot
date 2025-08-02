const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const express = require('express');
const mcData = require('minecraft-data');

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
  sleep: "Sleeps in a bed",
  rickroll: "Plays Never Gonna Give You Up with note blocks"
};

// === Start Bot ===
function startBot() {
  bot = mineflayer.createBot(config);
  const versionData = mcData(bot.version);

  bot.once('spawn', () => {
    console.log('✅ Bot connected.');
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

  // === Chat Commands ===
  bot.on('chat', async (username, message) => {
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

    if (cmd === 'rickroll') {
      bot.chat("🎵 Get ready to never give you up!");
      await playRickroll();
    }
  });

  // === Rickroll Function ===
  async function playRickroll() {
    // Simple melody (recognizable intro phrase)
    const song = [
      { pitch: 7, delay: 4 },  // G
      { pitch: 7, delay: 4 },  // G
      { pitch: 9, delay: 4 },  // A
      { pitch: 7, delay: 4 },  // G
      { pitch: 4, delay: 4 },  // E
      { pitch: 2, delay: 8 },  // D
      { pitch: 7, delay: 4 },
      { pitch: 7, delay: 4 },
      { pitch: 9, delay: 4 },
      { pitch: 7, delay: 4 },
      { pitch: 5, delay: 4 },  // F
      { pitch: 4, delay: 8 }   // E
    ];

    const startPos = bot.entity.position.offset(1, 0, 0);
    const noteBlockItem = bot.inventory.items().find(item => item.name === 'note_block');
    if (!noteBlockItem) {
      bot.chat('❌ I need note blocks in my inventory!');
      return;
    }

    // Place fixed set of blocks (1 per unique pitch in sequence length)
    for (let i = 0; i < song.length; i++) {
      const placePos = startPos.offset(i, 0, 0);
      const blockBelow = bot.blockAt(placePos.offset(0, -1, 0));

      await bot.equip(noteBlockItem, 'hand');
      await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));

      const placedBlock = bot.blockAt(placePos);

      // Tune block
      for (let t = 0; t < song[i].pitch; t++) {
        await bot.activateBlock(placedBlock);
        await bot.waitForTicks(2);
      }
    }

    // Play in sequence
    for (let i = 0; i < song.length; i++) {
      const notePos = startPos.offset(i, 0, 0);
      const noteBlock = bot.blockAt(notePos);
      await bot.activateBlock(noteBlock);
      await bot.waitForTicks(song[i].delay);
    }

    bot.chat("✅ Rickroll complete!");
  }

  // === Sleep Helper ===
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

  bot.on('time', () => {
    const time = bot.time.timeOfDay;
    const isNight = time > 12541 && time < 23458;
    if (isNight && !bot.isSleeping) {
      trySleep();
    }
  });

  bot.on('end', () => {
    console.log("⚠️ Bot disconnected (end). Reconnecting immediately...");
    startBot();
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
