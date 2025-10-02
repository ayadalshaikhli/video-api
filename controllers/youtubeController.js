import { google } from 'googleapis';
import { db } from '../lib/db/drizzle.js';
import { socialChannels, socialChannelTokens } from '../lib/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { verifyToken } from '../lib/auth/session.js';
import crypto from 'crypto';

// YouTube OAuth configuration
const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REDIRECT_URI = process.env.YT_REDIRECT_URI;
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || 'default-key-change-in-production';

// Encryption/Decryption helpers
function encrypt(text) {
    const cipher = crypto.createCipher('aes-256-cbc', TOKEN_ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(encryptedText) {
    const decipher = crypto.createDecipher('aes-256-cbc', TOKEN_ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Get user from request
async function getUserFromRequest(req) {
    const sessionCookie = req.cookies.session;
    if (!sessionCookie) {
        throw new Error('No session cookie');
    }
    
    const payload = await verifyToken(sessionCookie);
    return payload?.user;
}

// Initialize OAuth2 client
function getOAuth2Client() {
    return new google.auth.OAuth2(
        YT_CLIENT_ID,
        YT_CLIENT_SECRET,
        YT_REDIRECT_URI
    );
}

// Start YouTube OAuth flow
export async function connectYouTubeController(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const oauth2Client = getOAuth2Client();
        
        // Generate state parameter for security
        const state = crypto.randomBytes(32).toString('hex');
        
        // Store state in session or database for verification
        req.session = req.session || {};
        req.session.youtubeState = state;
        req.session.youtubeUserId = user.id;

        const scopes = [
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube.readonly'
        ];

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: state,
            prompt: 'consent' // Force consent to get refresh token
        });

        res.json({ authUrl });
    } catch (error) {
        console.error('YouTube connect error:', error);
        res.status(500).json({ error: 'Failed to initiate YouTube connection' });
    }
}

// Handle YouTube OAuth callback
export async function youtubeCallbackController(req, res) {
    try {
        const { code, state } = req.query;
        
        if (!code || !state) {
            return res.status(400).json({ error: 'Missing authorization code or state' });
        }

        // Verify state parameter
        if (req.session?.youtubeState !== state) {
            return res.status(400).json({ error: 'Invalid state parameter' });
        }

        const userId = req.session.youtubeUserId;
        if (!userId) {
            return res.status(400).json({ error: 'No user session found' });
        }

        const oauth2Client = getOAuth2Client();
        
        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get channel information
        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        const channelResponse = await youtube.channels.list({
            part: 'snippet,contentDetails',
            mine: true
        });

        if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
            return res.status(400).json({ error: 'No YouTube channel found' });
        }

        const channel = channelResponse.data.items[0];
        const channelId = channel.id;
        const channelName = channel.snippet.title;
        const channelUrl = `https://www.youtube.com/channel/${channelId}`;
        const profileImageUrl = channel.snippet.thumbnails?.default?.url;

        // Check if channel already exists
        const existingChannel = await db.select()
            .from(socialChannels)
            .where(and(
                eq(socialChannels.platform, 'youtube'),
                eq(socialChannels.channelId, channelId)
            ))
            .limit(1);

        let channelRecord;
        if (existingChannel.length > 0) {
            // Update existing channel
            channelRecord = existingChannel[0];
            await db.update(socialChannels)
                .set({
                    channelName,
                    channelUrl,
                    profileImageUrl,
                    isActive: true,
                    updatedAt: new Date()
                })
                .where(eq(socialChannels.id, channelRecord.id));
        } else {
            // Create new channel record
            const newChannel = await db.insert(socialChannels).values({
                teamId: user.teamId || user.id, // Use teamId if available, fallback to userId
                platform: 'youtube',
                channelName,
                channelId,
                channelUrl,
                profileImageUrl,
                isActive: true,
                connectedAt: new Date()
            }).returning();
            channelRecord = newChannel[0];
        }

        // Store/update tokens
        const encryptedAccessToken = encrypt(tokens.access_token);
        const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
        
        const tokenExpiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

        // Check if tokens already exist
        const existingTokens = await db.select()
            .from(socialChannelTokens)
            .where(eq(socialChannelTokens.channelId, channelRecord.id))
            .limit(1);

        if (existingTokens.length > 0) {
            // Update existing tokens
            await db.update(socialChannelTokens)
                .set({
                    accessToken: encryptedAccessToken,
                    refreshToken: encryptedRefreshToken,
                    tokenExpiresAt,
                    scopes: tokens.scope ? tokens.scope.split(' ') : [],
                    updatedAt: new Date()
                })
                .where(eq(socialChannelTokens.channelId, channelRecord.id));
        } else {
            // Insert new tokens
            await db.insert(socialChannelTokens).values({
                channelId: channelRecord.id,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                tokenExpiresAt,
                scopes: tokens.scope ? tokens.scope.split(' ') : []
            });
        }

        // Clear session data
        delete req.session.youtubeState;
        delete req.session.youtubeUserId;

        // Redirect to frontend with success
        res.redirect(`${APP_BASE_URL}/dashboard/channels?youtube=connected`);
    } catch (error) {
        console.error('YouTube callback error:', error);
        res.redirect(`${APP_BASE_URL}/dashboard/channels?youtube=error`);
    }
}

// Upload video to YouTube
export async function uploadToYouTubeController(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { 
            videoUrl, 
            title, 
            description, 
            tags = [], 
            privacy = 'private',
            thumbnailUrl 
        } = req.body;

        if (!videoUrl || !title) {
            return res.status(400).json({ error: 'Video URL and title are required' });
        }

        // Get user's YouTube channel
        const channel = await db.select()
            .from(socialChannels)
            .where(and(
                eq(socialChannels.platform, 'youtube'),
                eq(socialChannels.teamId, user.teamId || user.id),
                eq(socialChannels.isActive, true)
            ))
            .limit(1);

        if (channel.length === 0) {
            return res.status(400).json({ error: 'No YouTube channel connected' });
        }

        // Get tokens
        const tokens = await db.select()
            .from(socialChannelTokens)
            .where(eq(socialChannelTokens.channelId, channel[0].id))
            .limit(1);

        if (tokens.length === 0) {
            return res.status(400).json({ error: 'No YouTube tokens found' });
        }

        const decryptedAccessToken = decrypt(tokens[0].accessToken);
        const decryptedRefreshToken = tokens[0].refreshToken ? decrypt(tokens[0].refreshToken) : null;

        // Set up OAuth2 client
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({
            access_token: decryptedAccessToken,
            refresh_token: decryptedRefreshToken
        });

        // Download video file
        const response = await fetch(videoUrl);
        if (!response.ok) {
            throw new Error('Failed to download video');
        }
        const videoBuffer = await response.buffer();

        // Upload to YouTube
        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        
        const uploadResponse = await youtube.videos.insert({
            part: 'snippet,status',
            requestBody: {
                snippet: {
                    title,
                    description,
                    tags,
                    categoryId: '22' // People & Blogs category
                },
                status: {
                    privacyStatus: privacy, // 'private', 'public', 'unlisted'
                    selfDeclaredMadeForKids: false
                }
            },
            media: {
                body: videoBuffer
            }
        });

        // If thumbnail is provided, upload it
        if (thumbnailUrl && uploadResponse.data.id) {
            try {
                const thumbnailResponse = await fetch(thumbnailUrl);
                if (thumbnailResponse.ok) {
                    const thumbnailBuffer = await thumbnailResponse.buffer();
                    await youtube.thumbnails.set({
                        videoId: uploadResponse.data.id,
                        media: {
                            body: thumbnailBuffer
                        }
                    });
                }
            } catch (thumbnailError) {
                console.warn('Failed to upload thumbnail:', thumbnailError);
            }
        }

        // Store upload record
        await db.insert(socialPosts).values({
            channelId: channel[0].id,
            content: title,
            mediaUrls: [videoUrl],
            status: 'published',
            platformPostId: uploadResponse.data.id,
            publishedAt: new Date()
        });

        res.json({ 
            success: true, 
            videoId: uploadResponse.data.id,
            videoUrl: `https://www.youtube.com/watch?v=${uploadResponse.data.id}`
        });
    } catch (error) {
        console.error('YouTube upload error:', error);
        res.status(500).json({ error: 'Failed to upload video to YouTube' });
    }
}

// Get connected YouTube channels
export async function getYouTubeChannelsController(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const channels = await db.select()
            .from(socialChannels)
            .where(and(
                eq(socialChannels.platform, 'youtube'),
                eq(socialChannels.teamId, user.teamId || user.id),
                eq(socialChannels.isActive, true)
            ));

        res.json({ channels });
    } catch (error) {
        console.error('Get YouTube channels error:', error);
        res.status(500).json({ error: 'Failed to get YouTube channels' });
    }
}

// Disconnect YouTube channel
export async function disconnectYouTubeController(req, res) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { channelId } = req.params;

        // Verify channel belongs to user
        const channel = await db.select()
            .from(socialChannels)
            .where(and(
                eq(socialChannels.id, channelId),
                eq(socialChannels.teamId, user.teamId || user.id),
                eq(socialChannels.platform, 'youtube')
            ))
            .limit(1);

        if (channel.length === 0) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        // Deactivate channel and delete tokens
        await db.update(socialChannels)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(socialChannels.id, channelId));

        await db.delete(socialChannelTokens)
            .where(eq(socialChannelTokens.channelId, channelId));

        res.json({ success: true });
    } catch (error) {
        console.error('Disconnect YouTube error:', error);
        res.status(500).json({ error: 'Failed to disconnect YouTube channel' });
    }
}
