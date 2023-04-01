

const global_memory = new Map();


/*

have randal generate keywords based on what he is trying to remember

when recalling he'll feed a keyword in and get back all information that generated the keyword

*/

const get_memory = (key) => {
    const mem = global_memory.get(key);
    if(mem === undefined) {
        return "";
    }
}
const set_memory = (key, value) => {
    global_memory.set(key, value);
}

export {get_memory, set_memory}