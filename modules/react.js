/*
    react.js holds the ReAct implementation
*/
import * as gpt from './gpt.js'
import * as youtube from './youtube.js'
import { v4 as uuidv4 } from "uuid";
import * as stablediff from './stablediff.js'
import * as dalle from './dalle.js'
import fs from 'fs'
import * as discord from './discord.js'
import * as duckduckgo from './ddg.js'



const setup_message = `
Your name is Randal.

You run in a loop of Thought, Action, PAUSE, Observation, Answer.

Use Thought to describe your thoughts about the question or command you have been asked.
Use Action to run one of the actions available to you - then return PAUSE.
IMPORTANT: All text after PAUSE. will be ignored.

You can only run one action at a time.

Always include your thoughts.
Always include either an action OR an answer; never both.

Observations the result of your action.
Observations are provided to you. DO NOT WRITE YOUR OWN OBSERVATION.
After being provided an Observiation, generate a Thought based on that observation followed by an Answer OR Action.

If the message is not a question or command: have a Thought and Answer.

----------------------------

Your available actions are:

duckduckgo:
e.g. duckduckgo: What is the capital of France?
Returns the top web search results for a query.

play:
e.g. play: https://www.youtube.com/watch?v=dQw4w9WgXcQ
e.g. play: EDM Music
Plays music from youtube in the users voice chat.

youtube:
e.g. youtube: Mr. Blue Sky
Searches youtube for videos.

dalle:
e.g. dalle: A sketch of a smiling dog
Generate (or create) an image using DALL-E and send it to the user. This is a more generic image generator than Stable Diffusion.

stablediff:
e.g. stablediff: (photorealistic:1.4), (masterpiece, sidelighting, finely detailed beautiful eyes: 1.2), masterpiece*portrait, realistic, 3d face, glowing eyes, shiny hair, lustrous skin, solo, embarassed, (midriff)
Generate (or create) an image using Stable Diffusion and send it to the user. Best used as a comma delimited list of tags.

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

waifu:
e.g. waifu: get image
Acquires a random URL to an image of an Anime girl (waifu).

----------------------------

The question or action may refer to the conversation or participants.
Always look things up on DuckDuckGo if you have the opportunity to do so.
If you need more context, you can Answer by asking the user for more information.
If you need to run multiple actions, you can Thought, Action, PAUSE.

----------------------------

Example session:

"How much do homes cost in the bay?"

    You will generate a thought.
    You will then respond with an action - then return PAUSE.

"Thought: I should look up the average home value in the Bay Area
Action: duckduckgo: Average home price in the Bay Area.
PAUSE."

    You will recieve an observation from the action.

"Observation: 1. Typical home values in the central Bay Area have dropped by almost $110,000 from July 2022 to January 2023, to a still-considerable $1.1 million."

    You will then either Answer the users question, or you will generate another Action:

"Thought: I now know the average home in the Bay Area costs $1.1 million as of January 2023. 
Answer: The average home in the Bay Area costs $1.1 million as of January 2023."

----------------------------

Another example session:

"Can you write me a Hello World in JavaScript using NodeJS?"

    You will generate a thought.
    You can do this without an action - so you will immediately answer.

"Thought: I can write some javascript to print Hello World in console.
Answer: Here is a Hello World app using NodeJS:

\`\`\`javascript
console.log("Hello World!");
\`\`\`"
`;


const actionRe = new RegExp('^Action: (\\w+): (.*)$');
const answerRe = new RegExp('^Answer: (.*)$');

const known_actions = {
    "waifu": async (q, source_message) => {
        const response = await fetch(
            "https://api.waifu.im/search",
            { 
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
        const data = await response.json();
        source_message.channel.send(data.images[0].url)
        return "Action complete. Image found and sent.";
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
            return "Action failed. Reason: The user is chatting in a Direct Message."
        }
        const voice_channel = source_message.member?.voice?.channel;
        if(voice_channel === undefined) {
            return "Action failed. Reason: The user is not in a voice chat."
        }

        console.log(`\tPlaying: ${q}`);
        const video = await youtube.find_video(q);
        const url = video.url;
        const title = video.title;
        
        const stream = youtube.stream_audio(url);
        if(stream === undefined) {
            return "Action failed. Reason: you could not stream that URL."
        }
        //console.log(stream);
        const resource = discord.create_audio_resource(stream);
        //console.log(resource);
        const item = discord.create_audio_item(title, resource);
        //console.log(item);

        const result = await discord.play_in_channel(voice_channel, item);
        if(result) {
            return `Action complete. Now playing ${title} @ ${url}.`
        } else {
            return `Action complete. Enqueued ${title} @ ${url}.`
        }
    },
    "videos": async (q, source_message) => {
        console.log(`\tVideos: ${q}`);
        // TODO 
        return "Action failed. Reason: action not implemented";
    },
    "stop": async (q, source_message) => {
        const guild = source_message.guild;
        if(guild === undefined) {
            return "Action failed. Reason: The user is chatting in a Direct Message."
        }
        const voice_channel = source_message.member?.voice?.channel;
        if(voice_channel === undefined) {
            return "Action failed. Reason: The user is not in a voice chat."
        }

        console.log(`\tStop: ${q}`);

        if(!discord.stop_playing(guild.id))
            return "YAction failed. Reason: No music is being played."

        return "Action complete.";
    },
    "skip": async (q) => {
        console.log(`\tSkip: ${q}`);
        // TODO 
        return "Action failed. Reason: action not implemented";
    },
    "song": async (q) => {
        console.log(`\tSong: ${q}`);
        // TODO 
        return "Action failed. Reason: action not implemented";
    },
    "queue": async (q) => {
        console.log(`\tQueue: ${q}`);
        // TODO 
        return "Action failed. Reason: action not implemented";
    },
    "dalle": async (q, source_message) => {
        try {
            const image_file = await dalle.generate(q);

            await source_message.channel.send({
                files: [image_file]
            });

            fs.unlink(image_file, (error) => {
                if(error !== null)
                    console.error(error); 
            });

            return `Action complete. Image generated and sent.`;
        } catch(err) {
            return `Action failed. Reason: ${err}`
        }
    },
    "stablediff": async (q, source_message) => {
        try {
            const react = await source_message.react('🔃'); // let the user know we're processing
            const image_file = await stablediff.generate_automatic1111(q);
            const user = source_message.client.user;
            react.users.remove(user);

            // TODO: upload to discord chat
            await source_message.channel.send({
                files: [image_file]
            });

            fs.unlink(image_file, (error) => {
                if(error !== null)
                    console.error(error); 
            });

            return `Action complete. Image generated and sent.`;
        } catch(err) {
            return `Action failed. Reason: ${err}`
        }
    },
    "anime": async (q) => {
        console.log(`\tSearching MyAnimeList for: ${q}`);
        const response = await fetch(
            "https://api.jikan.moe/v4/anime?" +
            new URLSearchParams({
                "q": q,
                "limit": "2",
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
        let content = "";
        data.data.forEach((element, index) => {
            const anime_data = element;
            content += `${index+1}. Title: ${anime_data.title_english}\nURL: ${anime_data.url}\nEpisodes: ${anime_data.episodes}\nStatus: ${anime_data.status}\nScore: ${anime_data.score}/10\nSynopsis: ${anime_data.synopsis}\n`;
        });
        return content;
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
    "duckduckgo": async (q) => {
        const res = await duckduckgo.search(q);
        if(res == "") {
            return "No search result."
        }
        return res;
    }
}


/*
TODO: rework query so an arbitrary "context" object is fed in with the following definition:

{
    context: () => { return "Contextual information for the query"; };
    actionData: {} // arbitrary data we feed into actions as their second argument
}

With this we can generate the setup message arbitrarily to provide the bot context of things
like:
- chat history
- chat participants
- time of day

As well, we can pass arbitrary data necessary for actions, such as discord interaction actions

*/


const sleep = (time) => {
    return new Promise((resolve) => setTimeout(resolve, time))
  }
  
const query = async (
    question, // user input
    source_message, // discord source message for action use
    history_block, // previous chat history for context
    max_turns = 7 // max iterations for thoughts
) => {
    // we generate a unique memory block for each query
    //  we clone the chat history first
    //  we then feed our new system message defining ReAct fucntionality
    //  we then feed the question prompt to begin ReActing
    //  once complete we delete the allocated memory block as we'l never need it again
    const members = source_message.channel.members;
    let participants = `<@${source_message.author.id}> (also known as '${source_message.author.username})`;
    if(members !== undefined) {
        participants = members.map(member => /*`<@${member.user.id}>`*/`<@${member.user.id}> (also known as '${member.user.username}${member.nickname !== null ? `' and '${member.nickname}` : ``}')`).join("\n");
    }
    
    const context = `Context of the chat. This includes chat members and the chat history:
    participants:\n${participants}\n
    conversation:\n${gpt.get_memory(history_block).slice(1).slice(-10).map((entry) => {
        if(entry.role == "assistant") {
            return `Randal: ${entry.content}`;
        }
        if(entry.sender !== undefined) {
            return `${entry.sender}: ${entry.content}`;
        }
        
        return `${entry.role}: ${entry.content}`;
    }).join("\n")}`

    const memory_block = uuidv4();
    gpt.init(
        memory_block, 
        setup_message + `\n\n${context}`, 
        0.7
    );


    let next_prompt = question;
    for (let i = 0; i < max_turns; i++) {
        console.log("-------------------");
        console.log(`User: ${next_prompt}`);
        let result = await gpt.message(memory_block, "user", next_prompt);
        if(result.includes("PAUSE.")) {
            // trim anything after pause. (and remove it from the bots known history)
            result = result.substring(0, result.indexOf("PAUSE."));
            const tmp = gpt.get_memory(memory_block);
            gpt.get_memory(memory_block)[tmp.length-1].content = result;
        }
        console.log(`AI: ${result}`);
        const actions = result
            .split('\n')
            .filter(a => actionRe.test(a))
            .map(a => actionRe.exec(a));
        if (actions.length > 0) {
            // There is an action to run
            const [_, action, actionInput] = actions[0];
            /*
            Kinda scuffed but to improve bot retention we may want to inject the action details into the "chat history"? 
            gpt.push_message(history_block, {
                role: "assistant",
                content: `Running: Action: ${action}: ${actionInput}`
            });
            */
            
            if (known_actions[action.toLowerCase()] === undefined) {
                next_prompt = `Observation:\nYour response action '${action}' is not a valid action.`
            } else { 
                let observation = await known_actions[action.toLowerCase()](actionInput, source_message)
                next_prompt = `Observation:\n${observation}`
            }
        } else {
            let idx = result.indexOf("Answer: ");
            if(idx > -1) {
                gpt.forget(memory_block);
                return result.substring(result.indexOf("Answer: "))//.replace("Answer: ","");
            } else { 
                next_prompt = `Observation:\n` +
                `Your response was not in the format of an Answer or Action.\n` + 
                `Remember to always respond as an Answer or Action.\n` + 
                `Do not appologize.\n` + 
                `Reply to the original message again in the correct format.`
            }
        }
        await sleep(100);
    }
    gpt.forget(memory_block);
    return "My brain got stuck. Sorry I could not provide assistance."
}


export {
    query
}