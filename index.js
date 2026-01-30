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
  console.log(`  Checking if content starts with !power: ${content.startsWith('!power')}`);

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

  if (content.startsWith('!power')) {
    console.log('  -> Handling !power command');
    console.log(`  -> Full content: "${content}"`);
    console.log(`  -> Mentions.users size: ${message.mentions.users.size}`);
    console.log(`  -> Mentions.users:`, Array.from(message.mentions.users.keys()));
    
    // Only works in a server (guild), not DMs
    if (!message.guild) {
      message.reply('This command only works in a server!').catch(err => {
        console.error('Error replying:', err);
      });
      return;
    }

    try {
      const guild = message.guild;
      const gameMaster = await guild.members.fetch(message.author.id);

      // Check if user is game master (has admin permissions or a role with "game master" in the name)
      const isGameMaster = gameMaster.permissions.has('ADMINISTRATOR') || 
                          gameMaster.roles.cache.some(role => 
                            role.name.toLowerCase().includes('game master') || 
                            role.name.toLowerCase().includes('gamemaster')
                          );

      console.log(`  -> Is game master: ${isGameMaster}`);

      if (!isGameMaster) {
        message.reply('❌ Only the game master can use this command!').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Get mentioned users (exclude bots and the bot itself)
      const mentionedUsers = message.mentions.users.filter(user => !user.bot);
      console.log(`  -> Filtered mentioned users (non-bots): ${mentionedUsers.size}`);
      console.log(`  -> Mentioned users:`, Array.from(mentionedUsers.values()).map(u => u.tag));
      
      if (mentionedUsers.size === 0) {
        message.reply('❌ Please mention the users you want to assign powers to!\nUsage: `!power @user1 @user2 @user3`').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Find all power roles (roles with "power" in the name, is not case sensitive)
      const powerRoles = guild.roles.cache.filter(role => 
        role.name.toLowerCase().includes('power')
      );

      if (powerRoles.size === 0) {
        message.reply('❌ No power roles found! Make sure you have roles with "power" in the name.').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      if (powerRoles.size < mentionedUsers.size) {
        message.reply(`❌ Not enough power roles! You have ${powerRoles.size} power role(s) but ${mentionedUsers.size} user(s) to assign.`).catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Convert power roles to array and shuffle for random assignment
      const powerRolesArray = Array.from(powerRoles.values());
      // Shuffle array using Fisher-Yates algorithm
      for (let i = powerRolesArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [powerRolesArray[i], powerRolesArray[j]] = [powerRolesArray[j], powerRolesArray[i]];
      }

      const assignments = [];
      console.log(`  -> Starting to fetch ${mentionedUsers.size} member(s)...`);
      
      const mentionedMembers = await Promise.all(
        Array.from(mentionedUsers.values()).map(user => 
          guild.members.fetch(user.id)
        )
      );
      
      console.log(`  -> Successfully fetched ${mentionedMembers.length} member(s)`);

      // Assign unique powers to each user
      console.log(`  -> Starting power assignment loop...`);
      for (let i = 0; i < mentionedMembers.length; i++) {
        const member = mentionedMembers[i];
        const powerRole = powerRolesArray[i];

        // Remove any existing power roles from this member
        const memberPowerRoles = member.roles.cache.filter(role => 
          role.name.toLowerCase().includes('power')
        );
        
        if (memberPowerRoles.size > 0) {
          await member.roles.remove(memberPowerRoles);
          console.log(`  -> Removed existing power role(s) from ${member.user.tag}`);
        }

        // Assign the new power role
        await member.roles.add(powerRole);
        console.log(`  -> Assigned ${powerRole.name} to ${member.user.tag}`);
        
        assignments.push(`${member.user.tag}: **${powerRole.name}**`);
      }

      // Send confirmation message
      const assignmentList = assignments.join('\n');
      message.reply(`✨ Powers assigned!\n\n${assignmentList}`).catch(err => {
        console.error('Error replying:', err);
      });

    } catch (error) {
      console.error('Error handling !power command:', error);
      console.error('Error stack:', error.stack);
      
      if (error.code === 50013) {
        message.reply('❌ I don\'t have permission to manage roles. Make sure my role is above the power roles and I have "Manage Roles" permission.').catch(err => {
          console.error('Error replying:', err);
        });
      } else {
        message.reply(`❌ An error occurred: ${error.message}`).catch(err => {
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