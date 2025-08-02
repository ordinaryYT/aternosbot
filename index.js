const mineflayer = require('mineflayer');
const express = require('express');

// === Express Web Server ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Minecraft Bot is running.'));
app.listen(PORT, () => console.log(`🌐 Web server listening on ${PORT}`));

// === Bot Config ===
let bot;

const config = {
  host: 'SlxshyNationCraft.aternos.me',
  port: 38931,
  username: 'NoDiamondForYou',
  version: '1.21.1'
};

const commands = {
  help: "Shows all commands",
  coords: "Shows my coordinates",
  rickroll: "Plays Never Gonna Give You Up from tuned note blocks"
};

// === Song order (indexes correspond to positions array) ===
const song = [
  0, 0, 1, 0, 2, 3,   // "Never gonna give you up"
  0, 0, 4, 0, 5, 6,   // "Never gonna let you down"
  0, 0, 1, 0, 2, 3,   // "Never gonna run around"
  0, 0, 7, 0, 5, 4    // "and desert you"
];

// === Start Bot ===
function startBot() {
  bot = mineflayer.createBot(config);

  bot.once('spawn', () => {
    console.log('✅ Bot connected.');
    bot.chat("✅ Bot is online! Type !help for commands.");
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

    if (cmd === 'rickroll' || cmd === '!rickroll') {
      bot.chat("🎵 Playing Rickroll...");
      try {
        await playRickroll();
      } catch (err) {
        console.error("❌ Rickroll failed:", err);
        bot.chat("❌ Failed to play Rickroll: " + err.message);
      }
    }
  });

  async function playRickroll() {
    // Get positions for the 8 blocks around the bot
    const center = bot.entity.position.floored();
    const positions = [
      center.offset(1, 0, 0),   // Grass Block (G)
      center.offset(1, 0, 1),   // Oak Planks (A)
      center.offset(0, 0, 1),   // Stone (E)
      center.offset(-1, 0, 1),  // Sand (D)
      center.offset(-1, 0, 0),  // Gold Block (F)
      center.offset(-1, 0, -1), // Clay (C high)
      center.offset(0, 0, -1),  // Bone Block (E high)
      center.offset(1, 0, -1)   // Emerald Block (G high)
    ];

    for (let noteIndex of song) {
      const block = bot.blockAt(positions[noteIndex]);
      if (block && block.name === 'note_block') {
        await bot.activateBlock(block);
      }
      await bot.waitForTicks(6); // short gap between notes
    }

    bot.chat("✅ Rickroll complete!");
  }

  bot.on('end', () => {
    console.log("⚠️ Disconnected, reconnecting...");
    startBot();
  });

  bot.on('error', (err) => console.error('❌ Bot error:', err));
}

startBot();
