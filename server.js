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

// ================== BOT REFERENCES ==================
let ogBot = null;
let tljBot = null;
let afkBot = null;
let afkInterval = null;

// ================== BOT FUNCTIONS ==================
function createMainBot(name, prefix) {
  const bot = mineflayer.createBot({ ...SERVER, username: name });

  bot.once('spawn', () => console.log(`${name} spawned`));
  bot.on('end', () => {
    console.log(`${name} left`);
    if (name === 'OGBot') ogBot = null;
    if (name === 'TLJBot') tljBot = null;
  });
  bot.on('error', err => console.error(`${name} error:`, err));

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    if (!message.startsWith(prefix)) return;

    const cmd = message.slice(prefix.length).trim().toLowerCase();

    if (cmd === 'help') {
      bot.chat(`${prefix}Commands: help, coords, tptome, savelocation, loadlocations`);
    } else if (cmd === 'coords') {
      const p = bot.entity?.position;
      if (p) bot.chat(`${prefix}X:${p.x.toFixed(0)} Y:${p.y.toFixed(0)} Z:${p.z.toFixed(0)}`);
    } else if (cmd === 'tptome') {
      bot.chat(`/tp ${bot.username} ${username}`);
    } else if (cmd.startsWith('savelocation')) {
      const note = cmd.split(' ').slice(1).join(' ');
      const pos = bot.players[username]?.entity?.position;
      if (pos && note) {
        await pool.query('INSERT INTO locations(bot_name, username, x, y, z, note) VALUES($1,$2,$3,$4,$5,$6)',
          [bot.username, username, pos.x, pos.y, pos.z, note]);
        bot.chat(`${prefix}Location saved: ${note}`);
      }
    } else if (cmd === 'loadlocations') {
      const res = await pool.query('SELECT username,x,y,z,note FROM locations WHERE bot_name=$1 ORDER BY created_at DESC', [bot.username]);
      res.rows.forEach(row => bot.chat(`${prefix}${row.username} @ (${row.x},${row.y},${row.z}) - ${row.note}`));
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
        if (reply) bot.chat(`${prefix}${reply}`);
      } catch (e) {
        console.error('AI error:', e);
      }
    }
  });

  return bot;
}

function createAfkBot() {
  return {
    toggle() {
      if (!afkBot) {
        afkBot = mineflayer.createBot({ ...SERVER, username: 'AFKBot' });
        afkBot.once('spawn', () => {
          afkInterval = setInterval(() => {
            if (!afkBot?.entity) return;
            afkBot.setControlState('forward', true);
            setTimeout(() => afkBot.setControlState('forward', false), 500);
            setTimeout(() => {
              afkBot.setControlState('back', true);
              setTimeout(() => afkBot.setControlState('back', false), 500);
            }, 1000);
          }, 5000);
        });
        afkBot.on('end', () => { clearInterval(afkInterval); afkBot = null; });
        afkBot.on('error', e => console.error('AFK bot error:', e));
      } else {
        clearInterval(afkInterval);
        afkBot.quit();
        afkBot = null;
      }
    },
    isActive: () => !!afkBot
  };
}

// ================== DISCORD ==================
const discord = new Client({ intents: [GatewayIntentBits.Guilds] });
const afkController = createAfkBot();

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

  if (interaction.customId === 'join') {
    if (!ogBot) ogBot = createMainBot('OGBot', '?');
    if (!tljBot) tljBot = createMainBot('TLJBot', '!');
    return interaction.reply({ content: 'Bots joined.', ephemeral: true });
  }

  if (interaction.customId === 'leave') {
    if (ogBot) ogBot.quit(); ogBot = null;
    if (tljBot) tljBot.quit(); tljBot = null;
    return interaction.reply({ content: 'Bots left.', ephemeral: true });
  }

  if (interaction.customId === 'afk_toggle') {
    afkController.toggle();
    return interaction.reply({ content: afkController.isActive() ? 'AFK enabled.' : 'AFK disabled.', ephemeral: true });
  }
});

discord.login(DISCORD_TOKEN);
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
