import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { consola } from 'consola';
import { retryFunction } from '../utils/utils.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function geminiSummarize(transcriptionText) {
    try {
        const prompt = `
You are a professional summarizer and analyst. Given the following podcast transcription, provide a concise summary that captures the overall discussion and specifically list the main points and important insights mentioned.

Transcription:
"""${transcriptionText}"""

Summary (include a brief overall summary and then list the main points):
    `;
        const result = await geminiModel.generateContent(prompt);
        const response = result.response;
        const summaryText = response.text().trim();
        return { success: true, summary: summaryText };
    } catch (error) {
        consola.error('Error summarizing transcription with Gemini:', error);
        return { success: false, error: error.message };
    }
}


export async function geminiExtractSections(transcriptionText) {
    try {
        const prompt = `
  You are a professional video editor and content analyst. Analyze the following podcast transcription and determine which segments are engaging and have the potential to be turned into effective short video clips (for platforms like TikTok). 
  Only include segments that:
  - Have high engagement or a strong hook.
  - Are concise and self-contained.
  - Provide interesting insights or moments.
  For each valid segment, provide:
  - start: The start time in seconds of the segment.
  - end: The end time in seconds of the segment.
  - caption: A short caption describing the segment.
  
  Transcription:
  """${transcriptionText}"""
  
  Output the result as a JSON array (do not include extra text or code fences). For example:
  [
    { "start": 12, "end": 30, "caption": "Exciting announcement about X" },
    { "start": 45, "end": 65, "caption": "Interesting insight on Y" }
  ]
      `;
        const result = await retryFunction(() => geminiModel.generateContent(prompt));
        const response = result.response;
        let sectionsText = response.text().trim();
        sectionsText = sectionsText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
        const sections = JSON.parse(sectionsText);
        return { success: true, sections };
    } catch (error) {
        consola.error('Error extracting sections with Gemini:', error);
        console.error("Full error details:", JSON.stringify(error, null, 2));
        return { success: false, error: error.message };
    }
}


