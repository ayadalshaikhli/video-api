import fetch from "node-fetch";
import { createShortVideo, updateShortVideo } from "../actions/create-short-video.js";
import { getUserFromSession } from "../utils/session.js";
import { retryFunction } from "../utils/utils.js";
import { consola } from "consola";

export const lambdaVideoGenerationController = async (req, res) => {
  try {
    const user = await getUserFromSession(req);
    const { url, text, projectTitle, captionId, videoStyleId, voiceId } = req.body;

    if (!url && !text) {
      return res.status(400).json({
        success: false,
        message: "Either URL or text input is required.",
      });
    }

    // Create a pending record in your database
    const videoData = {
      url,          // This can be null or the value sent in req.body
      text,
      captionId,
      videoStyleId,
      voiceId,
      projectTitle,
      userId: user.id,
    };

    // Create the short video record (pending)
    const shortVideo = await createShortVideo(videoData);
    consola.info("[LambdaVideoGeneration] Short video created:", shortVideo);

    // Log the incoming request.
    consola.info("[LambdaVideoGeneration] Received request:", req.body);

    // Get your Lambda function URL from environment variables.
    const lambdaUrl = process.env.LAMBDA_VIDEO_URL;
    if (!lambdaUrl) {
      throw new Error("Lambda function URL not configured");
    }
    consola.info("[LambdaVideoGeneration] Calling Lambda function at:", lambdaUrl);

    // Wrap the Lambda call inside a function to be retried.
    const callLambda = async () => {
      const response = await fetch(lambdaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      if (!response.ok) {
        throw new Error(`Lambda call failed with status: ${response.status}`);
      }
      return response;
    };

    // Use the retry function to call Lambda
    const lambdaResponse = await retryFunction(callLambda, 5, 1000);
    
    // Wait for the JSON response from Lambda.
    const result = await lambdaResponse.json();
    consola.info("[LambdaVideoGeneration] Received response from Lambda:", result);

    // Update the pending record with the video URL returned by Lambda.
    if (result.data && result.data.videoUrl) {
      await updateShortVideo({ id: shortVideo.id, videoUrl: result.data.videoUrl });
      consola.info("[LambdaVideoGeneration] Updated short video record with URL");
    } else {
      consola.warn("[LambdaVideoGeneration] Lambda response did not include videoUrl");
    }
    // Return the result (or video URL) to your front end.
    res.status(lambdaResponse.ok ? 200 : lambdaResponse.status).json(result);
  } catch (error) {
    consola.error("[LambdaVideoGeneration] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
