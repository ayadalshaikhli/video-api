import { oauth2Client } from '../config/google-config.js';
import { getTokens, updateTokens } from '../controllers/AuthController.js';

export async function refreshAndGetValidToken(channelId) {
    try {
        // Get current tokens
        let tokens = await getTokens(channelId);
        if (!tokens) {
            throw new Error('No tokens found for this channel');
        }

        // Check if token is expired or will expire soon (within 5 minutes)
        const expiryDate = new Date(tokens.expiry_date);
        const now = new Date();
        const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

        if (expiryDate.getTime() - now.getTime() <= fiveMinutes) {
            console.log('Token expired or expiring soon, refreshing...');
            
            // Set the current tokens to get a refresh
            oauth2Client.setCredentials({
                refresh_token: tokens.refresh_token,
                access_token: tokens.access_token,
                expiry_date: tokens.expiry_date
            });

            // Get new tokens
            const { credentials } = await oauth2Client.refreshAccessToken();
            
            // Update tokens in database
            await updateTokens(channelId, {
                access_token: credentials.access_token,
                refresh_token: credentials.refresh_token || tokens.refresh_token, // Keep old refresh token if new one isn't provided
                expiry_date: credentials.expiry_date
            });

            // Return new tokens
            return credentials;
        }

        return tokens;
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
} 