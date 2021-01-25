const { getUserProfile } = require('../../spotify-overwatch.js');

module.exports = {
	name: 'ping',
	group: 'general',
	description: 'Get the latentcy of the bot and its connected APIs',
	args: false,
    usage: '',
    aliases: [],
	async execute({bot, message, args}) {
		const sent_message = await message.channel.send('Pinging...');	//send response
		const latency = { discord: bot.ws.ping, spotify: new Date() };	//generate latency variables
		sent_message.edit(`Took ${sent_message.createdTimestamp - message.createdTimestamp}ms to respond.\nDiscord API latency is ${latency.discord}ms\nPinging Spotify API...`
		);
		getUserProfile('ollog10').then(() => {
			latency.spotify = Date.now() - latency.spotify.getTime();
			sent_message.edit(`Took ${sent_message.createdTimestamp - message.createdTimestamp}ms to respond.\nDiscord API latency is ${latency.discord}ms\nSpotify API latency is ${latency.spotify}ms`
			);
		}).catch((err) => {
			console.log(err);
			sent_message.edit(`Took ${sent_message.createdTimestamp - message.createdTimestamp}ms to respond.\nDiscord API latency is ${latency.discord}ms\nSpotify API was pinged unsuccessfully`
			);
		});
    }
};