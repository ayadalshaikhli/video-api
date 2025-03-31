import fetch from "node-fetch";
import axios from "axios";
import mp3Duration from "mp3-duration";
import { db } from "../../lib/db/drizzle.js";
import { videoProjects, creditUsage, userCredits, videoStyles } from "../../lib/db/schema.js";
import { eq, sql } from "drizzle-orm";
import { verifyToken } from "../../lib/auth/session.js";
import { apiClient } from "../../utils/auth.js";

const GOOGLE_AUTH_TOKEN = process.env.GOOGLE_AUTH_TOKEN;

// Helper: authenticate cookie‑based session
async function getUserId(req, res) {
  const cookie = req.cookies.session;
  if (!cookie) return res.status(401).json({ error: "Not authenticated" });
  try {
    const payload = await verifyToken(cookie);
    return payload.user.id;
  } catch {
    return res.status(401).json({ error: "Invalid session token" });
  }
}

export const uploadController = async (req, res) => {
  console.log("[uploadController] Start...");
  console.log("[uploadController] req.body:", req.body);
  console.log("[uploadController] req.file:", req.file);
  const userId = await getUserId(req, res);
  if (!userId) return;

  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  if (!file.originalname.toLowerCase().endsWith(".mp3"))
    return res.status(400).json({ error: "Only MP3 allowed" });

  if (file.size > 50 * 1024 * 1024)
    return res.status(400).json({ error: "Max 50MB" });

  let durationSec;
  try {
    durationSec = await mp3Duration(file.buffer);
  } catch {
    return res.status(500).json({ error: "Failed to parse MP3" });
  }
  if (durationSec < 15) return res.status(400).json({ error: "Min 15s audio" });
  if (durationSec > 600) return res.status(400).json({ error: "Max 10m audio" });

  const minutes = Math.round((durationSec / 60) * 100) / 100;
  const creditsNeeded = Math.round(minutes * 100);

  // Check credits
  const credits = await db.select().from(userCredits).where(eq(userCredits.userId, userId)).limit(1);
  if (!credits.length || credits[0].totalCredits < creditsNeeded) {
    return res.status(400).json({ error: "Insufficient credits", insufficient: true });
  }

  // Get presigned URL
  let presigned;
  for (let i=0;i<100;i++) {
    const resp = await fetch("https://api.app.ontoworks.org/get-presigned-url", {
      method:"POST",
      headers:{ "Content-Type":"application/json", Authorization:`Bearer ${GOOGLE_AUTH_TOKEN}` },
      body: JSON.stringify({ fileName: file.originalname }),
    });
    const data = await resp.json();
    if (data.result?.presignedUrl) {
      presigned = data.result.presignedUrl;
      break;
    }
  }
  if (!presigned) return res.status(500).json({ error: "Could not obtain presigned URL" });

  // Upload to S3
  await fetch(presigned, { method:"PUT", headers:{"Content-Type":"audio/mpeg"}, body:file.buffer });

  const parts = new URL(presigned).pathname.split("/");
  const awsId = parts[parts.length-2];
  const filename = parts[parts.length-1].split("?")[0];

  // Insert project record
  await db.insert(videoProjects).values({
    userId, awsId, projectName: req.body.projectName||"", url: presigned, filename, status:"Draft", duration: creditsNeeded
  });

  return res.json({ awsId, filename, presignedUrl: presigned, duration: creditsNeeded });
};

export const step1Controller = async (req, res) => {
  const userId = await getUserId(req, res);
  if (!userId) return;

  const { projectName, awsId, filename } = req.body;
  if (!awsId || !filename) return res.status(400).json({ error:"Missing awsId/filename" });

  try {
    const { data } = await apiClient.post("/project/step1", {
      name: projectName,
      audio: { tempFileId: awsId, filename }
    });

    await db.update(videoProjects)
      .set({ projectId: data.id })
      .where(eq(videoProjects.awsId, awsId))
      .execute();

    return res.json({ id: data.id });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ error:"Step1 failed" });
  }
};

export const step2Controller = async (req, res) => {
  const userId = await getUserId(req, res);
  if (!userId) return;

  const { projectId, filename, resolution, fps, audioname, duration } = req.body;
  try {
    const payload = {
      id: projectId,
      name: filename,
      width: resolution==="desktop"?1920:1080,
      height: resolution==="desktop"?1080:1920,
      framesPerSeconds: Number(fps),
      audio: { action:2, filename: audioname, url:`Project.Audio/${projectId}`, itemId: projectId },
      minutes: duration
    };
    const { data } = await apiClient.put(`/project/step2/${projectId}`, payload);
    return res.json(data);
  } catch(err) {
    console.error(err);
    return res.status(500).json({ error:"Step2 failed" });
  }
};

export const step3Controller = async (req, res) => {
  const userId = await getUserId(req, res);
  if (!userId) return;

  const { projectId, filename, genre, prompt, fps, audioname, duration } = req.body;
  try {
    const payload = {
      id: projectId,
      name: filename,
      genreId: genre,
      framesPerSeconds: Number(fps),
      positiveKeyword:[prompt],
      audio: { action:2, filename: audioname, url:`Project.Audio/${projectId}.mp3`, itemId: projectId },
      minutes: duration,
      isSubmitted: true,
      cond_prompt: prompt
    };
    const { data } = await apiClient.put(`/project/step3/${projectId}`, payload);
    return res.json(data);
  } catch(err) {
    console.error(err);
    return res.status(500).json({ error:"Step3 failed" });
  }
};

export const step4Controller = async (req, res) => {
  const userId = await getUserId(req, res);
  if (!userId) return;

  const { projectId, filename, resolution, fps, prompt, duration } = req.body;
  try {
    const payload = {
      id: projectId,
      name: filename,
      framesPerSeconds: Number(fps),
      positiveKeyword:[prompt],
      minutes: duration*100,
      cond_prompt: prompt,
      isSubmitted: false
    };
    const { data } = await apiClient.put(`/project/submit/${projectId}`, payload);

    await db.insert(creditUsage).values({ userId, projectId, creditsSpent: duration*100 });
    await db.update(userCredits)
      .set({
        totalCredits: sql`${userCredits.totalCredits} - ${duration*100}`,
        usedCredits: sql`${userCredits.usedCredits} + ${duration*100}`
      })
      .where(eq(userCredits.userId, userId))
      .execute();

    return res.json(data);
  } catch(err) {
    console.error(err);
    return res.status(500).json({ error:"Step4 failed" });
  }
};

// Youtube Shorts
export const youtubeVideoStylesConroller = async (req, res) => {
  
  const userId = await getUserId(req, res);
  if (!userId) return; 


  const activeVideoStyles = await db
    .select({
      id: videoStyles.id,
      name: videoStyles.name,
      imageUrl: videoStyles.imageUrl,
      description: videoStyles.description,
    })
    .from(videoStyles)
    .where(eq(videoStyles.isActive, true));


  return res.status(200).json(activeVideoStyles);
}
