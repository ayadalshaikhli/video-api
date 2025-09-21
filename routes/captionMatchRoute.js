import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia } from "@remotion/renderer";
import { whisperAudio } from "../actions/whisper.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = './temp_videos/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `caption-match-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|mp3|wav|m4a/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Generate caption-matched video
router.post('/caption-match', async (req, res) => {
    try {
        const { originalText, audioUrl, transcriptionData, settings } = req.body;

        console.log('[Caption Match] Starting video generation with data:', {
            textLength: originalText?.length,
            hasAudio: !!audioUrl,
            hasTranscription: !!transcriptionData,
            settings
        });

        if (!originalText || !transcriptionData) {
            return res.status(400).json({ 
                error: 'Missing required data: originalText and transcriptionData are required' 
            });
        }

        // Process transcription data to create word-level timing for captions
        const processedCaptions = processTranscriptionForCaptions(transcriptionData, originalText);
        console.log('[Caption Match] Processed captions sample:', processedCaptions.slice(0, 3));

        // Calculate actual duration from words if not provided
        let actualDuration = transcriptionData.duration;
        console.log('[Caption Match] Original duration from transcription:', actualDuration);
        
        if (!actualDuration || actualDuration === 0) {
            // Calculate from the last word's end time
            if (transcriptionData.words && transcriptionData.words.length > 0) {
                actualDuration = Math.max(...transcriptionData.words.map(word => word.end || 0));
                console.log('[Caption Match] Calculated duration from words:', actualDuration);
            } else {
                actualDuration = 30; // fallback
                console.log('[Caption Match] Using fallback duration:', actualDuration);
            }
        }
        
        console.log('[Caption Match] Final duration for video:', actualDuration);

        // Create simple segments from captions for VideoComposition compatibility
        const segments = [{
            id: 'caption-segment-1',
            text: originalText,
            start: 0,
            end: actualDuration,
            mediaUrl: null, // No background image for caption-only video
            imageUrl: null,
            animation: 'fadeIn',
            order: 1
        }];

        // Create video composition data - match VideoComposition schema
        const videoComposition = {
            id: `caption-match-${Date.now()}`,
            text: originalText,
            segments: segments, // Add segments for VideoComposition compatibility
            captions: processedCaptions,
            audioUrl: audioUrl,
            musicUrl: audioUrl, // Also set musicUrl for compatibility
            script: originalText,
            // Customization properties with defaults
            fontSize: 64,
            fontWeight: 700,
            fontFamily: 'Inter',
            textTransform: 'uppercase',
            activeWordColor: '#fff',
            inactiveWordColor: '#00ffea',
            positionFromBottom: 9,
            wordsPerBatch: 3,
            showEmojis: true,
            musicVolume: 8,
            // Settings for rendering
            settings: {
                width: settings?.width || 1080,
                height: settings?.height || 1920,
                fps: settings?.fps || 30,
                duration: actualDuration // Use actual duration, don't round up
            }
        };

        // Generate unique filename
        const videoFileName = `caption-match-${Date.now()}.mp4`;
        const outputPath = path.join('./videos', videoFileName);

        // Ensure videos directory exists
        if (!fs.existsSync('./videos')) {
            fs.mkdirSync('./videos', { recursive: true });
        }

        // Bundle and render Remotion video
        const bundleLocation = await bundle({
            entryPoint: path.resolve("./src/index.ts"),
            webpackOverride: (config) => config,
        });

        console.log('[Caption Match] Starting video rendering...');
        
        const durationInFrames = Math.ceil(videoComposition.settings.duration * videoComposition.settings.fps);
        console.log('[Caption Match] Render parameters:', {
            duration: videoComposition.settings.duration,
            fps: videoComposition.settings.fps,
            durationInFrames: durationInFrames,
            segmentsCount: videoComposition.segments?.length || 0,
            captionsCount: videoComposition.captions?.length || 0
        });
        
        await renderMedia({
            composition: "VideoComposition",
            serveUrl: bundleLocation,
            outputLocation: outputPath,
            inputProps: videoComposition,
            codec: "h264",
            type: "video",
            durationInFrames: durationInFrames,
            fps: videoComposition.settings.fps
        });

        console.log('[Caption Match] Video rendered successfully:', outputPath);

        // Return the video URL
        const videoUrl = `/videos/${videoFileName}`;
        
        res.json({
            success: true,
            videoUrl: videoUrl,
            videoPath: outputPath,
            captions: processedCaptions,
            duration: videoComposition.settings.duration
        });

    } catch (error) {
        console.error('[Caption Match] Error generating video:', error);
        res.status(500).json({ 
            error: 'Failed to generate caption-matched video',
            details: error.message
        });
    }
});

// Helper function to process transcription data for caption matching
function processTranscriptionForCaptions(transcriptionData, originalText) {
    try {
        let captions = [];
        
        // Cloudflare Whisper returns words array directly
        if (transcriptionData.words && transcriptionData.words.length > 0) {
            transcriptionData.words.forEach((word, wordIndex) => {
                captions.push({
                    id: `word-${wordIndex}`,
                    text: word.word || word.text || word,
                    start: word.start || 0,
                    end: word.end || 0,
                    confidence: word.confidence || 1
                });
            });
        } else if (transcriptionData.vtt) {
            // Parse VTT format if available
            const vttLines = transcriptionData.vtt.split('\n');
            let wordIndex = 0;
            
            for (let i = 0; i < vttLines.length; i++) {
                const line = vttLines[i].trim();
                // Look for time stamps in VTT format: 00:00:00.000 --> 00:00:01.000
                if (line.includes('-->')) {
                    const [startTime, endTime] = line.split(' --> ');
                    const nextLine = vttLines[i + 1];
                    
                    if (nextLine && nextLine.trim()) {
                        const words = nextLine.trim().split(' ');
                        const segmentStart = parseVTTTime(startTime);
                        const segmentEnd = parseVTTTime(endTime);
                        const segmentDuration = segmentEnd - segmentStart;
                        const timePerWord = segmentDuration / words.length;
                        
                        words.forEach((word, idx) => {
                            const wordStart = segmentStart + (idx * timePerWord);
                            const wordEnd = wordStart + timePerWord;
                            
                            captions.push({
                                id: `vtt-${wordIndex}`,
                                text: word,
                                start: wordStart,
                                end: wordEnd,
                                confidence: 1
                            });
                            wordIndex++;
                        });
                    }
                }
            }
        } else if (transcriptionData.text) {
            // Fallback: split text evenly across estimated duration
            const words = transcriptionData.text.split(' ');
            const estimatedDuration = words.length * 0.5; // Estimate 0.5 seconds per word
            const timePerWord = estimatedDuration / words.length;
            
            words.forEach((word, index) => {
                const start = index * timePerWord;
                const end = start + timePerWord;
                
                captions.push({
                    id: `fallback-${index}`,
                    text: word,
                    start: start,
                    end: end,
                    confidence: 1
                });
            });
        }

        // Sort captions by start time
        captions.sort((a, b) => a.start - b.start);
        
        console.log(`[Caption Match] Processed ${captions.length} caption segments`);
        return captions;
        
    } catch (error) {
        console.error('[Caption Match] Error processing transcription:', error);
        // Return basic fallback
        const words = originalText.split(' ');
        return words.map((word, index) => ({
            id: `fallback-${index}`,
            text: word,
            start: index * 0.5,
            end: (index + 1) * 0.5,
            confidence: 1
        }));
    }
}

// Helper function to parse VTT time format (00:00:00.000) to seconds
function parseVTTTime(timeString) {
    const parts = timeString.split(':');
    const seconds = parseFloat(parts[2]);
    const minutes = parseInt(parts[1]);
    const hours = parseInt(parts[0]);
    
    return hours * 3600 + minutes * 60 + seconds;
}

// Get caption timing analysis without Remotion
router.post('/analyze-timing', async (req, res) => {
    try {
        const { transcriptionData, originalText } = req.body;
        
        if (!transcriptionData) {
            return res.status(400).json({ error: 'Transcription data is required' });
        }

        console.log('[Timing Analysis] Starting analysis with data:', {
            hasWords: !!transcriptionData.words,
            wordsCount: transcriptionData.words?.length || 0,
            duration: transcriptionData.duration,
            originalTextLength: originalText?.length || 0
        });

        // Process transcription data to get word-level timing
        const processedCaptions = processTranscriptionForCaptions(transcriptionData, originalText);
        
        const analysis = {
            totalWords: processedCaptions.length,
            totalDuration: transcriptionData.duration || 0,
            averageWordDuration: 0,
            wordsPerSecond: 0,
            wordsPerMinute: 0,
            timingIssues: [],
            captionSegments: processedCaptions,
            timingAccuracy: 'unknown',
            recommendations: []
        };

        if (processedCaptions.length > 0) {
            // Calculate timing statistics
            const wordDurations = processedCaptions.map(caption => caption.end - caption.start);
            const totalWordDuration = wordDurations.reduce((sum, duration) => sum + duration, 0);
            
            analysis.averageWordDuration = totalWordDuration / processedCaptions.length;
            analysis.wordsPerSecond = processedCaptions.length / analysis.totalDuration;
            analysis.wordsPerMinute = Math.round(analysis.wordsPerSecond * 60);

            // Check for timing issues
            const issues = [];
            
            // Check for overlapping words
            for (let i = 0; i < processedCaptions.length - 1; i++) {
                const current = processedCaptions[i];
                const next = processedCaptions[i + 1];
                
                if (current.end > next.start) {
                    issues.push({
                        type: 'overlap',
                        message: `Words "${current.text}" and "${next.text}" overlap`,
                        severity: 'warning',
                        time: current.end,
                        words: [current.text, next.text]
                    });
                }
            }

            // Check for gaps that are too long
            for (let i = 0; i < processedCaptions.length - 1; i++) {
                const current = processedCaptions[i];
                const next = processedCaptions[i + 1];
                const gap = next.start - current.end;
                
                if (gap > 1.0) { // More than 1 second gap
                    issues.push({
                        type: 'long_gap',
                        message: `Long gap (${gap.toFixed(2)}s) between "${current.text}" and "${next.text}"`,
                        severity: 'info',
                        time: current.end,
                        gap: gap
                    });
                }
            }

            // Check for very short word durations (might indicate timing issues)
            processedCaptions.forEach((caption, index) => {
                const duration = caption.end - caption.start;
                if (duration < 0.1) { // Less than 100ms
                    issues.push({
                        type: 'short_duration',
                        message: `Word "${caption.text}" has very short duration (${duration.toFixed(3)}s)`,
                        severity: 'warning',
                        time: caption.start,
                        word: caption.text,
                        duration: duration
                    });
                }
            });

            analysis.timingIssues = issues;

            // Determine timing accuracy
            if (issues.length === 0) {
                analysis.timingAccuracy = 'excellent';
            } else if (issues.filter(issue => issue.severity === 'warning').length === 0) {
                analysis.timingAccuracy = 'good';
            } else {
                analysis.timingAccuracy = 'needs_improvement';
            }

            // Generate recommendations
            const recommendations = [];
            
            if (analysis.wordsPerMinute > 200) {
                recommendations.push({
                    type: 'speed',
                    message: 'Speaking rate is very fast. Consider slowing down for better caption readability.',
                    priority: 'medium'
                });
            } else if (analysis.wordsPerMinute < 100) {
                recommendations.push({
                    type: 'speed',
                    message: 'Speaking rate is slow. Consider increasing pace for better engagement.',
                    priority: 'low'
                });
            }

            if (issues.filter(issue => issue.type === 'overlap').length > 0) {
                recommendations.push({
                    type: 'timing',
                    message: 'Some words overlap in timing. This may cause caption display issues.',
                    priority: 'high'
                });
            }

            if (issues.filter(issue => issue.type === 'short_duration').length > 0) {
                recommendations.push({
                    type: 'timing',
                    message: 'Some words have very short durations. Consider adjusting speech pace.',
                    priority: 'medium'
                });
            }

            analysis.recommendations = recommendations;
        }

        console.log('[Timing Analysis] Analysis complete:', {
            totalWords: analysis.totalWords,
            timingAccuracy: analysis.timingAccuracy,
            issuesCount: analysis.timingIssues.length,
            recommendationsCount: analysis.recommendations.length
        });

        res.json({
            success: true,
            analysis
        });

    } catch (error) {
        console.error('[Timing Analysis] Error analyzing timing:', error);
        res.status(500).json({ 
            error: 'Failed to analyze caption timing',
            details: error.message
        });
    }
});

export default router;
