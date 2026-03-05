const handlePing = require('./ping');
const handleTest = require('./test');
const handleVitals = require('./vitals');
const handleCommandsList = require('./commandsList');

// Map of simple text commands to their handlers
const commandHandlers = {
  '!ping': handlePing,
  '!test': handleTest,
  '!vitals': handleVitals,
  '!commands': handleCommandsList,
};

async function handleCommand(client, message, content) {
  const commandName = content.split(' ')[0];
  const handler = commandHandlers[commandName];

  if (!handler) {
    return false;
  }

  await handler(client, message, content);
  return true;
}

module.exports = {
  handleCommand,
};

