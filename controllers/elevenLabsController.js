import { ElevenLabsClient } from "elevenlabs";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import fetch from 'node-fetch';
import { uploadAudioFile } from "../actions/cloudflare.js";
import { db } from "../lib/db/drizzle.js";
import { userAudioGenerations } from "../lib/db/schema.js";
import { getUser } from "../lib/db/queries.js";
import multer from 'multer';
import { Readable } from 'stream';
import FormData from 'form-data';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create ElevenLabs client
const client = new ElevenLabsClient({
  apiKey: process.env.ELEVEN_LABS_API_KEY,
});

// Get available voices
export const getVoices = async (req, res) => {
  try {
    const voices = await client.voices.getAll();
    console.log(`Retrieved ${voices.length} voices from ElevenLabs`);
    
    // Transform the voices to have a consistent format
    const formattedVoices = voices.map(voice => ({
      voice_id: voice.voice_id,
      name: voice.name,
      preview_url: voice.preview_url,
      category: voice.category || 'Premium',
      description: voice.description || '',
      // Include any other fields that might be needed
    }));
    
    // Format the response to match what the frontend expects
    return res.status(200).json({ 
      success: true, 
      data: formattedVoices
    });
  } catch (error) {
    console.error('Error fetching voices:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Convert text to speech and return audio
export const textToSpeechSimple = async (req, res) => {
  try {
    // Destructure the request body; voiceId must be provided or you can use a default
    const {
      text,
      voiceId, // For a completely simple flow, you might even hardcode a voice id.
      modelId = "eleven_multilingual_v2",
      stability = 0.5,
      similarityBoost = 0.75,
      outputFormat = "mp3_44100_128"
    } = req.body;
    
    // Validate input
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }
    if (!voiceId) {
      return res.status(400).json({ success: false, error: "Voice ID is required" });
    }
    
    console.log(`Converting text to speech with voice ${voiceId} (no DB saving)`);
    
    // Call the ElevenLabs API directly
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVEN_LABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: parseFloat(stability),
          similarity_boost: parseFloat(similarityBoost)
        },
        output_format: outputFormat
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('ElevenLabs API error:', errorData);
      return res.status(response.status).json({ 
        success: false, 
        error: errorData.detail?.message || 'Failed to generate speech'
      });
    }
    
    // Retrieve the audio data
    const audioBuffer = await response.arrayBuffer();
    
    // Set response headers so the client treats the response as an audio file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    
    // Send the audio buffer
    return res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('Error converting text to speech:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Save text to speech audio to file and return path
export const textToSpeechFile = async (req, res) => {
  try {
    const { text, voiceId, modelId = "eleven_multilingual_v2", stability, similarityBoost, outputFormat = "mp3_44100_128" } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: "Text is required" });
    }
    
    if (!voiceId) {
      return res.status(400).json({ success: false, error: "Voice ID is required" });
    }
    
    console.log(`Converting text to speech with voice ${voiceId} and saving to file`);
    
    // Get the authenticated user using the same pattern as in audioController.js
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: "User not authenticated" });
    }
    
    // Using the ElevenLabs API endpoint with voice settings
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVEN_LABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: parseFloat(stability) || 0.5,
          similarity_boost: parseFloat(similarityBoost) || 0.75
        },
        output_format: outputFormat
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('ElevenLabs API error:', errorData);
      return res.status(response.status).json({ 
        success: false, 
        error: errorData.detail?.message || 'Failed to generate speech'
      });
    }
    
    // Get the audio data as an ArrayBuffer
    const audioBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(audioBuffer);
    
    try {
      // Upload to Cloudflare - this matches your pattern in other controllers
      const uploadResult = await uploadAudioFile(buffer, `elevenlabs_${Date.now()}.mp3`, 'audio/mpeg');
      
      // Save to database history - store the ElevenLabs voice ID as a string in the prompt field
      // since the voice_id column is an integer that references your internal voices table
      const [record] = await db
        .insert(userAudioGenerations)
        .values({
          userId: user.id,
          // Don't set voiceId since it's an integer foreign key to your internal voices table
          prompt: JSON.stringify({
            text,
            elevenLabsVoiceId: voiceId,
            modelId,
            stability,
            similarityBoost
          }),
          audioUrl: uploadResult.publicUrl,
          provider: 'elevenlabs'
        })
        .returning();
      
      console.log("Speech generation saved to history:", record);
      
      return res.status(200).json({
        success: true,
        audioUrl: uploadResult.publicUrl,
        filepath: uploadResult.publicUrl, // For backward compatibility
        message: "Audio file generated and uploaded successfully"
      });
    } catch (uploadError) {
      console.error('Error uploading to Cloudflare:', uploadError);
      
      // Fallback to local storage if Cloudflare upload fails
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../uploads/audio');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Generate a unique filename
      const filename = `speech_${Date.now()}.mp3`;
      const filepath = path.join(uploadsDir, filename);
      
      // Write the audio buffer to file
      fs.writeFileSync(filepath, buffer);
      
      // Still save to history, but with local path
      try {
        const [record] = await db
          .insert(userAudioGenerations)
          .values({
            userId: user.id,
            // Don't set voiceId since it's an integer foreign key to your internal voices table
            prompt: JSON.stringify({
              text,
              elevenLabsVoiceId: voiceId,
              modelId,
              stability,
              similarityBoost
            }),
            audioUrl: `/uploads/audio/${filename}`,
            provider: 'elevenlabs'
          })
          .returning();
        
        console.log("Speech generation saved to history (local file):", record);
      } catch (dbError) {
        console.error('Error saving to database:', dbError);
      }
      
      return res.status(200).json({ 
        success: true, 
        filepath: `/uploads/audio/${filename}`,
        message: "Audio file generated successfully (fallback to local storage)" 
      });
    }
  } catch (error) {
    console.error('Error generating speech file:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Configure storage for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Voice cloning endpoint
export const cloneVoice = async (req, res) => {
  try {
    // Use multer to handle file uploads
    upload.array('files')(req, res, async function(err) {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      
      // Get user authentication
      const user = await getUser(req);
      if (!user) {
        return res.status(401).json({ success: false, error: "User not authenticated" });
      }
      
      const { name, description = "" } = req.body;
      
      if (!name) {
        return res.status(400).json({ success: false, error: "Voice name is required" });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: "At least one audio file is required" });
      }
      
      // Create a form data object for the ElevenLabs API
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      
      // Add each file to the form data
      for (const file of req.files) {
        formData.append('files', Buffer.from(file.buffer), {
          filename: file.originalname,
          contentType: file.mimetype
        });
      }
      
      // Call the ElevenLabs API to clone the voice
      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVEN_LABS_API_KEY,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('ElevenLabs API error when cloning voice:', errorData);
        return res.status(response.status).json({ 
          success: false, 
          error: errorData.detail?.message || 'Failed to clone voice'
        });
      }
      
      const responseData = await response.json();
      
      return res.status(200).json({
        success: true,
        voiceId: responseData.voice_id,
        message: "Voice cloned successfully",
        data: responseData
      });
    });
  } catch (error) {
    console.error('Error cloning voice:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}; 