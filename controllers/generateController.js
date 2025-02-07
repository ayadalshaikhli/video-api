// controllers/generateController.js
import fs from "fs/promises";
import path from "path";
import { getMp3Duration } from "../utils/getMp3Duration.js";
import { getTotalCredits, setUserCredits, storeVideoProject } from "../lib/db/data.js";
import {
  getPresignedUrl,
  getTempId,
  uploadFile,
  getProjectId,
  setStep2,
  submitProject,
} from "./ontoworksController.js";
import { RESOLUTION_MAPPING, GENRE_MAPPING, VAIRALITY_USERNAME, VAIRALITY_PASSWORD } from "../utils/config.js";
import { getAuthToken } from "../utils/auth.js";

export const generateProject = async (req, res) => {
  try {
    const file = req.file;
    const itemString = req.body.item; // expects a JSON string
    if (!file || !itemString) {
      return res.status(400).json({ error: "Missing file or item data" });
    }

    // Save the uploaded file to the "uploads" directory
    const uploadsDir = path.join(process.cwd(), "uploads");
    try {
      await fs.access(uploadsDir);
    } catch (err) {
      await fs.mkdir(uploadsDir);
    }
    const filePath = path.join(uploadsDir, file.originalname);
    await fs.writeFile(filePath, file.buffer);

    // Calculate the MP3 duration (in minutes)
    const videoLength = await getMp3Duration(filePath);

    // Retrieve user credits using the API key (set by the apiKeyAuth middleware)
    const creditsResult = await getTotalCredits(req.apiKey);
    if (!creditsResult) {
      return res.status(401).json({ error: "Invalid API key" });
    }
    const { userId, totalCredits } = creditsResult;
    if (totalCredits < videoLength) {
      return res.status(402).json({ error: "Not enough credits. Please recharge your account." });
    }

    // Parse the item JSON
    const itemData = JSON.parse(itemString);
    if (!itemData.frames_per_second) {
      itemData.frames_per_second = 60;
    }

    // Get a token from Ontoworks using the auth module's logic
    const token = await getAuthToken();

    // Obtain a presigned URL to upload the file (using relative endpoint)
    const presignedUrl = await getPresignedUrl("/get-presigned-url", token, file.originalname);

    // Upload the file to the presigned URL
    await uploadFile(presignedUrl, filePath);

    // Extract the temporary ID from the presigned URL
    const tempId = getTempId(presignedUrl);

    // Create the project (step 1) and obtain the project ID
    const projectId = await getProjectId(token, file.originalname, tempId, itemData.project_name);

    // Prepare input data for subsequent steps
    const resolution = RESOLUTION_MAPPING[itemData.resolution] || RESOLUTION_MAPPING.desktop;
    const inputJson = {
      filename: file.originalname,
      project_name: itemData.project_name,
      resolutionId: resolution.id,
      width: resolution.width,
      height: resolution.height,
      frames_per_second: itemData.frames_per_second,
      prompt: itemData.prompt,
      video_length: videoLength,
    };
    inputJson.genreId = itemData.genre ? (GENRE_MAPPING[itemData.genre] || "") : "";

    // Call step 2 on Ontoworks
    await setStep2(projectId, token, inputJson, `/project/step2/${projectId}`);

    // Submit the project (calls steps 3,4,5,6 then final submit)
    const submitStatus = await submitProject(projectId, token, inputJson);

    if (submitStatus === 200) {
      // Deduct credits and store the video project in your database
      await setUserCredits(userId, totalCredits, videoLength);
      await storeVideoProject(userId, inputJson.project_name, projectId, presignedUrl, tempId);
      return res.status(200).json({ message: "Project submitted successfully." });
    } else {
      return res.status(500).json({ error: "Failed to submit project" });
    }
  } catch (error) {
    console.error("Error in generateProject:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
