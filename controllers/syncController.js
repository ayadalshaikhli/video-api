// controllers/syncController.js
import axios from "axios";
import { db } from "../lib/db/drizzle.js"; // ensure sql helper is imported
import { externalProjects } from "../lib/db/schema.js";
import { getAuthToken } from "../utils/auth.js";
import { sql } from "drizzle-orm";

export const syncProjects = async () => {
    try {
        const token = await getAuthToken();

        // Fetch projects from the external API
        const response = await axios.get("https://api.app.ontoworks.org/project/get", {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
        const externalProjectsData = response.data;

        // Prepare the array for bulk upsert.
        const projectsToUpsert = externalProjectsData.map((project) => ({
            externalId: project.id,
            userId: project.userId,
            name: project.name,
            createDate: project.createDate,
            animationModeId: project.animationModeId,
            genreId: project.genreId,
            resolutionId: project.resolutionId,
            projectStatusId: project.projectStatusId,
            generativeVideoIntegrationId: project.generativeVideoIntegrationId,
            audioSynchronizationId: project.audioSynchronizationId,
            width: project.width,
            height: project.height,
            framesPerSecond: project.framesPerSeconds,
            smoothness: project.smoothness,
            positiveKeywords: project.positiveKeyword,
            negativeKeywords: project.negativeKeyword,
            translation: project.translation,
            rotation: project.rotation,
            dynamicCamera: project.dynamicCamera,
            oscillation: project.oscillation,
            intensity: project.intensity,
            audio: project.audio,
            completedForm: project.completedForm,
            video: project.video,
            status: project.status,
            minutes: project.minutes,
            isSubmitted: project.isSubmitted,
            userName: project.userName,
            completedPercentage: project.completedPercentage,
            updatedAt: new Date(),
        }));

        // Bulk upsert using ON CONFLICT.
        // Note: The SQL helper ensures that, for example, EXCLUDED.intensity is treated as an SQL expression.
        await db
            .insert(externalProjects)
            .values(projectsToUpsert)
            .onConflictDoUpdate({
                target: externalProjects.externalId,
                set: {
                    name: sql`EXCLUDED.name`,
                    status: sql`EXCLUDED.status`,
                    audio: sql`EXCLUDED.audio`,
                    video: sql`EXCLUDED.video`,
                    completedForm: sql`EXCLUDED.completed_form`, // note: use the DB column name if it differs from the JS key
                    positiveKeywords: sql`EXCLUDED.positive_keywords`,
                    negativeKeywords: sql`EXCLUDED.negative_keywords`,
                    translation: sql`EXCLUDED.translation`,
                    rotation: sql`EXCLUDED.rotation`,
                    dynamicCamera: sql`EXCLUDED.dynamic_camera`,
                    intensity: sql`EXCLUDED.intensity`,
                    minutes: sql`EXCLUDED.minutes`,
                    isSubmitted: sql`EXCLUDED.is_submitted`,
                    userName: sql`EXCLUDED.user_name`,
                    completedPercentage: sql`EXCLUDED.completed_percentage`,
                    updatedAt: new Date(), // or sql`EXCLUDED.updated_at` if you prefer
                },
            });

        return { success: true, message: "Projects synced successfully" };
    } catch (error) {
        console.error("Error syncing projects:", error.message);
        throw error;
    }
};
