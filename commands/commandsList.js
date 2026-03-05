module.exports = async function handleCommandsList(client, message, content) {
  console.log('  -> Responding to !commands');

  const commandsList = [
    '!ping',
    '!test',
    '!commands',
    '!power',
    '!kill',
    '!reanimate',
    '!define',
    '!gamemaster',
    '!endgame',
    '!endgamedetails',
    '!vitals',
  ];

  try {
    await message.reply(`Available commands:\n${commandsList.join('\n')}`);
  } catch (err) {
    console.error('Error replying to !commands:', err);
  }
};

