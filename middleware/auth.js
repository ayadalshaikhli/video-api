import { getSession } from '../lib/auth/session.js';

/**
 * Authentication middleware - verifies user is logged in
 * Attaches user, userRole, and userClinic to req object
 * Use this for all routes - clinic ID will come from req.userClinic.id
 */
export const requireAuth = async (req, res, next) => {
    try {
        console.log(`[Auth Middleware] Checking authentication for ${req.method} ${req.originalUrl}`);
        
        const session = await getSession(req);
        if (!session || !session.user) {
            console.log('[Auth Middleware] No valid session found');
            return res.status(401).json({ 
                error: 'Authentication required. Please log in.',
                code: 'NO_AUTH'
            });
        }

        // Attach session data to request
        req.user = session.user;
        req.userRole = session.userRole;
        req.userClinic = session.clinic;
        
        console.log(`[Auth Middleware] User ${session.user.id} authenticated successfully`);
        console.log(`[Auth Middleware] User clinic: ${session.clinic?.id || 'none'}`);
        
        next();
    } catch (error) {
        console.error('[Auth Middleware] Authentication error:', error);
        return res.status(401).json({ 
            error: 'Authentication failed',
            code: 'AUTH_ERROR'
        });
    }
};

export default {
    requireAuth
}; 