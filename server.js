import mineflayer from 'mineflayer';
import express from 'express';
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder
} from 'discord.js';

/* ================= EXPRESS ================= */
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('alive'));
app.listen(PORT);

/* ================= ENV ================= */
const { DISCORD_TOKEN, DISCORD_CHANNEL_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CHANNEL_ID) process.exit(1);

/* ================= MC CONFIG ================= */
const MC_CONFIG = {
  host: 'server.ogdev.qzz.io',
  port: 41140,
  version: '1.21.1',
  keepAlive: true
};

/* ================= GLOBAL BOT REFERENCES ================= */
let ogBot = null;
let tljBot = null;
let afkBot = null;
let afkInterval = null;

/* ================= BOT FUNCTIONS ================= */
function joinBot(name) {
  console.log(`Joining ${name}`);

  const bot = mineflayer.createBot({
    ...MC_CONFIG,
    username: name
  });

  bot.once('spawn', () => console.log(`${name} spawned`));
  bot.on('kicked', r => console.log(`${name} kicked`, r));
  bot.on('error', e => console.log(`${name} error`, e));
  bot.on('end', () => console.log(`${name} ended`));

  return bot;
}

function leaveBot(bot) {
  if (!bot) return;
  bot.quit();
}

/* ================= DISCORD ================= */
const discord = new Client({ intents: [GatewayIntentBits.Guilds] });

discord.once(Events.ClientReady, async () => {
  const channel = await discord.channels.fetch(DISCORD_CHANNEL_ID);

  const embed = new EmbedBuilder().setDescription('Click me');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('join').setLabel('Join').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('leave').setLabel('Leave').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('afk').setLabel('AFK').setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
});

discord.on(Events.InteractionCreate, async i => {
  if (!i.isButton()) return;

  if (i.customId === 'join') {
    if (!ogBot) ogBot = joinBot('OGBot');
    if (!tljBot) tljBot = joinBot('TLJBot');
    return i.reply({ content: 'Joined', ephemeral: true });
  }

  if (i.customId === 'leave') {
    leaveBot(ogBot);
    leaveBot(tljBot);
    ogBot = null;
    tljBot = null;
    return i.reply({ content: 'Left', ephemeral: true });
  }

  if (i.customId === 'afk') {
    if (!afkBot) {
      afkBot = joinBot('AFKBot');
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
    } else {
      clearInterval(afkInterval);
      leaveBot(afkBot);
      afkBot = null;
    }
    return i.reply({ content: 'AFK toggled', ephemeral: true });
  }
});

discord.login(DISCORD_TOKEN);
