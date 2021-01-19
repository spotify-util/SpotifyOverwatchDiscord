const spotify_util = require('../../spotify-overwatch.js');
const { DateTime } = require('luxon');      //for manipulation of dates
let ow_targets;

module.exports = {
	name: 'remove',
	description: 'Removes an overwatch on a user by their overwatch number or Spotify profile URL',
	args: true,
    usage: '<overwatch-number> OR <spotify-profile-url>',
    aliases: ['rm', 'delete'],
	async execute({bot, message, args}) {
        ow_targets = spotify_util.cache.overwatch_targets[message.guild.id] || {};   //change reference variable to be a server-specific object
        if(!ow_targets || Object.values(ow_targets).length == 0)
            return message.channel.send('There are currently no overwatches set up for this server');
		if(!checkInput(args[0])) return message.channel.send('That is not a valid argument. Please specify either the number or the profile URL of the overwatch to remove.');
		const id = getId(args[0]);
        if(!id) return message.channel.send('I could not find a Spotify user with the given arguments');
        //ensure ID exists in the server overwatches
        if(!Object.keys(ow_targets).includes(id)) return message.channel.send('There is no overwatch for that user');

		//retrieve user info and send confirmation message:
		let user, playlists;
		try {
			user = await spotify_util.getUserProfile(id);
			playlists = await spotify_util.getPlaylistsOfCurrentUser(id);
		} catch (err) { 
			console.error(err);
			return message.channel.send('I had trouble retrieving info from Spotify...');
		}
		const msg = await generateUserEmbed({user, playlists, cached_obj:ow_targets[id]});
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
		if(!confirm) return message.channel.send('Overwatch removal canceled');
		//proceed with removing the overwatch on the selected user
		spotify_util.remOverwatchTarget({ guild: message.guild, target_id: id })
			.then(() => message.channel.send(`Overwatch on \`${user.display_name}\` successfully removed`))
			.catch((err) => {
				console.error(err);
				return message.channel.send('I was unable to remove the overwatch on that user');
			});
	}
};

//ensure arg has a spotify ID or is a number
const checkInput = function (input) {
	//checks user input to ensure it contains a user id 
	input = input.toString().trim();   //remove whitespace
	if((input.startsWith('http') && input.includes('open.spotify.com') && input.includes('/user/')) ||
	   (input.startsWith('open.spotify.com') && input.includes('/user/')) ||
        input.startsWith('spotify:user:')) return true;
    if(isNaN(Number(input))) return false;  //'' will default to zero, which is fine
    //if input is a number, ensure it exists within the range of overwatches to remove
    if(Number(input) <= Object.values(ow_targets).length &&
        Number(input) > 0) return true;
	return false;
};

const getId = function getIdFromUserInput(input) {
    //function assumes input passed the checkInput function
    //first deal with numbers
    if(!isNaN(input)) 
        return Object.values(ow_targets)[Number(input) - 1].spotify_target.id;
    //now with strings
	input = input.toString().trim();
	let id = undefined; //default to undefined for error handling
	//if we have a url
	if(input.startsWith('http') || input.includes('open.spotify.com')) id = input.split('/').pop().split('?')[0];
	//if we have a uri
	else if(input.startsWith('spotify:user:')) id = input.split(':').pop(); //even though .pop() is somewhat inefficent, its less practical to get the length of the array and use that as our index
	return id;
};

//generate a confirmation embed for a given Spotify user object
const generateUserEmbed = async function({user, playlists, cached_obj}) {
	return {
		//color: 0xffd12b,
		title: user.display_name,
		url: user.external_urls.spotify,
		author: {
			name: 'Confirm Removal of Overwatch on User'
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
            },
			{
				name: '\u200b',
				value: '\u200b'
            },
            {
				name: 'Added By',
				value: `<@${cached_obj.added_by.id}>`,
				inline: true
			},
			{
				name: 'Added On',
				value: DateTime.fromMillis(cached_obj.added_on).toFormat('yyyy-LL-dd'),
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