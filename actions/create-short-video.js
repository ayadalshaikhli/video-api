import { db } from "../lib/db/drizzle.js";
import { shortVideos } from "../lib/db/schema.js";
import { getUser } from "../lib/db/queries.js";
import { eq } from "drizzle-orm";




// Create a pending short video record
export async function createShortVideo(videoData) {
    console.log("Creating short video record...");
    const [record] = await db.insert(shortVideos).values({
      userId: videoData.userId,
      projectTitle: videoData.projectTitle,
      videoTopic: videoData.text || "",
      generatedScript: videoData.text || "",
      videoStyleId: videoData.videoStyleId,
      voiceId: videoData.voiceId,
      // Omit captionStyleId for now
    }).returning();
    return record;
  }
  
  // Update the short video record with the video URL
  export async function updateShortVideo({ id, videoUrl }) {
    console.log(`Updating short video record ${id} with URL ${videoUrl}...`);
    const [updatedRecord] = await db
      .update(shortVideos)
      .set({ videoUrl })
      .where(eq(shortVideos.id, id))
      .returning();
    return updatedRecord;
  }