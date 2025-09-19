import { VideoComposition } from './VideoComposition';

// Test the VideoComposition component with the exact data structure from the controller
const testProps = {
  data: {
    id: 38,
    segments: [
      {
        id: 81,
        compositionId: 38,
        text: 'A boy named Sam found a small injured bird in his backyard',
        start: '0.000',
        end: '3.000',
        mediaUrl: 'https://pub-f93ffe1bab59435da02607366eaa96f5.r2.dev/images/6b8a1e665e78b24cc3103e78461eb680.jpg',
        animation: 'fade'
      }
    ],
    captions: [
      {
        id: 81,
        compositionId: 38,
        text: 'A boy named Sam found a small injured bird in his backyard',
        startMs: 0,
        endMs: 2900
      }
    ],
    musicUrl: 'https://pub-f93ffe1bab59435da02607366eaa96f5.r2.dev/audio/077e718bfe43387b1e43721dc5ace37e.mp3',
    script: 'A boy named Sam found a small injured bird in his backyard.'
  },
  customizations: {
    captionStyle: 'default',
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
};

console.log('Testing VideoComposition component...');
console.log('Props structure:', testProps);

// This would simulate what the component receives
const result = VideoComposition(testProps);
console.log('Component result:', result);
