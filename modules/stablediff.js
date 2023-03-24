import fs from 'fs'
import * as tmp from 'tmp'


const generate = async (q) => {
    
    const response = await fetch(
        "https://api.stability.ai/v1/generation/stable-diffusion-v1-5/text-to-image", 
        {
            "headers": {
                'Content-Type': 'application/json',
                "Accept": 'image/png',
                "Authorization": `Bearer ${process.env.DREAMSTUDIO_KEY}`
            },
            "method": "POST",
            "body": JSON.stringify({
                "text_prompts": [
                    {
                        "text": q,
                    }
                ],
                "cfg_scale": 7,
                "samples": 1,
                "steps": 15
            })
        }
    );

    const tempFile = tmp.fileSync({postfix: '.png', prefix:'dalle-'});

    const data = await response.arrayBuffer();
    
    fs.writeFileSync(tempFile.name, Buffer.from(data));

    return tempFile.name;
};


export {generate}