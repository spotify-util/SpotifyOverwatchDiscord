module.exports = {
    name: 'setactivity',
    group: 'admin',
    description: 'Sets the discord status of the bot',
    args: true,
    usage: '<type> <text>',
    aliases: [],
    admin: true,
    execute({bot, message, args}) {
        const type = args.shift().trim().toUpperCase();
        const text = args.join(' ').trim();
        try {
            bot.user.setActivity(text, {type:type});
        } catch(err) {
            message.channel.send('I was unable to update my discord status');
        }

        return message.channel.send('Success');
    }
}