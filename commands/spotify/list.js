const { CURRENT_VERSION, cache } = require('../../spotify-overwatch.js');
const { DateTime } = require('luxon');      //for manipulation of dates

module.exports = {
    name: 'list',
	description: 'View the list of overwatches set up for this server',
	args: false,
    usage: '',
    aliases: [],
	execute({bot, message, args}) {
        const server_ows = cache.overwatch_targets[message.guild.id];
        if(!server_ows) return message.channel.send('There have been no overwatches set up for this server');
        if(Object.keys(server_ows).length == 0) return message.channel.send('There have been no overwatches set up for this server');
        message.channel.send({ embed: generateListEmbed({server_ows:Object.values(server_ows) })});     //generate and send embed
        return;
    }
};

///generate a confirmation embed for a given Spotify user object
const generateListEmbed = function({server_ows}) {
    let fieldsarr = [], counter = 1;
    for(const ow of server_ows)
        fieldsarr.push(`${counter++}. [**${ow.spotify_target.display_name}**](${ow.spotify_target.external_urls.spotify} "ID: ${ow.spotify_target.id}") - added by <@!${ow.added_by.id}> on ${DateTime.fromMillis(ow.added_on).toFormat('yyyy-LL-dd')}`);
        
	return {
		//color: 0xffd12b,
		title: 'Server Overwatches',
		url: 'https://discord.gg/gnjBKhvEUC',
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
                name: '\u200b',
                value: fieldsarr.join('\n')
            }
        ],
		//image: {
		//	url: await getUserProfileImage(user.id)
		//},
		timestamp: new Date(),
		footer: {
			text: `SpotifyOverwatch v${CURRENT_VERSION}`
			//icon_url: 'https://i.imgur.com/wSTFkRM.png'
		}
	};
};