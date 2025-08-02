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
  rickroll: "Plays Never Gonna Give You Up using note blocks"
};

// === Start Bot ===
function startBot() {
  bot = mineflayer.createBot(config);
  const versionData = mcData(bot.version);

  bot.once('spawn', () => {
    console.log('✅ Bot connected.');
  });

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
      bot.chat("🎵 Setting up Rickroll stage...");
      try {
        await buildRickrollStage();
        await playRickroll();
      } catch (err) {
        console.error("❌ Rickroll failed:", err);
        bot.chat("❌ Failed to play Rickroll: " + err.message);
      }
    }
  });

  // === Block types for instruments ===
  const instrumentBlocks = [
    'grass_block', // Harp/Piano
    'oak_planks',  // Bass
    'stone',       // Bass Drum
    'sand',        // Snare
    'gold_block',  // Bell
    'clay',        // Flute
    'bone_block',  // Xylophone
    'emerald_block'// Bit
  ];

  // === Rickroll Notes ===
  const pitches = [7, 9, 4, 2, 5, 12, 16, 19]; // One per block in ring

  // Chorus melody (sequence of block indexes to hit)
  const song = [
    0,0,1,0,2,3,   // "Never gonna give you up"
    0,0,4,0,5,6,   // "Never gonna let you down"
    0,0,1,0,2,3,   // "Never gonna run around"
    0,0,7,0,5,4    // "and desert you"
  ];

  // === Build Stage ===
  async function buildRickrollStage() {
    const noteBlockItem = bot.inventory.items().find(item => item.name === 'note_block');
    if (!noteBlockItem) {
      bot.chat('❌ I need note blocks in my inventory!');
      throw new Error('No note blocks in inventory');
    }

    // Positions around bot (ring)
    const center = bot.entity.position.floored();
    const positions = [
      center.offset(1, 0, 0),
      center.offset(1, 0, 1),
      center.offset(0, 0, 1),
      center.offset(-1, 0, 1),
      center.offset(-1, 0, 0),
      center.offset(-1, 0, -1),
      center.offset(0, 0, -1),
      center.offset(1, 0, -1)
    ];

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const blockBelowPos = pos.offset(0, -1, 0);

      // Place instrument block under note block
      const blockItem = bot.inventory.items().find(item => item.name === instrumentBlocks[i]);
      if (!blockItem) {
        bot.chat(`❌ Missing ${instrumentBlocks[i]} for instrument ${i}`);
        continue;
      }
      await bot.equip(blockItem, 'hand');
      await bot.placeBlock(bot.blockAt(blockBelowPos), new Vec3(0, 1, 0));

      // Place note block
      await bot.equip(noteBlockItem, 'hand');
      await bot.placeBlock(bot.blockAt(pos.offset(0, -1, 0)), new Vec3(0, 1, 0));

      // Tune note block
      const placed = bot.blockAt(pos);
      if (placed && placed.name === 'note_block') {
        for (let t = 0; t < pitches[i]; t++) {
          await bot.activateBlock(placed);
          await bot.waitForTicks(2);
        }
      }
    }
  }

  // === Play Song ===
  async function playRickroll() {
    const center = bot.entity.position.floored();
    const positions = [
      center.offset(1, 0, 0),
      center.offset(1, 0, 1),
      center.offset(0, 0, 1),
      center.offset(-1, 0, 1),
      center.offset(-1, 0, 0),
      center.offset(-1, 0, -1),
      center.offset(0, 0, -1),
      center.offset(1, 0, -1)
    ];

    bot.chat("🎶 Playing Rickroll chorus...");
    for (let noteIndex of song) {
      const blockToPlay = bot.blockAt(positions[noteIndex]);
      if (blockToPlay && blockToPlay.name === 'note_block') {
        await bot.activateBlock(blockToPlay);
      }
      await bot.waitForTicks(6);
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
