import Discord from 'discord.js';
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

// callback function that if defined will handle messages
let process_message = undefined;

const intents = new Discord.IntentsBitField();
intents.add(
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
    intents: intents,
    partials: [
        Discord.Partials.Channel,
    ], // required to recieve DMs
});
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});
client.on('messageCreate', message => {
    if (message.author.bot) return false;

    // DMs
    if(message.channel.type == Discord.ChannelType.DM) {
        process_message(message);
        return true;
    }

    // @BOT messages
    if(message.mentions.has(client.user)) {
        process_message(message);
        return true;
    }

    // not a command
    return false;
});

// ==== utils

function waitFor(conditionFunction) {
    const poll = (resolve, count) => {
        count += 400;
        if(conditionFunction()) resolve();
        else if(count > 20000) resolve(); // hard limit on wait time
        else setTimeout(_ => poll(resolve, count), 400);
    }
    return new Promise(poll, 0);
}

// ==== impl


const players = new Map();

// internal event handlers for audio players
const on_player_error = (guild_id, err) => {
    console.error(`${guild_id}: ${err}`);
}
const on_player_idle = (guild_id) => {
    const connection = getVoiceConnection(guild_id);
    if(!connection) {
        console.log(`${guild_id}: no voice connection - clearing queue`);
        players.get(guild_id).queue = [];
        players.get(guild_id).now = "";
        return;
    }

    const next_item = players.get(guild_id).queue.shift();
    if(!next_item) {
        players.get(guild_id).now = "";
        connection.destroy(); // DISCONNECT from channel
    }

    setTimeout(() => play_item(guild_id, next_item), 1000);
}

// play a queue item in the given guild
// expects an active voice connection
// if no active connection - player will transition but not start playing
const play_item = async (guild_id, item) => {
    console.log(`${guild_id}: playing "${item.name}"`);
    players.get(guild_id).now = item.name;
    players.get(guild_id).player.play(item.resource);
    waitFor(_ => player.audioPlayer.state.status != AudioPlayerStatus.Idle);
}

// join a voice channel and start playing the player for the guild
const join_voice = async (voice_channel) => {
    const guild_id = voice_channel.guild.id;

    let connection = getVoiceConnection(guild_id);
    if(connection && connection.state.status !== VoiceConnectionStatus.Ready) {
        // invalid state - destroy connection and recreate
        connection.destroy();
    } else if(connection && connection.state.subscription && connection.state.subscription.player != players.get(guild_id).player) {
        // invalid audio player - ?!
        console.warn(`${guild_id}: INVALID AUDIO PLAYER?!`);
        connection.subscribe(players.get(guild_id).player);
    }

    connection = joinVoiceChannel({
        channelId: voice_channel.id,
        guildId: guild_id,
        adapterCreator: voice_channel.guild.voiceAdapterCreator,
        selfDeaf: true, // we aren't spying on people lol
    }); 
    connection.subscribe(players.get(guild_id).player);
    await waitFor(_ => 
        conn.state.status == VoiceConnectionStatus.Ready
        ||
        conn.state.status == VoiceConnectionStatus.Destroyed);
}

// --- exposed functionality

const handle = (callback) => {
    process_message = callback;
}
const init = () => {
    client.login(process.env.DISCORD_KEY);

    // async create players for all guilds
    client.guilds.fetch().then((guilds) => {
        guilds.forEach(guild => {
            console.log(`creating player for ${guild.id}`)
            let guild_player = {
                player: createAudioPlayer(),
                queue: [],
                now: null,
            };

            // set events for player
            guild_player.player.on('error', (err) => on_player_error(guild.id, err));
            guild_player.player.on(AudioPlayerStatus.Idle, () => on_player_idle(guild.id));

            players.set(guild.id, guild_player)
        });
        console.log("guild player setup complete");
    })
};

// play provided item in channel
// pushes to queue if items are already playing
const play_in_channel = async(voice_channel, item) => {
    const guild_id = voice_channel.guild.id;

    await join_voice(voice_channel);
    
    const guild_player = players.get(voice_channel.guild.id);
    
    if(guild_player.queue.length == 0 && guild_player.player.state.status == AudioPlayerStatus.Idle) {
        await play_item(guild_id, item);
        return true;
    } else {
        guild_player.queue.push(item);
        return false;
    }
}

// create an audio item for use in the player
const create_audio_item = (name, resource) => {
    return {
        name: name,
        resource: resource
    };
}

// stop playing audio in the guild
//  also clears the queue
//  returns false if audio was not playing
const stop_playing = (guild_id) => {
    const guild_player = players.get(voice_channel.guild.id);
    if(guild_player.player.state.status === AudioPlayerStatus.Playing) {
        guild_player.queue = [];
        guild_player.player.stop();
        return true;
    }

    return false;
}

// clear the audio queue for a guild
const clear_queue = (guild_id) => {
    const guild_player = players.get(voice_channel.guild.id);
    guild_player.queue = [];
}

// get the queue for a guild
const get_queue = (guild_id) => {
    const guild_player = players.get(voice_channel.guild.id);
    return guild_player.queue;
}

// skip the current playing audio
const skip_audio = (guild_id) => {
    const guild_player = players.get(voice_channel.guild.id);
    guild_player.player.stop();
}

// removes an item from the queue 
//  returns the item or undefined if out of bounds
const remove_item = (guild_id, queue_index) => {
    const guild_player = players.get(voice_channel.guild.id);
    if(idx <= guild_player.queue.length && idx > 0) {
        const item = guild_player.queue[idx-1];
        guild_player.queue.splice(idx-1, 1);
        return item;
    }
    return undefined;
}



// create resource from our test audio
const create_test_resource = () => {
    return createAudioResource('77e8ac9116e2c05d2e4eaba5f60dc3ac.mp3');
}
// create resource from WebmOpus streams
const create_audio_resource = (stream) => {
    return createAudioResource(stream, { inputType: StreamType.WebmOpus });
}


export { init, handle, play_in_channel, create_audio_item, create_audio_resource, create_test_resource }

