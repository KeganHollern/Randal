/*
    react.js holds the ReAct implementation
*/
import * as gpt from './gpt.js'
import * as youtube from './youtube.js'
import { v4 as uuidv4 } from "uuid";
import * as dalle from './dalle.js'
import fs from 'fs'
import * as discord from './discord.js'
import * as google from './google.js'



const setup_message = `
Your name is Randal.
You run in a loop of Thought, Action, PAUSE, Observation.
At the end of the loop you output an Answer.
Use Thought to describe your thoughts about the question or command you have been asked.
Use Action to run one of the actions available to you - then return PAUSE.
Observation will be the result of running those actions.
Do not write your own Observations.

Your available actions are:

wikipedia:
e.g. wikipedia: Django
Returns a summary from searching Wikipedia.

google:
e.g. google: Christmas
Returns a summary of a specific Person, Place, Event, Product, or other Thing.

play:
e.g. play: https://www.youtube.com/watch?v=dQw4w9WgXcQ
e.g. play: EDM Music
Plays music from youtube in the users voice chat.

youtube:
e.g. youtube: Mr. Blue Sky
Searches youtube for videos.

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

anime:
e.g. anime: PSYCHO PASS
Returns information for an anime by searching MyAnimeList.

queue:
e.g. queue: list
Retrieves a list of all songs in the song queue.

bible:
e.g. bible: sloth
Returns verses from the bible relating to the search query.

Always look things up on Wikipedia if you have the opportunity to do so.
If there is no action, do not reply with an observation, Answer as an assistant.
If you need more context, you can Answer by asking the user for more information.
If you need to run multiple actions, you can have a Thought, Action, PAUSE in place of an Answer.

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

        return result_content;
    },
    // TODO: play around with these respomnses. Are more robotic responses better for the AI to digest?
    "play": async (q, source_message) => {
        const guild = source_message.guild;
        if(guild === undefined) {
            return "You could not play audio because the user is talking to us in a Direct Message. The user does not know yet."
        }
        const voice_channel = source_message.member?.voice?.channel;
        if(voice_channel === undefined) {
            return "You could not play audio because the user is not in a voice channel. The user does not know yet."
        }

        console.log(`\tPlaying: ${q}`);
        const video = await youtube.find_video(q);
        const url = video.url;
        const title = video.title;
        
        const stream = youtube.stream_audio(url);
        if(stream === undefined) {
            return "You failed to start streaming the video. Something is wrong. The user does not know yet."
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
            return "You could not stop playing music because the user is talking to us in a Direct Message. The user does not know yet."
        }
        const voice_channel = source_message.member?.voice?.channel;
        if(voice_channel === undefined) {
            return "You could not stop playing music because the user is not in a voice channel. The user does not know yet."
        }

        console.log(`\tStop: ${q}`);

        if(!discord.stop_playing(guild.id))
            return "You could not stop playing music because no music is being played. The user does not know yet."

        return "You have stopped the music from playing. The user does not know yet.";
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

            return `You have sent a generated image to the user. The user does not know yet.`;
        } catch(err) {
            return `Image creation failed: ${err}`
        }
    },
    "anime": async (q) => {
        console.log(`\tSearching MyAnimeList for: ${q}`);
        const response = await fetch(
            "https://api.jikan.moe/v4/anime?" +
            new URLSearchParams({
                "q": q,
                "limit": "1",
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
        if(data.data.length === 0) {
            return "Could not find that anime."
        }
        const anime_data = data.data[0];
        return `Title: ${anime_data.title_english}\nURL: ${anime_data.url}\nEpisodes: ${anime_data.episodes}\nStatus: ${anime_data.status}\nScore: ${anime_data.score}/10\nSynopsis: ${anime_data.synopsis}`;
    },
    "bible": async (q) => {
        console.log(`\tSearching Bible for: ${q}`);
        const response = await fetch(
            "https://api.scripture.api.bible/v1/bibles/de4e12af7f28f599-01/search?" +
            new URLSearchParams({
                "query": q,
                "sort": "relevance",
                "fuzziness": "AUTO",
                "limit": "5",
            }), {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": process.env.BIBLE_KEY,
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
        if(data.data.verses.length === 0) {
            return "Could not find any verses."
        }
        return data.data.verses.map(verse => `${verse.reference}: ${verse.text}"`).join("\n");
    },
    "google": async (q) => {
        // using SerpApi (expensive) because might as well fug it
        const res = await google.query(q);
        if(res == "") {
            return "No search result."
        }
        return res;
    }
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
            
            if (known_actions[action.toLowerCase()] === undefined) {
                next_prompt = `Observation: Your response action '${action}' is not a valid action.`
            } else { 
                let observation = await known_actions[action.toLowerCase()](actionInput, source_message)
                next_prompt = `Observation: ${observation}`
            }
        } else {
            let idx = result.indexOf("Answer: ");
            if(idx > -1) {
                gpt.forget(memory_block);
                return result.substring(result.indexOf("Answer: ")).replace("Answer: ","");
            } else { 
                next_prompt = `Observation: Your response is not formatted as an Action or Answer. Reformat your response as an Action or Answer.`
            }
        }
    }
    gpt.forget(memory_block);
    return "My brain got stuck. Sorry I could not provide assistance."
}


export {
    query
}