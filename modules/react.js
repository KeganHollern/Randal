/*
    react.js holds the ReAct implementation
*/
import * as gpt from './gpt.js'
import * as youtube from './youtube.js'
import { v4 as uuidv4 } from "uuid";
import * as dalle from './dalle.js'
import fs from 'fs'
import * as discord from './discord.js'



const setup_message = `
Your name is Randal.
You run in a loop of Thought, Action, PAUSE, Observation.
At the end of the loop you output an Answer.
Use Thought to describe your thoughts about the question or command you have been asked.
Use Action to run one of the actions available to you - then return PAUSE.
Observation will be the result of running those actions.

Your available actions are:

wikipedia:
e.g. wikipedia: Django
Returns a summary from searching Wikipedia.

play:
e.g. play: https://www.youtube.com/watch?v=dQw4w9WgXcQ
e.g. play: EDM Music
Plays music from youtube in the users voice chat.

youtube:
e.g. youtube: Mr. Blue Sky
Searches youtube for videos and playlists.

videos:
e.g videos: https://www.youtube.com/playlist?list=PLlM8Z1s1PUFLFpHSGOC_i611ZBVjo4pSY
Gets a list of videos associated with a playlist.

dalle:
e.g. dalle: A sketch of a smiling dog
Generate an image using DALL-E and send it to the user.

stop:
e.g. stop: playing music
Stop playing music in the users voice chat.

skip:
e.g. skip: current song
Skip the current song in the users voice chat.

song:
e.g. song: what song
Retrieves the name and url of the song currently being played.

queue:
e.g. queue: list
Retrieves a list of all songs in the song queue.

Always look things up on Wikipedia if you have the opportunity to do so.
If there is no action, do not reply with an observation, Answer as an assistant.
If you need more context, you can Answer by asking the user for more information.
If you need to run multiple actions, you can have a Thought, Action, PAUSE before providing an answer.

Example session:

Question: What is the capital of France?
Thought: I should look up France on Wikipedia
Action: wikipedia: France
PAUSE

You will be called again with this:

Observation: France is a country. The capital is Paris.

You then output:

Answer: The capital of France is Parisslou
`;


const actionRe = new RegExp('^Action: (\\w+): (.*)$');
const answerRe = new RegExp('^Answer: (.*)$');

const known_actions = {
    "wikipedia": async (q) => {
        console.log(`\tSearching wikipedia for: ${q}`);
        const response = await fetch(
            "https://en.wikipedia.org/w/api.php?" +
            new URLSearchParams({
                "action": "query",
                "list": "search",
                "srsearch": q,
                "format": "json"
            }), {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
                mode: "cors",
                cache: "no-cache",
                credentials: "same-origin",
                redirect: "follow",
                referrerPolicy: "no-referrer",
                body: null,
                signal: null,
                keepalive: false,
                referrer: "",
                integrity: "",
                destination: "",
            });

        const data = await response.json();
        return data.query.search[0].snippet;
    },
    "youtube": async (q) => {
        console.log(`\tSearching youtube for: ${q}`);
        let results = await youtube.find(q)
        let result_content = "Search results:\n";
        results.videos.forEach((vid) => {
            result_content += `Video: ${vid.title} by ${vid.author} @ ${vid.url}\n`
        });
        results.playlists.forEach((vid) => {
            result_content += `Playlist: ${vid.title} by ${vid.author} @ ${vid.url}\n`
        });

        return result_content;
    },
    "play": async (q, source_message) => {
        const guild = source_message.guild;
        if(guild === undefined) {
            return "Could not play audio because the user is talking to us in a Direct Message."
        }
        const voice_channel = source_message.member?.voice?.channel;
        if(voice_channel === undefined) {
            return "Could not play audio because the user is not in a voice channel."
        }

        console.log(`\tPlaying: ${q}`);
        const video = await youtube.find_video(q);
        const url = video.url;
        const title = video.title;
        
        const stream = youtube.stream_audio(url);
        if(stream === undefined) {
            return "Failed to start streaming. Something is wrong."
        }
        //console.log(stream);
        const resource = discord.create_audio_resource(stream);
        //console.log(resource);
        const item = discord.create_audio_item(title, resource);
        //console.log(item);

        const result = await discord.play_in_channel(voice_channel, item);
        if(result) {
            return `You have started playing ${title} @ ${url} for the user. The user does not know yet.`
        } else {
            return `You have have added ${title} @ ${url} to the queue for the user. The user does not know yet.`
        }
    },
    "videos": async (q, source_message) => {
        console.log(`\tVideos: ${q}`);
        // TODO 
        return "action not implemented";
    },
    "stop": async (q, source_message) => {
        const guild = source_message.guild;
        if(guild === undefined) {
            return "Could not stop playing music because the user is talking to us in a Direct Message."
        }
        const voice_channel = source_message.member?.voice?.channel;
        if(voice_channel === undefined) {
            return "Could not stop playing music because the user is not in a voice channel."
        }

        console.log(`\tStop: ${q}`);

        if(!discord.stop_playing(guild.id))
            return "Could not stop playing music because no music is being played."

        return "You have stopped the music from playing.";
    },
    "skip": async (q) => {
        console.log(`\tSkip: ${q}`);
        // TODO 
        return "action not implemented";
    },
    "song": async (q) => {
        console.log(`\tSong: ${q}`);
        // TODO 
        return "action not implemented";
    },
    "queue": async (q) => {
        console.log(`\tQueue: ${q}`);
        // TODO 
        return "action not implemented";
    },
    "dalle": async (q, source_message) => {
        try {
            const image_file = await dalle.generate(q);

            // TODO: upload to discord chat
            await source_message.channel.send({
                files: [image_file]
            });

            fs.unlink(image_file, (error) => {
                if(error !== null)
                    console.error(error); 
            });

            return `You have sent a generated image to the user. You have not told them in an Answer yet.`;
        } catch(err) {
            return `Image creation failed: ${err}`
        }
    },
}


const query = async (
    question, // user input
    source_message, // discord source message for action use
    history_block, // previous chat history for context
    max_turns = 5 // max iterations for thoughts
) => {
    // we generate a unique memory block for each query
    //  we clone the chat history first
    //  we then feed our new system message defining ReAct fucntionality
    //  we then feed the question prompt to begin ReActing
    //  once complete we delete the allocated memory block as we'l never need it again

    const memory_block = uuidv4();
    gpt.init(memory_block, setup_message, 0.7);

    gpt.push_message(memory_block,{
        role: "assistant",
        content: `Observation: chat history:\n${gpt.get_memory(history_block).slice(-20).map((entry) => `${entry.role}: ${entry.content}`).join("\n")}`
    })


    let next_prompt = question;
    for (let i = 0; i < max_turns; i++) {
        console.log("-------------------");
        console.log(`User: ${next_prompt}`);
        let result = await gpt.message(memory_block, "user", next_prompt);
        console.log(`AI: ${result}`);
        const actions = result
            .split('\n')
            .filter(a => actionRe.test(a))
            .map(a => actionRe.exec(a));
        if (actions.length > 0) {
            // There is an action to run
            const [_, action, actionInput] = actions[0];

            if (known_actions[action] === undefined) {
                gpt.forget(memory_block);
                throw new Error(`Unknown action: ${action}: ${actionInput}`);
            }
            let observation = await known_actions[action](actionInput, source_message)
            next_prompt = `Observation: ${observation}`
        } else {
            let idx = result.indexOf("Answer: ");
            gpt.forget(memory_block);
            if(idx > -1)
                return result.substring(result.indexOf("Answer: ")).replace("Answer: ","");
            else 
                return result
        }
    }
    gpt.forget(memory_block);
    return "UH OH"
}


export {
    query
}