//const express = require('express');         //run the web server
const request = require('superagent');      //make requests
//const cors = require('cors');               //allow the requests to go thru (web security, i know, so annoying)
const fs = require('fs');                   // filesystem
const fsPromises = fs.promises;             //promises module
//const chokidar = require('chokidar');       //an alternative to fs.watch
const firebase = require('firebase-admin'); //communicate with a database
const { setIntervalAsync } = require('set-interval-async/fixed');   //async setInterval

const CREDENTIALS = require('./credentials').spotify;
const serviceAccount = require('./spotify-overwatch-firebase-adminsdk-wqz65-47d0d4083e.json');  //used for firebase

const CURRENT_VERSION = "1.0.4";    //current application version
//cycle record: 

firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://spotify-overwatch.firebaseio.com"
    //databaseAuthVariableOverride: {
    //  uid: "spotify-overwatch"
    //}
});

//import json
let local_cache = {};
async function importLocalJSON() {
    try {
        local_cache.overwatch_targets       = JSON.parse(await fsPromises.readFile('./cache/guild-targets.json', 'utf8'));
        local_cache.user_profile_playlists  = JSON.parse(await fsPromises.readFile('./cache/user-playlist-cache.json', 'utf8'));
        local_cache.single_user_playlists   = JSON.parse(await fsPromises.readFile('./cache/single-playlist-cache.json', 'utf8'));
    } catch (err) {
        throw new Error(err);
    } finally {
        return; //resolve promise
    }
};

//global variables
let database = firebase.database();
let local_credentials = {};
let current_user;

function importDatabaseContent() {
    //imports the user credentials from firebase and stores them in the cache
    //this overrides whatever was previously in the cache
    return Promise.all([
        database.ref(`guild_targets`).once("value").then(async snapshot => {
            await fsPromises.writeFile('./cache/guild-targets.json', JSON.stringify(snapshot.val()))
                .then(() => console.log(`Imported ${Object.values(snapshot.val()).reduce((acc, cur) => acc + Object.keys(cur).length, 0)} overwatch targets from Firebase`))
            return;
        }).catch(err => err),
        database.ref('guild_settings').once("value").then(async snapshot => {
            await fsPromises.writeFile('./cache/guild-settings.json', JSON.stringify(snapshot.val()))
                .then(() => console.log(`Imported ${Object.keys(snapshot.val()).length} guild settings from Firebase`));
            return;
        }).catch(err => err)
    ]);
}

function refreshToken() {
    //refreshes access token and updates local variable
    return request.post('https://accounts.spotify.com/api/token')
        .type('form')
        .set("Authorization", "Basic " + (new Buffer('a4511d3c34a04558bd0dbecda128ebdc' + ':' + '118513780a6a46fc94241c0aef11b2c8').toString('base64')))
        .send({
            grant_type: "refresh_token",
            refresh_token:  CREDENTIALS.refresh_token
        })
        .then(res => {
            //console.log(res.body);
            local_credentials.access_token = res.body.access_token;
            local_credentials.expires_at = new Date().getTime() + (res.body.expires_in * 1000);
            console.log('Succesfully retreived new access token');
        });
};

function authenticateSpotify() {
    //if no token stored locally, generate one
    if(!local_credentials || !local_credentials.access_token) return refreshToken();

    //if token is expired (60sec tolerance)
    if(local_credentials.expires_at <= (new Date().getTime() + (60 * 1000))) return refreshToken();
    return new Promise((resolve, reject) => resolve());
};

function logError(err) {
    console.log("[ERROR] was sent to logError: " +err);
    //log an err to the errors file
    if(err.toString() == "SyntaxError: Unexpected end of JSON input") return fs.appendFile("./log/tmp.log",  JSON.stringify(local_cache) +"\n\n", (append_err) => {
        if(append_err) console.log(`Error in logError: ${append_err}`);
    });
    fs.appendFile("./log/errors.log", `\n${new Date().getTime()} : ${err}`, (append_err) => {
        if(append_err) console.log(`[ERROR] in logError: ${append_err}`);
    });
};


async function updateCache() {
    //takes whatever is in local_cache and saves it to the appropriate ./cache/ files
    console.log("Updating all local cache files...");
    try {
        await fsPromises.writeFile('./cache/single-playlist-cache.json', JSON.stringify(local_cache.single_user_playlists));
        await fsPromises.writeFile('./cache/user-playlist-cache.json', JSON.stringify(local_cache.user_profile_playlists));
        //await fsPromises.writeFile('./cache/guild-targets.json', JSON.stringify(local_cache.overwatch_targets));
    } catch (err) {
        throw new Error(err);
    } finally {
        console.log("Local cache files finished updating!");
    }
};

async function addOverwatchTarget({guild, discord_author, target}) {
    return new Promise((resolve, reject) => {
        const obj = {
            spotify_target: {...target},
            added_by: {...discord_author},
            added_on: new Date().getTime()
        };
        local_cache.overwatch_targets[guild.id] = {...local_cache.overwatch_targets[guild.id], [target.id]: {  ...obj }};   //add object to cache
        fsPromises.writeFile('./cache/guild-targets.json', JSON.stringify(local_cache.overwatch_targets)) //write cache locally
            .then(resolve())
            .catch((err) => {
                console.error(err);
                reject(err);
            });
        database.ref('guild_targets').update({ [`/${guild.id}/${target.id}`]: obj });   //synchronously write to database
    });
};

async function remOverwatchTarget({guild, target_id}) {
    return new Promise(async (resolve, reject) => {
        if(!local_cache.overwatch_targets[guild.id][target_id]) reject();   //ensure target exists in guild cache
        delete local_cache.overwatch_targets[guild.id][target_id];          //remove it
        await fsPromises.writeFile('./cache/guild-targets.json', JSON.stringify(local_cache.overwatch_targets)) //write cache locally
            .catch((err) => {
                console.error(err);
                reject(err);
            });
        //synchronously remove target from database
        database.ref(`guild_targets/${guild.id}/${target_id}`).remove();
        if(!!local_cache.user_profile_playlists[target_id])
            delete local_cache.user_profile_playlists[target_id];           //remove target from playlist cache as well, to save storage
        await updateCache().catch((err) => {
            console.error(err);
            reject(err);
        });
        resolve();
    });
};

//completely remove a guild from the local cache and cloud, including all its overwatch targets
async function remGuildFromCache(guild_id) {
    return new Promise(async (resolve, reject) => {
        if(!local_cache.overwatch_targets[guild_id]) return;  //ensure guild exists in local storage

        //remove all cached playlists from every overwatched user in the guild. you may ask- what if there is a user that was being watched
        //in another server as well? won't removing the cache for that user cause a flood of discord events or console errors?
        //no, it won't- because the method that inspects user profiles on an interval was designed to not send events or throw errors if
        //it's inspecting a profile that has no cache. see the profilePlaylistOverwatch() method for more details
        for(const spotify_uid of Object.keys(local_cache.overwatch_targets[guild_id])) {
            console.log(spotify_uid);
            console.log(!!local_cache.user_profile_playlists[spotify_uid]);
            !!local_cache.user_profile_playlists[spotify_uid] && delete local_cache.user_profile_playlists[spotify_uid];
        }
        console.log(Object.keys(local_cache.user_profile_playlists));
        await updateCache().catch((err) => {
            console.error(err);
            reject(err);
        });

        delete local_cache.overwatch_targets[guild_id]; //remove the guild from our list of ow targets per guild

        //TODO: remove the guild settings from guild-settings.json ??

        //remove the guild info from firebase
        database.ref(`guild_targets/${guild_id}`).remove();
        //database.ref(`guild_settings/${guild_id}`).remove();
        
        //write cache locally
        await fsPromises.writeFile('./cache/guild-targets.json', JSON.stringify(local_cache.overwatch_targets))
            .catch((err) => {
                console.error(err);
                reject(err);
            });
        console.log(Object.keys(local_cache.user_profile_playlists));
        resolve();
    });
};

function locateDifferenceInPlaylistObjs(playlists1, playlists2) {
    //the below function returns an array of playlist objects that are present in playlists1 but not playlists2
    //taken from https://stackoverflow.com/a/40538072
    let added_playlist_ids = playlists1.map(playlist_obj => playlist_obj.id).filter( function(n) { return !this.has(n) }, new Set(playlists2.map(playlist_obj => playlist_obj.id)));
    //^ an array of ids that we need to use to find the actual objects
    let added_playlist_objs = [];   //empty array to return later
    for(const added_playlist_id of added_playlist_ids) {
        let found_obj = playlists1.find(playlist_obj => playlist_obj.id == added_playlist_id);
        if(found_obj) added_playlist_objs.push(found_obj);  //if we actually have an obj, push it
    }
    return added_playlist_objs;
};

function getSinglePlaylist(playlist_id) {
    return new Promise((resolve, reject) => {
        requrest.get(`https://api.spotify.com/v1/playlists/${playlist_id}`)
        .set('Authorization', 'Bearer ' + local_credentials.access_token)     //Spotify API mandatory request header
        .send({ market:'from_token' })
        .then(res => resolve(res.body))
        .catch(err => reject(err));
    });
};

async function getPlaylistsOfCurrentUser(uid = current_user) {
    //watch the user specified, notify upon: playlist add/delete
    let retrieved_playlists = [];
    function recursivelyGetAllPlaylists(url) {
        return new Promise((resolve, reject) => {
            request.get(url)
            .set('Authorization', 'Bearer ' + local_credentials.access_token)     //Spotify API mandatory request header
            .then(async res => {
                for(const playlist of res.body.items) {
                    //since it's using my acct token it has access to my private playlists, go ahead and ignore thoses
                    if(playlist.owner.id != uid || (playlist.owner.id == 'ollog10' && !playlist.public)) continue;
                    retrieved_playlists.push(playlist);
                }
                if(res.body.next) await recursivelyGetAllPlaylists(res.body.next);
                //the above line should wait until all chained promises have completed
                resolve(retrieved_playlists);
            })
            .catch(err => reject(err));
        });
    }

    return recursivelyGetAllPlaylists(`https://api.spotify.com/v1/users/${uid}/playlists?limit=50`);
};

async function getUserProfileImage(id) {
    return new Promise((resolve, reject) => {
        request.get(`https://api.spotify.com/v1/users/${id}`)
        .set('Authorization', 'Bearer ' + local_credentials.access_token)     //Spotify API mandatory request header
        .then(res => {
            if(!res.body.images) reject(`No profile images found for ${id}`);
            if(res.body.images.length > 0) resolve(res.body.images[0].url); //return first image in array
            else resolve('https://icon-library.com/images/default-profile-icon/default-profile-icon-16.jpg'); //default pfp image
        })
        .catch(err => reject(err));
    });
};

async function getUserProfile(id) {
    return new Promise((resolve, reject) => {
        request.get(`https://api.spotify.com/v1/users/${id}`)
        .set('Authorization', 'Bearer ' + local_credentials.access_token)     //Spotify API mandatory request header
        .then(res => {
            if(!!res.body) resolve(res.body);
            else reject("Error getting that user's profile");
        })
        .catch(err => reject(err));
    });
};

async function compareUserProfilePlaylists(retrieved_playlists, uid = current_user) {
    //compares the new (given) list of playlists with whatever's in the cache
    console.log(`${uid}: ${local_cache.user_profile_playlists[uid].length} to ${retrieved_playlists.length}`)
    if(!local_cache.user_profile_playlists[uid]) return;  //nothing in the cache means nothing for us to compare
    //compare this with what is in the cache
    if(retrieved_playlists.length != local_cache.user_profile_playlists[uid].length) {
        //the user either added or deleted a playlist, time to figure out what happened, then send the notification
        if(retrieved_playlists.length > local_cache.user_profile_playlists[uid].length) {
            //determine which playlist was added
            let playlist_diff = locateDifferenceInPlaylistObjs(retrieved_playlists, local_cache.user_profile_playlists[uid]);
            //console.log(playlist_diff);
            if(playlist_diff.length < 1) throw "locateDifferenceInPlaylistObjs error; playlist_diff < 1";   //ideally this shouldn't happen, given the previous checks
            //console.log(playlist_diff);
            //for each new added playlist, send a notification
            for(const playlist_obj of playlist_diff) {
                //store the target playlist in its current state to be referenced later
                const current_playlist_obj = await getSinglePlaylist(playlist_obj.id);

                // TEMPORARY LOGGING
                fs.appendFile("./log/tmp.log", `\n${new Date().getTime()} : \n\tCached User: ${JSON.stringify(local_cache.user_profile_playlists[uid])}\n\tCurrent Obj: ${JSON.stringify(current_playlist_obj)}`, (append_err) => {
                    if(append_err) console.log(`[ERROR] in logError: ${append_err}`);
                });


                //if the newly discovered playlists has songs inside that were added over than 2500ms ago, then we assume the playlist went from private to public
                if(current_playlist_obj.tracks.items.length > 0 &&
                    new Date(current_playlist_obj.tracks.items.sort((a,b) => new Date(a.added_at) - new Date(b.added_at))[0].added_at) < new Date(new Date().getTime() - 2500))
                //send private to public notif
                    database.ref('redirect_ids').push({
                        uid: uid,
                        type: "playlistPublic",  //required
                        playlist: {
                            title: playlist_obj.name,
                            description: playlist_obj.description,
                            image: !!playlist_obj.images[0] ? playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                            owner: { 
                                name: playlist_obj.owner.display_name,
                                id: playlist_obj.owner.id,
                                url: playlist_obj.owner.external_urls.spotify,
                                image: await getUserProfileImage(playlist_obj.owner.id)    //if needed, make the profile image a global variable above
                            },
                            url: playlist_obj.external_urls.spotify
                        },
                        timestamp: new Date().getTime()
                    });
                else    //playlist has no songs or has songs that were added within 2500ms of this being checked (deduction is playlist was just created)
                    database.ref('redirect_ids').push({
                        uid: uid,
                        type: "playlistAdd",  //required
                        playlist: {
                            title: playlist_obj.name,
                            description: playlist_obj.description,
                            image: !!playlist_obj.images[0] ? playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                            owner: { 
                                name: playlist_obj.owner.display_name,
                                id: playlist_obj.owner.id,
                                url: playlist_obj.owner.external_urls.spotify,
                                image: await getUserProfileImage(playlist_obj.owner.id)    //if needed, make the profile image a global variable above
                            },
                            url: playlist_obj.external_urls.spotify
                        },
                        timestamp: new Date().getTime()
                    });
            }
            return;
        } else if(retrieved_playlists.length < local_cache.user_profile_playlists[uid].length) {
            //user removed a playlist from the public library
            //two cases: they had a public playlist that they turned private, or they deleted a public playlist
            let playlist_diff = locateDifferenceInPlaylistObjs(local_cache.user_profile_playlists[uid], retrieved_playlists); //which playlists are present in the cache but not in what was just retrieved?
            //console.log(playlist_diff);
            if(playlist_diff.length < 1) throw "locateDifferenceInPlaylistObjs error; playlist_diff < 1";   //ideally this shouldn't happen, given the previous checks
            //check the "deleted" playlist to see which of the above cases it matches
            for(const playlist_obj of playlist_diff) {
                //store the target playlist in its current state to be referenced later
                const current_playlist_obj = await getSinglePlaylist(playlist_obj.id);

                // TEMPORARY LOGGING
                fs.appendFile("./log/tmp.log", `\n${new Date().getTime()} : \n\tCached Obj: ${JSON.stringify(playlist_obj)}\n\tCurrent Obj: ${JSON.stringify(current_playlist_obj)}`, (append_err) => {
                    if(append_err) console.log(`[ERROR] in logError: ${append_err}`);
                });

                //if snapshot ids are different, then the playlist was deleted
                if(playlist_obj.snapshot_id != current_playlist_obj.snapshot_id)
                    database.ref('redirect_ids').push({
                        uid: uid,
                        type: "playlistRemove",  //required
                        playlist: {
                            title: playlist_obj.name,
                            description: playlist_obj.description,
                            image: !!playlist_obj.images[0] ? playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                            owner: { 
                                name: playlist_obj.owner.display_name,
                                id: playlist_obj.owner.id,
                                url: playlist_obj.owner.external_urls.spotify,
                                image: await getUserProfileImage(playlist_obj.owner.id)    //if needed, make the profile image a global variable above
                            },
                            url: playlist_obj.external_urls.spotify
                        },
                        timestamp: new Date().getTime()
                    });
                //if snapshot ids are the same, then the playlist was only made private
                else if(!current_playlist_obj.public) 
                    database.ref('redirect_ids').push({
                        uid: uid,
                        type: "playlistPrivate",  //required
                        playlist: {
                            title: playlist_obj.name,
                            description: playlist_obj.description,
                            image: !!playlist_obj.images[0] ? playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                            owner: { 
                                name: playlist_obj.owner.display_name,
                                id: playlist_obj.owner.id,
                                url: playlist_obj.owner.external_urls.spotify,
                                image: await getUserProfileImage(playlist_obj.owner.id)    //if needed, make the profile image a global variable above
                            },
                            url: playlist_obj.external_urls.spotify
                        },
                        timestamp: new Date().getTime()
                    });
            }
            return;
        }
    }
    //if we've made it to this point the user has not added or removed any playlists, but they could have modified one of their current ones
    //possible modifications: title, description, images, followers
    for(const single_playlist_obj of retrieved_playlists) {
        //compare the id of our current new playlist to the ids of the cached playlist
        let corresponding_cached_playlist = local_cache.user_profile_playlists[uid].find(playlist_obj => playlist_obj.id == single_playlist_obj.id);
        if(!corresponding_cached_playlist) { 
            console.log("Couldn't find a corresponding cached playlist with id " +single_playlist_obj.id);  //if we couldn't find a playlist with the same id, we have nothing to compare our current new playlist with, so might as well return
            continue;    
        }
        if(single_playlist_obj.snapshot_id == corresponding_cached_playlist.snapshot_id) continue; //both playlists should be exactly the same version, so no need to waste processing power running several checks on them
        //check title
        if(single_playlist_obj.name != corresponding_cached_playlist.name) {
            let dbID = /*await*/ database.ref('redirect_ids').push({
                uid: uid,
                type: "playlistModify",  //required
                subtype: "titleChange", 
                playlist: {
                    title: {
                        old: corresponding_cached_playlist.name,
                        new: single_playlist_obj.name,
                    },
                    description: {
                        old: corresponding_cached_playlist.description,
                        new: single_playlist_obj.description
                    },
                    image: {
                        old: !!corresponding_cached_playlist.images[0] ? corresponding_cached_playlist.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                        new: !!single_playlist_obj.images[0] ? single_playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg'
                    },
                    owner: { 
                        name: corresponding_cached_playlist.owner.display_name,
                        id: corresponding_cached_playlist.owner.id,
                        url: corresponding_cached_playlist.owner.external_urls.spotify,
                        image: await getUserProfileImage(corresponding_cached_playlist.owner.id)    //if needed, make the profile image a global variable above
                    },
                    url: corresponding_cached_playlist.external_urls.spotify
                },
                timestamp: new Date().getTime()
            }).key;
            //no return b/c this is a for-loop
            //no continue b/c it's possible (but not probable) that we might have more changes to notify the user of
        }
        //check desc
        if(single_playlist_obj.description != corresponding_cached_playlist.description) {
            let dbID = /*await*/ database.ref('redirect_ids').push({
                uid: uid,
                type: "playlistModify",  //required
                subtype: "descChange", 
                playlist: {
                    title: {
                        old: corresponding_cached_playlist.name,
                        new: single_playlist_obj.name
                    },
                    description: {
                        old: corresponding_cached_playlist.description,
                        new: single_playlist_obj.description
                    },
                    image: {
                        old: !!corresponding_cached_playlist.images[0] ? corresponding_cached_playlist.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                        new: !!single_playlist_obj.images[0] ? single_playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg'
                    },
                    owner: { 
                        name: corresponding_cached_playlist.owner.display_name,
                        id: corresponding_cached_playlist.owner.id,
                        url: corresponding_cached_playlist.owner.external_urls.spotify,
                        image: await getUserProfileImage(corresponding_cached_playlist.owner.id)
                    },
                    url: corresponding_cached_playlist.external_urls.spotify
                },
                timestamp: new Date().getTime()
            }).key;
        }

        //check followers (to be added, there's currently no list of followers, only a number)

        //check images
        function isCustomImage(img_obj) {
            if(!img_obj) return false;  //can't be a custom img if it doesn't exist lol
            if(!img_obj.url || img_obj.url.includes("mosaic.scdn.co")) return false;
            if(img_obj.height && img_obj.width) return false;
            return true;
        }
        //ok so images are a bit more complicated. they need to come last because we break the loop under certain conditions
        //idea is we notify the user upon any changes involving a custom image, whether that's addition, removal, or change
        //if the images array is missing from either playlist, we have to process a separate set of checks to prevent errs
        if(corresponding_cached_playlist.images.length < 1) {   //if the old playlist has no images
            if(single_playlist_obj.images.length < 1) continue; //if the new playlist also has no images, no change, but we can't continue to run other tests because we need that image array object
            if(isCustomImage(single_playlist_obj.images[0])) {
                let dbID = /*await*/ database.ref('redirect_ids').push({
                    uid: uid,
                    type: "playlistModify",  //required
                    subtype: "imgAdd", 
                    playlist: {
                        title: {
                            old: corresponding_cached_playlist.name,
                            new: single_playlist_obj.name
                        },
                        description: {
                            old: corresponding_cached_playlist.description,
                            new: single_playlist_obj.description
                        },
                        image: {
                            old: !!corresponding_cached_playlist.images[0] ? corresponding_cached_playlist.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                            new: !!single_playlist_obj.images[0] ? single_playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg'
                        },
                        owner: { 
                            name: corresponding_cached_playlist.owner.display_name,
                            id: corresponding_cached_playlist.owner.id,
                            url: corresponding_cached_playlist.owner.external_urls.spotify,
                            image: await getUserProfileImage(corresponding_cached_playlist.owner.id)
                        },
                        url: corresponding_cached_playlist.external_urls.spotify
                    },
                    timestamp: new Date().getTime()
                }).key;
                continue;
            }
        }
        if(single_playlist_obj.images.length < 1) { //if the new playlist has no images
            if(corresponding_cached_playlist.images.length < 1) continue; //if the old playlist also has no images (see long comment ~10 lines above)
            if(isCustomImage(corresponding_cached_playlist.images[0])) {
                let dbID = /*await*/ database.ref('redirect_ids').push({
                    uid: uid,
                    type: "playlistModify",  //required
                    subtype: "imgRemove", 
                    playlist: {
                        title: {
                            old: corresponding_cached_playlist.name,
                            new: single_playlist_obj.name
                        },
                        description: {
                            old: corresponding_cached_playlist.description,
                            new: single_playlist_obj.description
                        },
                        image: {
                            old: !!corresponding_cached_playlist.images[0] ? corresponding_cached_playlist.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                            new: !!single_playlist_obj.images[0] ? single_playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg'
                        },
                        owner: { 
                            name: corresponding_cached_playlist.owner.display_name,
                            id: corresponding_cached_playlist.owner.id,
                            url: corresponding_cached_playlist.owner.external_urls.spotify,
                            image: await getUserProfileImage(corresponding_cached_playlist.owner.id)
                        },
                        url: corresponding_cached_playlist.external_urls.spotify
                    },
                    timestamp: new Date().getTime()
                }).key;
                continue;
            }
        }
        
        //at this point we should be safe to reference images[0] w/o errors
        if(!isCustomImage(single_playlist_obj.images[0]) && !isCustomImage(corresponding_cached_playlist.images[0])) continue;  //both images are non-custom, we don't care
        //if the urls are different, that means there was a change
        if(single_playlist_obj.images[0].url != corresponding_cached_playlist.images[0].url) {
            if(isCustomImage(single_playlist_obj.images[0]) && isCustomImage(corresponding_cached_playlist.images[0])) { //playlist went from one custom img to another
                let dbID = /*await*/ database.ref('redirect_ids').push({
                    uid: uid,
                    type: "playlistModify",  //required
                    subtype: "imgChange", 
                    playlist: {
                        title: {
                            old: corresponding_cached_playlist.name,
                            new: single_playlist_obj.name
                        },
                        description: {
                            old: corresponding_cached_playlist.description,
                            new: single_playlist_obj.description
                        },
                        image: {
                            old: !!corresponding_cached_playlist.images[0] ? corresponding_cached_playlist.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                            new: !!single_playlist_obj.images[0] ? single_playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg'
                        },
                        owner: { 
                            name: corresponding_cached_playlist.owner.display_name,
                            id: corresponding_cached_playlist.owner.id,
                            url: corresponding_cached_playlist.owner.external_urls.spotify,
                            image: await getUserProfileImage(corresponding_cached_playlist.owner.id)
                        },
                        url: corresponding_cached_playlist.external_urls.spotify
                    },
                    timestamp: new Date().getTime()
                }).key;
                continue;
            }

            //another possibility is the playlist went from default img to custom img (or vice versa)

            //went from default img to custom img 
            if(!isCustomImage(corresponding_cached_playlist.images[0]) && isCustomImage(single_playlist_obj.images[0])) {
                let dbID = /*await*/ database.ref('redirect_ids').push({
                    uid: uid,
                    type: "playlistModify",  //required
                    subtype: "imgAdd", 
                    playlist: {
                        title: {
                            old: corresponding_cached_playlist.name,
                            new: single_playlist_obj.name
                        },
                        description: {
                            old: corresponding_cached_playlist.description,
                            new: single_playlist_obj.description
                        },
                        image: {
                            old: !!corresponding_cached_playlist.images[0] ? corresponding_cached_playlist.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                            new: !!single_playlist_obj.images[0] ? single_playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg'
                        },
                        owner: { 
                            name: corresponding_cached_playlist.owner.display_name,
                            id: corresponding_cached_playlist.owner.id,
                            url: corresponding_cached_playlist.owner.external_urls.spotify,
                            image: await getUserProfileImage(corresponding_cached_playlist.owner.id)
                        },
                        url: corresponding_cached_playlist.external_urls.spotify
                    },
                    timestamp: new Date().getTime()
                }).key;
                continue;
            }
            //went from custom img to default img (a generally rare case)
            if(isCustomImage(corresponding_cached_playlist.images[0]) && !isCustomImage(single_playlist_obj.images[0])) {
                let dbID = /*await*/ database.ref('redirect_ids').push({
                    uid: uid,
                    type: "playlistModify",  //required
                    subtype: "imgRemove", 
                    playlist: {
                        title: {
                            old: corresponding_cached_playlist.name,
                            new: single_playlist_obj.name
                        },
                        description: {
                            old: corresponding_cached_playlist.description,
                            new: single_playlist_obj.description
                        },
                        image: {
                            old: !!corresponding_cached_playlist.images[0] ? corresponding_cached_playlist.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg',
                            new: !!single_playlist_obj.images[0] ? single_playlist_obj.images[0].url : 'http://www.glassintel.com/images/default_playlist_img.jpg'
                        },
                        owner: { 
                            name: corresponding_cached_playlist.owner.display_name,
                            id: corresponding_cached_playlist.owner.id,
                            url: corresponding_cached_playlist.owner.external_urls.spotify,
                            image: await getUserProfileImage(corresponding_cached_playlist.owner.id)
                        },
                        url: corresponding_cached_playlist.external_urls.spotify
                    },
                    timestamp: new Date().getTime()
                }).key;
                continue;
            }
        }
    }
};

function getSinglePlaylist(uri) {
    //gets a single playlist and returns a spotify playlist object
    return request.get(`https://api.spotify.com/v1/playlists/${uri}`)
    .set('Authorization', 'Bearer ' + local_credentials.access_token)     //Spotify API mandatory request header
    .query({ market: "from_token" })
    .then(res => res.body)
    .catch(err => err);
};

async function profilePlaylistOverwatch(uid = current_user) {
    //handles the playlist watching of the given user
    //control flow: get current playlists, compare current playlsts to cache, send notif if necessary, then store the retrieved playlists in the cache
    try {
        //console.log("starting overwatch on " +uid);

        //get current playlists
        let new_playlists = await getPlaylistsOfCurrentUser(uid);

        //if there are no playlists in the cache, set the cache now so it can reffered to next iteration
        //this means that if a user was just added and has no cached data, there will not be a flooding of event messages
        if(!local_cache.user_profile_playlists[uid]) //return await updateCache({obj:{...local_cache.user_profile_playlists, [uid]:new_playlists}, file:"user-playlist-cache.json"});
            return local_cache.user_profile_playlists[uid] = new_playlists;
        //we return to prevent unnecessary processing

        //next step is to comapre the new playlists to what's in the cache
        await compareUserProfilePlaylists(new_playlists, uid);  //this function sends notifs for me

        //finally, update the cache
        local_cache.user_profile_playlists[uid] = new_playlists;  //our watcher should catch the below cache update for us
        //await updateCache({file:"user-playlist-cache.json", obj:{...local_cache.user_profile_playlists, [uid]:new_playlists}, uid:uid});
    } catch(err) {
        console.log(`profilePlaylistOverwatch err: ${err}`);
        logError(err);
        throw new Error(err);
    } finally {
        //console.log("finished overwatch on " +uid);
        return;
    }
};

async function compareSinglePlaylists(old_playlist, new_playlist) {
    //compares the two playlist objects and sends the appropriate notifications
    //as well as saves whatever information is necessary in firebase
    try {
        //no differences
        if(old_playlist.snapshot_id == new_playlist.snapshot_id) return;
        
        if(old_playlist.name != new_playlist.name) return await sendNotification({
            type:"playlistModify",
            user:old_playlist.owner.display_name,
            playlist_title:old_playlist.name,
            databaseID:"titleChange" //just for testing purposes
        });
        if(old_playlist.description != new_playlist.description) return await sendNotification({
            type:"playlistModify",
            user:old_playlist.owner.display_name,
            playlist_title:old_playlist.name,
            databaseID:"descChange" //just for testing purposes
        });

        //now for tracks which are a bit more complicated
        
    } catch (err) {
        throw new Error(err);
    } finally {
        return;
    }
}

async function singlePlaylistOverwatch(playlist_uri = "") {
    //handles the single playlist watching of the given playlist
    //control flow: get current playlist, compare current playlst track number to what's in cache, store differences in firebase, send notif if necessary, then store the retrieved playlist in the cache
    try {
        //get current playlist
        let new_playlist = await getSinglePlaylist(playlist_uri);
        //make sure we actually have a playlist
        if(!new_playlist.snapshot_id) throw new Error("Missing playlist snapshot ID: " +JSON.stringify(new_playlist));

        //if there is no playlist in the cache, set the cache now so it can reffered to next iteration
        if(!local_cache.single_user_playlists[playlist_uri]) //return await updateCache({obj:{...local_cache.single_user_playlists, [playlist_uri]:new_playlist}, file:"single-playlist-cache.json"});
        return localStorage.single_user_playlists[playlist_uri] = new_playlist;
        //we return to prevent unnecessary processing

        //next step is to comapre the new playlist obj to what's in the cache
        await compareSinglePlaylists(local_cache.single_user_playlists[playlist_uri], new_playlist);  //this function sends notifs for me

        //finally, update the cache
        local_cache.single_user_playlists[playlist_uri] = new_playlist; // our watcher should catch the below cache update for us
        //await updateCache({file:"single-playlist-cache.json", obj:{...local_cache.single_user_playlists, [playlist_uri]:new_playlist}});
    } catch(err) {
        logError(err);
        throw new Error(err);
    } finally {
        return;
    }
};

let cycle_counter = 0;
const incrementCycleCounter = () => ++cycle_counter;
(async function main() {
    console.log(`Running Spotify Overwatch version ${CURRENT_VERSION}`);
    cycle_counter = 0;
    try {
        // I need to set up something that watches the database and updates the cache files upon database being updated, if I go for cloud-based
        console.log("Initializing...");
        current_user = "";
        await importDatabaseContent();
        await importLocalJSON();
        await authenticateSpotify();

        /*
        logic flow: grab each user from each server and combine them into a single array, removing dups
        for each unique user, perform an overwatch on that user. if a singularity occurs, push an event to firebase
        where it will be processed by the discord bot
        */
        let master_user_list = [];
        for(const targets of Object.values(local_cache.overwatch_targets))
            for(const target_id of Object.keys(targets))
                !master_user_list.includes(target_id) && master_user_list.push(target_id);  //ensure no dups

        //watch the current user and send notification on playlist add/deletion
        let playlist_overwatch = setIntervalAsync(async function(){
            try {
                console.log(`Starting Overwatch cycle ${incrementCycleCounter()}`);
                await authenticateSpotify();
                
                //import cache and update user list
                await importLocalJSON();
                master_user_list = [];
                for(const targets of Object.values(local_cache.overwatch_targets))
                    for(const target_id of Object.keys(targets))
                        !master_user_list.includes(target_id) && master_user_list.push(target_id);  //ensure no dups
                
                for(const user_id of master_user_list)
                    await profilePlaylistOverwatch(user_id);    
                
                //if(!!local_cache.overwatch_targets[current_user].user_profiles)
                //    for(const target_user in local_cache.overwatch_targets[current_user].user_profiles)
                //        await profilePlaylistOverwatch(target_user);
                //if(!!local_cache.overwatch_targets[current_user].user_playlists)
                //    for(const target_playlist in local_cache.overwatch_targets[current_user].user_playlists)
                //        await singlePlaylistOverwatch(target_playlist);
            } catch(err) {
                logError(err);
                console.log(`Overwatch error in cycle ${cycle_counter}: ${err}`);
            } finally {
                await updateCache();
                console.log(`Finished Overwatch cycle ${cycle_counter}`);
            }
        }, 2000);
    } catch(err) {
        logError(err);
        console.log("Initialization error: ", err);
    } finally {
        console.log("Initialization complete");
    }
})();

module.exports = {
    CURRENT_VERSION,
    database,
    cache: local_cache,
    getCurrentOverwatchCycle: () => cycle_counter,
    getUserProfile,
    getUserProfileImage,
    getPlaylistsOfCurrentUser,
    addOverwatchTarget,
    remOverwatchTarget,
    remGuildFromCache
};