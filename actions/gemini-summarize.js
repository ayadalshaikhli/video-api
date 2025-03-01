import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { consola } from 'consola';

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
