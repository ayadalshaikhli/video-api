import React from 'react';
import { 
    AbsoluteFill, 
    useCurrentFrame, 
    useVideoConfig, 
    registerRoot,
    Img,
    Video,
    Audio,
    Sequence,
    interpolate,
    Easing,
    Composition
} from 'remotion';

// Simple Video Composition for server-side rendering
export const SimpleVideo = ({ data: composition, customizations }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    
    // Debug logging - more detailed
    console.log('=== SimpleVideo Debug Info ===');
    console.log('Raw props received:', { data: composition, customizations });
    console.log('Composition type:', typeof composition);
    console.log('Composition value:', composition);
    console.log('Has composition:', !!composition);
    console.log('Has segments:', !!composition?.segments);
    console.log('Segments count:', composition?.segments?.length || 0);
    console.log('Has captions:', !!composition?.captions);
    console.log('Captions count:', composition?.captions?.length || 0);
    console.log('Composition keys:', composition ? Object.keys(composition) : []);
    console.log('First segment:', composition?.segments?.[0]);
    console.log('First caption:', composition?.captions?.[0]);
    console.log('Customizations:', customizations);
    console.log('Current frame:', frame);
    console.log('FPS:', fps);
    console.log('=== End Debug Info ===');
    
    // Force a visible background to test if component is rendering at all
    const backgroundColor = frame < 10 ? '#ff0000' : '#000000';
    
    // Check if we have real data (not just defaults)
    const hasRealData = composition && composition.id && composition.id !== 'default' && composition.segments && composition.segments.length > 0;
    
    if (!hasRealData) {
        return (
            <AbsoluteFill style={{ backgroundColor: '#000000' }}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: '48px',
                        fontFamily: 'Arial',
                        textAlign: 'center',
                        padding: '20px',
                    }}
                >
                    <div>No composition data available</div>
                    <div style={{ fontSize: '24px', marginTop: '20px' }}>
                        Composition: {composition ? 'exists' : 'null'}
                        <br />
                        ID: {composition?.id || 'N/A'}
                        <br />
                        Segments: {composition?.segments?.length || 0}
                        <br />
                        Captions: {composition?.captions?.length || 0}
                        <br />
                        Frame: {frame}
                        <br />
                        FPS: {fps}
                        <br />
                        Has Music: {composition?.musicUrl ? 'Yes' : 'No'}
                    </div>
                </div>
            </AbsoluteFill>
        );
    }
    
    return (
        <AbsoluteFill style={{ backgroundColor: backgroundColor }}>
            {/* Test element to verify component is rendering */}
            <div
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '20px',
                    color: '#ffffff',
                    fontSize: '24px',
                    fontFamily: 'Arial',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: '10px',
                    borderRadius: '5px',
                }}
            >
                Frame: {frame} | FPS: {fps} | Segments: {composition?.segments?.length || 0}
            </div>
            
            {/* Render audio if available */}
            {composition.musicUrl && (
                <Audio
                    src={composition.musicUrl}
                    volume={1}
                />
            )}
            
            {/* Render segments */}
            {composition.segments?.map((segment, index) => {
                const startFrame = Math.floor((parseFloat(segment.start) || 0) * fps);
                const endFrame = Math.floor((parseFloat(segment.end) || (parseFloat(segment.start) + 3)) * fps);
                const durationInFrames = endFrame - startFrame;
                
                const isActive = frame >= startFrame && frame <= endFrame;
                
                // Debug logging for first segment
                if (index === 0 && frame < 10) {
                    console.log(`Segment ${index}: start=${segment.start}, end=${segment.end}, startFrame=${startFrame}, endFrame=${endFrame}, currentFrame=${frame}, isActive=${isActive}`);
                }
                
                if (!isActive) return null;
                
                // Simple animation
                const progress = interpolate(
                    frame,
                    [startFrame, startFrame + 10, endFrame - 10, endFrame],
                    [0, 1, 1, 0],
                    {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                        easing: Easing.bezier(0.4, 0, 0.2, 1),
                    }
                );
                
                return (
                    <Sequence key={segment.id || index} from={startFrame} durationInFrames={durationInFrames}>
                        <AbsoluteFill style={{ opacity: progress }}>
                            {segment.mediaUrl ? (
                                segment.mediaUrl.endsWith('.mp4') || segment.mediaUrl.endsWith('.mov') ? (
                                    <Video
                                        src={segment.mediaUrl}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                        }}
                                    />
                                ) : (
                                    <Img
                                        src={segment.mediaUrl}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                        }}
                                    />
                                )
                            ) : (
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        fontSize: '48px',
                                        fontFamily: 'Arial',
                                    }}
                                >
                                    Segment {index + 1}
                                </div>
                            )}
                        </AbsoluteFill>
                    </Sequence>
                );
            })}
            
            {/* Render captions */}
            {composition.captions?.map((caption) => {
                const startFrame = (caption.startMs / 1000) * fps;
                const endFrame = (caption.endMs / 1000) * fps;
                
                const isActive = frame >= startFrame && frame <= endFrame;
                
                if (!isActive) return null;
                
                const progress = interpolate(
                    frame,
                    [startFrame, endFrame],
                    [0, 1],
                    {
                        extrapolateLeft: 'clamp',
                        extrapolateRight: 'clamp',
                    }
                );
                
                // Get customization settings with defaults
                const fontSize = customizations?.fontSize || 64;
                const fontWeight = customizations?.fontWeight || 700;
                const fontFamily = customizations?.fontFamily || 'Inter';
                const textTransform = customizations?.textTransform || 'uppercase';
                const activeWordColor = customizations?.activeWordColor || '#fff';
                const inactiveWordColor = customizations?.inactiveWordColor || '#00ffea';
                const positionFromBottom = customizations?.positionFromBottom || 9;
                
                // Word-by-word highlighting
                const words = caption.text.split(' ');
                const activeWordIndex = Math.floor(progress * words.length);
                
                return (
                    <div
                        key={caption.id}
                        style={{
                            position: 'absolute',
                            bottom: `${positionFromBottom}%`,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            textAlign: 'center',
                            maxWidth: '90%',
                            padding: '20px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {words.map((word, index) => {
                            const isActive = index <= activeWordIndex;
                            const isCurrentWord = index === activeWordIndex;
                            
                            return (
                                <span
                                    key={index}
                                    style={{
                                        color: isActive ? activeWordColor : inactiveWordColor,
                                        fontSize: `${fontSize}px`,
                                        fontWeight: fontWeight,
                                        fontFamily: fontFamily,
                                        textTransform: textTransform,
                                        marginRight: '8px',
                                        transition: 'color 0.1s ease',
                                        opacity: isActive ? 1 : 0.6,
                                    }}
                                >
                                    {word}
                                    {isCurrentWord && ' 👀'}
                                </span>
                            );
                        })}
                    </div>
                );
            })}
        </AbsoluteFill>
    );
};

export const SimpleVideoConfig = {
    id: 'SimpleVideo',
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 300, // 10 seconds default
};

// Create a proper Remotion root component
export const RemotionRoot = () => {
    return (
        <Composition
            id="SimpleVideo"
            component={SimpleVideo}
            durationInFrames={630} // 21 seconds for 7 segments of 3 seconds each
            fps={30}
            width={1080}
            height={1920}
            defaultProps={{
                data: {
                    id: 'default',
                    segments: [{
                        id: 'default-segment',
                        text: 'Loading...',
                        start: 0,
                        end: 3,
                        mediaUrl: null,
                        animation: 'fade',
                        style: {
                            fontFamily: 'Arial',
                            fontSize: 24,
                            color: '#ffffff',
                            background: 'transparent'
                        },
                        order: 0
                    }],
                    captions: [],
                    musicUrl: null,
                    script: 'Loading...',
                    aspect: '9:16'
                },
                customizations: {
                    fontSize: 64,
                    fontWeight: 700,
                    fontFamily: 'Inter',
                    textTransform: 'uppercase',
                    activeWordColor: '#fff',
                    inactiveWordColor: '#00ffea',
                    positionFromBottom: 9,
                    wordsPerBatch: 3,
                    showEmojis: true,
                    backgroundMusic: '',
                    musicVolume: 8
                }
            }}
        />
    );
};

// Register the root component
registerRoot(RemotionRoot);

// Also export the component directly for server-side rendering
export default SimpleVideo;
