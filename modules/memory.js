

const global_memory = new Map();

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