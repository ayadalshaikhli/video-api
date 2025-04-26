import express from 'express';
import { getVoices, textToSpeechFile, textToSpeechSimple, cloneVoice } from '../controllers/elevenLabsController.js';

const router = express.Router();

// Get all available voices
router.get('/voices', getVoices);

// Convert text to speech and return audio
router.post('/text-to-speech', textToSpeechSimple);

// Convert text to speech and save to file
router.post('/text-to-speech-file', textToSpeechFile);

// Clone a voice using audio samples
router.post('/clone-voice', cloneVoice);

export default router; 