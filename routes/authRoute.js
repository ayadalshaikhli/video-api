// File: routes/authRoutes.js
import express from 'express';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';

// ----- Import from your existing code -----
import { db } from '../lib/db/drizzle.js'; // or wherever your drizzle instance is
import {
  users,
  teams,
  teamMembers,
  invitations,
  activityLogs,
  ActivityType
} from '../lib/db/schema.js';
import {
  hashPassword,
  comparePasswords,
  setSession,
  verifyToken,
  clearSession
} from '../lib/auth/session.js';
// If you have createCheckoutSession logic, import it (or remove if not needed)
// import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUserWithTeam } from '../lib/db/queries.js'; // if you have this helper
import { getAuthURL, handleCallback, listChannels } from "../controllers/AuthController.js";
// ------------------------------------------

const router = express.Router();

// Add validation schemas
const signInSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  inviteId: z.string().optional(),
});

/** 
 * Helper to log an activity if you want the same logic 
 * from your Next.js code 
 */
async function logActivity(teamId, userId, type, ipAddress) {
  if (!teamId) return;
  await db.insert(activityLogs).values({
    teamId,
    userId,
    action: type,
    ipAddress: ipAddress || ''
  });
}

// Custom error handler
const handleError = (error, res) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    });
  }
  
  if (error.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({ error: 'Email already exists' });
  }
  
  console.error('[Auth Error]:', error);
  return res.status(500).json({ error: 'Internal server error' });
};

/** 
 * signIn
 * Replicates the logic from your Next.js `signIn` validated action:
 *  1) Find user by email
 *  2) Compare password
 *  3) setSession (writes a JWT cookie)
 *  4) logActivity
 *  5) Return { success: true, user: { ... } } or { error: "..."} 
 */
router.post("/signin", async (req, res) => {
  try {
    // Validate request body
    const validatedData = signInSchema.parse(req.body);
    console.log("signin route hit")
    console.log(validatedData, "validatedData") 
    const { email, password } = validatedData;

    console.log('[signin] Attempting signin for email:', email);
    console.log('[signin] Password provided:', password ? 'YES' : 'NO');
    console.log('[signin] Password length:', password?.length || 0);

    // 1. Find the user in your DB:
    const foundUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    console.log('[signin] Users found in DB:', foundUser.length);
    
    if (!foundUser || foundUser.length === 0) {
      console.log('[signin] No user found with email:', email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 2. Compare passwords:
    const userRecord = foundUser[0];
    console.log('[signin] User found with ID:', userRecord.id);
    console.log('[signin] User email from DB:', userRecord.email);
    console.log('[signin] User has password hash:', userRecord.passwordHash ? 'YES' : 'NO');
    
    const validPassword = await comparePasswords(password, userRecord.passwordHash);
    console.log('[signin] Password comparison result:', validPassword);
    
    if (!validPassword) {
      console.log('[signin] Password comparison failed for user:', userRecord.email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3. Set session
    console.log('[signin] Setting session for user:', userRecord.email);
    await setSession(res, userRecord);
    
    console.log('[signin] Signin successful for user:', userRecord.email);
    
    // Return success with minimal user data
    return res.json({
      success: true,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        role: userRecord.role
      }
    });
  } catch (error) {
    console.error('[signin] Error during signin:', error);
    return handleError(error, res);
  }
});

/**
 * signUp
 * Replicates the Next.js signUp logic:
 *  1) Check if user exists
 *  2) Hash password
 *  3) Insert user
 *  4) If inviteId, link them to a team, otherwise create new team
 *  5) Insert teamMembers, log activity
 *  6) setSession
 *  7) Return JSON 
 */
router.post('/signup', async (req, res) => {
  try {
    // Validate request body
    const validatedData = signUpSchema.parse(req.body);
    const { email, password, inviteId } = validatedData;

    // Start a transaction
    const result = await db.transaction(async (trx) => {
      // Check existing user
      const existingUser = await trx
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new Error('USER_EXISTS');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const [createdUser] = await trx
        .insert(users)
        .values({
          email,
          passwordHash,
          role: 'owner'
        })
        .returning();

      if (!createdUser) {
        throw new Error('FAILED_TO_CREATE_USER');
      }

      let teamId;
      let userRole;
      let createdTeam;

      if (inviteId) {
        // Handle invitation logic
        const [invitation] = await trx
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.id, parseInt(inviteId, 10)),
              eq(invitations.email, email),
              eq(invitations.status, 'pending')
            )
          )
          .limit(1);

        if (!invitation) {
          throw new Error('INVALID_INVITATION');
        }

        teamId = invitation.teamId;
        userRole = invitation.role;

        await trx
          .update(invitations)
          .set({ status: 'accepted' })
          .where(eq(invitations.id, invitation.id));

        [createdTeam] = await trx
          .select()
          .from(teams)
          .where(eq(teams.id, teamId))
          .limit(1);
      } else {
        // Create new team
        [createdTeam] = await trx
          .insert(teams)
          .values({
            name: `${email}'s Team`
          })
          .returning();

        if (!createdTeam) {
          throw new Error('FAILED_TO_CREATE_TEAM');
        }

        teamId = createdTeam.id;
        userRole = 'owner';
      }

      // Create team member
      await trx.insert(teamMembers).values({
        userId: createdUser.id,
        teamId: teamId,
        role: userRole
      });

      return { createdUser, createdTeam };
    });

    // Set session after successful transaction
    await setSession(res, result.createdUser);

    // Log activity outside transaction
    await logActivity(
      result.createdTeam.id,
      result.createdUser.id,
      inviteId ? ActivityType.ACCEPT_INVITATION : ActivityType.SIGN_UP,
      req.ip
    );

    return res.json({
      success: true,
      user: {
        id: result.createdUser.id,
        email: result.createdUser.email,
        role: result.createdUser.role
      },
      team: {
        id: result.createdTeam.id,
        name: result.createdTeam.name
      }
    });
  } catch (error) {
    // Handle specific error cases
    if (error.message === 'USER_EXISTS') {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }
    if (error.message === 'INVALID_INVITATION') {
      return res.status(400).json({ error: 'Invalid or expired invitation.' });
    }
    if (error.message === 'FAILED_TO_CREATE_USER') {
      return res.status(400).json({ error: 'Failed to create user.' });
    }
    if (error.message === 'FAILED_TO_CREATE_TEAM') {
      return res.status(400).json({ error: 'Failed to create team.' });
    }
    
    return handleError(error, res);
  }
});

/**
 * signOut
 *  - Clear the cookie so the session is invalid
 *  - Log sign-out activity if desired
 *  - Return success
 */
router.post('/signout', async (req, res) => {
  try {
    console.log('[signout] Processing signout request');
    
    // If you want to log the sign-out, you need the user's ID from the cookie
    const sessionCookie = req.cookies?.session;
    console.log('[signout] Session cookie exists:', !!sessionCookie);
    
    if (sessionCookie) {
      // decode token to get user
      try {
        const decoded = await verifyToken(sessionCookie);
        const userId = decoded?.user?.id;
        console.log('[signout] User ID from token:', userId);
        
        if (userId) {
          const userWithTeam = await getUserWithTeam(userId);
          await logActivity(userWithTeam?.teamId, userId, ActivityType.SIGN_OUT, req.ip);
          console.log('[signout] Activity logged for user:', userId);
        }
      } catch (err) {
        console.log('[signout] Token verification failed (expected if already expired):', err.message);
        // no-op if token invalid - this is expected for expired tokens
      }
    }

    // Use the proper clearSession function to ensure cookie is cleared with matching options
    clearSession(res);
    console.log('[signout] Session cookie cleared');

    return res.json({ success: true });
  } catch (error) {
    console.error('[signout] error:', error);
    // Even if there's an error, we should still clear the session
    clearSession(res);
    return res.json({ success: true }); // Don't fail signout due to logging errors
  }
});

/**
 * session
 *  - Check if there's a valid 'session' cookie
 *  - If valid, fetch user from DB, return user
 *  - Otherwise, return 401
 */
router.get('/session', async (req, res) => {
  try {
    console.log('[session] Checking session...');
    
    const sessionCookie = req.cookies?.session;
    console.log('[session] Session cookie exists:', !!sessionCookie);
    
    if (!sessionCookie) {
      console.log('[session] No session cookie found');
      return res.status(401).json({ error: 'No session cookie found.' });
    }

    // verifyToken from session.js
    const decoded = await verifyToken(sessionCookie); 
    // => { user: { id: ... }, expires: ... }
    console.log('[session] Token decoded successfully, user ID:', decoded?.user?.id);

    // Check if token is expired
    if (decoded.expires && new Date() > new Date(decoded.expires)) {
      console.log('[session] Token has expired');
      return res.status(401).json({ error: 'Session expired.' });
    }

    // If token is expired or invalid, an error is thrown
    if (!decoded?.user?.id) {
      console.log('[session] Invalid token payload');
      return res.status(401).json({ error: 'Invalid session.' });
    }

    // Fetch user from DB
    const userId = decoded.user.id;
    const [foundUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!foundUser) {
      console.log('[session] User not found in database for ID:', userId);
      return res.status(401).json({ error: 'User not found for this session.' });
    }

    console.log('[session] Session valid for user:', foundUser.email);
    return res.json({
      user: {
        id: foundUser.id,
        email: foundUser.email,
        role: foundUser.role,
        // other fields if needed
      }
    });
  } catch (error) {
    console.error('[session] Session validation error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
});

// Get authentication URL
router.get("/youtube/auth", getAuthURL);

// Handle OAuth2 callback
router.get("/youtube/callback", handleCallback);

// List authenticated channels
router.get("/youtube/channels", listChannels);

export default router;
