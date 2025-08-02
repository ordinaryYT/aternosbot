const mineflayer = require('mineflayer');
const Vec3 = require('vec3');
const express = require('express');

// === Web server to keep bot alive ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Bot is running.'));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// === Bot setup ===
let bot;
let isDancing = false;

const config = {
  host: 'SlxshyNationCraft.aternos.me',
  port: 38931,
  username: 'NoDiamondForYou',
  version: '1.21.1'
};

// === Embedded Song Data ===
const riptideSong = [
  { note: 5, tick: 0 },
  { note: 7, tick: 2 },
  { note: 9, tick: 4 },
  { note: 7, tick: 6 },
  { note: 5, tick: 8 }
];

// === Command Descriptions ===
const commands = {
  help: "Show all commands",
  coords: "Show my coordinates",
  dance: "Make the bot dance",
  sleep: "Bot goes to bed",
  music: "Play nearby note blocks",
  play: "Play a custom song like 'play riptide'"
};

// === Start Bot ===
function startBot() {
  bot = mineflayer.createBot(config);

  bot.once('spawn', () => {
    console.log('✅ Bot connected to server.');
  });

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;

    const args = message.trim().split(' ');
    const cmd = args[0].toLowerCase();

    if (cmd === 'help') {
      bot.chat("Available commands:");
      for (const c in commands) bot.chat(`- ${c}: ${commands[c]}`);
    }

    if (cmd === 'coords') {
      const pos = bot.entity.position;
      bot.chat(`📍 X:${pos.x.toFixed(1)} Y:${pos.y.toFixed(1)} Z:${pos.z.toFixed(1)}`);
    }

    if (cmd === 'dance') {
      if (bot.isSleeping) return bot.chat("😴 Can't dance while sleeping!");
      bot.chat("💃 Dancing!");
      isDancing = true;
      let jumps = 0;
      const interval = setInterval(() => {
        if (jumps >= 10 || bot.isSleeping) {
          clearInterval(interval);
          bot.setControlState('jump', false);
          bot.chat("🛑 Dance finished.");
          isDancing = false;
        } else {
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 300);
          jumps++;
        }
      }, 600);
    }

    if (cmd === 'sleep') trySleep();

    if (cmd === 'music') {
      const noteBlocks = bot.findBlocks({
        matching: block => block.name === 'note_block',
        maxDistance: 10,
        count: 8
      });

      if (noteBlocks.length === 0) {
        bot.chat("❌ No note blocks nearby.");
        return;
      }

      bot.chat("🎼 Playing nearby note blocks...");
      let i = 0;
      const interval = setInterval(() => {
        if (i >= noteBlocks.length) {
          clearInterval(interval);
          bot.chat("✅ Done!");
          return;
        }
        const block = bot.blockAt(noteBlocks[i]);
        if (block && bot.canSeeBlock(block)) bot.activateBlock(block);
        i++;
      }, 700);
    }

    if (cmd === 'play') {
      const songName = args[1]?.toLowerCase();
      if (!songName) return bot.chat("❌ Usage: play <songname>");

      if (songName === 'riptide') {
        const song = riptideSong;
        if (!Array.isArray(song) || song.length === 0) {
          bot.chat("❌ Riptide song is not available.");
          return;
        }

        try {
          const base = bot.entity.position.offset(2, 0, 0);
          bot.chat("🎵 Building Riptide...");
          await buildNoteGrid(song, base);
          bot.chat("▶️ Playing Riptide...");
          playSong(song, base);
        } catch (err) {
          console.error(err);
          bot.chat("❌ Failed to play song: " + err.message);
        }
      } else {
        bot.chat(`❌ Unknown song: '${songName}'`);
      }
    }
  });

  // === Sleep Function ===
  function trySleep() {
    const bed = bot.findBlock({
      matching: block => block.name.endsWith('_bed')
    });

    if (!bed) {
      bot.chat("🛏 No bed nearby.");
      return;
    }

    bot.sleep(bed).then(() => {
      bot.chat("💤 Sleeping...");
    }).catch(err => {
      console.error('❌ Sleep error:', err);
      bot.chat("❌ Can't sleep: " + err.message);
    });
  }

  // === Build Note Grid ===
  async function buildNoteGrid(song, base) {
    const dirtId = bot.registry.itemsByName.dirt.id;
    const noteBlockId = bot.registry.itemsByName.note_block.id;

    for (let i = 0; i < song.length; i++) {
      const pos = base.offset(i, 0, 0);
      const below = pos.offset(0, -1, 0);

      // Place dirt block underneath
      await bot.creative.setInventorySlot(36, dirtId, null);
      await bot.waitForTicks(2);
      const underBlock = bot.blockAt(below.offset(0, -1, 0));
      if (underBlock) {
        await bot.placeBlock(underBlock, new Vec3(0, 1, 0));
        await bot.waitForTicks(2);
      }

      // Place note block on top of dirt
      await bot.creative.setInventorySlot(36, noteBlockId, null);
      await bot.waitForTicks(2);
      const dirtBlock = bot.blockAt(below);
      if (dirtBlock) {
        await bot.placeBlock(dirtBlock, new Vec3(0, 1, 0));
        await bot.waitForTicks(2);
      }

      // Tune the note block
      const block = bot.blockAt(pos);
      for (let n = 0; n < song[i].note; n++) {
        if (block) await bot.activateBlock(block);
        await bot.waitForTicks(1);
      }
    }
  }

  // === Play Song ===
  function playSong(song, base) {
    let tick = 0;
    let i = 0;

    const interval = setInterval(() => {
      while (i < song.length && song[i].tick === tick) {
        const pos = base.offset(i, 0, 0);
        const block = bot.blockAt(pos);
        if (block) bot.activateBlock(block);
        i++;
      }
      tick++;
      if (i >= song.length) {
        clearInterval(interval);
        bot.chat("✅ Riptide finished!");
      }
    }, 100); // 1 tick = 100ms
  }

  // === Error Handling ===
  bot.on('end', () => {
    console.log("⚠️ Bot disconnected. Reconnecting...");
    startBot();
  });

  bot.on('error', (err) => {
    console.error('❌ Bot error:', err);
  });
}

startBot();
