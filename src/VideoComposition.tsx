import React from 'react';
import { 
    AbsoluteFill, 
    useCurrentFrame, 
    useVideoConfig, 
    Img,
    Video,
    Audio,
    Sequence,
    interpolate,
    Easing,
    delayRender,
    continueRender,
    getInputProps
} from 'remotion';
import { z } from 'zod';
import TikTokCaption, { TikTokCaptionGroup } from './TikTokCaption';

// Schema for the fixed component - expects flat data structure
export const videoCompositionFixedSchema = z.object({
    // Data properties (flat structure)
    id: z.union([z.string(), z.number()]).optional(),
    segments: z.array(z.object({
        id: z.string(),
        text: z.string().optional(),
        start: z.number(),
        end: z.number(),
        mediaUrl: z.string().optional(),
        imageUrl: z.string().optional(),
        animation: z.string().optional(),
        order: z.number().optional()
    })).optional(),
    captions: z.array(z.object({
        id: z.string(),
        text: z.string(),
        startMs: z.number(),
        endMs: z.number()
    })).optional(),
    musicUrl: z.string().optional(),
    script: z.string().optional(),
    aspect: z.string().optional(),
    
    // Customization properties (flat structure)
    fontSize: z.number().optional(),
    fontWeight: z.number().optional(),
    fontFamily: z.string().optional(),
    textTransform: z.string().optional(),
    activeWordColor: z.string().optional(),
    inactiveWordColor: z.string().optional(),
    positionFromBottom: z.number().optional(),
    wordsPerBatch: z.number().optional(),
    showEmojis: z.boolean().optional(),
    musicVolume: z.number().optional(),
    
    // Additional caption styling properties
    captionHorizontalAlign: z.string().optional(),
    captionMaxWidthPercent: z.number().optional(),
    captionPaddingPx: z.number().optional(),
    captionBorderRadiusPx: z.number().optional(),
    captionBackgroundColor: z.string().optional(),
    captionBackgroundOpacity: z.number().optional(),
    captionBackdropBlurPx: z.number().optional(),
    captionHorizontalOffsetPx: z.number().optional(),
    captionBoxShadow: z.string().optional()
}).passthrough(); // Allow additional properties

// Advanced Caption component with word-by-word highlighting
const AdvancedCaption = ({ caption, customizations, startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const isActive = frame >= startFrame && frame <= startFrame + durationFrames;
  
  if (!isActive) return null;
  
  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
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
  const wordsPerBatch = customizations?.wordsPerBatch || 3;
  const showEmojis = customizations?.showEmojis !== false;
  
  // Word-by-word highlighting with batch support
  const words = caption.text.split(' ');
  const batchSize = Math.min(wordsPerBatch, 3);
  const totalBatches = Math.ceil(words.length / batchSize);
  const currentBatch = Math.floor(progress * totalBatches);
  const activeWordIndex = Math.floor(progress * words.length);
  
  // Get the current batch of words to display
  const startIndex = currentBatch * batchSize;
  const endIndex = Math.min(startIndex + batchSize, words.length);
  const currentWords = words.slice(startIndex, endIndex);
  
  return (
    <div
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
        backdropFilter: 'blur(10px)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {currentWords.map((word, index) => {
        const globalIndex = startIndex + index;
        const isActive = globalIndex <= activeWordIndex;
        const isCurrentWord = globalIndex === activeWordIndex;
        
        const wordStyle = {
          color: isActive ? activeWordColor : inactiveWordColor,
          fontSize: `${fontSize}px`,
          fontWeight: fontWeight,
          fontFamily: fontFamily,
          textTransform: textTransform,
          marginRight: '8px',
          transition: 'color 0.1s ease',
          opacity: isActive ? 1 : 0.6,
          textShadow: `${activeWordColor} 0px 0px 8px, ${activeWordColor} 0px 0px 16px`,
        };
        
        return (
          <span
            key={globalIndex}
            style={wordStyle}
          >
            {word}
            {showEmojis && isCurrentWord && ' 👀'}
          </span>
        );
      })}
    </div>
  );
};

export const VideoComposition = (props: any) => {
  const [handle] = React.useState(() => delayRender());
  const frame = useCurrentFrame();
  
  // Try to get input props using getInputProps()
  const inputProps = getInputProps();
  
  console.log('🚀🚀🚀 VideoCompositionFixed COMPONENT EXECUTING! 🚀🚀🚀');
  console.log('🚀 Props received:', {
    hasProps: !!props,
    propsKeys: props ? Object.keys(props) : [],
    timestamp: new Date().toISOString()
  });
  
  console.log('🔍 Input props from getInputProps():', {
    hasInputProps: !!inputProps,
    inputPropsKeys: inputProps ? Object.keys(inputProps) : [],
    inputPropsContent: JSON.stringify(inputProps, null, 2)
  });
  
  // Log the actual props content
  console.log('🔍 Full props content:', JSON.stringify(props, null, 2));

  // Validate props with schema
  try {
    const validatedProps = videoCompositionFixedSchema.parse(props);
    console.log('✅ Schema validation passed:', {
      hasSegments: !!validatedProps.segments,
      hasCaptions: !!validatedProps.captions,
      segmentsCount: validatedProps.segments?.length || 0,
      captionsCount: validatedProps.captions?.length || 0,
      hasCustomizations: !!(validatedProps.fontSize && validatedProps.fontFamily)
    });
  } catch (schemaError) {
    console.error('❌ Schema validation failed:', schemaError);
    console.log('Raw props that failed validation:', JSON.stringify(props, null, 2));
  }

  // Continue render immediately
  React.useEffect(() => {
    continueRender(handle);
  }, [handle]);

  // Extract data from props - handle both flat and nested structures
  // Use inputProps if available, otherwise fall back to props
  const raw = inputProps || props || {};
  
  let segments: any[] = [];
  let captions: any[] = [];
  let musicUrl: string = '';
  
  if ((raw as any).data) {
    // Nested structure from frontend
    console.log('📦 Detected nested data structure from frontend');
    const data = (raw as any).data;
    segments = Array.isArray(data.segments) ? data.segments : [];
    captions = Array.isArray(data.captions) ? data.captions : [];
    musicUrl = data.musicUrl || '';
  } else {
    // Flat structure from backend
    console.log('📋 Detected flat data structure from backend');
    segments = Array.isArray((raw as any).segments) ? (raw as any).segments : [];
    captions = Array.isArray((raw as any).captions) ? (raw as any).captions : [];
    musicUrl = (raw as any).musicUrl || '';
  }
  
  // Extract customizations
  const rawAny = raw as any;
  const customizations: any = {
    fontSize: rawAny.fontSize || 64,
    fontWeight: rawAny.fontWeight || 700,
    fontFamily: rawAny.fontFamily || 'Inter',
    textTransform: rawAny.textTransform || 'uppercase',
    activeWordColor: rawAny.activeWordColor || '#4cd6b4',
    inactiveWordColor: rawAny.inactiveWordColor || '#ffff00',
    positionFromBottom: rawAny.positionFromBottom || 10,
    wordsPerBatch: rawAny.wordsPerBatch || 3,
    showEmojis: rawAny.showEmojis !== false,
    musicVolume: rawAny.musicVolume || 8,
    
    // Additional caption styling properties
    captionHorizontalAlign: rawAny.captionHorizontalAlign || 'right',
    captionMaxWidthPercent: rawAny.captionMaxWidthPercent || 80,
    captionPaddingPx: rawAny.captionPaddingPx || 20,
    captionBorderRadiusPx: rawAny.captionBorderRadiusPx || 10,
    captionBackgroundColor: rawAny.captionBackgroundColor || '#000000',
    captionBackgroundOpacity: rawAny.captionBackgroundOpacity ?? 29,
    captionBackdropBlurPx: rawAny.captionBackdropBlurPx || 0,
    captionHorizontalOffsetPx: rawAny.captionHorizontalOffsetPx || 0,
    captionBoxShadow: rawAny.captionBoxShadow || '0 6px 24px rgba(0,0,0,0.35)'
  };

  console.log('🔍 Data extraction:', {
    segmentsCount: segments.length,
    captionsCount: captions.length,
    hasMusicUrl: !!musicUrl,
    firstSegment: segments[0] ? {
      text: segments[0].text?.substring(0, 50) + '...',
      hasMediaUrl: !!segments[0].mediaUrl,
      hasImageUrl: !!segments[0].imageUrl,
      mediaUrl: segments[0].mediaUrl,
      imageUrl: segments[0].imageUrl
    } : null
  });

  // If no segments, show debug info
  if (segments.length === 0) {
    console.log('⚠️ NO SEGMENTS FOUND - Showing debug info');
    
    return (
      <AbsoluteFill style={{ backgroundColor: '#1a1a1a' }}>
        {/* Fallback content */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#fff',
          fontSize: '32px',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ marginBottom: '20px' }}>No content available</div>
            <div style={{ fontSize: '18px', color: '#ccc' }}>
              Please check your video data
            </div>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  console.log('🎬 RENDERING with segments:', segments.length, 'captions:', captions.length);
  
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      
      {/* Render each segment */}
      {segments.map((segment: any, index: number) => {
        const startTime = typeof segment.start === 'number' ? segment.start : parseFloat(segment.start || 0);
        const endTimeRaw = typeof segment.end === 'number' ? segment.end : parseFloat(segment.end || (startTime + 3));
        const endTime = isNaN(endTimeRaw) ? startTime + 3 : endTimeRaw;
        const duration = Math.max(0.01, endTime - startTime);
        const startFrame = Math.max(0, Math.round(startTime * 30));
        const durationFrames = Math.max(1, Math.round(duration * 30));

        console.log(`🎬 Segment ${index + 1}/${segments.length}: start=${startTime}s end=${endTime}s frames=${startFrame}-${startFrame + durationFrames}`);

        const mediaUrl = segment.mediaUrl || segment.imageUrl;

        return (
          <Sequence
            key={`segment-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <AbsoluteFill>
              {mediaUrl ? (
                <Img
                  src={mediaUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onError={(e) => {
                    console.error(`❌ Failed to load image for segment ${index}:`, mediaUrl, e);
                  }}
                  onLoad={() => {
                    console.log(`✅ Successfully loaded image for segment ${index}:`, mediaUrl);
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(45deg, #${Math.floor(Math.random()*16777215).toString(16)}, #${Math.floor(Math.random()*16777215).toString(16)})`,
                  color: '#fff',
                  fontSize: 32,
                  fontFamily: 'sans-serif',
                  textAlign: 'center'
                }}>
                  <div>
                    <div>Segment {index + 1}</div>
                    <div style={{ fontSize: 18, marginTop: 10 }}>No media URL</div>
                  </div>
                </div>
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* Render captions using TikTok-style presentation */}
      {captions && captions.length > 0 ? (
        <TikTokCaptionGroup
          wordCaptions={captions}
          currentFrame={frame}
          fps={30}
          customizations={customizations}
        />
      ) : (
        // Fallback to individual caption rendering if needed
        captions?.map((caption: any, index: number) => {
          const startTime = caption.startMs ? caption.startMs / 1000 : 0;
          const endTime = caption.endMs ? caption.endMs / 1000 : startTime + 3;
          const duration = endTime - startTime;
          
          const startFrame = Math.round(startTime * 30);
          const durationFrames = Math.round(duration * 30);

          console.log(`📝 Rendering caption ${index + 1}/${captions.length}: "${caption.text}" from ${startFrame} to ${startFrame + durationFrames} frames`);

          return (
            <Sequence
              key={`caption-${index}`}
              from={startFrame}
              durationInFrames={durationFrames}
            >
              <TikTokCaption 
                caption={caption}
                currentFrame={frame}
                fps={30}
                customizations={customizations}
              />
            </Sequence>
          );
        })
      )}

      {/* Add background music if available */}
      {musicUrl && (
        <>
          {console.log('🎵 Adding background music:', musicUrl, 'at volume:', customizations?.musicVolume)}
          <Audio
            src={musicUrl}
            volume={customizations?.musicVolume ? customizations.musicVolume / 10 : 0.5}
          />
        </>
      )}
      
      {!musicUrl && console.log('🔇 No background music to add')}
    </AbsoluteFill>
  );
};
