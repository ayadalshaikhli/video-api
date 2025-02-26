import axios from "axios";

const COMFYUI_API_URL = "https://vairality.ngrok.app/queue";

async function checkQueue() {
    try {
        console.log("Checking queue status...");
        const response = await axios.get(COMFYUI_API_URL);
        console.log("Queue Status:", response.data);
    } catch (error) {
        console.error("Error checking queue:", error.response ? error.response.data : error.message);
    }
}

checkQueue();
