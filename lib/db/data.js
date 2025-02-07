// data.js

import { db } from "./drizzle.js";
import { currentCredits, userCredits, videoProjects } from "./schema.js";
import { eq } from "drizzle-orm";

export const getTotalCredits = async (apiKey) => {
  const rows = await db.select().from(currentCredits).where(eq(currentCredits.apiKey, apiKey));
  if (rows.length > 0) {
    const row = rows[0];
    return { userId: row.userId, totalCredits: parseFloat(row.totalCredits) };
  }
  return null;
};

export const setUserCredits = async (userId, currentCreditsValue, videoLength) => {
  const newCredits = currentCreditsValue - videoLength;
  await db.update(userCredits)
    .set({ totalCredits: newCredits, updatedAt: new Date() })
    .where(eq(userCredits.userId, userId));
};

export const storeVideoProject = async (userId, projectName, projectId, presignedUrl, tempId) => {
  await db.insert(videoProjects).values({
    userId,
    projectName,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "Draft",
    projectId,
    url: presignedUrl,
    awsId: tempId
  });
};
