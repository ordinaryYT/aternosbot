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

// ================== EXPRESS ==================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Minecraft bots alive'));
app.listen(PORT, () => console.log(`Web server running on ${PORT}`));

// ================== ENV ==================
const { DISCORD_TOKEN, DISCORD_CHANNEL_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CHANNEL_ID) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CHANNEL_ID');
  process.exit(1);
}

// ================== MINECRAFT SERVER ==================
const SERVER = {
  host: 'server.ogdev.qzz.io',
  port: 41140,
  version: '1.21.1'
};

// ================== BOT CONFIG ==================
const MAIN_BOTS = [
  { username: 'OGBot' },
  { username: 'TLJBot' }
];

const AFK_BOT_USERNAME = 'AFKBot';

// ================== BOT FACTORIES ==================
function createJoinLeaveBot(username) {
  let bot = null;

  return {
    join() {
      if (bot) return;
      bot = mineflayer.createBot({ ...SERVER, username });
      bot.once('spawn', () => console.log(`${username} joined`));
      bot.on('end', () => (bot = null));
    },
    leave() {
      if (!bot) return;
      bot.quit('Discord leave');
      bot = null;
    }
  };
}

function createAfkBot(username) {
  let bot = null;
  let interval = null;

  function startMovement() {
    interval = setInterval(() => {
      if (!bot?.entity) return;

      bot.setControlState('forward', true);
      setTimeout(() => bot.setControlState('forward', false), 500);

      setTimeout(() => {
        bot.setControlState('back', true);
        setTimeout(() => bot.setControlState('back', false), 500);
      }, 1000);
    }, 5000);
  }

  return {
    toggle() {
      if (!bot) {
        bot = mineflayer.createBot({ ...SERVER, username });
        bot.once('spawn', startMovement);
        bot.on('end', () => {
          clearInterval(interval);
          bot = null;
        });
      } else {
        clearInterval(interval);
        bot.quit('AFK toggle off');
        bot = null;
      }
    },
    isActive() {
      return !!bot;
    }
  };
}

// ================== INIT BOTS ==================
const controllers = MAIN_BOTS.map(b => createJoinLeaveBot(b.username));
const afkController = createAfkBot(AFK_BOT_USERNAME);

// ================== DISCORD ==================
const discord = new Client({
  intents: [GatewayIntentBits.Guilds]
});

discord.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${discord.user.tag}`);

  const channel = await discord.channels.fetch(DISCORD_CHANNEL_ID);
  if (!channel) {
    console.error('Channel not found');
    return;
  }

  const embed = new EmbedBuilder().setDescription('Click me');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('join')
      .setLabel('Join')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('leave')
      .setLabel('Leave')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('afk_toggle')
      .setLabel('AFK')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    embeds: [embed],
    components: [row]
  });
});

discord.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'join') {
    controllers.forEach(c => c.join());
    return interaction.reply({ content: 'Bots joined.', ephemeral: true });
  }

  if (interaction.customId === 'leave') {
    controllers.forEach(c => c.leave());
    return interaction.reply({ content: 'Bots left.', ephemeral: true });
  }

  if (interaction.customId === 'afk_toggle') {
    afkController.toggle();
    return interaction.reply({
      content: afkController.isActive() ? 'AFK enabled.' : 'AFK disabled.',
      ephemeral: true
    });
  }
});

discord.login(DISCORD_TOKEN);

// ================== SAFETY ==================
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
