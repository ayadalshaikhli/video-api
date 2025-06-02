import { google } from 'googleapis';
import { oauth2Client } from '../config/google-config.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { refreshAndGetValidToken } from '../utils/tokenManager.js';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Create multer instance with specific field name
const uploadMiddleware = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Accept video files only
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    }
});

// Export the middleware
export const upload = uploadMiddleware.single('videoFile');

export const uploadVideo = async (req, res) => {
    try {
        if (!req.file && (!req.file?.path || !req.body)) {
            const error = { error: 'No video file provided' };
            return res.json ? res.status(400).json(error) : error;
        }

        // Get tokens for the channel with automatic refresh
        const channelId = req.body.channelId || 'UC1SzzlBweueOoIbPMFzgSIA'; // Default channel ID
        
        try {
            const tokens = await refreshAndGetValidToken(channelId);
            oauth2Client.setCredentials(tokens);
        } catch (error) {
            const response = { error: 'Authentication error. Please authenticate again.' };
            return res.json ? res.status(401).json(response) : response;
        }

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        // Verify the channel
        try {
            const channelResponse = await youtube.channels.list({
                part: 'snippet',
                id: channelId
            });
            
            if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
                const response = { error: 'Invalid channel ID' };
                return res.json ? res.status(400).json(response) : response;
            }
        } catch (error) {
            console.error('Channel verification error:', error);
            const response = { error: 'Could not verify channel access' };
            return res.json ? res.status(400).json(response) : response;
        }

        // Prepare video metadata
        const videoMetadata = {
            snippet: {
                title: req.body.title || 'My YouTube Short',
                description: req.body.description || 'Uploaded via API #Shorts',
                tags: ['shorts'],
                categoryId: '22' // People & Blogs category
            },
            status: {
                privacyStatus: req.body.privacy || 'private',
                selfDeclaredMadeForKids: false
            }
        };

        // Get the correct file path
        const filePath = req.file.path;

        // Upload the video
        const response = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: videoMetadata,
            media: {
                body: fs.createReadStream(filePath)
            }
        });

        // Clean up the uploaded file
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting file:', err);
        });

        // Prepare success response
        const successResponse = {
            success: true,
            message: 'Video uploaded successfully',
            videoId: response.data.id,
            videoUrl: `https://youtube.com/watch?v=${response.data.id}`,
            channelId: channelId,
            title: videoMetadata.snippet.title,
            privacy: videoMetadata.status.privacyStatus
        };

        // Return response based on context
        return res.json ? res.json(successResponse) : successResponse;

    } catch (error) {
        console.error('Error uploading to YouTube:', error);
        
        // Clean up the uploaded file in case of error
        if (req.file?.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }

        const errorResponse = {
            success: false,
            error: error.message || 'Failed to upload video to YouTube'
        };

        // Return error response based on context
        return res.json ? res.status(500).json(errorResponse) : errorResponse;
    }
};

