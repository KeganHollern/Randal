# Randal
Randal is a ChatGPT powered Discord bot which implements ReAct techniques for complex action and response.

## Samples

DALL-E | WAIFU | WEB SEARCH 
:-----:|:-----:|:----------:
![image](https://user-images.githubusercontent.com/15372623/226472964-f6283f40-01bf-473d-bc9c-3ea2b634f2a4.png) | ![image](https://user-images.githubusercontent.com/15372623/227073663-2591d3e7-79a8-4b34-b322-1340eabbf0fe.png) | ![image](https://user-images.githubusercontent.com/15372623/227073697-7a6666c2-7f93-401c-bce9-f58ef4c2f180.png)

## ReAct
Please read the following paper to learn more on reasoning and action in LLMs like GPT-3.5-Turbo: [https://arxiv.org/abs/2210.03629](https://arxiv.org/abs/2210.03629)

## Actions
- Google Knowledge Graph Search
- DuckDuckGo Web Search
- Bible Search
- MyAnimeList Search
- Youtube Search
- Music Player
- Dall-E Image Generation

## Requirements
1. [OpenAI](https://platform.openai.com/) API Key
2. [Discord Bot](https://discord.com/developers/applications) API Key
3. [API.Bible](https://scripture.api.bible/) Key
4. [Google](https://console.cloud.google.com/) API Key
5. Latest NodeJS

## Using
1. Add your API keys as environment variables:
  - `OPENAI_KEY`
  - `DISCORD_KEY`
  - `BIBLE_KEY`
  - `GOOGLE_API_KEY`
  
2. Run `npm install`
3. Invite your discord bot to a server
4. Run `node ./index.js`

## Known limitations

Sometimes the bot will "hallucinate" it's own chat history and run arbitrary actions. 
Because of this, I **highly** recommend you do not introduce any arbitrary execution, 
such as with `eval()`. 

The bot needs restarted when invited to a new discord, otherwise playing music will not function.

The bot does not always search for information before generating an action. Due to this,
playing music from youtube sometimes requires explicitly telling the bot to search for
the song on youtube.

The bot can sometimes generate its own actions and observations to break free.

MyAnimeList implementation is not particularly good. Needs some overhauls.
