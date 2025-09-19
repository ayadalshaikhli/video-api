import pkg from '@remotion/captions';
const { parseSrt, parseVtt, serializeSrt, createTikTokStyleCaptions } = pkg;

/**
 * Parse SRT content and convert to our caption format
 */
export const parseSrtToCaptions = (srtContent) => {
    try {
        const parsed = parseSrt(srtContent);
        return parsed.map(caption => ({
            text: caption.text,
            startMs: caption.startMs,
            endMs: caption.endMs,
            timestampMs: caption.timestampMs,
            confidence: caption.confidence || 0.95
        }));
    } catch (error) {
        console.error('Error parsing SRT:', error);
        throw new Error('Invalid SRT format');
    }
};

/**
 * Parse VTT content and convert to our caption format
 */
export const parseVttToCaptions = (vttContent) => {
    try {
        const parsed = parseVtt(vttContent);
        return parsed.map(caption => ({
            text: caption.text,
            startMs: caption.startMs,
            endMs: caption.endMs,
            timestampMs: caption.timestampMs,
            confidence: caption.confidence || 0.95
        }));
    } catch (error) {
        console.error('Error parsing VTT:', error);
        throw new Error('Invalid VTT format');
    }
};

/**
 * Create TikTok-style captions with word-by-word highlighting
 */
export const createTikTokCaptions = (text, startMs, endMs, options = {}) => {
    const {
        wordsPerCaption = 3,
        overlapMs = 200,
        fontSize = 32,
        fontFamily = 'Arial',
        color = '#ffffff',
        backgroundColor = 'rgba(0, 0, 0, 0.7)',
        textShadow = '2px 2px 4px rgba(0, 0, 0, 0.8)'
    } = options;

    const words = text.split(' ').filter(word => word.trim().length > 0);
    const captions = [];
    
    for (let i = 0; i < words.length; i += wordsPerCaption) {
        const captionWords = words.slice(i, i + wordsPerCaption);
        const captionText = captionWords.join(' ');
        
        const captionStartMs = startMs + (i * (endMs - startMs) / words.length);
        const captionEndMs = startMs + ((i + wordsPerCaption) * (endMs - startMs) / words.length) + overlapMs;
        
        captions.push({
            text: captionText,
            startMs: Math.max(0, captionStartMs),
            endMs: Math.min(endMs, captionEndMs),
            timestampMs: captionStartMs,
            confidence: 0.95,
            style: {
                fontSize,
                fontFamily,
                color,
                backgroundColor,
                textShadow
            }
        });
    }
    
    return captions;
};

/**
 * Generate captions from text with automatic timing
 */
export const generateCaptionsFromText = (text, totalDurationMs, options = {}) => {
    const {
        sentencesPerCaption = 1,
        pauseBetweenSentences = 500,
        minCaptionDuration = 1000,
        maxCaptionDuration = 3000
    } = options;

    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const captions = [];
    
    let currentTime = 0;
    
    for (let i = 0; i < sentences.length; i += sentencesPerCaption) {
        const captionSentences = sentences.slice(i, i + sentencesPerCaption);
        const captionText = captionSentences.join('. ').trim();
        
        // Calculate duration based on text length
        const textLength = captionText.length;
        const baseDuration = Math.max(minCaptionDuration, textLength * 50); // 50ms per character
        const duration = Math.min(maxCaptionDuration, baseDuration);
        
        captions.push({
            text: captionText,
            startMs: currentTime,
            endMs: currentTime + duration,
            timestampMs: currentTime,
            confidence: 0.95
        });
        
        currentTime += duration + pauseBetweenSentences;
    }
    
    return captions;
};

/**
 * Align captions with audio segments
 */
export const alignCaptionsWithSegments = (captions, segments) => {
    const alignedCaptions = [];
    
    segments.forEach(segment => {
        const segmentStartMs = segment.start * 1000;
        const segmentEndMs = segment.end * 1000;
        
        // Find captions that overlap with this segment
        const overlappingCaptions = captions.filter(caption => 
            caption.startMs < segmentEndMs && caption.endMs > segmentStartMs
        );
        
        // Adjust timing to fit within segment
        overlappingCaptions.forEach(caption => {
            const adjustedCaption = {
                ...caption,
                startMs: Math.max(segmentStartMs, caption.startMs),
                endMs: Math.min(segmentEndMs, caption.endMs),
                segmentId: segment.id
            };
            
            alignedCaptions.push(adjustedCaption);
        });
    });
    
    return alignedCaptions;
};

/**
 * Export captions to SRT format
 */
export const exportToSrt = (captions) => {
    return serializeSrt(captions.map(caption => ({
        text: caption.text,
        startMs: caption.startMs,
        endMs: caption.endMs,
        timestampMs: caption.timestampMs,
        confidence: caption.confidence
    })));
};

/**
 * Validate caption timing
 */
export const validateCaptionTiming = (captions) => {
    const errors = [];
    
    captions.forEach((caption, index) => {
        if (caption.startMs >= caption.endMs) {
            errors.push(`Caption ${index + 1}: Start time must be before end time`);
        }
        
        if (caption.startMs < 0) {
            errors.push(`Caption ${index + 1}: Start time cannot be negative`);
        }
        
        if (caption.text.trim().length === 0) {
            errors.push(`Caption ${index + 1}: Text cannot be empty`);
        }
    });
    
    // Check for overlapping captions
    for (let i = 0; i < captions.length - 1; i++) {
        const current = captions[i];
        const next = captions[i + 1];
        
        if (current.endMs > next.startMs) {
            errors.push(`Captions ${i + 1} and ${i + 2} overlap`);
        }
    }
    
    return errors;
};

/**
 * Auto-correct caption timing
 */
export const autoCorrectCaptionTiming = (captions) => {
    const corrected = [...captions];
    
    // Sort by start time
    corrected.sort((a, b) => a.startMs - b.startMs);
    
    // Fix overlapping captions
    for (let i = 0; i < corrected.length - 1; i++) {
        const current = corrected[i];
        const next = corrected[i + 1];
        
        if (current.endMs > next.startMs) {
            // Adjust end time to match start of next caption
            current.endMs = next.startMs;
        }
    }
    
    // Ensure minimum duration
    corrected.forEach(caption => {
        if (caption.endMs - caption.startMs < 500) {
            caption.endMs = caption.startMs + 500;
        }
    });
    
    return corrected;
};
