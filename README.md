# Randal
Randal is a ChatGPT powered Discord bot which implements ReAct techniques for complex action and response.

Example chat:

![image](https://user-images.githubusercontent.com/15372623/226472964-f6283f40-01bf-473d-bc9c-3ea2b634f2a4.png)

## ReAct
Please read the following paper to learn more on reasoning and action in LLMs like GPT-3.5-Turbo: [https://arxiv.org/abs/2210.03629](https://arxiv.org/abs/2210.03629)

## Actions
- Google Knowledge Graph Search
- Wikipedia Search
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

The bot interprets the observation as user feedback. This leads to the bot thanking 
the user for providing information on an action which was performed.

MyAnimeList implementation is not particularly good. Needs some overhauls.