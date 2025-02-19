// videoWorker.js
import dotenv from "dotenv";
dotenv.config();

import BeeQueue from "bee-queue";
import { UrlToVideoController } from "../controllers/urlToVideoController.js";

// Create the Bee-Queue for video generation using the same Redis settings
const videoQueue = new BeeQueue("video-generation", {
    redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: process.env.REDIS_PORT || 6379
    },
});

videoQueue.process(async (job) => {
    try {
        console.log(`Processing job ${job.id} with data:`, job.data);
        // Simulate Express req/res objects for the controller.
        const req = { body: job.data };
        const res = {
            json: (result) => {
                console.log(`Job ${job.id} result:`, result);
                return result;
            },
            status: (code) => ({
                json: (result) => {
                    throw new Error(`Job failed with status ${code}: ${JSON.stringify(result)}`);
                },
            }),
        };

        const result = await UrlToVideoController(req, res);
        console.log(`Job ${job.id} completed successfully.`);
        return result;
    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});

// Optional: Listen for job events
videoQueue.on("succeeded", (job, result) => {
    console.log(`Job ${job.id} succeeded:`, result);
});

videoQueue.on("failed", (job, err) => {
    console.error(`Job ${job.id} failed:`, err);
});
