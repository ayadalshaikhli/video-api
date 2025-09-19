import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { consola } from 'consola';
import { retryFunction } from '../utils/utils.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export async function generateVideoScript(prompt, additionalKnowledge, language, duration) {
    try {
        consola.info('Generating video script with Gemini...');
        
        // Build the prompt for script generation
        let systemPrompt = `You are a storyteller. Write a simple, engaging story based on the following topic:

Topic: ${prompt}
Language: ${language || 'English'}
Duration: ${duration || 30} seconds

Requirements:
- Write a natural, conversational story
- Use simple, everyday language
- Make it engaging and relatable
- Keep it concise for ${duration || 30} seconds of speaking
- Write in ${language || 'English'} language
- No technical formatting, scene directions, or timing markers
- Just tell a story that flows naturally
- Make it suitable for voice-over narration
- Focus on the story content, not video production details
- Adjust story length to fit the ${duration || 30} second duration

Write only the story text, nothing else.`;

        // Add additional knowledge if provided
        if (additionalKnowledge) {
            systemPrompt += `\n\nAdditional Context/Knowledge:\n${additionalKnowledge}`;
        }

        // Generate the script using retry function for reliability
        const result = await retryFunction(() => geminiModel.generateContent(systemPrompt));
        const response = result.response;
        const generatedScript = response.text().trim();

        if (!generatedScript) {
            throw new Error('No script content generated');
        }

        consola.success('Video script generated successfully');
        return { 
            success: true, 
            script: generatedScript,
            metadata: {
                language: language || 'English',
                duration: duration || 60,
                prompt: prompt,
                hasAdditionalKnowledge: !!additionalKnowledge
            }
        };

    } catch (error) {
        consola.error('Error generating video script with Gemini:', error);
        return { 
            success: false, 
            error: error.message || 'Failed to generate script'
        };
    }
}

export async function enhanceScriptWithContext(script, context) {
    try {
        consola.info('Enhancing script with additional context...');
        
        const prompt = `You are a professional script editor. Take the following video script and enhance it with the provided context while maintaining its original structure and tone.

Original Script:
"""${script}"""

Additional Context:
"""${context}"""

Please enhance the script by:
- Incorporating relevant information from the context
- Maintaining the original pacing and structure
- Keeping the engaging tone
- Adding more depth and accuracy where appropriate
- Ensuring it remains suitable for video production

Return only the enhanced script without any additional commentary.`;

        const result = await retryFunction(() => geminiModel.generateContent(prompt));
        const response = result.response;
        const enhancedScript = response.text().trim();

        consola.success('Script enhanced successfully');
        return { 
            success: true, 
            script: enhancedScript
        };

    } catch (error) {
        consola.error('Error enhancing script with Gemini:', error);
        return { 
            success: false, 
            error: error.message || 'Failed to enhance script'
        };
    }
}
