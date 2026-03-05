module.exports = async function handleTest(client, message, content) {
  console.log('  -> Responding to !test');

  try {
    await message.reply(`✅ I can see this channel! Channel: #${message.channel.name}`);
  } catch (err) {
    console.error('Error replying to !test:', err);
  }
};

