import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Load Instagram Credentials
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_USER_ID = process.env.INSTAGRAM_USER_ID;

// 📌 1. Upload Image or Video to Instagram API using a Public URL
export const uploadMediaToInstagram = async (req, res) => {
    try {
        const { mediaUrl, type, caption } = req.body;

        if (!mediaUrl) {
            return res.status(400).json({ error: "Media URL is required" });
        }

        let uploadUrl = `https://graph.facebook.com/v18.0/${INSTAGRAM_USER_ID}/media`;
        let params = {
            access_token: INSTAGRAM_ACCESS_TOKEN,
            caption: caption || "",
        };

        if (type === "IMAGE") {
            params.image_url = mediaUrl;
        } else if (type === "VIDEO" || type === "REELS") {
            params.media_type = "VIDEO";
            params.video_url = mediaUrl;
        } else {
            return res.status(400).json({ error: "Invalid media type. Use IMAGE or VIDEO" });
        }

        // Step 1: Upload Media
        const uploadResponse = await axios.post(uploadUrl, params);
        const creationId = uploadResponse.data.id;

        // Step 2: Publish Media
        const publishUrl = `https://graph.facebook.com/v18.0/${INSTAGRAM_USER_ID}/media_publish`;
        const publishResponse = await axios.post(publishUrl, {
            creation_id: creationId,
            access_token: INSTAGRAM_ACCESS_TOKEN,
        });

        res.json({ message: "Media posted successfully!", postId: publishResponse.data.id });

    } catch (error) {
        console.error("[Instagram] Error posting media:", error.response?.data || error.message);
        res.status(500).json({ error: "Internal server error", details: error.response?.data || error.message });
    }
};

// 📌 2. Upload Carousel (Multiple Images/Videos in One Post)
export const uploadCarouselToInstagram = async (req, res) => {
    try {
        const { mediaUrls, caption } = req.body;

        if (!mediaUrls || !Array.isArray(mediaUrls)) {
            return res.status(400).json({ error: "Media URLs must be an array" });
        }

        // Step 1: Upload Each Media as Carousel Items
        const containerIds = await Promise.all(mediaUrls.map(async (fileUrl) => {
            const response = await axios.post(`https://graph.facebook.com/v18.0/${INSTAGRAM_USER_ID}/media`, {
                image_url: fileUrl,
                is_carousel_item: true,
                access_token: INSTAGRAM_ACCESS_TOKEN
            });
            return response.data.id;
        }));

        // Step 2: Create Carousel Container
        const carouselResponse = await axios.post(`https://graph.facebook.com/v18.0/${INSTAGRAM_USER_ID}/media`, {
            media_type: "CAROUSEL",
            caption,
            children: containerIds.join(","),
            access_token: INSTAGRAM_ACCESS_TOKEN
        });

        const carouselId = carouselResponse.data.id;

        // Step 3: Publish Carousel
        const publishResponse = await axios.post(`https://graph.facebook.com/v18.0/${INSTAGRAM_USER_ID}/media_publish`, {
            creation_id: carouselId,
            access_token: INSTAGRAM_ACCESS_TOKEN
        });

        res.json({ message: "Carousel posted successfully!", postId: publishResponse.data.id });

    } catch (error) {
        console.error("[Instagram] Error posting carousel:", error.response?.data || error.message);
        res.status(500).json({ error: "Internal server error", details: error.response?.data || error.message });
    }
};
