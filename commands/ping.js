module.exports = async function handlePing(client, message, content) {
  console.log('  -> Responding to !ping');

  try {
    await message.reply('Pong!');
  } catch (err) {
    console.error('Error replying to !ping:', err);
  }
};

