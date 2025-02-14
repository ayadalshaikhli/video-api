// controllers/syncController.js
import axios from "axios";
import { db } from "../lib/db/drizzle.js"; // ensure sql helper is imported
import { externalProjects } from "../lib/db/schema.js";
import { getAuthToken } from "../utils/auth.js";
import { sql } from "drizzle-orm";

export const syncProjects = async () => {
    console.log("syncProjects called");
    try {
        const token = await getAuthToken();
        console.log("Received auth token:", token);

        // Fetch projects from the external API
        const response = await axios.get("https://api.app.ontoworks.org/project/get", {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });
        console.log("External API response status:", response.status);
        console.log("External API response data:", response.data);

        const externalProjectsData = response.data;

        // Prepare the array for bulk upsert.
        const projectsToUpsert = externalProjectsData.map((project) => {
            console.log("Processing project:", project.id);
            return {
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
            };
        });

        console.log("Projects to upsert:", projectsToUpsert);

        // Bulk upsert using ON CONFLICT.
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
                    completedForm: sql`EXCLUDED.completed_form`, // use DB column name if different
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
                    updatedAt: new Date(), // or sql`EXCLUDED.updated_at`
                },
            });

        console.log("Projects synced successfully");
        return { success: true, message: "Projects synced successfully" };
    } catch (error) {
        console.error("Error syncing projects:", error.message);

        // Log additional error details:
        if (error.response) {
            console.error("Error response data:", error.response.data);
            console.error("Error response status:", error.response.status);
            console.error("Error response headers:", error.response.headers);
        }
        console.error("Request config:", error.config);
        // Convert the error to a JSON string for further inspection:
        console.error("Full error details:", JSON.stringify(error.toJSON(), null, 2));
        console.error("Error stack:", error.stack);
        throw error;
    }
};
