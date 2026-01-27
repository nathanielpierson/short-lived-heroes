const dotenv = require('dotenv');
dotenv.config();

const { Client, Intents } = require('discord.js');

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.MESSAGE_CONTENT, // Required to read message content
  ],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`Bot is in ${client.guilds.cache.size} server(s)`);
});

// Add error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

client.on('warn', (warning) => {
  console.warn('Discord client warning:', warning);
});

client.on('messageCreate', async (message) => {
  // Try fetching the message to ensure we have full data
  try {
    if (message.partial) {
      await message.fetch();
    }
  } catch (error) {
    console.error('Error fetching message:', error);
  }

  // Debug: log all messages (you can remove this later)
  console.log(`Message received: "${message.content}" from ${message.author.tag} in #${message.channel.name}`);
  console.log(`  Message ID: ${message.id}`);
  console.log(`  Has embeds: ${message.embeds.length > 0}`);
  console.log(`  Has attachments: ${message.attachments.size > 0}`);
  console.log(`  Content length: ${message.content.length}`);
  console.log(`  Raw content value:`, JSON.stringify(message.content));
  
  // Ignore messages from bots (including this bot)
  if (message.author.bot) {
    console.log('  -> Ignored (bot message)');
    return;
  }

  // Trim whitespace and check commands
  const content = message.content.trim();
  console.log(`  Trimmed content: "${content}"`);

  if (content === '!ping') {
    console.log('  -> Responding to !ping');
    message.reply('Pong!').catch(err => {
      console.error('Error replying to !ping:', err);
    });
  }

  if (content === '!test') {
    console.log('  -> Responding to !test');
    // This confirms the bot can see and respond in this channel
    message.reply(`✅ I can see this channel! Channel: #${message.channel.name}`).catch(err => {
      console.error('Error replying to !test:', err);
    });
  }
});

// Check if token exists
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ ERROR: DISCORD_TOKEN not found in .env file!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('❌ Failed to login:', error.message);
  process.exit(1);
});