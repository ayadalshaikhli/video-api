
import mp3Duration from "mp3-duration";
import fetch from "node-fetch";
import { db } from "../lib/db/drizzle.js";
import { videoProjects } from "../lib/db/schema.js";
import { getUserCredits } from "../data/credit.js";
import { eq } from "drizzle-orm";
import { verifyToken } from "../lib/auth/session.js";

const google_auth_token = process.env.GOOGLE_AUTH_TOKEN;


export const uploadController = async (req, res) => {
    try {
        console.log("[uploadController] Start...");
        const sessionCookie = req.cookies.session;
        if (!sessionCookie) {
            return res.status(401).json({ error: "Not authenticated (no session cookie)" });
        }

        let payload;
        try {
            payload = await verifyToken(sessionCookie); // the same function from Next.js
        } catch (err) {
            console.error("[uploadController] JWT verify fail:", err);
            return res.status(401).json({ error: "Invalid session token" });
        }
        // 1. Extract userId + projectName from form data
        const userId = payload?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Invalid session payload" });
        }

        const projectName = req.body.projectName || "";

        console.log("[uploadController] userId =", userId, "projectName =", projectName);

        // 2. Extract the file from Multer
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        console.log("[uploadController] Received file:", file.originalname, "(Size:", file.size, "bytes)");

        // Check extension is MP3
        if (!file.originalname.toLowerCase().endsWith(".mp3")) {
            return res.status(400).json({ error: "Invalid file format. Only MP3 allowed." });
        }

        // Check size < 50MB
        if (file.size > 50 * 1024 * 1024) {
            return res.status(400).json({ error: "File size must be less than 50 MB." });
        }

        // 3. Calculate MP3 duration
        let durationSeconds;
        try {
            durationSeconds = await mp3Duration(file.buffer);
            console.log("[uploadController] MP3 duration (seconds):", durationSeconds);
        } catch (err) {
            console.error("[uploadController] Error in mp3Duration:", err);
            return res.status(500).json({ error: "Failed to calculate MP3 duration" });
        }
        if (durationSeconds < 15) {
            return res.status(400).json({ error: "Audio duration must be at least 15 seconds." });
        }
        if (durationSeconds >= 600) { // 10 min = 600 seconds
            return res.status(400).json({ error: "Audio duration must be less than 10 minutes." });
        }
        // Convert to minutes, round to 2 decimals
        const durationMinutes = Math.round((durationSeconds / 60) * 100) / 100;
        console.log("[uploadController] Duration (minutes):", durationMinutes);

        // 4. Check user credits
        const userCreditsData = await getUserCredits(parseInt(userId, 10));
        if (!userCreditsData) {
            return res.status(500).json({ error: "Could not retrieve user credits" });
        }
        const availableMinutes = userCreditsData.totalCredits;
        console.log("[uploadController] user credits:", availableMinutes, "available, needed:", durationMinutes);
        if (availableMinutes < durationMinutes) {
            return res.status(400).json({
                error: "Insufficient minutes to process this file. Please purchase more minutes.",
                insufficient: true,
            });
        }

        // 5. Request presigned URL (retry up to 100 times)
        console.log("[uploadController] Requesting presigned URL...");
        let attempts = 0;
        let presignedData;
        while (attempts < 200) {
            attempts++;
            console.log(`🔄 Attempt ${attempts} to get presigned URL...`);
            try {
                const presignedRes = await fetch("https://api.app.ontoworks.org/get-presigned-url", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${google_auth_token}`,
                    },
                    body: JSON.stringify({ fileName: file.originalname }),
                });
                if (!presignedRes.ok) {
                    throw new Error(`Attempt ${attempts} failed with status ${presignedRes.status}`);
                }
                presignedData = await presignedRes.json();
                if (presignedData?.result?.presignedUrl) {
                    console.log("[uploadController] Got presigned URL on attempt", attempts);
                    break;
                }
            } catch (error) {
                console.error("❌ Error getting presigned URL attempt", attempts, error);
                if (attempts >= 100) {
                    return res.status(500).json({ error: "Failed to obtain presigned URL, please retry." });
                }
            }
        }

        if (!presignedData || !presignedData.result?.presignedUrl) {
            return res.status(500).json({ error: "Presigned URL not found" });
        }
        const presignedUrl = presignedData.result.presignedUrl;
        console.log("✅ Presigned URL:", presignedUrl);

        // Extract awsId + filename from the URL
        const urlObject = new URL(presignedUrl);
        const pathnameParts = urlObject.pathname.split("/");
        if (pathnameParts.length < 3) {
            return res.status(500).json({ error: "Unexpected presigned URL format" });
        }
        const awsId = pathnameParts[pathnameParts.length - 2];
        const finalFilename = pathnameParts[pathnameParts.length - 1].split("?")[0];
        if (!awsId || !finalFilename) {
            return res.status(500).json({ error: "Invalid presigned URL format - missing ID or filename" });
        }

        // 6. Insert record into "videoProjects"
        try {
            console.log("[uploadController] Inserting project into DB...");
            await db.insert(videoProjects).values({
                userId: parseInt(userId, 10),
                awsId: awsId,
                projectName: projectName,
                url: presignedUrl,
                filename: finalFilename,
                status: "Draft",
                duration: durationMinutes, // store duration in minutes
            });
            console.log("✅ Project inserted successfully.");
        } catch (dbError) {
            console.error("[uploadController] Database insertion failed:", dbError);
            return res.status(500).json({ error: "Failed to insert project into DB" });
        }

        // 7. Return success data
        return res.status(200).json({
            presignedUrl,
            awsId,
            filename: finalFilename,
            duration: durationMinutes,
        });
    } catch (err) {
        console.error("[uploadController] Unexpected error:", err);
        return res.status(500).json({ error: "Something went wrong" });
    }
};

export default uploadController;
