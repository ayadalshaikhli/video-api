import { generateSpeechAndSave, uploadVoice } from "../actions/text-to-audio.js";
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
