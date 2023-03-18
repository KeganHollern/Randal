// import dependencies
import Discord from 'discord.js';
import yts from 'yt-search';
import { 
    joinVoiceChannel, 
    getVoiceConnection,
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    StreamType,
    VoiceConnectionStatus,
    EndBehaviorType,
} from '@discordjs/voice';
import youtubedl from 'youtube-dl-exec';

import { TalkToBot, ProcessMessage, AddAICommand } from './modules/gpt.js';

// insert commands for bot to run
AddAICommand( async (query) => {
    let res = await yts(query)
    return res.videos[0].url;
}, `// Search on youtube
// Argument is the youtube search query as a string.
// Returns the first result URL as a string.
function search(query);`);


let randal_message_cache = new Map();

const talk_to_randal = async (memory_block, sender, message) => {
    
    console.log(await ProcessMessage(memory_block, sender, message));

    return await TalkToBot(memory_block, sender, message);
}

function waitFor(conditionFunction) {
    const poll = resolve => {
      if(conditionFunction()) resolve();
      else setTimeout(_ => poll(resolve), 400);
    }
    return new Promise(poll);
  }


const commands = new Map();
// Add command handler -- note that handler MUST be *async*
const AddCommand = (cmd, code) => {
    commands.set(cmd, code);
};
// Get command handler - undefined if not found
const GetCommand = (message) => {
    if(!message.content.startsWith('!')) return undefined;
    return commands.get(message.content.split(' ')[0].substring(1));
};


const audioPlayers = new Map();


// Create a player w/ a queue that automatically switches songs along the queue
//  Once the queue is empty, the active connection for the guild is canceled.
const NewPlayerForGuild = (gid) => {
    var player = {
        audioPlayer: createAudioPlayer(),
        queue: [],
        now: null,
    };

    player.audioPlayer.on('error', (err) => {
        console.log(err);
    });
    /*player.audioPlayer.on('stateChange', (o, n) => {
        console.log(`player ${o.status} -> ${n.status}`);
    });*/
    
    player.audioPlayer.on(AudioPlayerStatus.Idle, () => {
        const connection = getVoiceConnection(gid);
        if(connection) {
            const nextQueueItem = player.queue.shift();
            if(nextQueueItem) {
                setTimeout(() => PlayQueueItem(player, nextQueueItem), 1000);
            } else {
                // no next item - disconnect & set now to null
                player.now = null; 
                connection.destroy();
            }
        } else {
            // not connected ensure queue and now are reset
            console.log('no active connection - clearing queue');
            // maybe: safely clear audioResource from memory 🤷‍♂️
            //  might be autocleared?  
            player.now = null;
            player.queue = [];
        }
    });

    audioPlayers.set(gid,player);
    return player;
}
// play the queue item resource & set player now to the queue item for metadata collection
// promise resolves when player state is no longer idle
const PlayQueueItem = async (player, queueItem) => {
    console.log(`Playing: ${queueItem.name}`);
    player.now = queueItem;
    player.audioPlayer.play(queueItem.resource);
    waitFor(_ => player.audioPlayer.state.status != AudioPlayerStatus.Idle);
}
// construct a new queue item
const NewQueueItem = (audioResource, displayName) => {
    return {
        name: displayName,
        resource: audioResource,
    };
}


// Get the audio player for the guild
const GetPlayer = (gid) => {
    var player = audioPlayers.get(gid);
    if(player === undefined) {
        // construct a player for the discord
       player = NewPlayerForGuild(gid);
    }
    return player;
}

// Connect to a voice channel - returned promise resolves when in the ready state or rejects on error
const JoinVoiceSafe = async (vc) => {
    // get audio player for voice chat
    const player = GetPlayer(vc.guild.id).audioPlayer;

    // connect to voice chat - leaving any previous one in the guild
    var conn = getVoiceConnection(vc.guild.id)
    if(conn && conn.state.status == VoiceConnectionStatus.Ready) {
        if(conn.state.subscription) {
            if(conn.state.subscription.player != player) {
                conn.subscribe(player);
            }
        }
        // TODO: Determine if we need to swap channels
        //   if so -- do not return but let this function fall through

        return
    } else if(conn) {
        conn.destroy(); // not in a valid ready state so we'll recreate the connection
    }
    
    conn = joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guild.id,
        adapterCreator: vc.guild.voiceAdapterCreator,
        selfDeaf: false,
    });
    conn.subscribe(player);
    // wait for connection to be ready or destroyed
    await waitFor(_ => 
        conn.state.status == VoiceConnectionStatus.Ready
        ||
        conn.state.status == VoiceConnectionStatus.Destroyed);

    //console.log(conn.state.status);
};

// Create an audio resource from a youtube URL
const CreateYoutubeResource = (url) => {
    console.log(`Creating youtube resource from ${url}`);
    // youtubedl.create("/path/to/yt-dlp").exec()
    const stream = youtubedl.exec(url, {
        output: '-', // pipe to stdout
        quiet: true, // quiet
        format: '251', // some unknown format - works so don't change
        limitRate: '100K', // 100K bitrate
    }, { stdio: ['ignore', 'pipe', 'ignore'] }) // stdin, stdout, stderr ?
    return createAudioResource(stream.stdout, { inputType: StreamType.WebmOpus });
}

// create an audio resource we'll use to test the bot
const CreateTestAudioResource = () => {
    return createAudioResource('77e8ac9116e2c05d2e4eaba5f60dc3ac.mp3');
}

// Play the provided queue item in the channel - safely enqueues if the bot is already playing something
// returns only when the music starts playing or item is safely pushed to queue
const PlayInChannel = async (voiceChannel, queueItem) => {
    // join channel & wait for valid connection
    await JoinVoiceSafe(voiceChannel);
    
    const player = GetPlayer(voiceChannel.guild.id);
    // if no queue & nothing playing then play -- otherwise enqueue
    // player - when an item is added to the player via playqueueitem - does not immediately transition from idle state
    if(player.queue.length == 0 && player.audioPlayer.state.status == AudioPlayerStatus.Idle) {
        //console.log(`playing ${queueItem.name} in channel ${voiceChannel.id}`);
        await PlayQueueItem(player, queueItem);
        return true;
    } else {
        //console.log(`pushing  ${queueItem.name} into queue`);
        player.queue.push(queueItem);
        return false;
    }
}

AddCommand("monkagiga", async (message) => {
    const mid = message.member.id;
    const gid = message.guild.id;
    const vc = message.member.voice.channel;
    JoinVoiceSafe(vc); // connect to voice
    const connection = getVoiceConnection(gid);

    // start listening to the user
    const rcvStream = connection.receiver.subscribe(mid,{
        // end after 1s of silence from the user
        end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000,
        },
        autoDestroy: true,
    });
    rcvStream.on('end', _ => {
        console.log('ended');
        if(connection.state.subscription 
            && 
            connection.state.subscription.player 
            &&
            connection.state.subscription.player.state.status == AudioPlayerStatus.Playing
            ) {
            console.log('i think music is playing');
            return; // playing music don't DC
        }
        connection.destroy();
    });
    
    rcvStream.on('data',(chunk => {
        connection.playOpusPacket(chunk)
    })) 
    

})

AddCommand("help", async (message) => {
    return message.reply("Here ya go retard:\n" + 
    "Search youtube: `!search <query>`\n" + 
    "Play music: `!play <video url>`\n" + 
    "Stop music: `!stop`\n" + 
    "View queue and current song: `!queue`\n" + 
    "Skip song: `!skip`\n" + 
    "Remove item from queue: `!remove <index>`\n" + 
    "Play playlist: `!playlist <query>`\n"
    );
});
AddCommand("search", async (message) => {
    var args = message.content.split(' ');
    if(args.length == 1) {
        return message.reply('retard, thats a search command. `!search <anything>`');
    }
    args.shift();
    const results = await yts(args.join(' '));
    const vids = results.videos.slice(0,3);

    var msg = `Videos found:\n`;
    results.videos.slice(0,3).forEach(item => {
        msg += `${item.title} \`${item.url}\`\n`
    });
    msg +=`Playlists found:\n`
    results.playlists.slice(0,3).forEach(item => {
        msg += `${item.title} \`${item.url}\`\n`
    });
    return message.reply(msg);
});
AddCommand("stop", async (message) => {
    const player = GetPlayer(message.guild.id).audioPlayer;
    if(player.state.status == AudioPlayerStatus.Playing) {
        player.stop(); // player should clear its own queue automatically - don't need to do it here
        return message.react('👍');
    } else {
        return message.reply("you're retarded. no music is playing.");
    }
});
AddCommand("clear", async (message) => {
    const voiceChannel = message.member.voice.channel;
    if(!voiceChannel) return message.reply("you must be in the voice channel to remove songs from queue");
    const player = GetPlayer(voiceChannel.guild.id);
    player.queue = [];
    return message.react('👍');
})
AddCommand("queue", async (message) => {
    const gid = message.guild.id;
    const player = GetPlayer(gid);
    if(player.now == null) return message.reply("Nothing is playing you ape.");
    var msg = `Now playing: \`${player.now.name}\`.`;
    if(player.queue.length == 0) return message.reply(msg);
    msg += "\nQueue:\n```\n";
    // iterate adding items to message until there is no way we could fit it
    var index = 0;
    for(const item of player.queue) {
        const nextItem = `${index+1}. ${item.name}\n`;
        if (msg.length + nextItem.length > (2000-7)) { // 7 here ensures we always have room to write `...` at the end of the queue list
            // not enough room for more items
            msg += "...\n"
            break
        }
        msg += nextItem;
        index++;
    }
    msg += "```"
    return message.reply(msg);
});
AddCommand("skip", async (message) => {
    const voiceChannel = message.member.voice.channel;
    if(!voiceChannel) return message.reply("you must be in the voice channel to skip");
    const player = GetPlayer(voiceChannel.guild.id);
    player.audioPlayer.stop(); // stopping the current song should force the player to automatically transition to the next one
    return message.react('✅');
});
AddCommand("remove", async (message) => {
    const voiceChannel = message.member.voice.channel;
    if(!voiceChannel) return message.reply("you must be in the voice channel to remove songs from queue");

    const args = message.content.split(' ').slice(1);
    const idx = parseInt(args);
    
    const player = GetPlayer(voiceChannel.guild.id);

    if(idx <= player.queue.length && idx > 0) {
        const queueItem = player.queue[idx-1];
        player.queue.splice(idx-1, 1);
        return message.reply(`Removed \`${queueItem.name}\`.`);
    } else {
        return message.reply("invalid index tard");
    }
});

AddCommand("playlist", async (message) => {
    const voiceChannel = message.member.voice.channel;
    if(!voiceChannel) return message.reply("you must be in a voice channel to play music retard.");

    // play but instead it uses playlist results & enqueues all videos from the playlist
    const query = message.content.split(' ').slice(1).join(' ');
    console.log(`searching for ${query}`);
    const results = await yts(query);
    
    if(results.playlists.length == 0) {
        return message.reply("no playlist found!");
    }

    const playlistId = results.playlists[0].listId;
    // console.log(`diving into ${playlistId}`);
    const playlist = await yts({listId: playlistId});
    
    if(!playlist || playlist.videos.length == 0) return message.reply('invalid playlist you ape.');

    const foundPromise = message.reply(`Found \`${playlist.title}\` @ ${playlist.url} with ${playlist.videos.length} videos.\n` + 
    `Please wait while I enqueue them for your lazy ass.`);


    // build promises that will all query youtube in parallel to quickly grab details for all items
    var i = 0;
    var promises = [];
    for(i = 0; i < playlist.videos.length; i++) {
        const videoId = playlist.videos[i].videoId;
        const lookupPromise = new Promise(async (resolve, reject) => {
            // console.log(`diving into ${videoId}`);

            const video = await yts({videoId: videoId});
            if(!video) {
                console.log('failed to yts video in playlist!?');
                reject("failed to get video");
                return;
            }
            console.log(`found ${video.url} - ${video.title}`);
            const audioResource = CreateYoutubeResource(video.url);
            const resourceName = video.title;
            const queueItem = NewQueueItem(audioResource, resourceName);
            resolve(queueItem);
        });
        promises.push(lookupPromise);
    }
    // wait for all promises to finish searching youtube
    const lookupPromiseResults = await Promise.allSettled(promises); // wait for all to finish populating queue
    // for each result - shove it into queue synchronously
    for(const result of lookupPromiseResults) {
        if(result.status == "fulfilled") {
            await PlayInChannel(voiceChannel, result.value);
        }
    }

    const foundMsg = await foundPromise;
    if(foundMsg)
        foundMsg.reply(`Added ${i} to the queue`);
    else 
        message.reply(`Added ${i} to the queue`);

    return message.react('🎵'); // notify now playing
});
AddCommand("play", async (message) => {
    const voiceChannel = message.member.voice.channel;
    if(!voiceChannel) return message.reply("you must be in a voice channel to play music retard.")

    // prototype of checking if sender and bot are in the same voice channel - resolve might not work idk im lazy
    //const botmember = await client.guilds.resolve(message.guild).members.fetchMe();
    //if(botmember.voice.channel && botmember.voice.channelId != voiceChannel) return message.reply("you're a slut named lucas")

    const args = message.content.split(' ').slice(1);

    // determine audio resource the user wants to play
    var audioResource = null;
    var resourceName = "idk kegan fucked up";
    if(args.length > 0) {
        var youtubeURL = args[0];
        if (!/^(https?:)?\/\/.*/.test(youtubeURL)) {
            const searchPromise = message.reply(`Searching for \`"${args.join(" ")}"\` 🔎`);
            const results = await yts(args.join(" "));
            if (results.videos.length === 0) return message.reply("Search for something on youtube retard. No results found.");
            const searchMsg = await searchPromise;
            if(searchMsg)
                searchMsg.reply(`Found ${results.videos[0].url}`); // try to reply to our own message
            else
                message.reply(`Found ${results.videos[0].url}`);

            youtubeURL = results.videos[0].url;
            resourceName = results.videos[0].title;
        } else { 
            // TODO: make this safe (don't assume videos contains results like you're doing)
            const r = await yts.search(youtubeURL);
            if(r.videos.length > 0) {            
                resourceName = r.videos[0].title;
            } else {
                console.log('failed to find title for video?')
                resourceName = youtubeURL;
            }
        }
        audioResource = CreateYoutubeResource(youtubeURL);
    } else {
        audioResource = CreateTestAudioResource();
        resourceName = "Test Audio Clip";
    }
    const queueItem = NewQueueItem(audioResource, resourceName);
    
    if(await PlayInChannel(voiceChannel, queueItem))
        return message.react('🎵'); // notify now playing
    else
        return message.react('⏭️'); // notify in queue
});


function chunkSubstr(str, size) {
    const numChunks = Math.ceil(str.length / size)
    const chunks = new Array(numChunks)
  
    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
      chunks[i] = str.substr(o, size)
    }
  
    return chunks
  }

const RandalGPT = async (message) => {
    message.channel.sendTyping();

    let id = (message.guild === null) ? message.channelId : message.guildId;

    const randalresponse = await talk_to_randal(
        id,
        message.author.username,
        message.content);

    const parts = chunkSubstr( randalresponse, 2000); //randalresponse.match(/.{1,4000}/g);
    parts.forEach((msg) => {
        message.channel.send(msg);
    });
};



Discord.Message

// construct our discord API client
const myIntents = new Discord.IntentsBitField();
myIntents.add(
    Discord.IntentsBitField.Flags.Guilds,
    Discord.IntentsBitField.Flags.GuildPresences,
    Discord.IntentsBitField.Flags.GuildVoiceStates,
    Discord.IntentsBitField.Flags.GuildMessages,
    Discord.IntentsBitField.Flags.GuildMessageTyping,
    Discord.IntentsBitField.Flags.GuildMessageReactions,
    Discord.IntentsBitField.Flags.MessageContent,
    Discord.IntentsBitField.Flags.GuildMembers,
    Discord.IntentsBitField.Flags.DirectMessages,
    Discord.IntentsBitField.Flags.DirectMessageTyping,
    Discord.IntentsBitField.Flags.DirectMessageReactions,
);
const client = new Discord.Client({
    intents: myIntents,
    partials: [
        Discord.Partials.Channel,
    ], // required to recieve DMs
});

// log when the client successfully logs in
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// when a player sends a message to a guild, we'll handle that here
client.on('messageCreate', async message => {
    // ignore messages from bots
    if (message.author.bot) return false;

    
   // console.log(message.guild);
    if(message.channel.type == Discord.ChannelType.DM) {
        return await RandalGPT(message);
    }
    
    // if the message is @OurBot then let them know how to use !help
    if(message.mentions.has(client.user)) {
        return await RandalGPT(message);
    }

    // get command and run its handler
    const cmdFunc = GetCommand(message);
    if(cmdFunc !== undefined) {
        return await cmdFunc(message);
    }
    // not a command
    return false;
});

client.login(process.env.DISCORD_KEY);