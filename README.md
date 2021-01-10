# SpotifyOverwatchDiscord
#### A Discord bot that watches Spotify profiles and sends messages when a playlist is added, removed, or modified (title/desc/image changed)

**NOT endorsed or sponsored by Spotify USA, Inc., Spotify AB, or Spotify Technologies S.A. in any way.**

This repository holds the source code for my SpotifyOverwatch discord bot. You can invite the bot using this link:

https://discord.com/api/oauth2/authorize?client_id=788528928863158313&permissions=0&scope=bot

You can join the support server with this invite: https://discord.gg/gnjBKhvEUC

## How to get started

The bot's prefix is its username. Just tag it (@SpotifyOverwatch) and type your command after the tag.

Once you've invited the bot to your server, you need to set up a channel for it to log overwatch events in. Do this by running the command `channel <channel-mention>`. Make sure the channel-mention is an actual Discord channel, otherwise the command won't work.

![Setting event channel](https://i.ibb.co/0t59dYB/image.png)

If you get an error while running the above command, you probably didn't mention the channel correctly or failed to give the bot proper permissions. If you're unable to resolve the issue, join the support server for help.

Once you've set the channel for the bot to log events in, you can create your first overwatch. To do this, run the command `overwatch <spotify-profile-url>`.

![Adding an overwatch](https://i.ibb.co/nL2vvh8/image.png)

The bot will send a confirmation message like the one above. React with the checkmark to confirm the creation of an overwatch on that Spotify user. React with the X to cancel the overwatch.

At this point, the bot will now send a message to the channel you added earlier anytime it detects an event on an overwatch you've created. Currently, the bot only watches for changes in playlists that aren't song-related (adding/removing a playlist, changing a playlist title/description, etc). Here's an example of what an overwatch event may look like:

![Example overwatch event](https://i.ibb.co/QfX6j8x/image.png)

At this point, you've completed the basic setup process. If you want to add more overwatches, simply repeat the `overwatch <spotify-profile-url>` command. You can change the channel that the bot sends events to by rerunning the `channel <channel-mention>` command. To view a full list of commands, run the command `help`. 

There are more resources available in the [support server](https://discord.gg/gnjBKhvEUC), and I'm more than willing to personally assist you if you get stuck. I hope you enjoy!
