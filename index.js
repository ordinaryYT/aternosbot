const mineflayer = require('mineflayer');
const express = require('express');
const fetch = require('node-fetch');

// === Express Server (for Render ping) ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Minecraft bot alive'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

// === OpenRouter API ===
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error('❌ Missing OPENROUTER_API_KEY');
  process.exit(1);
}

// === Bot State ===
let bot;
let reconnectDelay = 5000;

// === Bot Config ===
const config = {
  host: 'server.ogdev.qzz.io',
  port: 41140,
  username: 'OGDev_AFK', // hardcoded as before
  version: '1.21.1',
  keepAlive: true,
};

// === Commands Help Text ===
const commands = {
  '!help': 'Show commands',
  '!coords': 'Show bot coordinates',
  '!sleep': 'Try to sleep if bed nearby',
  '!leave': 'Disconnect bot',
  '!tptome': 'Teleport bot to you (requires operator)',
};

// === Start Bot ===
function startBot() {
  bot = mineflayer.createBot(config);

  bot.once('spawn', () => {
    console.log('✅ Bot spawned');
    reconnectDelay = 5000;
  });

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    if (!message.startsWith('!')) return;

    const cmdMessage = message.slice(1).trim(); // remove ! prefix

    // === Exact commands (manual) ===
    switch (cmdMessage.toLowerCase()) {
      case 'help':
        bot.chat('Commands:');
        for (const c in commands) bot.chat(`${c} - ${commands[c]}`);
        return;
      case 'coords':
        sendCoords();
        return;
      case 'sleep':
        trySleep();
        return;
      case 'leave':
        bot.chat('Goodbye 👋');
        bot.quit('Leave command');
        return;
      case 'tptome':
        bot.chat(`Teleporting to ${username}...`);
        bot.chat(`/tp ${bot.username} ${username}`);
        return;
    }

    // === AI-driven command handling (multiple commands) ===
    try {
      const aiResponse = await askAI(cmdMessage);
      if (!aiResponse) return;

      // Send AI response first
      bot.chat(aiResponse);

      // Determine which commands to execute based on AI response
      const lower = aiResponse.toLowerCase();

      // Command flags
      const cmdsToRun = [];

      if (lower.includes('coordinates') || lower.includes('where')) cmdsToRun.push('coords');
      if (lower.includes('sleep')) cmdsToRun.push('sleep');
      if (lower.includes('leave') || lower.includes('disconnect')) cmdsToRun.push('leave');
      if (lower.includes('teleport') && lower.includes('me')) cmdsToRun.push('tptome');

      // Execute commands sequentially
      for (const c of cmdsToRun) {
        switch (c) {
          case 'coords': sendCoords(); break;
          case 'sleep': trySleep(); break;
          case 'leave': bot.chat('Goodbye 👋'); bot.quit('Leave command'); break;
          case 'tptome': bot.chat(`Teleporting to ${username}...`); bot.chat(`/tp ${bot.username} ${username}`); break;
        }
      }

    } catch (err) {
      console.error('AI error:', err);
    }
  });

  bot.on('end', () => {
    console.log(`⚠️ Disconnected. Reconnecting in ${reconnectDelay / 1000}s`);
    setTimeout(startBot, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, 60000);
  });

  bot.on('error', (err) => {
    console.error('❌ Bot error:', err.message);
  });
}

// === Helper Functions ===
function sendCoords() {
  if (!bot.entity) return;
  const p = bot.entity.position;
  bot.chat(`X:${p.x.toFixed(0)} Y:${p.y.toFixed(0)} Z:${p.z.toFixed(0)}`);
}

function trySleep() {
  const bed = bot.findBlock({ matching: b => b.name.endsWith('_bed'), maxDistance: 6 });
  if (bed) bot.sleep(bed).catch(() => {});
}

// === OpenRouter AI Query ===
async function askAI(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
            You are a helpful Minecraft bot assistant. 
            Keep replies short, friendly, and interpret user requests. 
            The bot supports these commands: !help, !coords, !sleep, !leave, !tptome. 
            If the user asks about commands, explain them in a friendly way. 
            Detect if the user wants to see coordinates, sleep, leave, or teleport, even if phrased differently.
          `
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 50,
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

// === Safety ===
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

// === Start Bot ===
startBot();
