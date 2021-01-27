const fsPromises = require('fs').promises;
const spotify_util = require('../../spotify-overwatch.js');

module.exports = {
    name: 'astats',
    group: 'admin',
    description: 'View advanced statistics and information',
    args: false,
    usage: '',
    aliases: [],
    admin: true,
    async execute({bot, message, args}) {
        return message.channel.send({ embed: await generateEmbed({bot}) });
    }
}

const generateEmbed = async function generateAdminStatsEmbed({bot}) {
    // memory usage code modified from sidwarkd's original at https://gist.github.com/sidwarkd/9578213
    const getValFromLine = function (line) {
        var match = line.match(/[0-9]+/gi);
        if(match !== null)
            return parseInt(match[0]);
        else
            return null;
    };
    const memInfo = {};
    const memfile = await fsPromises.readFile('/proc/meminfo', 'utf8');
    const lines = memfile.split('\n');
    memInfo.total = Math.floor(getValFromLine(lines[0]) / 1024);
    memInfo.free = Math.floor(getValFromLine(lines[1]) / 1024);
    memInfo.cached = Math.floor(getValFromLine(lines[4]) / 1024);
    memInfo.used = memInfo.total - memInfo.free;
    memInfo.percentUsed = Math.ceil(((memInfo.used - memInfo.cached) / memInfo.total) * 100);

    //get all database events ever recorded
    const num_events = await spotify_util.database.ref('redirect_ids').once('value');
    
    //get all playlists currently being watched... sum up all playlists for each user (reference local cache to save time, info should still be the same)
    const num_playlists = Object.values(spotify_util.cache.user_profile_playlists).flat().length;
    
    //get the file information, process it below
    const cache_stat = await fsPromises.stat('./cache/user-playlist-cache.json');

    //byte converter method taken from https://stackoverflow.com/a/20732091 (I didn't feel like installing another npm module)
    const byteConverter = function humanFileSize(size) {
        const i = size == 0 ? 0 : Math.floor( Math.log(size) / Math.log(1024) );
        return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
    };

    return {
		color: 0x1DD05D,
		title: 'Advanced Stats Page',
		//url: user.external_urls.spotify,
		//author: {
		//	name: 'Confirm Overwatch on User'
		//	//icon_url: event_obj.playlist.owner.image,
		//	//url: event_obj.playlist.owner.url
		//},
		//description: '**NOT** endorsed or sponsored by Spotify USA, Inc., Spotify AB or Spotify Technologies S.A. in any way.\nThis is a Discord bot that watches Spotify profiles and sends messages when a playlist is added, removed, or modified (title/desc/image changed)',
		thumbnail: {
			url: bot.user.displayAvatarURL()
		},
        fields: [   //uptime, support server, github, coding language
            {
                name: 'Total Events Logged',
                value: num_events.numChildren(),
                inline: false
            },
            {
                name: 'Playlists Being Watched',
                value: num_playlists,
                inline: false
            },
            {
                name: 'Current Overwatch Cycle',
                value: spotify_util.getCurrentOverwatchCycle(),
                inline: false
            },
            {
                name: 'Memory Usage',
                value: `${memInfo.used}MB / ${memInfo.total}MB (${memInfo.percentUsed}%)`,
                inline: false
            },
            {
                name: 'Cache Size',
                value: byteConverter(cache_stat.size),
                inline: false
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