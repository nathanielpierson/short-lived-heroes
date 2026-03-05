const dotenv = require('dotenv');
dotenv.config();

const { Client, Intents } = require('discord.js');
const { handleCommand } = require('./commands/handler');

// Power definitions - you can customize these
const powerDefinitions = {
  // Example definitions - customize these to match your actual power role names
  'power: Super Strength': 'Attacker. Needs attacked by multiple villains/heroes to die',
  'power: ice': 'Ice Power: You can freeze enemies and create ice barriers.',
  'power: lightning': 'Lightning Power: You can strike with lightning and move at incredible speed.',
  'power: pickle': 'turns you into a pickle. Funniest shit you will ever see.'
  // Add more definitions here as you create power roles
};

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.MESSAGE_CONTENT, // Required to read message content
    Intents.FLAGS.GUILD_MEMBERS, // Required to manage roles
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS, // Required to detect reactions
  ],
});

// Store last endgame details for !endgamedetails command
let lastEndgameDetails = null;

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

// Debug: Log all reactions to see if they're being received
client.on('messageReactionAdd', async (reaction, user) => {
  // Only log reactions on messages we care about (to avoid spam)
  if (reaction.message.content && reaction.message.content.includes('If you are starting a new game')) {
    console.log(`[Reaction Event] ${user.tag} reacted with ${reaction.emoji.name} on message ${reaction.message.id}`);
  }
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

  // Route simple commands to the command handler first
  if (await handleCommand(client, message, content)) {
    return;
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
      const confirmationMessage = await message.reply(`✨ Powers assigned!\n\n${assignmentList}`).catch(err => {
        console.error('Error replying:', err);
        return null;
      });

      if (confirmationMessage) {
        // Ask about making users alive
        const alivePrompt = await message.channel.send(
          `If you are starting a new game, I can make sure all these users are currently alive if you'd like. Reply 👍 if you would like me to do this.`
        ).catch(err => {
          console.error('Error sending alive prompt:', err);
          return null;
        });

        if (alivePrompt) {
          // Ensure message is fetched and cached
          try {
            await alivePrompt.fetch();
          } catch (err) {
            console.error('Error fetching alive prompt:', err);
          }
          
          // React with thumbs up
          await alivePrompt.react('👍').catch(err => {
            console.error('Error reacting:', err);
          });
          
          console.log(`  -> Set up alive prompt message (ID: ${alivePrompt.id}), waiting for reaction...`);

          // Store mentionedMembers in a way accessible to the reaction handler
          const powerAssignmentMembers = [...mentionedMembers];
          
          // Set up reaction collector
          const filter = (reaction, user) => {
            console.log(`  -> Filter check: reaction from ${user.tag}, emoji: ${reaction.emoji.name}, message ID: ${reaction.message.id}, target ID: ${alivePrompt.id}`);
            
            // Check if this reaction is on our message
            if (reaction.message.id !== alivePrompt.id) {
              return false;
            }
            
            if (reaction.emoji.name !== '👍' || user.bot) {
              return false;
            }
            
            // Check if user is the original game master
            if (user.id === message.author.id) {
              console.log(`  -> Filter: User is original game master`);
              return true;
            }
            
            // Check if user is admin (using cached member if available)
            const member = guild.members.cache.get(user.id);
            if (member && member.permissions.has('ADMINISTRATOR')) {
              console.log(`  -> Filter: User is admin`);
              return true;
            }
            
            // If member not in cache, allow through and check in collect handler
            console.log(`  -> Filter: Allowing through for further check`);
            return true;
          };

          const collector = alivePrompt.createReactionCollector({
            filter: filter,
            time: 60000 // 60 seconds timeout
          });

          collector.on('collect', async (reaction, user) => {
            console.log(`  -> Reaction collected from ${user.tag} (${user.id})`);
            
            // Fetch member to check permissions
            let member = guild.members.cache.get(user.id);
            if (!member) {
              member = await guild.members.fetch(user.id).catch(() => null);
            }
            
            if (!member) {
              console.log(`  -> Could not fetch member ${user.tag}`);
              return;
            }
            
            // Check if user is the original game master
            const isOriginalGameMaster = user.id === message.author.id;
            
            // Check if user has Game Master role
            const hasGameMasterRole = member.roles.cache.some(role => 
              role.name.toLowerCase().includes('game master') || 
              role.name.toLowerCase().includes('gamemaster')
            );
            
            // Check if user is admin
            const isAdmin = member.permissions.has('ADMINISTRATOR');
            
            console.log(`  -> Authorization check for ${user.tag}:`);
            console.log(`     - Is original game master: ${isOriginalGameMaster}`);
            console.log(`     - Has Game Master role: ${hasGameMasterRole}`);
            console.log(`     - Is admin: ${isAdmin}`);
            
            const isAuthorized = isOriginalGameMaster || hasGameMasterRole || isAdmin;
            
            if (!isAuthorized) {
              // Not authorized - remove their reaction and continue waiting
              console.log(`  -> User ${user.tag} reacted but is not authorized`);
              await reaction.users.remove(user).catch(() => {});
              return;
            }
            
            // Authorized - stop collector and process
            collector.stop();
            const roleType = isAdmin ? 'Admin' : (hasGameMasterRole ? 'Game Master' : 'Original Game Master');
            console.log(`  -> ${roleType} ${user.tag} reacted with thumbs up - processing...`);
            
            try {
              // Find alive and dead roles
              const aliveRole = guild.roles.cache.find(role => 
                role.name.toLowerCase().includes('alive')
              );
              
              const deadRole = guild.roles.cache.find(role => 
                role.name.toLowerCase().includes('dead')
              );

              console.log(`  -> Found roles - Alive: ${aliveRole ? aliveRole.name : 'none'}, Dead: ${deadRole ? deadRole.name : 'none'}`);
              console.log(`  -> Processing ${mentionedMembers.length} member(s)...`);

              if (!aliveRole && !deadRole) {
                await message.channel.send('❌ No "alive" or "dead" roles found in this server.').catch(err => {
                  console.error('Error sending message:', err);
                });
                return;
              }
              
              if (!aliveRole) {
                await message.channel.send('❌ No "alive" role found in this server.').catch(err => {
                  console.error('Error sending message:', err);
                });
                return;
              }

              // Process each member
              let aliveCount = 0;
              let deadRemovedCount = 0;

              for (const member of powerAssignmentMembers) {
                // Remove dead role if present
                if (deadRole && member.roles.cache.has(deadRole.id)) {
                  await member.roles.remove(deadRole).catch(err => {
                    console.error(`Error removing dead role from ${member.user.tag}:`, err);
                  });
                  deadRemovedCount++;
                }

                // Add alive role if not present
                if (aliveRole && !member.roles.cache.has(aliveRole.id)) {
                  await member.roles.add(aliveRole).catch(err => {
                    console.error(`Error adding alive role to ${member.user.tag}:`, err);
                  });
                  aliveCount++;
                }
              }

              // Send confirmation
              console.log(`  -> Completed: Added alive to ${aliveCount}, removed dead from ${deadRemovedCount}`);
              
              let confirmMsg = '✅ ';
              if (aliveCount > 0) {
                confirmMsg += `Added "alive" role to ${aliveCount} member(s). `;
              }
              if (deadRemovedCount > 0) {
                confirmMsg += `Removed "dead" role from ${deadRemovedCount} member(s).`;
              }
              if (aliveCount === 0 && deadRemovedCount === 0) {
                confirmMsg += 'All users already have the correct alive/dead status.';
              }

              await message.channel.send(confirmMsg).catch(err => {
                console.error('Error sending confirmation:', err);
              });

            } catch (error) {
              console.error('Error processing alive/dead roles:', error);
              await message.channel.send('❌ An error occurred while setting alive/dead status.').catch(err => {
                console.error('Error sending error message:', err);
              });
            }
          });

          collector.on('end', (collected, reason) => {
            console.log(`  -> Reaction collector ended. Reason: ${reason}, Collected: ${collected.size}`);
            if (reason === 'time') {
              console.log('  -> Reaction collector timed out');
            }
          });
          
          // Also log when collector starts
          console.log('  -> Reaction collector started, waiting for 👍 reaction...');
        }
      }

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

  if (content.startsWith('!kill')) {
    console.log('  -> Handling !kill command');

    // Only works in a server (guild), not DMs
    if (!message.guild) {
      message.reply('This command only works in a server!').catch(err => {
        console.error('Error replying:', err);
      });
      return;
    }

    try {
      const guild = message.guild;
      const killer = await guild.members.fetch(message.author.id);

      // Check if user has the Killer power (a power role containing both "power" and "killer" in the name)
      const hasKillerPower = killer.roles.cache.some(role => {
        const name = role.name.toLowerCase();
        return name.includes('power') && name.includes('killer');
      });

      if (!hasKillerPower) {
        message.reply(`you can't do that you stupid dumb idiot`).catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Get mentioned user (exclude bots)
      const mentionedUsers = message.mentions.users.filter(user => !user.bot);

      if (mentionedUsers.size === 0) {
        message.reply('❌ Please mention a user to kill.\nUsage: `!kill @user`').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      if (mentionedUsers.size > 1) {
        message.reply('❌ Please mention only one user to kill at a time.').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      const targetUser = mentionedUsers.first();
      const targetMember = await guild.members.fetch(targetUser.id);

      // Find alive and dead roles
      const aliveRole = guild.roles.cache.find(role =>
        role.name.toLowerCase().includes('alive')
      );
      const deadRole = guild.roles.cache.find(role =>
        role.name.toLowerCase().includes('dead')
      );

      if (!aliveRole && !deadRole) {
        message.reply('❌ No "alive" or "dead" roles found in this server.').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Only allow killing users who are currently in the game (have alive or dead role)
      const isInGame =
        (aliveRole && targetMember.roles.cache.has(aliveRole.id)) ||
        (deadRole && targetMember.roles.cache.has(deadRole.id));

      if (!isInGame) {
        message.reply('❌ That user is not currently in the game.').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      let removedAlive = false;
      let addedDead = false;

      // Remove alive role if present
      if (aliveRole && targetMember.roles.cache.has(aliveRole.id)) {
        await targetMember.roles.remove(aliveRole).catch(err => {
          console.error(`Error removing alive role from ${targetMember.user.tag}:`, err);
        });
        removedAlive = true;
      }

      // Add dead role if not present
      if (deadRole && !targetMember.roles.cache.has(deadRole.id)) {
        await targetMember.roles.add(deadRole).catch(err => {
          console.error(`Error adding dead role to ${targetMember.user.tag}:`, err);
        });
        addedDead = true;
      }

      if (!removedAlive && !addedDead) {
        message.reply(`⚠️ ${targetMember.user.tag} already has the correct alive/dead status.`).catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      message.reply(`💀 ${targetMember.user.tag} has been killed.`).catch(err => {
        console.error('Error replying:', err);
      });
      console.log(`  -> ${targetMember.user.tag} has been killed (alive removed: ${removedAlive}, dead added: ${addedDead})`);
    } catch (error) {
      console.error('Error handling !kill command:', error);
      console.error('Error stack:', error.stack);

      if (error.code === 50013) {
        message.reply('❌ I don\'t have permission to manage roles. Make sure my role is above the Alive/Dead roles and I have "Manage Roles" permission.').catch(err => {
          console.error('Error replying:', err);
        });
      } else {
        message.reply(`❌ An error occurred while trying to kill that user: ${error.message}`).catch(err => {
          console.error('Error replying:', err);
        });
      }
    }
  }

  if (content.startsWith('!reanimate')) {
    console.log('  -> Handling !reanimate command');

    // Only works in a server (guild), not DMs
    if (!message.guild) {
      message.reply('This command only works in a server!').catch(err => {
        console.error('Error replying:', err);
      });
      return;
    }

    try {
      const guild = message.guild;
      const reanimator = await guild.members.fetch(message.author.id);

      // Check if user has the Reanimation power (a power role containing both "power" and "reanimation" in the name)
      const hasReanimationPower = reanimator.roles.cache.some(role => {
        const name = role.name.toLowerCase();
        return name.includes('power') && name.includes('reanimation');
      });

      if (!hasReanimationPower) {
        message.reply(`you can't do that you stupid dumb idiot`).catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Get mentioned user (exclude bots)
      const mentionedUsers = message.mentions.users.filter(user => !user.bot);

      if (mentionedUsers.size === 0) {
        message.reply('❌ Please mention a user to reanimate.\nUsage: `!reanimate @user`').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      if (mentionedUsers.size > 1) {
        message.reply('❌ Please mention only one user to reanimate at a time.').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      const targetUser = mentionedUsers.first();
      const targetMember = await guild.members.fetch(targetUser.id);

      // Find alive and dead roles
      const aliveRole = guild.roles.cache.find(role =>
        role.name.toLowerCase().includes('alive')
      );
      const deadRole = guild.roles.cache.find(role =>
        role.name.toLowerCase().includes('dead')
      );

      if (!aliveRole && !deadRole) {
        message.reply('❌ No "alive" or "dead" roles found in this server.').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Only allow reanimating users who are currently in the game (have alive or dead role)
      const isInGame =
        (aliveRole && targetMember.roles.cache.has(aliveRole.id)) ||
        (deadRole && targetMember.roles.cache.has(deadRole.id));

      if (!isInGame) {
        message.reply('❌ That user is not currently in the game.').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      let removedDead = false;
      let addedAlive = false;

      // Remove dead role if present
      if (deadRole && targetMember.roles.cache.has(deadRole.id)) {
        await targetMember.roles.remove(deadRole).catch(err => {
          console.error(`Error removing dead role from ${targetMember.user.tag}:`, err);
        });
        removedDead = true;
      }

      // Add alive role if not present
      if (aliveRole && !targetMember.roles.cache.has(aliveRole.id)) {
        await targetMember.roles.add(aliveRole).catch(err => {
          console.error(`Error adding alive role to ${targetMember.user.tag}:`, err);
        });
        addedAlive = true;
      }

      if (!removedDead && !addedAlive) {
        message.reply(`⚠️ ${targetMember.user.tag} already has the correct alive/dead status.`).catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      message.reply(`✨ ${targetMember.user.tag} has been reanimated.`).catch(err => {
        console.error('Error replying:', err);
      });
      console.log(`  -> ${targetMember.user.tag} has been reanimated (dead removed: ${removedDead}, alive added: ${addedAlive})`);
    } catch (error) {
      console.error('Error handling !reanimate command:', error);
      console.error('Error stack:', error.stack);

      if (error.code === 50013) {
        message.reply('❌ I don\'t have permission to manage roles. Make sure my role is above the Alive/Dead roles and I have "Manage Roles" permission.').catch(err => {
          console.error('Error replying:', err);
        });
      } else {
        message.reply(`❌ An error occurred while trying to reanimate that user: ${error.message}`).catch(err => {
          console.error('Error replying:', err);
        });
      }
    }
  }

  if (content.startsWith('!define')) {
    console.log('  -> Handling !define command');
    
    // Only works in a server (guild), not DMs
    if (!message.guild) {
      message.reply('This command only works in a server!').catch(err => {
        console.error('Error replying:', err);
      });
      return;
    }

    try {
      const args = content.split(' ').slice(1); // Get everything after "!define"
      const query = args.join(' ').toLowerCase().trim();

      // Handle "!define all" - show all definitions
      if (query === 'all') {
        const guild = message.guild;
        const powerRoles = guild.roles.cache.filter(role => 
          role.name.toLowerCase().includes('power')
        );

        if (powerRoles.size === 0) {
          message.reply('❌ No power roles found in this server!').catch(err => {
            console.error('Error replying:', err);
          });
          return;
        }

        // Build the rulebook
        let rulebook = '📖 **Power Rulebook**\n\n';
        
        // Get definitions for all power roles
        const definitions = [];
        powerRoles.forEach(role => {
          const roleNameLower = role.name.toLowerCase();
          // Try to find a matching definition
          let definition = powerDefinitions[roleNameLower];
          
          if (!definition) {
            const matchingKey = Object.keys(powerDefinitions).find(key => 
              roleNameLower.includes(key.replace('power: ', '')) ||
              key.includes(roleNameLower.replace('power', '').trim())
            );
            if (matchingKey) {
              definition = powerDefinitions[matchingKey];
            }
          }
          
          if (definition) {
            definitions.push(`**${role.name}**: ${definition}`);
          } else {
            definitions.push(`**${role.name}**: *No definition set yet.*`);
          }
        });

        rulebook += definitions.join('\n\n');
        
        // Discord has a 2000 character limit, so split if needed
        if (rulebook.length > 2000) {
          // Split into chunks
          const chunks = [];
          let currentChunk = '📖 **Power Rulebook**\n\n';
          
          definitions.forEach(def => {
            if ((currentChunk + def + '\n\n').length > 2000) {
              chunks.push(currentChunk);
              currentChunk = def + '\n\n';
            } else {
              currentChunk += def + '\n\n';
            }
          });
          
          if (currentChunk) {
            chunks.push(currentChunk);
          }
          
          // Send first chunk
          message.reply(chunks[0]).catch(err => {
            console.error('Error replying:', err);
          });
          
          // Send remaining chunks
          for (let i = 1; i < chunks.length; i++) {
            message.channel.send(chunks[i]).catch(err => {
              console.error('Error sending chunk:', err);
            });
          }
        } else {
          message.reply(rulebook).catch(err => {
            console.error('Error replying:', err);
          });
        }
        return;
      }

      // Handle specific power lookup
      if (query.length === 0) {
        message.reply('❌ Please specify a power or use `!define all` to see all powers.\nUsage: `!define [power name]` or `!define all`').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Find matching power role
      const guild = message.guild;
      const powerRoles = guild.roles.cache.filter(role => 
        role.name.toLowerCase().includes('power')
      );

      // Try to find a role that matches the query
      const matchingRole = powerRoles.find(role => {
        const roleNameLower = role.name.toLowerCase();
        return roleNameLower.includes(query) || query.includes(roleNameLower.replace('power', '').trim());
      });

      if (!matchingRole) {
        message.reply(`❌ No power role found matching "${args.join(' ')}". Use \`!define all\` to see available powers.`).catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Find definition for this role
      const roleNameLower = matchingRole.name.toLowerCase();
      let definition = powerDefinitions[roleNameLower];
      
      // Try fuzzy matching if exact match not found
      if (!definition) {
        const matchingKey = Object.keys(powerDefinitions).find(key => 
          roleNameLower.includes(key.replace('power: ', '')) ||
          key.includes(roleNameLower.replace('power', '').trim())
        );
        if (matchingKey) {
          definition = powerDefinitions[matchingKey];
        }
      }

      if (definition) {
        message.reply(`📖 **${matchingRole.name}**\n\n${definition}`).catch(err => {
          console.error('Error replying:', err);
        });
      } else {
        message.reply(`📖 **${matchingRole.name}**\n\n*No definition set yet. Contact the game master to add one!*`).catch(err => {
          console.error('Error replying:', err);
        });
      }

    } catch (error) {
      console.error('Error handling !define command:', error);
      message.reply('❌ An error occurred while looking up the definition.').catch(err => {
        console.error('Error replying:', err);
      });
    }
  }

  if (content.startsWith('!gamemaster')) {
    console.log('  -> Handling !gamemaster command');
    
    // Only works in a server (guild), not DMs
    if (!message.guild) {
      message.reply('This command only works in a server!').catch(err => {
        console.error('Error replying:', err);
      });
      return;
    }

    try {
      const guild = message.guild;
      const requester = await guild.members.fetch(message.author.id);

      // Check if requester is game master (has admin permissions or a role with "game master" in the name)
      const isGameMaster = requester.permissions.has('ADMINISTRATOR') || 
                          requester.roles.cache.some(role => 
                            role.name.toLowerCase().includes('game master') || 
                            role.name.toLowerCase().includes('gamemaster')
                          );

      if (!isGameMaster) {
        message.reply('❌ Only the game master can transfer game master status!').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Get mentioned user
      const mentionedUsers = message.mentions.users.filter(user => !user.bot);
      
      if (mentionedUsers.size === 0) {
        message.reply('❌ Please mention the user you want to make the game master!\nUsage: `!gamemaster @username`').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      if (mentionedUsers.size > 1) {
        message.reply('❌ Please mention only one user!').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      const newGameMasterUser = mentionedUsers.first();
      const newGameMaster = await guild.members.fetch(newGameMasterUser.id);

      // Find or create "Game Master" role
      let gameMasterRole = guild.roles.cache.find(role => 
        role.name.toLowerCase() === 'game master' || 
        role.name.toLowerCase() === 'gamemaster'
      );

      if (!gameMasterRole) {
        // Create the role if it doesn't exist
        gameMasterRole = await guild.roles.create({
          name: 'Game Master',
          color: 0xFFD700, // Gold color
          mentionable: false,
          reason: 'Game Master role created by bot'
        });
        console.log('  -> Created Game Master role');
      }

      // Find current game master(s) with the role
      const currentGameMasters = guild.members.cache.filter(member => 
        member.roles.cache.has(gameMasterRole.id) && member.id !== newGameMaster.id
      );

      // Remove role from current game masters
      if (currentGameMasters.size > 0) {
        await Promise.all(
          currentGameMasters.map(member => member.roles.remove(gameMasterRole))
        );
        console.log(`  -> Removed Game Master role from ${currentGameMasters.size} member(s)`);
      }

      // Assign role to new game master (if they don't already have it)
      if (!newGameMaster.roles.cache.has(gameMasterRole.id)) {
        await newGameMaster.roles.add(gameMasterRole);
        console.log(`  -> Assigned Game Master role to ${newGameMaster.user.tag}`);
      }

      message.reply(`✅ **${newGameMaster.user.tag}** is now the Game Master!`).catch(err => {
        console.error('Error replying:', err);
      });

    } catch (error) {
      console.error('Error handling !gamemaster command:', error);
      console.error('Error stack:', error.stack);
      
      if (error.code === 50013) {
        message.reply('❌ I don\'t have permission to manage roles. Make sure my role is above the Game Master role and I have "Manage Roles" permission.').catch(err => {
          console.error('Error replying:', err);
        });
      } else if (error.code === 50035) {
        message.reply('❌ I cannot assign the Game Master role. Make sure my role is higher than the Game Master role in the role hierarchy.').catch(err => {
          console.error('Error replying:', err);
        });
      } else {
        message.reply(`❌ An error occurred: ${error.message}`).catch(err => {
          console.error('Error replying:', err);
        });
      }
    }
  }

  if (content === '!endgame') {
    console.log('  -> Handling !endgame command');
    
    // Only works in a server (guild), not DMs
    if (!message.guild) {
      message.reply('This command only works in a server!').catch(err => {
        console.error('Error replying:', err);
      });
      return;
    }

    try {
      const guild = message.guild;
      const requester = await guild.members.fetch(message.author.id);

      // Check if requester is game master (has admin permissions or a role with "game master" in the name)
      const isGameMaster = requester.permissions.has('ADMINISTRATOR') || 
                          requester.roles.cache.some(role => 
                            role.name.toLowerCase().includes('game master') || 
                            role.name.toLowerCase().includes('gamemaster')
                          );

      if (!isGameMaster) {
        message.reply('❌ Only the game master can end the game!').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Find all game-related roles
      const gameMasterRoles = guild.roles.cache.filter(role => 
        role.name.toLowerCase() === 'game master' || 
        role.name.toLowerCase() === 'gamemaster'
      );

      const powerRoles = guild.roles.cache.filter(role => 
        role.name.toLowerCase().includes('power')
      );

      const aliveDeadRoles = guild.roles.cache.filter(role => 
        role.name.toLowerCase().includes('alive') || 
        role.name.toLowerCase().includes('dead')
      );

      // Combine all game-related roles
      const allGameRoles = new Set([
        ...Array.from(gameMasterRoles.values()),
        ...Array.from(powerRoles.values()),
        ...Array.from(aliveDeadRoles.values())
      ]);

      if (allGameRoles.size === 0) {
        message.reply('✅ No game-related roles found. The game is already ended!').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Get all members and remove game roles from them
      const members = await guild.members.fetch();
      let removedCount = 0;
      
      // Store detailed information for !endgamedetails
      const details = {
        roles: {}, // { roleName: [user1, user2, ...] }
        timestamp: new Date()
      };

      for (const member of members.values()) {
        for (const role of allGameRoles) {
          if (member.roles.cache.has(role.id)) {
            try {
              await member.roles.remove(role);
              removedCount++;
              
              // Store detailed info
              if (!details.roles[role.name]) {
                details.roles[role.name] = [];
              }
              details.roles[role.name].push(member.user.tag);
              
              console.log(`  -> Removed ${role.name} from ${member.user.tag}`);
            } catch (error) {
              console.error(`  -> Error removing ${role.name} from ${member.user.tag}:`, error.message);
            }
          }
        }
      }

      // Store details for !endgamedetails command
      lastEndgameDetails = details;

      // Simple message
      message.reply('✅ Applicable roles have been removed. Ready to start next game!').catch(err => {
        console.error('Error replying:', err);
      });

      console.log(`  -> Endgame complete: Removed ${removedCount} role assignment(s)`);

    } catch (error) {
      console.error('Error handling !endgame command:', error);
      console.error('Error stack:', error.stack);
      
      if (error.code === 50013) {
        message.reply('❌ I don\'t have permission to manage roles. Make sure I have "Manage Roles" permission.').catch(err => {
          console.error('Error replying:', err);
        });
      } else {
        message.reply(`❌ An error occurred: ${error.message}`).catch(err => {
          console.error('Error replying:', err);
        });
      }
    }
  }

  if (content === '!endgamedetails') {
    console.log('  -> Handling !endgamedetails command');
    
    // Only works in a server (guild), not DMs
    if (!message.guild) {
      message.reply('This command only works in a server!').catch(err => {
        console.error('Error replying:', err);
      });
      return;
    }

    try {
      if (!lastEndgameDetails) {
        message.reply('❌ No endgame details available. Use `!endgame` first to end a game.').catch(err => {
          console.error('Error replying:', err);
        });
        return;
      }

      // Build detailed message
      let detailsMessage = '📋 **Last Endgame Details**\n\n';
      
      const roleEntries = Object.entries(lastEndgameDetails.roles);
      
      if (roleEntries.length === 0) {
        detailsMessage += 'No roles were removed.';
      } else {
        for (const [roleName, users] of roleEntries) {
          detailsMessage += `**${roleName}** (${users.length} member${users.length !== 1 ? 's' : ''}):\n`;
          users.forEach(user => {
            detailsMessage += `  • ${user}\n`;
          });
          detailsMessage += '\n';
        }
      }

      // Discord has a 2000 character limit, so split if needed
      if (detailsMessage.length > 2000) {
        // Split into chunks
        const chunks = [];
        let currentChunk = '📋 **Last Endgame Details**\n\n';
        
        for (const [roleName, users] of roleEntries) {
          const roleSection = `**${roleName}** (${users.length} member${users.length !== 1 ? 's' : ''}):\n${users.map(u => `  • ${u}`).join('\n')}\n\n`;
          
          if ((currentChunk + roleSection).length > 2000) {
            chunks.push(currentChunk);
            currentChunk = roleSection;
          } else {
            currentChunk += roleSection;
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // Send first chunk
        message.reply(chunks[0]).catch(err => {
          console.error('Error replying:', err);
        });
        
        // Send remaining chunks
        for (let i = 1; i < chunks.length; i++) {
          message.channel.send(chunks[i]).catch(err => {
            console.error('Error sending chunk:', err);
          });
        }
      } else {
        message.reply(detailsMessage).catch(err => {
          console.error('Error replying:', err);
        });
      }

    } catch (error) {
      console.error('Error handling !endgamedetails command:', error);
      message.reply('❌ An error occurred while retrieving endgame details.').catch(err => {
        console.error('Error replying:', err);
      });
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