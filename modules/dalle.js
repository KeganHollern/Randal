import { Configuration, OpenAIApi } from 'openai';
import * as tmp from 'tmp'
import fs from 'fs'
import https from 'https'

const configuration = new Configuration({
    apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(configuration);
const model = "gpt-3.5-turbo";

const downloadImage = (url) => {
    return new Promise((resolve, reject) => {
        const tempFile = tmp.fileSync({postfix: '.png', prefix:'dalle-'});
        const file = fs.createWriteStream(tempFile.name);
        https.get(url, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(tempFile.name);
          });
        }).on('error', (error) => {
          fs.unlink(tempFile.name, () => {}); // Delete the file if there was an error
          reject(`Error downloading the image: ${error.message}`)
        });
    })
}

// generates an image with DALL-E and downloads it to disk.
// call fs.unlink when you're done with the image.
const generate = async (query) => {
    const response = await openai.createImage({
        prompt: query,
        n: 1,
        size: '256x256',
        response_format: 'url',
    });
    if(response.status !== 200) {
        throw new Error(response.statusText);
    }

    let image_file = await downloadImage(response.data.data[0].url);

    
    return image_file;
};

export { generate };