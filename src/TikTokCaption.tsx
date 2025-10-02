import React from 'react';
import {
    AbsoluteFill,
    useCurrentFrame,
    useVideoConfig,
    interpolate,
    spring,
    Easing,
} from 'remotion';

// Get font family name directly to avoid any duplicate key issues
const getFontFamilyName = (fontName: string) => {
    switch (fontName) {
        case 'Inter': return 'Inter';
        case 'Roboto': return 'Roboto';
        case 'Open Sans': return 'Open Sans';
        case 'Montserrat': return 'Montserrat';
        case 'Poppins': return 'Poppins';
        case 'Lato': return 'Lato';
        case 'Source Sans 3': return 'Source Sans Three';
        case 'Raleway': return 'Raleway';
        case 'Ubuntu': return 'Ubuntu';
        case 'Playfair Display': return 'Playfair Display';
        default: return 'Inter';
    }
};

// Helper to group word-level captions into TikTok-style phrases
const groupWordCaptionsIntoTikTokPhrases = (wordCaptions: any[], wordsPerPhrase = 3) => {
    const phrases = [];
    
    for (let i = 0; i < wordCaptions.length; i += wordsPerPhrase) {
        const wordsInPhrase = wordCaptions.slice(i, i + wordsPerPhrase);
        
        if (wordsInPhrase.length === 0) continue;
        
        // Create phrase with exact word-level timing
        const phraseStartMs = wordsInPhrase[0].startMs;
        const phraseEndMs = wordsInPhrase[wordsInPhrase.length - 1].endMs;
        const phraseText = wordsInPhrase.map(w => w.text).join(' ');
        
        // Create tokens with precise timing from word-level captions
        const tokens = wordsInPhrase.map((wordCaption, index) => ({
            text: wordCaption.text + (index < wordsInPhrase.length - 1 ? ' ' : ''),
            fromMs: wordCaption.startMs,
            toMs: wordCaption.endMs,
            originalCaption: wordCaption
        }));
        
        phrases.push({
            text: phraseText,
            startMs: phraseStartMs,
            endMs: phraseEndMs,
            tokens,
            wordCaptions: wordsInPhrase
        });
    }
    
    return phrases;
};

// Helper to convert single caption data to TikTok-style format (fallback)
const createTikTokStyleCaptions = (caption: any, wordsPerBatch = 3) => {
    const words = caption.text.split(' ');
    const pages = [];
    
    // Calculate duration per batch
    const totalDuration = caption.endMs - caption.startMs;
    const batchCount = Math.ceil(words.length / wordsPerBatch);
    const durationPerBatch = totalDuration / batchCount;
    
    for (let i = 0; i < words.length; i += wordsPerBatch) {
        const batchWords = words.slice(i, i + wordsPerBatch);
        const startMs = caption.startMs + (Math.floor(i / wordsPerBatch) * durationPerBatch);
        const endMs = Math.min(startMs + durationPerBatch, caption.endMs);
        
        // Create tokens for each word in the batch
        const tokens = batchWords.map((word, wordIndex) => {
            const globalWordIndex = i + wordIndex;
            const wordDuration = durationPerBatch / batchWords.length;
            const wordStartMs = startMs + (wordIndex * wordDuration);
            const wordEndMs = Math.min(wordStartMs + wordDuration, endMs);
            
            return {
                text: word + (wordIndex < batchWords.length - 1 ? ' ' : ''),
                fromMs: wordStartMs,
                toMs: wordEndMs,
            };
        });
        
        pages.push({
            text: batchWords.join(' '),
            startMs,
            endMs,
            tokens,
        });
    }
    
    return { pages };
};

// TikTok-style page component with improved animations
const TikTokPage = ({ page, enterProgress, customizations }: any) => {
    const frame = useCurrentFrame();
    const { fps, width, height } = useVideoConfig();
    const timeInMs = (frame / fps) * 1000;
    
    // Get customization settings with defaults
    const fontSize = customizations?.fontSize || 120;
    const fontWeight = customizations?.fontWeight || 700;
    const fontFamily = getFontFamilyName(customizations?.fontFamily || 'Inter');
    const textTransform = customizations?.textTransform || 'uppercase';
    const activeWordColor = customizations?.activeWordColor || '#39E508';
    const inactiveWordColor = customizations?.inactiveWordColor || '#ffffff';
    // Positioning and container styling
    const positionFromBottom = customizations?.positionFromBottom ?? 9;
    const captionPositionUnit = customizations?.captionPositionUnit || 'percent'; // 'percent' | 'px'
    const captionHorizontalAlign = customizations?.captionHorizontalAlign || 'center'; // 'left' | 'center' | 'right'
    const captionHorizontalOffsetPx = customizations?.captionHorizontalOffsetPx || 0;
    const captionMaxWidthPercent = customizations?.captionMaxWidthPercent || 90;
    const captionPaddingPx = customizations?.captionPaddingPx || 20;
    const captionBorderRadiusPx = customizations?.captionBorderRadiusPx || 10;
    const captionBackgroundColor = customizations?.captionBackgroundColor || '#000000';
    const captionBackgroundOpacity = customizations?.captionBackgroundOpacity ?? 60; // 0-100
    const captionBackdropBlurPx = customizations?.captionBackdropBlurPx || 0;
    const captionBoxShadow = customizations?.captionBoxShadow || '0 6px 24px rgba(0,0,0,0.35)';
    
    // Advanced text effects
    const textStroke = customizations?.textStroke || 'thick';
    const textStrokeWidth = customizations?.textStrokeWidth || 8;
    const textStrokeColor = customizations?.textStrokeColor || '#000000';
    
    // Simple text fitting (since fitText might not be available on server)
    const maxWidth = width * 0.9;
    const estimatedTextWidth = page.text.length * (fontSize * 0.6); // rough estimation
    const finalFontSize = estimatedTextWidth > maxWidth ? 
        Math.floor((maxWidth / estimatedTextWidth) * fontSize) : fontSize;
    
    // Helpers
    const hexToRgba = (hex: string, opacityPercent: number) => {
        const o = Math.max(0, Math.min(100, opacityPercent)) / 100;
        let h = hex.replace('#', '');
        if (h.length === 3) {
            h = h.split('').map((c) => c + c).join('');
        }
        const bigint = parseInt(h, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${o})`;
    };

    const bottomValue = captionPositionUnit === 'percent' ? `${positionFromBottom}%` : positionFromBottom;

    // Container for positioning the wrapper
    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        left: 0,
        right: 0,
        top: undefined,
        bottom: bottomValue,
        display: 'flex',
        justifyContent: captionHorizontalAlign === 'left' ? 'flex-start' : captionHorizontalAlign === 'right' ? 'flex-end' : 'center',
        alignItems: 'center',
        pointerEvents: 'none',
    };

    // Wrapper box around the text (background, padding, radius)
    const wrapperStyle: React.CSSProperties = {
        maxWidth: `${captionMaxWidthPercent}%`,
        padding: `${captionPaddingPx}px`,
        borderRadius: `${captionBorderRadiusPx}px`,
        background: hexToRgba(captionBackgroundColor, captionBackgroundOpacity),
        backdropFilter: captionBackdropBlurPx ? `blur(${captionBackdropBlurPx}px)` : 'none',
        boxShadow: captionBoxShadow,
        pointerEvents: 'none',
        transform: `translateY(0)`,
        marginLeft: captionHorizontalAlign === 'left' ? `${captionHorizontalOffsetPx}px` : undefined,
        marginRight: captionHorizontalAlign === 'right' ? `${captionHorizontalOffsetPx}px` : undefined,
    };
    
    // Main text style with stroke effect
    const textStyle: React.CSSProperties = {
        fontSize: finalFontSize,
        color: inactiveWordColor,
        WebkitTextStroke: `${textStrokeWidth}px ${textStrokeColor}`,
        fontFamily,
        textTransform: textTransform.toLowerCase() as any,
        transform: `scale(${interpolate(enterProgress, [0, 1], [0.8, 1])}) translateY(${interpolate(enterProgress, [0, 1], [50, 0])}px)`,
        textAlign: 'center',
        lineHeight: 1.2,
        fontWeight,
    };
    
    return (
        <AbsoluteFill style={containerStyle}>
            <div style={wrapperStyle}>
                <div style={textStyle}>
                {page.tokens.map((token: any, index: number) => {
                    const startRelativeToSequence = token.fromMs - page.startMs;
                    const endRelativeToSequence = token.toMs - page.startMs;
                    const currentTimeRelative = timeInMs - page.startMs;
                    
                    const isActive = 
                        startRelativeToSequence <= currentTimeRelative &&
                        endRelativeToSequence > currentTimeRelative;
                    
                    // Add a subtle scale animation for active words
                    const wordScale = isActive ? 
                        interpolate(
                            Math.sin((currentTimeRelative - startRelativeToSequence) * 0.01),
                            [-1, 1],
                            [1, 1.05]
                        ) : 1;
                    
                    return (
                        <span
                            key={index}
                            style={{
                                display: 'inline',
                                whiteSpace: 'pre',
                                color: isActive ? activeWordColor : inactiveWordColor,
                                transform: `scale(${wordScale})`,
                                transition: 'color 0.1s ease, transform 0.1s ease',
                                textShadow: isActive ? 
                                    `0 0 20px ${activeWordColor}, 0 0 40px ${activeWordColor}` : 
                                    'none',
                            }}
                        >
                            {token.text}
                        </span>
                    );
                })}
                </div>
            </div>
        </AbsoluteFill>
    );
};

// Subtitle page wrapper with spring animation
const TikTokSubtitlePage = ({ page, customizations }: any) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    const enter = spring({
        frame,
        fps,
        config: {
            damping: 200,
        },
        durationInFrames: 8, // Slightly longer for smoother entrance
    });
    
    return (
        <AbsoluteFill>
            <TikTokPage enterProgress={enter} page={page} customizations={customizations} />
        </AbsoluteFill>
    );
};

// TikTok Caption Group - Groups word-level captions into TikTok-style phrases
export const TikTokCaptionGroup = ({ wordCaptions, currentFrame, fps, customizations }: any) => {
    const wordsPerPhrase = customizations?.wordsPerBatch || 3;
    
    // Debug logging on first frame
    if (currentFrame === 0 && wordCaptions && wordCaptions.length > 0) {
        console.log('🎬 [TikTok Caption Group] Initializing with word-level captions:', {
            totalWords: wordCaptions.length,
            wordsPerPhrase,
            firstWord: wordCaptions[0],
            lastWord: wordCaptions[wordCaptions.length - 1]
        });
    }
    
    // Group word-level captions into TikTok-style phrases
    const phrases = groupWordCaptionsIntoTikTokPhrases(wordCaptions, wordsPerPhrase);
    
    // Debug logging on first frame
    if (currentFrame === 0 && phrases.length > 0) {
        console.log('🎬 [TikTok Caption Group] Created phrases:', {
            totalPhrases: phrases.length,
            firstPhrase: {
                text: phrases[0].text,
                startMs: phrases[0].startMs,
                endMs: phrases[0].endMs,
                tokensCount: phrases[0].tokens.length
            }
        });
    }
    
    // Calculate current time in milliseconds
    const currentTimeMs = (currentFrame / fps) * 1000;
    
    // Find the active phrase
    const activePhrase = phrases.find(phrase => 
        currentTimeMs >= phrase.startMs && currentTimeMs < phrase.endMs
    );
    
    if (!activePhrase) return null;
    
    // Render the active phrase using TikTok-style presentation
    return <TikTokSubtitlePage page={activePhrase} customizations={customizations} />;
};

// Main TikTok Caption component (for single captions - fallback)
const TikTokCaption = ({ caption, currentFrame, fps, customizations }: any) => {
    // Handle both timing formats: startMs/endMs (milliseconds) or start/end (seconds)
    let startMs, endMs;
    
    if (caption.startMs !== undefined && caption.endMs !== undefined) {
        startMs = caption.startMs;
        endMs = caption.endMs;
    } else if (caption.start !== undefined && caption.end !== undefined) {
        startMs = parseFloat(caption.start) * 1000;
        endMs = parseFloat(caption.end) * 1000;
    } else {
        return null;
    }
    
    // Convert to frame-based timing
    const startFrame = (startMs / 1000) * fps;
    const endFrame = (endMs / 1000) * fps;
    
    const isActive = currentFrame >= startFrame && currentFrame <= endFrame;
    if (!isActive) return null;
    
    // Create TikTok-style pages from caption
    const wordsPerBatch = customizations?.wordsPerBatch || 3;
    const { pages } = createTikTokStyleCaptions({
        text: caption.text,
        startMs,
        endMs,
    }, wordsPerBatch);
    
    // Calculate current time in milliseconds
    const currentTimeMs = (currentFrame / fps) * 1000;
    
    // Find the active page
    const activePage = pages.find(page => 
        currentTimeMs >= page.startMs && currentTimeMs < page.endMs
    );
    
    if (!activePage) return null;
    
    return <TikTokSubtitlePage page={activePage} customizations={customizations} />;
};

export default TikTokCaption;
