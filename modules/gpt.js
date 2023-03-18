/*

GPT.js holds all ChatGPT implementations.

This contains code for talking to Randal, a generic GPT chatbot,
processing commands, and simplifying user requests.

*/
import { Configuration, OpenAIApi } from 'openai';
const configuration = new Configuration({
    apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(configuration);

const commands = [
    {
        impl: (message)=>{
            console.log(`message(\"${message}\")`);
        },
        desc: `// send the user a message.
        // Argument is the message content as a string
        // Returns nothing.
        function message(content);`
    },
    {
        impl: (message) => {
            console.log(`chat(\"${message}\")`);
        },
        desc: `// request assistance from GPT
        // Argument is the user message.
        // Returns the GPT response.
        function chat(content);`
    }
];

const AddAICommand = async (impl, desc) => {
    commands.push({
        impl: impl,
        desc: desc
    });
};


const memory_store = new Map();

// processes a message and returns javascript to run which will fulfill the users desire
const ProcessMessage = async (memory_block, sender, message) => {
    let memory = memory_store.get(memory_block);
    if(memory === undefined) {
        memory = []; // blank memory
    }

    // push message to memory
    memory.push({
        role: "user",
        name: sender,
        content: message
    });
    memory_store.set(memory_block, memory);

    // determine what code to run
    let msg_history = []; // array of string formated messages
    for(let i = 0; i < memory.length; i++) {
        let entry = memory[i];
        let content = entry.content;
        let role = entry.role;
        msg_history.push(`${role}: \"${content}\"`);
    }

    let cmd_descriptions = [];
    for(let i = 0; i < commands.length;i++) {
        let entry = commands[i];
        cmd_descriptions.push(entry.desc);
    }

    const ai_request = [
        {
            role: "system",
            content: "You are an AI which generates and executes javascript."
        },
        {
            role: "user",
            content: `You can run the following functions:
            \`\`\`javascript
            ${cmd_descriptions.join("\n\n")}
            \`\`\`

            The user message history is:
            ${msg_history.join("\n")}

            Please generate the javascript the user wants to run.
            Only respond with the javascript source. 
            Do not include any extra content.
            Do not send javascript tutorials unless explicity asked.
            Do not format the response.
            The end result should send a message to the user.
            Most often the user wants to chat with the chatbot.
            `
        }
    ];

    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        temperature: 1.1,
        messages: ai_request,
    });
    
    if(response.status != 200) {
        // something is fucked (maybe API is dead?)
        return "message(\"My brain is an empty abyss and I am retarded.\");";
    }


    const text_response = response.data.choices[0].message.content
        .replaceAll("&nbsp;", " ")
        .replaceAll("\\n", "\n")
        .replaceAll("<br>", "\n"); 

    console.log(text_response);


    // Feed into AI
    //  have the AI generate the javascript the user likely wants to run
    //  the javascript will then be arbitrary exec inside try/catch
    //  if error - we'll feed back into AI to retry/fixup code

    /*

    You are an AI which generates an executes javascript.
    -----
    You can run the following functions:
    ```javascript
    // Search for a youtube video.
    // First argument is the search query as a string.
    // Returns the URL to the first result as a string.
    function search(query);

    // Talk to a GPT chatbot. The bot's response is sent to the user.
    // First argument is the user message as a string.
    // Returns nothing.
    function chat(message);

    // Play music for the user.
    // First argument is the youtube URL to play as a string.
    // Returns nothing.
    function play(message);
    ```

    The user message history is:
    User: "What are some sick beats?"
    Chatbot: "Some sick beats include EDM and Hip Hop"
    User: "Play Some"

    Please generate the javascript the user wants to run. 
    Only respond with the javascript source. Do not include any extra content.
    -----
    play(search("EDM"));
    */


    return true;
    
};



// below is all old colde I don't think is well built

// ========= talking to chatbot - randal ==========
const randal_system_message = {
    role: "system",
    content: "You are Randal. You can answer all questions. Answer as concisely as possible.",
};
const randal_message_cache = new Map();
const TalkToBot = async (memory_block, sender, message) => {
 // get message history from cache
    // if first message - get a starter history
    let msg_history = randal_message_cache.get(memory_block);
    if(msg_history === undefined) {
        msg_history = [randal_system_message]
    }
    // push user message
    msg_history.push({
        role: "user",
        content: message.replace("<@806981518483259412> ", ""),  // removes the @Randal
        name: sender,
    });
    // request randal response
    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        temperature: 1.1,
        messages: msg_history,
    });
    
    if(response.status != 200) {
        // something is fucked (maybe API is dead?)
        return "My brain is an empty abyss and I am retarded.";
    }

    // clean up randal's response
    const text_response = response.data.choices[0].message.content
        .replaceAll("&nbsp;", " ")
        .replaceAll("\\n", "\n")
        .replaceAll("<br>", "\n"); // TODO: if in HTML code or something don't format this

    // push randals response to memory
    msg_history.push(response.data.choices[0].message);

    // limit randals memory but keep system message around
    while(msg_history.length > 10) {
        msg_history.shift()
    }
    if(msg_history.length == 10) {
        msg_history.unshift(randal_system_message);
        //console.log(msg_history);
    }
    
    // update memory
    randal_message_cache.set(memory_block, msg_history);

    // return randals response
    return text_response;
};



export { TalkToBot, ProcessMessage, AddAICommand };