import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition, videoCompositionFixedSchema } from './VideoComposition';
import { DebugSolid } from './DebugSolid';

export const RemotionRoot = () => {
    return (
        <>
            <Composition
                id="VideoComposition"
                component={VideoComposition}
                durationInFrames={630} // Will be calculated dynamically
                fps={30}
                width={1080}
                height={1920}
                schema={videoCompositionFixedSchema}
                // Ensure input props are passed through
                calculateMetadata={({ props }) => {
                    console.log('📊 Root.tsx calculateMetadata called with props:', {
                        hasProps: !!props,
                        propsKeys: props ? Object.keys(props) : [],
                        hasSegments: !!props?.segments,
                        hasCaptions: !!props?.captions,
                        segmentsCount: Array.isArray(props?.segments) ? props.segments.length : 0,
                        captionsCount: Array.isArray(props?.captions) ? props.captions.length : 0
                    });
                    return {
                        durationInFrames: 630,
                        fps: 30,
                        width: 1080,
                        height: 1920
                    };
                }}
            />
            <Composition
                id="DebugSolid"
                component={DebugSolid}
                durationInFrames={120}
                fps={30}
                width={1080}
                height={1920}
                defaultProps={{ color: '#222244', label: 'DebugSolid OK' }}
            />
        </>
    );
};
