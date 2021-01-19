module.exports = {
	name: 'ping',
	group: 'general',
	description: 'Get the latentcy of the bot',
	args: false,
    usage: '',
    aliases: [],
	execute({bot, message, args}) {
        return message.channel.send('Pinging...').then((sent) => sent.edit(`Took ${sent.createdTimestamp - message.createdTimestamp}ms to respond. Discord API latency is ${bot.ws.ping}ms`));
    }
};