const fsPromises = require('fs').promises;

module.exports = {
    name: 'channel',
	description: 'Change or set the channel where Overwatch events are logged',
	args: false,
    usage: '<channel-name>',
    aliases: [],
	async execute({bot, message, args}) {
        //import current guild settings
        let guild_settings;
        try {
            guild_settings = JSON.parse(await fsPromises.readFile('./cache/guild-settings.json', 'utf8'));
        } catch(err) {
            console.error(err);
			return message.channel.send('I encountered an error while trying to run that command');
        }

        //inform user of current event channel
        if(!args || args.length == 0) {
            if(!guild_settings[message.guild.id]) return message.channel.send(`I have no overwatch channel saved for this discord.\nYou can set one by using the command <@!${bot.user.id}> \`channel <channel-name>\``);
            if(!guild_settings[message.guild.id].ow_channel) return message.channel.send(`I have no overwatch channel saved for this discord.\nYou can set one by using the command <@!${bot.user.id}> \`channel <channel-name>\``);
            return message.channel.send(`The currently set channel for overwatch events is <#${guild_settings[message.guild.id].ow_channel}>`);
        }

        //check input
        if(!args[0].startsWith("<#") || !args[0].endsWith(">"))
            return message.channel.send(`That is not a proper channel mention. Example of a proper channel mention: <#${message.channel.id}>`);
        const ch_id = args[0].slice(2, -1); //extract channel ID
        if(!message.guild.channels.cache.get(ch_id))    //ensure channel exists in this server
            return message.channel.send('That channel does not exist inside this server');
        //check permissions
        const channel_perms = message.guild.channels.resolve(ch_id).permissionsFor(message.guild.me);
        if(!channel_perms.has(["VIEW_CHANNEL", "SEND_MESSAGES"]))
            return message.channel.send('I don\'t have access to send messages in that channel, please either give me access or try a different channel');
        if(!channel_perms.has("EMBED_LINKS"))
            return message.channel.send('I don\'t have access to embed links in that channel, please either give me access or try a different channel');
        if(!channel_perms.has("ADD_REACTIONS"))
            return message.channel.send('I don\'t have access to add reactions in that channel, please either give me access or try a different channel');
        
        //import current guild settings file, add to it locally, then write to the file
        //import performed above
        guild_settings[message.guild.id] = { ...guild_settings[message.guild.id], ow_channel:ch_id };
        try {
            await fsPromises.writeFile('./cache/guild-settings.json', JSON.stringify(guild_settings));
        } catch (err) {
            console.error(err);
            return message.channel.send('I was unable to set that as the event channel');
        }
        return message.channel.send(`Success. I will now send overwatch events to <#${ch_id}>`);
    }
};