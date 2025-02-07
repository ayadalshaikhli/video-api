// controllers/ontoworksController.js
import { URL } from "url";
import fs from "fs/promises";
import { apiClient } from "../utils/auth.js";

// Remove or ignore any getNewToken function here.
// Instead, all functions expect a valid token to be passed in.

// Obtain a presigned URL using a relative endpoint (the apiClient already has baseURL)
export const getPresignedUrl = async (endpoint = "/get-presigned-url", token, filename) => {
  const headers = {
    "Authorization": token,
    "Content-Type": "application/json",
  };
  const data = { filename };
  const response = await apiClient.post(endpoint, data, { headers });
  return response.data.result.presignedUrl;
};

export const getTempId = (presignedUrl) => {
  const parsedUrl = new URL(presignedUrl);
  const parts = parsedUrl.pathname.split('/');
  const idx = parts.indexOf('%40Temp.File.Upload');
  if (idx === -1 || idx === parts.length - 1) {
    throw new Error("Invalid URL: cannot extract project ID");
  }
  return parts[idx + 1];
};

export const uploadFile = async (url, filePath) => {
  const fileContent = await fs.readFile(filePath);
  const response = await apiClient.put(url, fileContent, {
    headers: { "Content-Type": "audio/mpeg" },
  });
  return response.status;
};

export const getProjectId = async (token, fileName, tempId, projectName, endpoint = "/project/step1") => {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const data = { name: projectName, audio: { tempFileId: tempId, filename: fileName } };
  const response = await apiClient.post(endpoint, data, { headers });
  return response.data.id;
};

export const setStep2 = async (projectId, token, inputJson, endpoint) => {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const data = {
    id: projectId,
    name: inputJson.project_name,
    createDate: new Date().toISOString(),
    userId: "df10cefa-a31f-4cbb-827c-4277b2625b6f",
    animationModeId: null,
    genreId: null,
    resolutionId: "51fcd898-b175-4a4a-8623-2b5e4a588d23",
    projectStatusId: "89b828f0-c564-417d-98b5-7a4cb5cc2c58",
    generativeVideoIntegrationId: null,
    audioSynchronizationId: null,
    width: inputJson.width,
    height: inputJson.height,
    framesPerSeconds: inputJson.frames_per_second,
    smoothness: null,
    positiveKeyword: null,
    negativeKeyword: null,
    translation: [],
    rotation: [],
    dynamicCamera: null,
    oscillation: null,
    intensity: null,
    audio: {
      action: 2,
      tempFileId: "",
      filename: "jingle.mp3",
      url: `Project.Audio/${projectId}.mp3`,
      hasValue: true,
      isEmpty: false,
      itemId: "a5895b9d-d8d0-4b33-843b-c95ab8b8691c",
    },
    completedForm: null,
    video: null,
    status: "Draft",
    minutes: 0.04,
    isSubmitted: false,
    userName: "Motaz Abu Mathkour",
    completedPercentage: 0,
  };
  const response = await apiClient.put(endpoint, data, { headers });
  return response.data;
};

export const submitProject = async (projectId, token, inputJson) => {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const data = {
    id: projectId,
    name: inputJson.project_name,
    createDate: new Date().toISOString(),
    userId: "df10cefa-a31f-4cbb-827c-4277b2625b6f",
    animationModeId: null,
    genreId: inputJson.genreId,
    resolutionId: inputJson.resolutionId,
    projectStatusId: "89b828f0-c564-417d-98b5-7a4cb5cc2c58",
    generativeVideoIntegrationId: null,
    audioSynchronizationId: "b0d00081-84ac-44d3-bf59-cd75efcdd7f9",
    width: inputJson.width,
    height: inputJson.height,
    framesPerSeconds: inputJson.frames_per_second,
    smoothness: 1,
    positiveKeyword: ["visual"],
    negativeKeyword: [],
    translation: ["x", "y", "z"],
    rotation: ["x", "y", "z"],
    dynamicCamera: true,
    oscillation: null,
    intensity: 3,
    audio: {
      action: 2,
      tempFileId: "",
      filename: "jingle.mp3",
      url: `Project.Audio/${projectId}.mp3`,
      hasValue: true,
      isEmpty: false,
      itemId: projectId,
    },
    completedForm: null,
    video: null,
    status: "Draft",
    minutes: inputJson.video_length,
    isSubmitted: false,
    userName: process.env.VAIRALITY_USERNAME,
    completedPercentage: 0,
    cond_prompt: inputJson.prompt,
    uncond_prompt: "",
  };

  // Use relative URLs; the baseURL in apiClient is applied automatically.
  await apiClient.put(`/project/step3/${projectId}`, data, { headers });
  await apiClient.put(`/project/step4/${projectId}`, data, { headers });
  await apiClient.put(`/project/step5/${projectId}`, data, { headers });
  await apiClient.put(`/project/step6/${projectId}`, data, { headers });
  const submitResponse = await apiClient.put(`/project/submit/${projectId}`, data, { headers });
  return submitResponse.status;
};
