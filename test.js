import axios from "axios";

const COMFYUI_API_URL = "https://vairality.ngrok.app/prompt"; // ComfyUI API endpoint

const testPayload = {
    "prompt": {  // ✅ Wrapping the workflow inside "prompt"
        "3": {
            "inputs": {
                "seed": 444016448752826,
                "steps": 25,
                "cfg": 4,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 0.75,
                "model": ["10", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["16:2", 0]
            },
            "class_type": "KSampler"
        },
        "4": {
            "inputs": {
                "ckpt_name": "juggernautXL_juggXIByRundiffusion.safetensors"
            },
            "class_type": "CheckpointLoaderSimple"
        },
        "6": {
            "inputs": {
                "text": "sex master.",
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "7": {
            "inputs": {
                "text": "",
                "clip": ["10", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "8": {
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
        },
        "9": {
            "inputs": {
                "filename_prefix": "ComfyUI",
                "images": ["8", 0]
            },
            "class_type": "SaveImage"
        },
        "10": {
            "inputs": {
                "lora_name": "hyvid_lora_adapter.safetensors",
                "strength_model": 1.5,
                "strength_clip": 1,
                "model": ["4", 0],
                "clip": ["4", 1]
            },
            "class_type": "LoraLoader"
        },
        "16:0": {
            "inputs": {
                "image": "_91408619_55df76d5-2245-41c1-8031-07a4da3f313f.jpg.webp",
                "upload": "image"
            },
            "class_type": "LoadImage"
        },
        "16:1": {
            "inputs": {
                "upscale_method": "nearest-exact",
                "width": 1024,
                "height": 1024,
                "crop": "disabled",
                "image": ["16:0", 0]
            },
            "class_type": "ImageScale"
        },
        "16:2": {
            "inputs": {
                "pixels": ["16:1", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEEncode"
        }
    }
};

async function runTest() {
    try {
        console.log("Sending test request to ComfyUI...");
        const response = await axios.post(COMFYUI_API_URL, testPayload, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        console.log("Response received:", response.data);
    } catch (error) {
        console.error("Error during test request:", error.response ? error.response.data : error.message);
    }
}

// Run the test
runTest();
