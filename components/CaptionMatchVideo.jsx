import React from 'react';
import { Sequence, useCurrentFrame, useVideoConfig, Audio, AbsoluteFill } from 'remotion';

export const CaptionMatchVideo = ({
    text,
    captions,
    audioUrl,
    settings
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const currentTime = frame / fps;

    // Find the current captions that should be displayed
    const getCurrentCaptions = () => {
        return captions.filter(caption => 
            currentTime >= caption.start && currentTime <= caption.end
        );
    };

    const currentCaptions = getCurrentCaptions();

    // Get all words that have been spoken so far (for highlighting effect)
    const getSpokenWords = () => {
        return captions.filter(caption => currentTime >= caption.end);
    };

    const spokenWords = getSpokenWords();

    return (
        <AbsoluteFill style={{ backgroundColor: '#000' }}>
            {/* Audio track */}
            {audioUrl && (
                <Audio src={audioUrl} />
            )}

            {/* Background */}
            <AbsoluteFill
                style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
            />

            {/* Main content area */}
            <AbsoluteFill
                style={{
                    padding: '60px 40px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {/* Story text with word highlighting */}
                <div
                    style={{
                        width: '100%',
                        maxWidth: '800px',
                        marginBottom: '100px',
                    }}
                >
                    <StoryWithHighlights 
                        text={text}
                        spokenWords={spokenWords}
                        currentCaptions={currentCaptions}
                    />
                </div>

                {/* Current caption display */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: '120px',
                        left: '40px',
                        right: '40px',
                        textAlign: 'center',
                    }}
                >
                    <CurrentCaptionDisplay captions={currentCaptions} />
                </div>

                {/* Progress indicator */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: '40px',
                        left: '40px',
                        right: '40px',
                    }}
                >
                    <ProgressBar 
                        currentTime={currentTime}
                        totalDuration={settings.duration}
                        captions={captions}
                    />
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

// Component to display story text with word highlighting
const StoryWithHighlights = ({ text, spokenWords, currentCaptions }) => {
    const words = text.split(' ');
    const spokenWordsSet = new Set(spokenWords.map(w => w.text.toLowerCase().trim()));
    const currentWordsSet = new Set(currentCaptions.map(w => w.text.toLowerCase().trim()));

    return (
        <div
            style={{
                fontSize: '32px',
                lineHeight: 1.6,
                color: 'white',
                textAlign: 'center',
                fontWeight: '600',
                fontFamily: 'Inter, Arial, sans-serif',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
            }}
        >
            {words.map((word, index) => {
                const cleanWord = word.toLowerCase().replace(/[.,!?;:]/, '').trim();
                const isSpoken = spokenWordsSet.has(cleanWord);
                const isCurrent = currentWordsSet.has(cleanWord);
                
                let wordStyle = {
                    marginRight: '12px',
                    display: 'inline-block',
                    transition: 'all 0.3s ease',
                };

                if (isCurrent) {
                    // Currently being spoken - highlight in bright color
                    wordStyle = {
                        ...wordStyle,
                        color: '#FFD700',
                        backgroundColor: 'rgba(255, 215, 0, 0.2)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        transform: 'scale(1.1)',
                        fontWeight: '700',
                    };
                } else if (isSpoken) {
                    // Already spoken - dimmed
                    wordStyle = {
                        ...wordStyle,
                        color: '#B0B0B0',
                        opacity: 0.7,
                    };
                } else {
                    // Not yet spoken - normal
                    wordStyle = {
                        ...wordStyle,
                        color: 'white',
                    };
                }

                return (
                    <span key={index} style={wordStyle}>
                        {word}
                    </span>
                );
            })}
        </div>
    );
};

// Component to display current captions
const CurrentCaptionDisplay = ({ captions }) => {
    if (captions.length === 0) return null;

    const captionText = captions.map(c => c.text).join(' ');

    return (
        <div
            style={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: '20px 30px',
                borderRadius: '15px',
                border: '2px solid #FFD700',
            }}
        >
            <div
                style={{
                    fontSize: '28px',
                    color: '#FFD700',
                    fontWeight: '700',
                    textAlign: 'center',
                    fontFamily: 'Inter, Arial, sans-serif',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                }}
            >
                {captionText}
            </div>
        </div>
    );
};

// Progress bar component
const ProgressBar = ({ currentTime, totalDuration, captions }) => {
    const progress = Math.min(currentTime / totalDuration, 1);

    return (
        <div style={{ width: '100%' }}>
            {/* Progress bar */}
            <div
                style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '10px',
                }}
            >
                <div
                    style={{
                        width: `${progress * 100}%`,
                        height: '100%',
                        backgroundColor: '#FFD700',
                        borderRadius: '4px',
                        transition: 'width 0.1s ease',
                    }}
                />
            </div>

            {/* Time indicators */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontFamily: 'Inter, Arial, sans-serif',
                }}
            >
                <span>{formatTime(currentTime)}</span>
                <span>{captions.length} words</span>
                <span>{formatTime(totalDuration)}</span>
            </div>
        </div>
    );
};

// Utility function to format time
const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};
