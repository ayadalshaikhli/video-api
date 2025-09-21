import { Composition } from '@remotion/core';
import { SimpleVideo } from './SimpleVideo.jsx';
import { CaptionMatchVideo } from './CaptionMatchVideo.jsx';

export const RemotionRoot = () => {
    return (
        <>
            <Composition
                id="SimpleVideo"
                component={SimpleVideo}
                durationInFrames={30 * 30} // 30 seconds at 30fps
                fps={30}
                width={1080}
                height={1920}
            />
            <Composition
                id="CaptionMatchVideo"
                component={CaptionMatchVideo}
                durationInFrames={30 * 30} // 30 seconds at 30fps (will be overridden)
                fps={30}
                width={1080}
                height={1920}
                defaultProps={{
                    text: "Default story text",
                    captions: [],
                    audioUrl: null,
                    settings: {
                        width: 1080,
                        height: 1920,
                        fps: 30,
                        duration: 30
                    }
                }}
            />
        </>
    );
};
