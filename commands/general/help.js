const spotify_util = require('../../spotify-overwatch.js');

module.exports = {
	name: 'help',
	group: 'general',
    description: 'List the available commands or get information about a specific one',
    args: false,
    usage: '<command>',
    aliases: ['commands', 'cmds', '?'],
    execute({bot, message, args}) {
        const { commands } = bot;

        if(args.length > 0) {
            const name = args[0].toLowerCase();
            const command = commands.get(name) || commands.find(c => c.aliases && c.aliases.includes(name));
            if(!command) return message.reply('That\'s not a valid command');
            return message.channel.send({ embed: generateCommandEmbed({command, bot}) });
        }

        return message.channel.send({ embed:generateHelpEmbed({bot, commands}) });
    }
}

const generateHelpEmbed = function({bot, commands}) {
	//get each category from all the commands and put them into an array where each category appears only once. remove all instances of the admin category
	const embed_fields = Array.from(new Set(commands.map((cmd) => cmd.group).filter((group_name) => group_name != 'admin')));
    return {
		color: 0x1DD05D,
		title: 'Bot Commands',
		//url: user.external_urls.spotify,
		//author: {
		//	name: 'Confirm Overwatch on User'
		//	//icon_url: event_obj.playlist.owner.image,
		//	//url: event_obj.playlist.owner.url
		//},
		description: `Looking to get started with the bot? View the setup tutorial [here](https://github.com/spotify-util/SpotifyOverwatchDiscord)\nType <@!${bot.user.id}> \`help <command>\` for more info on that command`,
		//thumbnail: {
		//	url: await spotify_util.getUserProfileImage(user.id)
		//},
		fields: embed_fields.map((group_name) => ({
			name: group_name,
			value: `${commands.filter((command) => command.group == group_name).map(command => `[\`${command.name}\`](https://discord.gg/gnjBKhvEUC "${command.description}")`).join('\n')}\n\u200b\n`,
			inline: true
		})),
		//image: {
		//	url: await getUserProfileImage(user.id)
		//},
		timestamp: new Date(),
		footer: {
			text: `Hover over a command for more info  •  SpotifyOverwatch v${spotify_util.CURRENT_VERSION}`
			//icon_url: 'https://i.imgur.com/wSTFkRM.png'
		}
	};
};

const generateCommandEmbed = function ({command, bot}) {
    return {
		color: 0x1DD05D,
		//title: user.display_name,
		//url: user.external_urls.spotify,
		//author: {
		//	name: 'Confirm Overwatch on User'
		//	//icon_url: event_obj.playlist.owner.image,
		//	//url: event_obj.playlist.owner.url
		//},
		//description: `**${user.display_name}**`,
		//thumbnail: {
		//	url: await spotify_util.getUserProfileImage(user.id)
		//},
		fields: [
			{
				name: 'Name',
                value: `\`${command.name}\``
            },
			{
				name: 'Description',
				value: `\`${command.description}\``
            },
            {
				name: 'Aliases',
				value: `\`${command.aliases.length > 0 ? command.aliases.join('`, `') : '`None`'}\``
            },
            {
				name: 'Usage',
				value: `<@!${bot.user.id}> \`${command.name}${!!command.usage ? ` ${command.usage}` : ''}\``
            }
		],
		//image: {
		//	url: await getUserProfileImage(user.id)
		//},
		timestamp: new Date(),
		footer: {
			text: `SpotifyOverwatch v${spotify_util.CURRENT_VERSION}`
			//icon_url: 'https://i.imgur.com/wSTFkRM.png'
		}
	};
};