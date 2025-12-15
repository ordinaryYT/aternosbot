import mineflayer from 'mineflayer';
import express from 'express';
import fetch from 'node-fetch';
import pkg from 'pg';
const { Pool } = pkg;

// === Express Server ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ Minecraft bots alive'));
app.listen(PORT, () => console.log(`🌐 Web server on port ${PORT}`));

// === Environment Variables ===
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!OPENROUTER_API_KEY || !DATABASE_URL) {
  console.error('❌ Missing OPENROUTER_API_KEY or DATABASE_URL');
  process.exit(1);
}

// === Postgres Pool ===
const pool = new Pool({ connectionString: DATABASE_URL });

// === Bot Configurations ===
const BOT_CONFIGS = [
  { username: 'OGBot', host: 'server.ogdev.qzz.io', port: 41140, prefix: '!!' },
  { username: 'TLJBot', host: 'server.ogdev.qzz.io', port: 41140, prefix: '!' },
];

const COMMANDS = ['help','coords','sleep','leave','tptome','s','savelocation','loadlocations'];

// === Start All Bots ===
for (const cfg of BOT_CONFIGS) {
  startBot(cfg);
}

function startBot(cfg) {
  let bot;
  let reconnectDelay = 5000;

  async function connectBot() {
    bot = mineflayer.createBot({
      host: cfg.host,
      port: cfg.port,
      username: cfg.username,
      version: '1.21.1',
      keepAlive: true,
    });

    bot.once('spawn', () => console.log(`✅ ${cfg.username} spawned`));

    // === Auto Sleep at Night ===
    bot.on('time', () => {
      if (!bot.entity) return;
      const time = bot.time.timeOfDay;
      const isNight = time > 12541 && time < 23458;
      if (isNight && !bot.isSleeping) trySleep(bot);
    });

    // === Chat Handler ===
    bot.on('chat', async (username, message) => {
      if (username === bot.username) return;
      if (!message.startsWith(cfg.prefix)) return;

      const cmdMessage = message.slice(cfg.prefix.length).trim();
      const lower = cmdMessage.toLowerCase();

      // === !s / !!s (save player to bot) ===
      if (lower === 's') {
        if (!bot.entity) return;
        const playerEntity = bot.players[username]?.entity;
        if (!playerEntity) {
          bot.chat(`${cfg.prefix}${username}, I can't find you.`);
          return;
        }
        const distance = bot.entity.position.distanceTo(playerEntity.position);
        if (distance > 500) {
          bot.chat(`${cfg.prefix}${username}, you are too far away to be saved.`);
          return;
        }
        bot.chat(`${cfg.prefix}Teleporting ${username} to me!`);
        bot.chat(`/tp ${username} ${bot.username}`);
        return;
      }

      // === Exact commands ===
      switch(lower) {
        case 'help':
          bot.chat(`${cfg.prefix}Commands:`);
          for (const c of COMMANDS) bot.chat(`${cfg.prefix}${c}`);
          return;

        case 'coords':
          sendCoords(bot, cfg.prefix);
          return;

        case 'sleep':
          trySleep(bot);
          return;

        case 'leave':
          bot.chat(`${cfg.prefix}Goodbye! Rejoining in 5 minutes...`);
          bot.quit('Leave command');
          setTimeout(connectBot, 5*60*1000);
          return;

        case 'tptome':
          bot.chat(`${cfg.prefix}Teleporting to ${username}...`);
          bot.chat(`/tp ${bot.username} ${username}`);
          return;

        default:
          // SQL save/load commands
          if (lower.startsWith('savelocation')) {
            const note = cmdMessage.split(' ').slice(1).join(' ');
            if (!note) {
              bot.chat(`${cfg.prefix}You must provide a note for the location.`);
              return;
            }
            const p = bot.players[username]?.entity?.position;
            if (!p) {
              bot.chat(`${cfg.prefix}I can't find you to save location.`);
              return;
            }
            await pool.query(
              'INSERT INTO locations(bot_name, username, x, y, z, note) VALUES($1,$2,$3,$4,$5,$6)',
              [bot.username, username, p.x, p.y, p.z, note]
            );
            bot.chat(`${cfg.prefix}Location saved with note: ${note}`);
            return;
          }

          if (lower === 'loadlocations') {
            const res = await pool.query(
              'SELECT username,x,y,z,note,created_at FROM locations WHERE bot_name=$1 ORDER BY created_at DESC',
              [bot.username]
            );
            if (res.rows.length === 0) {
              bot.chat(`${cfg.prefix}No saved locations.`);
            } else {
              for (const row of res.rows) {
                bot.chat(`${cfg.prefix}${row.username} @ (${row.x},${row.y},${row.z}) - ${row.note}`);
              }
            }
            return;
          }
      }

      // === AI-driven messages ===
      try {
        const aiResp = await askAI(cmdMessage, cfg.prefix);
        if (aiResp) bot.chat(aiResp);
      } catch(err) {
        console.error(`AI error ${cfg.username}:`, err);
      }
    });

    bot.on('end', () => {
      console.log(`⚠️ ${cfg.username} disconnected. Reconnecting in ${reconnectDelay/1000}s`);
      setTimeout(connectBot, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay*1.5,60000);
    });

    bot.on('error', err => console.error(`❌ ${cfg.username} error:`, err.message));
  }

  connectBot();
}

// === Helper Functions ===
function sendCoords(bot, prefix){
  if (!bot.entity) return;
  const p = bot.entity.position;
  bot.chat(`${prefix}X:${p.x.toFixed(0)} Y:${p.y.toFixed(0)} Z:${p.z.toFixed(0)}`);
}

function trySleep(bot){
  const bed = bot.findBlock({ matching: b=>b.name.endsWith('_bed'), maxDistance:6 });
  if (bed) bot.sleep(bed).catch(()=>{});
}

// === AI Function ===
async function askAI(prompt, prefix){
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',
    headers:{
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type':'application/json'
    },
    body: JSON.stringify({
      model:'openai/gpt-3.5-turbo',
      messages:[
        {
          role:'system',
          content:`
You are a friendly Minecraft bot assistant.
Keep replies short, friendly, and start every message with the bot's prefix.
The bot supports these commands: ${COMMANDS.map(c=>prefix+c).join(', ')}.
Only mention commands if specifically asked.
Detect if the user wants coordinates, sleep, leave, or teleport.
`
        },
        {role:'user', content:prompt}
      ],
      max_tokens:50
    })
  });
  const data = await res.json();
  let reply = data?.choices?.[0]?.message?.content?.trim();
  if (reply && !reply.startsWith(prefix)) reply = prefix + reply;
  return reply;
}

// === Safety ===
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
