/*
    StableDiffusion API

    Intended for use with DREAMSTUDIO or Automatic1111 WebUI
*/
import fs from 'fs'
import * as tmp from 'tmp'

const generate_api = async (q) => {
    
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
// example input:
//"(photorealistic:1.4), (masterpiece, sidelighting, finely detailed beautiful eyes: 1.2), masterpiece*portrait, realistic, 3d face, glowing eyes, shiny hair, lustrous skin, solo, embarassed, (midriff), nsfw"
const generate_automatic1111 = async (q) => {
    const response = await fetch(
        `http://${process.env.STABLEDIFF_URI}/sdapi/v1/txt2img`, //"http://127.0.0.1:7860/sdapi/v1/txt2img", 
        {
            "headers": {
                'Content-Type': 'application/json',
                "Accept": 'application/json',
            },
            "method": "POST",
            "body": JSON.stringify({
                "prompt": q,
                "negative_prompt": "(worst quality, low quality:1.4), monochrome, zombie, many fingers, few fingers",
                
                "width": 512,
                "height": 768,
                "cfg_scale": 7,

                "sampler_name": "DPM++ 2M Karras",
                "steps": 30,


                "enable_hr": true,
                "denoising_strength": 0.3,
                "hr_scale": 2,
                "hr_upscaler": "R-ESRGAN 4x+",
                "hr_second_pass_steps": 30
            })
        }
    );

    const json = await response.json();
    
    if( json.images === undefined || json.images.length === 0) { 
        console.error(json);
        return ""
    }

    const b64 = json.images[0];

    const tempFile = tmp.fileSync({postfix: '.png', prefix:'stablediff-'});
    
    fs.writeFileSync(tempFile.name, b64, 'base64');

    return tempFile.name;
};

export {generate_api, generate_automatic1111}