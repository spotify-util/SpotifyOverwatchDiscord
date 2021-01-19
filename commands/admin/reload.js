module.exports = {
    name: 'reload',
    description: 'Reloads a command',
    args: false,
    usage: '<command>',
    aliases: [],
    admin: true,
    execute({bot, message, args}) {
        const commandName = args[0].toLowerCase();
        const command = bot.commands.get(commandName) || bot.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        if(!command) return message.channel.send(`There is no command with name or alias \`${commandName}\`, ${message.author}!`);

        delete require.cache[require.resolve(`./${command.name}.js`)];

        try {
            const newCommand = require(`./${command.name}.js`);
            message.client.commands.set(newCommand.name, newCommand);
        } catch (error) {
            console.error(error);
            return message.channel.send(`There was an error while reloading a command \`${command.name}\`:\n\`${error.message}\``);
        }

        message.channel.send(`Command \`${command.name}\` was reloaded!`);
    }
}