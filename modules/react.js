/*
    react.js holds the ReAct implementation
*/
import * as gpt from './gpt.js'
import * as youtube from './youtube.js'
import { v4 as uuidv4 } from "uuid";



const setup_message = `
Your name is Randal.
You run in a loop of Thought, Action, PAUSE, Observation.
At the end of the loop you output an Answer.
Do not include a duplicate of the Observation with your Answer.
Use Thought to describe your thoughts about the question or command you have been asked.
Use Action to run one of the actions available to you - then return PAUSE.
Observation will be the result of running those actions.

Your available actions are:

wikipedia:
e.g. wikipedia: Django
Returns a summary from searching Wikipedia.

play:
e.g. play: https://www.youtube.com/watch?v=dQw4w9WgXcQ
Plays music from a youtube video in the users voice chat.

youtube:
e.g. youtube: Mr. Blue Sky
Searches youtube for videos and playlists.

videos:
e.g videos: https://www.youtube.com/playlist?list=PLlM8Z1s1PUFLFpHSGOC_i611ZBVjo4pSY
Gets a list of videos associated with a playlist.

stop:
e.g. stop: playing music
Stop playing music in the users voice chat.

skip:
e.g. skip: current song
Skip the current song in the users voice chat.

song:
e.g. song: what is playing
Retrieves the current song playing in the users voice chat.

queue:
e.g. queue: list
Retrieves a list of all songs in the song queue.

Look things up on Wikipedia if you have the opportunity to do so.
If you need more context, you can Answer by asking the user for more information.

Example session:

Question: What is the capital of France?
Thought: I should look up France on Wikipedia
Action: wikipedia: France
PAUSE

You will be called again with this:

Observation: France is a country. The capital is Paris.

You then output:

Answer: The capital of France is Paris
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
                "generator": "search",
                "gsrsearch": q,
                "prop": "extracts",
                "explaintext": "true",
                "exintro": "true",
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
        //console.log(data);

        return Object.values(data.query.pages)
            .find((page)=>page.index == 1).extract;
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
    "play": async (q) => {
        console.log(`\tPlaying: ${q}`);
        // TODO 
        return "action not implemented";
    },
    "videos": async (q) => {
        console.log(`\tVideos: ${q}`);
        // TODO 
        return "action not implemented";
    },
    "stop": async (q) => {
        console.log(`\tStop: ${q}`);
        // TODO 
        return "action not implemented";
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
    }
}


const query = async (history_block, question, max_turns = 10) => {
    // we generate a unique memory block for each query
    //  we clone the chat history first
    //  we then feed our new system message defining ReAct fucntionality
    //  we then feed the question prompt to begin ReActing
    //  once complete we delete the allocated memory block as we'l never need it again

    const memory_block = uuidv4();
    gpt.init(memory_block, setup_message, 0.7);

    gpt.push_message(memory_block,{
        role: "assistant",
        content: `Observation: chat history:\n${gpt.get_memory(history_block).slice(-10).map((entry) => `${entry.role}: ${entry.content}`).join("\n")}`
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
            let observation = await known_actions[action](actionInput)
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