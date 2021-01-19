const spotify_util = require('../../spotify-overwatch.js');
const fsPromises = require('fs').promises;

module.exports = {
	name: 'overwatch',
	description: 'Set up an overwatch on a Spotify user using their profile URL',
	args: true,
    usage: '<spotify-profile-url>',
    aliases: ['ow', 'watch'],
	async execute({bot, message, args}) {
		//first, make sure the server has set up a channel to log overwatches
		let guild_settings;
        try {
            guild_settings = JSON.parse(await fsPromises.readFile('./cache/guild-settings.json', 'utf8'));
        } catch(err) {
            console.error(err);
			return message.channel.send('I encountered an error while trying to run that command');
		}
		if(!guild_settings[message.guild.id]) return message.channel.send(`I have no overwatch channel saved for this discord.\nYou can set one by using the command <@!${bot.user.id}> \`channel <channel-name>\``);
		if(!guild_settings[message.guild.id].ow_channel) return message.channel.send(`I have no overwatch channel saved for this discord.\nYou can set one by using the command <@!${bot.user.id}> \`channel <channel-name>\``);

		//check command input
		if(!checkInput(args[0])) return message.channel.send('That is not a valid Spotify profile URL. Example of a profile URL: https://open.spotify.com/user/ollog10');
		const id = getId(args[0]);
		if(!id) return message.channel.send('I could not find a Spotify user connected to that account');
		//check if overwatch already exists for user
		if(!!spotify_util.cache.overwatch_targets[message.guild.id] && 
			Object.keys(spotify_util.cache.overwatch_targets[message.guild.id]).includes(id))
			return message.channel.send('This server already has an overwatch placed on that user!');
		//retrieve user info and send confirmation message:
		let user, playlists;
		try {
			user = await spotify_util.getUserProfile(id);
			playlists = await spotify_util.getPlaylistsOfCurrentUser(id);
		} catch (err) { 
			console.error(err);
			return message.channel.send('I could not find a Spotify user connected to that account');
		}
		const msg = await generateUserEmbed({user, playlists});
		let confirm = false;
		//send embed
		await message.channel.send({embed : msg}).then(async (m) => {
			await m.react('✅');	//add reactions
			await m.react('❌');
			await m.awaitReactions((reaction, user) => (reaction.emoji.name == '✅' || reaction.emoji.name == '❌') && user.id == message.author.id, 
				{ time: 10000, max: 1, errors: ['time'] })
				.then((collected) => confirm = collected.first().emoji.name == '✅')	//update confirm boolean to match the emoji collected
				.catch((collected) => collected);	//do nothing
		});
		if(!confirm) return message.channel.send('Canceling overwatch...');
		//proceed with adding the overwatch on the selected user
		spotify_util.addOverwatchTarget({ guild: message.guild, discord_author:message.author, target:user })
			.then(() => message.channel.send(`Overwatch succesfully placed upon \`${user.display_name}\`!`))
			.catch((err) => {
				console.error(err);
				return message.channel.send('I was unable to place an overwatch on that user');
			});
	}
};

const checkInput = function (input) {
	//checks user input to ensure it contains a user id 
	input = input.toString().trim();   //remove whitespace
	if((input.startsWith('http') && input.includes('open.spotify.com') && input.includes('/user/')) ||
	   (input.startsWith('open.spotify.com') && input.includes('/user/')) ||
		input.startsWith('spotify:user:')) return true;
	return false;
};
const getId = function getIdFromUserInput(input) {
	//function assumes input passed the checkInput function
	input = input.toString().trim();
	let id = undefined; //default to undefined for error handling
	//if we have a url
	if(input.startsWith('http') || input.includes('open.spotify.com')) id = input.split('/').pop().split('?')[0];
	//if we have a uri
	else if(input.startsWith('spotify:user:')) id = input.split(':').pop(); //even though .pop() is somewhat inefficent, its less practical to get the length of the array and use that as our index
	return id;
};

//generate a confirmation embed for a given Spotify user object
const generateUserEmbed = async function({user, playlists}) {
	return {
		//color: 0xffd12b,
		title: user.display_name,
		url: user.external_urls.spotify,
		author: {
			name: 'Confirm Overwatch on User'
			//icon_url: event_obj.playlist.owner.image,
			//url: event_obj.playlist.owner.url
		},
		//description: `**${user.display_name}**`,
		thumbnail: {
			url: await spotify_util.getUserProfileImage(user.id)
		},
		fields: [
			{
				name: 'Playlists',
				value: playlists.length,
				inline: true
			},
			{
				name: 'Followers',
				value: user.followers.total,
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