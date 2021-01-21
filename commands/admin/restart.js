module.exports = {
    name: 'restart',
    group: 'admin',
    description: 'Restarts the bot',
    args: false,
    usage: '',
    aliases: ['rs'],
    admin: true,
    execute({bot, message, args}) {
        console.log(`[!] Restart command issued by ${message.author.username}`);
        message.channel.send('Restarting...');

        bot.destroy();
        process.kill(process.pid, 'SIGINT');

        return message.channel.send('Restart unsuccessful');
    }
}