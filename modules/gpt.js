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
const model = "gpt-3.5-turbo";

// map of message histories
// used for retaining memory
const memory_store = new Map();

const init = (memory_block, system_message, temperature=1.1) => {
    if(memory_store.get(memory_block) !== undefined) {
        throw new Error("memory blcok in use - call forget() before initializing");
    }
    memory_store.set(memory_block, {
        temperature: temperature,
        history: [{
            role: "system",
            content: system_message
        }]
    });
};
const forget = (memory_block) => {
    return memory_store.delete(memory_block);
};
const message = async (memory_block, sender, message) => {
    let block = memory_store.get(memory_block);
    if(block === undefined) {
        throw new Error("memory block not initialized - call init() before messaging")
    }

    block.history.push({
        role: "user",
        name: sender,
        content: message
    });
    memory_store.set(memory_block, block);

    //console.log(block.history);

    console.log("\tQuerying OpenAi...");
    const response = await openai.createChatCompletion({
        model: model,
        temperature: block.temperature,
        messages: block.history,
    });

    if(response.status != 200) {
        throw new Error(response.statusText);
    }

    // Debugging
    console.log(response.data.usage);

    block.history.push(response.data.choices[0].message);
    // probably not needed but we'll play with it
    memory_store.set(memory_block, block);

    // this will go somewhere else
    /**/

    return response.data.choices[0].message.content;
};
const remembers = (memory_block) => {
    return memory_store.get(memory_block) !== undefined;
};

const clone_memory = (src, dest, fullclone=false) => {
    if(!remembers(src))
        throw new Error("memory block not initialized - use init before cloning");

    if(fullclone || memory_store.get(dest) === undefined)
        memory_store.set(dest, memory_store.get(src));
    
    // non-full clone - only copy history (+ system message)
    memory_store.get(dest).history = memory_store.get(src).history;
};
const push_message = (memory_block, message) => {
    if(!remembers(memory_block))
        throw new Error("memory block not initialized - use init before pushing");

    memory_store.get(memory_block).history.push(message);
};

const get_memory = (memory_block) => {
    return memory_store.get(memory_block).history;
};

/*

useful legacy snippets

<@806981518483259412>

const text_response = response.data.choices[0].message.content
        .replaceAll("&nbsp;", " ")
        .replaceAll("\\n", "\n")
        .replaceAll("<br>", "\n"); 

*/

export { init, forget, message, remembers, clone_memory, push_message, get_memory };