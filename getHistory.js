import axios from "axios";

const COMFYUI_API_URL = "https://vairality.ngrok.app/history";

async function getHistory() {
    try {
        console.log("Fetching generated images...");
        const response = await axios.get(COMFYUI_API_URL);
        const history = response.data;

        for (const [promptId, data] of Object.entries(history)) {
            if (data.status.completed) {
                console.log(`✅ Image for prompt_id: ${promptId} is ready!`);

                const outputNode = data.outputs["9"]; // Node 9 is where images are saved
                if (outputNode && outputNode.images) {
                    outputNode.images.forEach((image, index) => {
                        const imageUrl = `https://vairality.ngrok.app/view?filename=${image.filename}&type=output&subfolder=&t=${Date.now()}`;
                        console.log(`🖼️ Image ${index + 1}: ${imageUrl}`);
                    });
                } else {
                    console.log("⚠️ No image found for this prompt.");
                }
            }
        }
    } catch (error) {
        console.error("Error fetching history:", error.response ? error.response.data : error.message);
    }
}

getHistory();
