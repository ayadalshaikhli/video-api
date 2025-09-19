import { YoutubeTranscript } from 'youtube-transcript-plus';
import { getUser } from '../lib/db/queries.js';

export const YouTubeTranscriptController = async (req, res) => {
  try {
    // Get authenticated user
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: "User not authenticated" 
      });
    }

    // Extract YouTube URL from request body
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: "YouTube URL is required" 
      });
    }

    // Validate YouTube URL format
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
    if (!youtubeRegex.test(url)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid YouTube URL format" 
      });
    }

    // Extract video ID from URL
    let videoId;
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    } else {
      return res.status(400).json({ 
        success: false, 
        error: "Could not extract video ID from URL" 
      });
    }

    console.log(`[YouTube Transcript] User ${user.id} requesting transcript for video: ${videoId}`);

    // Fetch transcript from YouTube
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      console.log(`[YouTube Transcript] No transcript found for video ${videoId}`);
      return res.status(404).json({ 
        success: false, 
        error: "No transcript available for this video. The video may not have captions enabled or may be private." 
      });
    }

    // Format transcript data
    const formattedTranscript = transcript.map(item => ({
      text: item.text,
      start: item.offset,
      duration: item.duration
    }));

    // Combine all text for full transcript
    const fullText = transcript.map(item => item.text).join(' ');

    console.log(`[YouTube Transcript] Successfully retrieved transcript for video ${videoId}, ${transcript.length} segments`);

    return res.json({
      success: true,
      data: {
        videoId,
        url,
        transcript: formattedTranscript,
        fullText,
        segmentCount: transcript.length,
        totalDuration: transcript.reduce((sum, item) => sum + item.duration, 0)
      },
      message: "Transcript retrieved successfully"
    });

  } catch (error) {
    console.error("[YouTube Transcript] Error:", error);
    
    // Handle specific YouTube transcript errors
    if (error.message.includes('Transcript is disabled')) {
      return res.status(404).json({ 
        success: false, 
        error: "Transcript is disabled for this video" 
      });
    }
    
    if (error.message.includes('Video unavailable')) {
      return res.status(404).json({ 
        success: false, 
        error: "Video is unavailable or private" 
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: "Failed to retrieve transcript", 
      details: error.message 
    });
  }
};
