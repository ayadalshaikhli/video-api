import { oauth2Client, SCOPES } from '../config/google-config.js';
import { google } from 'googleapis';
import { db } from '../lib/db/drizzle.js';
import { youtubeTokens } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';

export const getAuthURL = (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
    res.json({ authUrl });
};

export const handleCallback = async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get channel information
        const youtube = google.youtube('v3');
        const response = await youtube.channels.list({
            auth: oauth2Client,
            part: 'snippet',
            mine: true
        });

        const channels = response.data.items;

        // Store tokens in database
        for (const channel of channels) {
            await db
                .insert(youtubeTokens)
                .values({
                    channelId: channel.id,
                    channelTitle: channel.snippet.title,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token,
                    tokenType: tokens.token_type,
                    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                    scope: tokens.scope
                })
                .onConflictDoUpdate({
                    target: [youtubeTokens.channelId],
                    set: {
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token,
                        tokenType: tokens.token_type,
                        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                        scope: tokens.scope,
                        updatedAt: new Date()
                    }
                });
        }

        // Send HTML response with success message
        res.send(`
            <html>
                <head>
                    <title>Authentication Success</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
                        .success { color: #4CAF50; }
                        .container { max-width: 600px; margin: 0 auto; }
                        .button {
                            display: inline-block;
                            background: #4CAF50;
                            color: white;
                            padding: 10px 20px;
                            text-decoration: none;
                            border-radius: 4px;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1 class="success">✓ Authentication Successful!</h1>
                        <h2>Available Channels:</h2>
                        <ul style="list-style: none; padding: 0;">
                            ${channels.map(channel => `
                                <li style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;">
                                    ${channel.snippet.title} (ID: ${channel.id})
                                </li>
                            `).join('')}
                        </ul>
                        <p>You can now upload videos to your channel.</p>
                        <a href="/upload.html" class="button">Go to Upload Page</a>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).send(`
            <html>
                <head>
                    <title>Authentication Error</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
                        .error { color: #f44336; }
                    </style>
                </head>
                <body>
                    <h1 class="error">Authentication Error</h1>
                    <p>${error.message}</p>
                </body>
            </html>
        `);
    }
};

export const refreshTokenIfNeeded = async (channelId) => {
    try {
        // Get current tokens from database
        const result = await db
            .select()
            .from(youtubeTokens)
            .where(eq(youtubeTokens.channelId, channelId))
            .limit(1);

        if (result.length === 0) {
            throw new Error('No tokens found for this channel');
        }

        const tokenData = result[0];
        
        // Check if token needs refresh (5 minutes buffer before expiry)
        const expiryDate = tokenData.expiryDate?.getTime() || 0;
        const fiveMinutes = 5 * 60 * 1000;
        const now = Date.now();

        if (expiryDate - now <= fiveMinutes) {
            console.log('Token expired or expiring soon, refreshing...');
            
            // Set the current credentials to use for refresh
            oauth2Client.setCredentials({
                refresh_token: tokenData.refreshToken,
                access_token: tokenData.accessToken,
                expiry_date: expiryDate
            });

            // Refresh the token
            const { credentials } = await oauth2Client.refreshAccessToken();
            
            // Update the database with new tokens
            await db
                .update(youtubeTokens)
                .set({
                    accessToken: credentials.access_token,
                    refreshToken: credentials.refresh_token || tokenData.refreshToken, // Keep old refresh token if new one not provided
                    tokenType: credentials.token_type,
                    expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
                    scope: credentials.scope,
                    updatedAt: new Date()
                })
                .where(eq(youtubeTokens.channelId, channelId));

            return credentials;
        }

        // Token is still valid, return current tokens
        return {
            access_token: tokenData.accessToken,
            refresh_token: tokenData.refreshToken,
            token_type: tokenData.tokenType,
            expiry_date: expiryDate,
            scope: tokenData.scope
        };
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
};

// Modify getTokens to use the refresh logic
export const getTokens = async (channelId) => {
    try {
        return await refreshTokenIfNeeded(channelId);
    } catch (error) {
        console.error('Error getting/refreshing tokens:', error);
        return null;
    }
};

export const listChannels = async (req, res) => {
    try {
        const channels = await db
            .select({
                id: youtubeTokens.channelId,
                title: youtubeTokens.channelTitle
            })
            .from(youtubeTokens);

        res.json({ channels });
    } catch (error) {
        console.error('Error listing channels:', error);
        res.status(500).json({ error: 'Failed to list channels' });
    }
};

export const setActiveChannel = async (channelId) => {
    const tokens = await getTokens(channelId);
    if (tokens) {
        oauth2Client.setCredentials(tokens);
        return true;
    }
    return false;
};

export const updateTokens = async (channelId, tokens) => {
    try {
        // Update the tokens in your database
        const query = `
            UPDATE youtube_auth_tokens 
            SET 
                access_token = ?,
                refresh_token = ?,
                expiry_date = ?
            WHERE channel_id = ?
        `;
        
        const values = [
            tokens.access_token,
            tokens.refresh_token,
            new Date(tokens.expiry_date).toISOString(),
            channelId
        ];

        // Execute the query using your database connection
        // Replace this with your actual database connection code
        const result = await db.query(query, values);
        
        return result;
    } catch (error) {
        console.error('Error updating tokens:', error);
        throw error;
    }
}; 