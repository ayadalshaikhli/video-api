import { generateSpeechAndSave, uploadConvertedVoice, uploadVoice } from "../actions/text-to-audio.js";
import { verifyToken } from "../lib/auth/session.js";

async function getUserFromRequest(req) {
    console.log("[getUserFromRequest] Starting user extraction...");
    const sessionCookie = req.cookies.session;
    console.log("[getUserFromRequest] Session cookie:", sessionCookie);
    if (!sessionCookie) {
        console.error("[getUserFromRequest] No session cookie provided.");
        throw new Error("Not authenticated (no session cookie)");
    }
    let payload;
    try {
        payload = await verifyToken(sessionCookie);
        console.log("[getUserFromRequest] Token verified. Payload:", payload);
    } catch (err) {
        console.error("[getUserFromRequest] Token verification failed:", err);
        throw new Error("Invalid session token");
    }
    const user = payload?.user;
    if (!user || !user.id) {
        console.error("[getUserFromRequest] Invalid session payload. User data:", user);
        throw new Error("Invalid session payload");
    }
    console.log("[getUserFromRequest] Extracted user:", user);
    return user;
}

// POST /api/text-to-speech
export async function generateSpeechController(req, res, next) {
    console.log("[generateSpeechController] Received request:", req.method, req.originalUrl);
    console.log("[generateSpeechController] Request query:", req.query);
    console.log("[generateSpeechController] Request headers:", req.headers);
    console.log("[generateSpeechController] Request body:", req.body);
    console.log("[generateSpeechController] Request file:", req.file);

    try {
        // Grab the user from the session (similar to your uploadController)
        const user = await getUserFromRequest(req);
        console.log("[generateSpeechController] User extracted:", user);

        const { prompt, voiceId, languageIsoCode } = req.body;
        console.log("[generateSpeechController] prompt:", prompt);
        console.log("[generateSpeechController] voiceId:", voiceId);
        console.log("[generateSpeechController] languageIsoCode:", languageIsoCode);

        // If a file was uploaded (e.g. from mic recording), it is available as req.file
        const clonedVoiceFile = req.file;
        if (clonedVoiceFile) {
            console.log("[generateSpeechController] Cloned voice file detected:", clonedVoiceFile.originalname);
        } else {
            console.log("[generateSpeechController] No cloned voice file provided.");
        }

        const result = await generateSpeechAndSave({
            prompt,
            voiceId,
            clonedVoiceFile,
            languageIsoCode,
            userOverride: user,
        });
        console.log("[generateSpeechController] Generation result:", result);
        res.json(result);
    } catch (error) {
        console.error("[generateSpeechController] Error occurred:", error);
        next(error);
    }
}

// POST /api/text-to-speech/uploadVoice
export async function uploadVoiceController(req, res, next) {
    console.log("[uploadVoiceController] Received request:", req.method, req.originalUrl);
    console.log("[uploadVoiceController] Request query:", req.query);
    console.log("[uploadVoiceController] Request headers:", req.headers);
    console.log("[uploadVoiceController] Request file info:", req.file);

    try {
        const user = await getUserFromRequest(req);
        console.log("[uploadVoiceController] User extracted:", user);

        const file = req.file;
        if (!file) {
            console.error("[uploadVoiceController] No file provided in request.");
            return res.status(400).json({ error: "No file provided" });
        }
        console.log("[uploadVoiceController] File details:", {
            originalname: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
        });

        const newVoice = await uploadVoice(file, user);
        console.log("[uploadVoiceController] Uploaded new voice:", newVoice);
        res.json(newVoice);
    } catch (error) {
        console.error("[uploadVoiceController] Error occurred:", error);
        next(error);
    }
}

// NEW: POST /api/text-to-speech/convertYouTube
export async function convertYouTubeController(req, res, next) {
    console.log("[convertYouTubeController] Received request:", req.method, req.originalUrl);
    try {
        // Ensure the user is authenticated.
        const user = await getUserFromRequest(req);
        console.log("[convertYouTubeController] User extracted:", user);

        // Expect the YouTube URL in the request body.
        const { url } = req.body;
        if (!url) {
            console.error("[convertYouTubeController] No YouTube URL provided.");
            return res.status(400).json({ error: "No YouTube URL provided" });
        }
        console.log("[convertYouTubeController] YouTube URL:", url);

        // Call your Python conversion service.
        const PYTHON_CONVERT_ENDPOINT = process.env.PYTHON_CONVERT_ENDPOINT || "http://localhost:5000/convert30sec";
        const response = await fetch(PYTHON_CONVERT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("[convertYouTubeController] Python service error:", errorData);
            return res.status(response.status).json(errorData);
        }

        const result = await response.json();
        console.log("[convertYouTubeController] Conversion result:", result);
        // result should be something like:
        // { key: 'audio/xxx_filename.mp3', publicUrl: 'https://your-public-endpoint/audio/xxx_filename.mp3' }

        // Now, treat this converted file as if the user uploaded an MP3.
        // Assuming you have an action (uploadConvertedVoice) similar to uploadVoice that
        // takes an object { originalname, buffer, mimetype } and inserts a new record.
        // In this case, you don't have a file buffer; you have a URL.
        // You might want to store the URL along with a default name.

        // For example:
        const convertedVoiceData = {
            originalname: result.key.split("/").pop(), // Extract filename from key
            publicUrl: result.publicUrl,
            // mimetype for an mp3:
            mimetype: "audio/mpeg"
        };

        // Call your action that saves the converted voice to the DB.
        // You'll need to implement uploadConvertedVoice in your actions/text-to-audio.js.
        const newVoice = await uploadConvertedVoice(convertedVoiceData, user);
        console.log("[convertYouTubeController] New voice record inserted:", newVoice);

        // Return the new voice record (or at least its id and publicUrl)
        res.json({
            voiceId: newVoice.id,
            publicUrl: newVoice.voiceUrl, // or newVoice.publicUrl
        });
    } catch (error) {
        console.error("[convertYouTubeController] Error occurred:", error);
        next(error);
    }
}