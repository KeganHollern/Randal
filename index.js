// import dependencies
import * as gpt from './modules/gpt.js'
import * as discord from './modules/discord.js'
import * as youtube from './modules/youtube.js'
import * as react from './modules/react.js'

const randal_message = "Your name is Randal. Answer as concisely as possible";
const temp = 0.5;

// Discord.Message<boolean>
discord.handle((message) => {
    const voice_channel = message.member?.voice?.channel;
    const channel =  message.channel;
    const guild = message.guild;
    const content = message.content;
    const sender = message.author.username;

    channel

    channel.sendTyping();
    
    // generic memory setup
    const chat_memory = guild ? guild.id : channel.id;
    if(!gpt.remembers(chat_memory)) {
        gpt.init(chat_memory, randal_message, temp);
    }

    // push the users message to history
    gpt.push_message(chat_memory, {
        role: "user",
        name: sender,
        content: message
    });

    react.query(
        content.replace("<@806981518483259412>", "Randal"),
        message,
        chat_memory)
        .then(response => {
            // push response
            gpt.push_message(chat_memory, {
                role: "assistant",
                content: response
            });

            function chunkSubstr(str, size) {
                const numChunks = Math.ceil(str.length / size)
                const chunks = new Array(numChunks)
              
                for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
                  chunks[i] = str.substr(o, size)
                }
              
                return chunks
            } 
            const parts = chunkSubstr( response, 2000);
            parts.forEach((msg) => {
                channel.send(msg);
            });
        })
        .catch(err => {
            channel.send("OOPSIE WOOPSIE!! Uwu We make a fucky wucky!! A wittle fucko boingo! The code monkeys at our headquarters are working VEWY HAWD to fix this!");
            if(err.response?.data !== undefined)
                console.error(err.response.data);
            else
                console.error(err);
        });

    return;

    

   gpt.message(chat_memory, sender, content.replace("<@806981518483259412>", "Randal"))
    .then(response => {
        function chunkSubstr(str, size) {
            const numChunks = Math.ceil(str.length / size)
            const chunks = new Array(numChunks)
          
            for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
              chunks[i] = str.substr(o, size)
            }
          
            return chunks
        }
        const parts = chunkSubstr( response, 2000);
        parts.forEach((msg) => {
            channel.send(msg);
        });
    })
    .catch(err => {
        console.error(err);
        channel.send("OOPSIE WOOPSIE!! Uwu We make a fucky wucky!! A wittle fucko boingo! The code monkeys at our headquarters are working VEWY HAWD to fix this!")
    });
});
discord.init();

/*



// --- handle discord messages
const randal = async (message) => {
    message.channel.sendTyping();

    let id = (message.guild === null) ? message.channelId : message.guildId;
    
    //TODO: this will get reworked so more complex discord actions
    //          such as play or dall-e will be integrated

    // get do randalgpt
    const randalresponse = await talk_to_randal(
        id,
        message.author.username,
        message.content);

    // send responses
    
};*/