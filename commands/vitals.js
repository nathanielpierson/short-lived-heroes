module.exports = async function handleVitals(client, message, content) {
  console.log('  -> Handling !vitals command');

  if (!message.guild) {
    try {
      await message.reply('This command only works in a server!');
    } catch (err) {
      console.error('Error replying:', err);
    }
    return;
  }

  try {
    const guild = message.guild;

    // Find alive and dead roles
    const aliveRole = guild.roles.cache.find((role) =>
      role.name.toLowerCase().includes('alive')
    );
    const deadRole = guild.roles.cache.find((role) =>
      role.name.toLowerCase().includes('dead')
    );

    if (!aliveRole && !deadRole) {
      await message.reply('❌ No "alive" or "dead" roles found in this server.');
      return;
    }

    const members = await guild.members.fetch();

    // Players currently in the game: anyone with alive or dead role
    const players = members.filter(
      (member) =>
        (aliveRole && member.roles.cache.has(aliveRole.id)) ||
        (deadRole && member.roles.cache.has(deadRole.id))
    );

    if (players.size === 0) {
      await message.reply('No players currently in the game.');
      return;
    }

    const randomInt = (min, max) =>
      Math.floor(Math.random() * (max - min + 1)) + min;

    const lines = [];

    // Sort by username for consistency
    const sortedPlayers = Array.from(players.values()).sort((a, b) =>
      a.user.tag.localeCompare(b.user.tag)
    );

    for (const member of sortedPlayers) {
      const isAlive = aliveRole && member.roles.cache.has(aliveRole.id);
      const isDead = deadRole && member.roles.cache.has(deadRole.id);

      let beeps = '';

      if (isAlive && !isDead) {
        // Alive: 3–6 beeps, each with 2–6 e's
        const beepCount = randomInt(3, 6);
        const parts = [];
        for (let i = 0; i < beepCount; i++) {
          const eCount = randomInt(2, 6);
          parts.push('b' + 'e'.repeat(eCount) + 'p');
        }
        beeps = parts.join(' ');
      } else if (isDead && !isAlive) {
        // Dead: one long beep, 8–16 e's
        const eCount = randomInt(8, 16);
        beeps = 'b' + 'e'.repeat(eCount) + 'p';
      } else {
        // Both or neither: treat as unknown
        beeps = '???';
      }

      lines.push(`${member.user.tag}: ${beeps}`);
    }

    const response = '**Vitals:**\n' + lines.join('\n');

    await message.reply(response);
  } catch (error) {
    console.error('Error handling !vitals command:', error);
    try {
      await message.reply('❌ An error occurred while checking vitals.');
    } catch (err) {
      console.error('Error replying:', err);
    }
  }
};

