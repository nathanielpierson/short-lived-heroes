const dotenv = require('dotenv');
dotenv.config();

const { Client, Intents } = require('discord.js');

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.MESSAGE_CONTENT, // Required to read message content
    Intents.FLAGS.GUILD_MEMBERS, // Required to manage roles
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

  if (content === '!power') {
    console.log('  -> Handling !power command');
    
    // Only works in a server (guild), not DMs
    if (!message.guild) {
      message.reply('This command only works in a server!').catch(err => {
        console.error('Error replying:', err);
      });
      return;
    }

    try {
      const member = await message.guild.members.fetch(message.author.id);
      const guild = message.guild;

      // Find all power roles (roles with "power" in the name, case-insensitive)
      const powerRoles = guild.roles.cache.filter(role => 
        role.name.toLowerCase().includes('power')
      );

      if (powerRoles.size === 0) {
        message.reply('❌ No power roles found! Make sure you have roles with "power" in the name.').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Get member's current power roles
      const memberPowerRoles = member.roles.cache.filter(role => 
        role.name.toLowerCase().includes('power')
      );

      // Remove all existing power roles
      if (memberPowerRoles.size > 0) {
        await member.roles.remove(memberPowerRoles);
        console.log(`  -> Removed ${memberPowerRoles.size} existing power role(s)`);
      }

      // Pick a random power role
      const powerRolesArray = Array.from(powerRoles.values());
      const randomPowerRole = powerRolesArray[Math.floor(Math.random() * powerRolesArray.length)];

      // Assign the new power role
      await member.roles.add(randomPowerRole);
      console.log(`  -> Assigned power role: ${randomPowerRole.name}`);

      message.reply(`✨ You've been assigned the **${randomPowerRole.name}** power!`).catch(err => {
        console.error('Error replying:', err);
      });

    } catch (error) {
      console.error('Error handling !power command:', error);
      
      if (error.code === 50013) {
        message.reply('❌ I don\'t have permission to manage roles. Make sure my role is above the power roles and I have "Manage Roles" permission.').catch(err => {
          console.error('Error replying:', err);
        });
      } else {
        message.reply('❌ An error occurred while assigning your power role.').catch(err => {
          console.error('Error replying:', err);
        });
      }
    }
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