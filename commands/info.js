const spotify_util = require('../spotify-overwatch.js');
const { Duration } = require('luxon');

module.exports = {
    name: 'info',
    description: 'Get information about this bot, such as support server and source code',
    args: false,
    aliases: ['information', 'support', 'about', 'stats'],
    execute({bot, message, args}) {
       return message.channel.send({ embed:generateHelpEmbed({bot}) });
    }
}

const generateHelpEmbed = function({bot}) {
    return {
		color: 0x1DD05D,
		title: 'Bot Information',
		//url: user.external_urls.spotify,
		//author: {
		//	name: 'Confirm Overwatch on User'
		//	//icon_url: event_obj.playlist.owner.image,
		//	//url: event_obj.playlist.owner.url
		//},
		description: 'Discord bot that watches Spotify profiles and sends messages when a playlist is added, removed, or modified (title/desc/image changed)',
		thumbnail: {
			url: bot.user.displayAvatarURL()
		},
        fields: [   //uptime, support server, github, coding language
            {
                name: 'Total Servers',
                value: bot.guilds.cache.size.toString() +'\n\u200b',
                inline: true
            },
            {
                name: 'Current Overwatches',
                value: Object.values(spotify_util.cache.overwatch_targets).reduce((acc, cur) => acc + Object.keys(cur).length, 0),
                inline: true
            },
            {
                name: 'Uptime',
                value: Duration.fromMillis(bot.uptime).toFormat("dd'd' hh'h' mm'm' ss's'"),
                inline: true
            },
            {
                name: 'Programmed In',
                value: 'Javascript, [discord.js](https://discord.js.org)',
                inline: true
            },
            {
                name: 'Support Server',
                value: 'https://discord.gg/gnjBKhvEUC',
                inline: true
            },
            {
                name: 'Bot Invite',
                value: '[Click here](https://discord.com/api/oauth2/authorize?client_id=788528928863158313&permissions=0&scope=bot "God bless")',
                inline: true
            },
            {
                name: 'GitHub Repo',
                value: 'https://github.com/spotify-util/SpotifyOverwatchDiscord',
                inline: true
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