import mineflayer from 'mineflayer';
import express from 'express';
import fetch from 'node-fetch';
import { Pool } from 'pg';
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder
} from 'discord.js';

// ================== EXPRESS ==================
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Minecraft bots alive'));
app.listen(PORT, () => console.log(`Web server running on ${PORT}`));

// ================== ENV ==================
const { DISCORD_TOKEN, DISCORD_CHANNEL_ID, OPENROUTER_API_KEY, DATABASE_URL } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CHANNEL_ID || !OPENROUTER_API_KEY || !DATABASE_URL) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// ================== DATABASE ==================
const pool = new Pool({ connectionString: DATABASE_URL });

// ================== MINECRAFT SERVER ==================
const SERVER = {
  host: 'server.ogdev.qzz.io',
  port: 41140,
  version: '1.21.1',
  keepAlive: true
};

// ================== BOT CONFIG ==================
const MAIN_BOTS = [
  { username: 'OGBot', prefix: '?' },
  { username: 'TLJBot', prefix: '!' }
];
const AFK_BOT_USERNAME = 'AFKBot';

// ================== BOT FACTORIES ==================
function createMainBot(cfg) {
  let bot = mineflayer.createBot({ ...SERVER, username: cfg.username });

  bot.once('spawn', () => console.log(`${cfg.username} joined`));
  bot.on('end', () => console.log(`${cfg.username} left`));
  bot.on('error', err => console.error(`${cfg.username} error:`, err));

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    if (!message.startsWith(cfg.prefix)) return;

    const cmd = message.slice(cfg.prefix.length).trim().toLowerCase();

    if (cmd === 'help') {
      bot.chat(`${cfg.prefix}Commands: help, coords, tptome, savelocation, loadlocations`);
    } else if (cmd === 'coords') {
      const p = bot.entity?.position;
      if (p) bot.chat(`${cfg.prefix}X:${p.x.toFixed(0)} Y:${p.y.toFixed(0)} Z:${p.z.toFixed(0)}`);
    } else if (cmd === 'tptome') {
      bot.chat(`/tp ${bot.username} ${username}`);
    } else if (cmd.startsWith('savelocation')) {
      const note = cmd.split(' ').slice(1).join(' ');
      const pos = bot.players[username]?.entity?.position;
      if (pos && note) {
        await pool.query('INSERT INTO locations(bot_name, username, x, y, z, note) VALUES($1,$2,$3,$4,$5,$6)',
          [bot.username, username, pos.x, pos.y, pos.z, note]);
        bot.chat(`${cfg.prefix}Location saved: ${note}`);
      }
    } else if (cmd === 'loadlocations') {
      const res = await pool.query('SELECT username,x,y,z,note FROM locations WHERE bot_name=$1 ORDER BY created_at DESC', [bot.username]);
      res.rows.forEach(row => bot.chat(`${cfg.prefix}${row.username} @ (${row.x},${row.y},${row.z}) - ${row.note}`));
    } else {
      try {
        const aiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'openai/gpt-3.5-turbo',
            messages: [
              { role: 'system', content: `You are a friendly Minecraft bot assistant.` },
              { role: 'user', content: message }
            ],
            max_tokens: 50
          })
        });
        const data = await aiResp.json();
        let reply = data?.choices?.[0]?.message?.content?.trim();
        if (reply) bot.chat(`${cfg.prefix}${reply}`);
      } catch (e) {
        console.error('AI error:', e);
      }
    }
  });

  return {
    join: () => {}, // bots are always joined here
    leave: () => { bot.quit(); }
  };
}

function createAfkBot(username) {
  let bot = null;
  let interval = null;
  return {
    toggle() {
      if (!bot) {
        bot = mineflayer.createBot({ ...SERVER, username });
        bot.once('spawn', () => {
          interval = setInterval(() => {
            if (!bot?.entity) return;
            bot.setControlState('forward', true);
            setTimeout(() => bot.setControlState('forward', false), 500);
            setTimeout(() => {
              bot.setControlState('back', true);
              setTimeout(() => bot.setControlState('back', false), 500);
            }, 1000);
          }, 5000);
        });
        bot.on('end', () => { clearInterval(interval); bot = null; });
      } else {
        clearInterval(interval);
        bot.quit();
        bot = null;
      }
    },
    isActive: () => !!bot
  };
}

// ================== INIT ==================
const controllers = MAIN_BOTS.map(cfg => createMainBot(cfg));
const afkController = createAfkBot(AFK_BOT_USERNAME);

// ================== DISCORD ==================
const discord = new Client({ intents: [GatewayIntentBits.Guilds] });

discord.once(Events.ClientReady, async () => {
  const channel = await discord.channels.fetch(DISCORD_CHANNEL_ID);
  const embed = new EmbedBuilder().setDescription('Click me');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('join').setLabel('Join').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('leave').setLabel('Leave').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('afk_toggle').setLabel('AFK').setStyle(ButtonStyle.Primary)
  );
  await channel.send({ embeds: [embed], components: [row] });
});

discord.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId === 'join') { controllers.forEach(c => {}); return interaction.reply({ content: 'Bots ready.', ephemeral: true }); }
  if (interaction.customId === 'leave') { controllers.forEach(c => c.leave()); return interaction.reply({ content: 'Bots left.', ephemeral: true }); }
  if (interaction.customId === 'afk_toggle') { afkController.toggle(); return interaction.reply({ content: afkController.isActive() ? 'AFK enabled.' : 'AFK disabled.', ephemeral: true }); }
});

discord.login(DISCORD_TOKEN);

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
