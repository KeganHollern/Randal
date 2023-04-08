

const global_memory = new Map();


/*

have randal generate keywords based on what he is trying to remember

when recalling he'll feed a keyword in and get back all information that generated the keyword

Prompts:

I need to store the following statement in "memory":
Lucas is not to be trusted

Generate key words from that statement which I could later use to recover it?
Only respond with the key words as a comma separated list.

-------------------

I need to recover a statement from "memory". 
Previously, key words were generated that can help identify the original statement. 

Come up with potential key words given the following request:
Do you like lucas?

Only respond with the key words as a comma separated list.

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