const Discord = require('discord.js');			//interact with discord
const cloudinary = require('cloudinary').v2;	//modify playlist images
//const firebase = require('firebase-admin');		//access Google firebase to monitor new events
const fs = require('fs');
const { join } = require('path');
const spotify_util = require('./spotify-overwatch.js');

const bot = new Discord.Client({ disableMentions: 'everyone' });
const CREDENTIALS = require('./credentials.js');
//const serviceAccount = require('./spotify-overwatch-firebase-adminsdk-wqz65-47d0d4083e.json');  //used for firebase
bot.PROGRAM_START = new Date();	//store program start date
const CURRENT_VERSION = spotify_util.CURRENT_VERSION;    //current application version
bot.login(CREDENTIALS.discord.token);

let database = spotify_util.database;

cloudinary.config(CREDENTIALS.cloudinary);

bot.commands = new Discord.Collection();

//import commands from files
const commandFiles = fs.readdirSync(join(__dirname, "commands")).filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
	const command = require(join(__dirname, "commands", `${file}`));
	bot.commands.set(command.name, command);
}

const generatePlaylistImage = function(image) {
	return new Promise((resolve, reject) => {
		if(typeof image != 'string') resolve('http://www.glassintel.com/images/default_playlist_img.jpg');
		cloudinary.uploader.upload(image, { folder: "playlist_images/", use_filename: true, unique_filename: false }, (err, res) => {
			if(err) reject(err);
			//if(!res) resolve('http://www.glassintel.com/images/default_playlist_img.jpg');
			//image is now uplaoded, transform it and resolve promise
			resolve(cloudinary.url(res.public_id, {transformation: [
				{aspect_ratio: "1:1", quality: 'auto', width: 300, crop: "fill"},
				{aspect_ratio: "1:1", quality: 'auto', width: 300, crop: "crop"}
			]}));
		});
	});
};

const generateEmbed = async function (event_obj) {
	const embed = {
		//color: 0xffd12b,
		title: 'Overwatch Event!',
		url: event_obj.playlist.url,
		author: {
			//name: `Playlist Modified by ${event_obj.playlist.owner.name}`,
			icon_url: event_obj.playlist.owner.image,
			url: event_obj.playlist.owner.url
		},
		//description: '**__Title Change__**',
		//thumbnail: {
		//	url: 'https://i.scdn.co/image/ab6775700000ee85668f126c6d0a0b85517569cf'
		//},
		fields: [],
		image: {
			//url: await generatePlaylistImage(event_obj.playlist.image.new)
		},
		timestamp: new Date(event_obj.timestamp),
		footer: {
			text: `SpotifyOverwatch v${CURRENT_VERSION}`
			//icon_url: 'https://i.imgur.com/wSTFkRM.png'
		}
	};

	const generateTitle = (text) => `🎵  ${text} 🎵`;
	const generateDesc =  (text) => `⚙️ __**${text}**__ ⚙️`;
	//change the fields of the embed depending on the type of event
	switch (event_obj.type) {
		case "playlistPublic":
			embed.color = 0x5cf78d;
			embed.author.name = `Playlist Made Public by ${event_obj.playlist.owner.name}`;
			embed.title = generateTitle(event_obj.playlist.title);
			embed.image.url = await generatePlaylistImage(event_obj.playlist.image);
			embed.fields = [
				{
					name: 'Title:',
					value: event_obj.playlist.title || '[No title set]'
				},
				{
					name: '\u200b',
					value: '\u200b'
				},
				{
					name: 'Description:',
					value: event_obj.playlist.description || '[No description set]'
				},
				{
					name: '\u200b',
					value: '\u200b'
				},
				{
					name: '\u200b',
					value: '**Image:**'
				}
			];	
			break;
		case "playlistAdd":
			embed.color = 0x1DD05D;
			embed.author.name = `Playlist Created by ${event_obj.playlist.owner.name}`;
			embed.title = generateTitle(event_obj.playlist.title);
			embed.image.url = await generatePlaylistImage(event_obj.playlist.image);
			embed.fields = [
				{
					name: 'Title:',
					value: event_obj.playlist.title || '[No title set]'
				},
				{
					name: '\u200b',
					value: '\u200b'
				},
				{
					name: 'Description:',
					value: event_obj.playlist.description || '[No description set]'
				},
				{
					name: '\u200b',
					value: '\u200b'
				},
				{
					name: '\u200b',
					value: '**Image:**'
				}
			];	
			break;
		case "playlistPrivate":
			embed.color = 0xff6c3b;
			embed.author.name = `Playlist Made Private by ${event_obj.playlist.owner.name}`;
			embed.title = generateTitle(event_obj.playlist.title);
			embed.image.url = await generatePlaylistImage(event_obj.playlist.image);
			embed.fields = [
				{
					name: 'Title:',
					value: event_obj.playlist.title || '[No title set]'
				},
				{
					name: '\u200b',
					value: '\u200b'
				},
				{
					name: 'Description:',
					value: event_obj.playlist.description || '[No description set]'
				},
				{
					name: '\u200b',
					value: '\u200b'
				},
				{
					name: '\u200b',
					value: '**Image:**'
				}
			];	
			break;
		case "playlistRemove":
			embed.color = 0xFF413B;
			embed.author.name = `Playlist Removed by ${event_obj.playlist.owner.name}`;
			embed.title = generateTitle(event_obj.playlist.title);
			embed.image.url = await generatePlaylistImage(event_obj.playlist.image);
			embed.fields = [
				{
					name: 'Title:',
					value: event_obj.playlist.title || '[No title set]'
				},
				{
					name: '\u200b',
					value: '\u200b'
				},
				{
					name: 'Description:',
					value: event_obj.playlist.description || '[No description set]'
				},
				{
					name: '\u200b',
					value: '\u200b'
				},
				{
					name: '\u200b',
					value: '**Image:**'
				}
			];	
			break;
		case "playlistModify":
			embed.color = 0xffd12b;
			embed.author.name = `Playlist Modified by ${event_obj.playlist.owner.name}`;
			embed.title = generateTitle(event_obj.playlist.title.old);
			embed.image.url = await generatePlaylistImage(event_obj.playlist.image.new);
			embed.fields = [
				{
					name: 'Old Title:',
					value: event_obj.playlist.title.old || '[No title set]',
					inline: true
				},
				{
					name: 'New Title:',
					value: event_obj.playlist.title.new || '[No title set]',
					inline: true
				},
				{
					name: '\u200b',
					value: '\u200b',
					inline: false
				},
				{
					name: 'Old Description:',
					value: event_obj.playlist.description.old || '[No description set]',
					inline: true
				},
				{
					name: 'New Description:',
					value: event_obj.playlist.description.new || '[No description set]',
					inline: true
				},
				{
					name: '\u200b',
					value: '\u200b',
					inline: false
				},
				{
					name: 'Old Image:',
					value: `[Click here](${event_obj.playlist.image.old})\n\n**New Image:**`,
					inline: true
				}
			];
			switch(event_obj.subtype) {
				case "titleChange":
					embed.description = generateDesc('Title Change');
					break;
				case "descChange":
					embed.description = generateDesc('Description Change');
					break;
				case "imgChange":
					embed.description = generateDesc('Image Change');
					break;
				case "imgAdd":
					embed.description = generateDesc('Image Added');
					embed.fields[embed.fields.length - 1] = {
						name: '\u200b',
						value: `**New Image:**`,
						inline: true
					};
					break;
				case "imgRemove":
					embed.description = generateDesc('Image Removed');
					embed.fields[embed.fields.length - 1] = {
						name: '\u200b',
						value: `**Old Image:**`,
						inline: true
					};
					embed.image.url = await generatePlaylistImage(event_obj.playlist.image.old);
					break;
			}
	}; 
	
	return embed;
};

bot.once('ready', async () => {
	console.log("Bot online");
	bot.user.setActivity('Spotify profiles', { type: 'WATCHING' });
	//let msg = await spotify_util.getUserProfile('ollog10');
	//bot.channels.cache.find(ch => ch.id == '791372963681271819').send('```json\n' +JSON.stringify(msg) +'```');
	database.ref('redirect_ids').on('child_added', async (snapshot) => {
		//child_added is really dumb in the sense that when you initially call it, it returns
		//all the children currently at the ref
		//bypass this by checking timestamp
		if(!snapshot.val().timestamp || snapshot.val().timestamp < bot.PROGRAM_START.getTime()) return;    //if no timestamp or if timestamp is in the past
		
		//when a new event is added, it does not contain any information about which server to send it to. just the spotify user details.
		//in this file, we need to determine which server(s) need to be notified about the event and send that notification
		const uid = snapshot.val().uid;
		if(!uid) return console.error('Missing UID: ' +snapshot.val());

		//generate embed now so it doesn't get generated multiple times in a later for..of loop
		const embed = await generateEmbed(snapshot.val());

		const matching_servers = [];
		for(const [server_id, server_obj] of Object.entries(spotify_util.cache.overwatch_targets))
			for(const target_id of Object.keys(server_obj))
				if(target_id === uid) matching_servers.push(server_id);	//if a server has an overwatch on the stored uid, add that server id to our array
		for(const server_id of matching_servers) {
			//import guild settings to get channel to send msg
			const guild_settings = JSON.parse(await fs.promises.readFile('./cache/guild-settings.json', 'utf8'));
			if(!guild_settings[server_id]) return console.log(`No guild found with id ${server_id}`);
			if(!guild_settings[server_id].ow_channel) return console.log(`No ow_channel found for guild with id ${server_id}`);
			bot.channels.cache.find(ch => ch.id == guild_settings[server_id].ow_channel).send({ embed: embed });
		}
	});
});

bot.on('message', async (message) => {
	if(message.author.bot || !message.guild) return;
	if(!message.content.startsWith(`<@${bot.user.id}>`) && !message.content.startsWith(`<@!${bot.user.id}`)) return;
	const args = message.content.trim().split(/ +/).slice(1);
	if(!args.length) return;	//if user just typed the prefix and not any actual command
	const commandName = args.shift().toLowerCase();

	const command = bot.commands.get(commandName) || bot.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(commandName));
	if(!command) return;	//if the command is not an actual cmd, exit w/o message
	if(!!command.args && !args.length) 
		return message.channel.send(!!command.usage ? `Proper usage: <@${bot.user.id}> \`${commandName} ${command.usage}\`` : `You didn't provide any arguments, ${message.author}!`);
	
	
	try {
		command.execute({bot:bot, message:message, args:args});
	} catch (err) {
		console.error(err);
		message.reply('There was an error executing that command').catch(console.error);
	}
});

bot.on('guildCreate', (guild) => {
	const embed = {
		title: 'Joined Server',
		thumbnail: {
			url: guild.iconURL()
		},
		fields: [
			{
				name: 'Name',
				value: guild.name,
				inline: true
			},
			{
				name: 'Members',
				value: guild.memberCount.toString(),
				inline: true
			},
			{
				name: 'Owner',
				value: `<@${guild.ownerID}>`,
				inline: true
			}
		],
		timestamp: new Date()
	};
	bot.channels.cache.find(ch => ch.id == '795009519360802918').send({ embed: embed });
});