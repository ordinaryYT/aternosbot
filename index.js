const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const express = require('express');
const mcData = require('minecraft-data');

// === Express Web Server ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Minecraft Bot is running.'));
app.listen(PORT, () => console.log(`🌐 Web server listening on ${PORT}`));

// === Bot Config ===
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
  });

  // === Chat Commands ===
  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    const args = message.trim().split(' ');
    const cmd = args[0].toLowerCase();

    if (cmd === 'help' || cmd === '!help') {
      bot.chat("Available commands:");
      for (const c in commands) bot.chat(`- ${c}: ${commands[c]}`);
    }

    if (cmd === 'coords' || cmd === '!coords') {
      const pos = bot.entity.position;
      bot.chat(`📍 X:${pos.x.toFixed(1)} Y:${pos.y.toFixed(1)} Z:${pos.z.toFixed(1)}`);
    }

    if (cmd === 'dance' || cmd === '!dance') {
      if (bot.isSleeping) return bot.chat("😴 Can't dance while sleeping!");
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

    if (cmd === 'sleep' || cmd === '!sleep') trySleep();

    if (cmd === 'rickroll' || cmd === '!rickroll') {
      bot.chat("🎵 Starting Rickroll...");
      try {
        await playRickroll();
      } catch (err) {
        console.error("❌ Rickroll failed:", err);
        bot.chat("❌ Failed to play Rickroll: " + err.message);
      }
    }
  });

  // === Move Bot Forward ===
  async function walkForward(distance) {
    return new Promise((resolve) => {
      const targetZ = bot.entity.position.z + distance;
      bot.setControlState('forward', true);
      const check = setInterval(() => {
        if (Math.abs(bot.entity.position.z - targetZ) < 0.5) {
          bot.setControlState('forward', false);
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  // === Rickroll Function ===
  async function playRickroll() {
    const song = [
      { pitch: 7, delay: 4 },
      { pitch: 7, delay: 4 },
      { pitch: 9, delay: 4 },
      { pitch: 7, delay: 4 },
      { pitch: 4, delay: 4 },
      { pitch: 2, delay: 8 },
      { pitch: 7, delay: 4 },
      { pitch: 7, delay: 4 },
      { pitch: 9, delay: 4 },
      { pitch: 7, delay: 4 },
      { pitch: 5, delay: 4 },
      { pitch: 4, delay: 8 }
    ];

    const noteBlockItem = bot.inventory.items().find(item => item.name === 'note_block');
    if (!noteBlockItem) {
      bot.chat('❌ I need note blocks in my inventory!');
      return;
    }

    // Face forward for consistent placement
    bot.look(0, 0, true);

    for (let i = 0; i < song.length; i++) {
      // Move forward for each note
      if (i > 0) await walkForward(1);

      // Position to the right
      const placePos = bot.entity.position.floored().offset(1, 0, 0);
      const blockBelow = bot.blockAt(placePos.offset(0, -1, 0));
      if (!blockBelow || blockBelow.name === 'air') {
        bot.chat(`❌ No solid block under note ${i + 1}`);
        return;
      }

      // Place note block
      await bot.equip(noteBlockItem, 'hand');
      try {
        await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));
      } catch (err) {
        console.error(`❌ Failed placing at ${placePos}:`, err);
      }

      // Tune block
      const placedBlock = bot.blockAt(placePos);
      if (placedBlock && placedBlock.name === 'note_block') {
        for (let t = 0; t < song[i].pitch; t++) {
          await bot.activateBlock(placedBlock);
          await bot.waitForTicks(2);
        }
      }

      // Play it
      if (placedBlock) await bot.activateBlock(placedBlock);
      await bot.waitForTicks(song[i].delay);
    }

    bot.chat("✅ Rickroll complete!");
  }

  // === Sleep Helper ===
  function trySleep() {
    const bed = bot.findBlock({
      matching: block => block.name.endsWith('_bed')
    });
    if (!bed) return bot.chat("🛏 No bed nearby!");
    bot.sleep(bed)
      .then(() => bot.chat("💤 Sleeping..."))
      .catch(err => {
        console.error('❌ Failed to sleep:', err);
        bot.chat("❌ Can't sleep: " + err.message);
      });
  }

  bot.on('time', () => {
    const time = bot.time.timeOfDay;
    const isNight = time > 12541 && time < 23458;
    if (isNight && !bot.isSleeping) trySleep();
  });

  bot.on('end', () => {
    console.log("⚠️ Disconnected, reconnecting...");
    startBot();
  });

  bot.on('error', (err) => console.error('❌ Bot error:', err));
  process.on('unhandledRejection', (reason) => console.error('🛑 Unhandled Promise:', reason));
  process.on('uncaughtException', (err) => console.error('🔥 Uncaught Exception:', err));
}

startBot();
