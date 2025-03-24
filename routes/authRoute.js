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
  verifyToken
} from '../lib/auth/session.js';
// If you have createCheckoutSession logic, import it (or remove if not needed)
// import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUserWithTeam } from '../lib/db/queries.js'; // if you have this helper
// ------------------------------------------

const router = express.Router();

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
      const { email, password } = req.body;
  
      // 1. Find the user in your DB:
      const foundUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
  
      if (!foundUser || foundUser.length === 0) {
        return res.status(401).json({ error: "Invalid email or password." });
      }
  
      // 2. Compare passwords:
      const userRecord = foundUser[0]; // or however you access the user
      const validPassword = await comparePasswords(password, userRecord.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid email or password." });
      }
  
      // 3. If valid, pass the actual user object to setSession:
      await setSession(res, userRecord);
      
      // Return success
      return res.json({ success: true, user: { id: userRecord.id, email: userRecord.email } });
    } catch (error) {
      console.error("[signin] error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
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
    const { email, password, inviteId } = req.body;

    // Basic validation checks
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // 1) Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // 2) Hash password
    const passwordHash = await hashPassword(password);

    // 3) Insert user
    const newUserData = {
      email,
      passwordHash,
      role: 'owner' // default role (overridden if there's an invitation)
    };
    const [createdUser] = await db.insert(users).values(newUserData).returning();

    if (!createdUser) {
      return res.status(400).json({ error: 'Failed to create user.' });
    }

    // 4) If inviteId is provided, validate the invitation & link to existing team
    let teamId;
    let userRole;
    let createdTeam;

    if (inviteId) {
      // Check if there's a valid invitation
      const [invitation] = await db
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
        return res.status(400).json({ error: 'Invalid or expired invitation.' });
      }

      teamId = invitation.teamId;
      userRole = invitation.role;

      // Mark invitation as accepted
      await db
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, invitation.id));

      // Log acceptance
      await logActivity(teamId, createdUser.id, ActivityType.ACCEPT_INVITATION, req.ip);

      // Fetch that team if you want
      [createdTeam] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    } else {
      // Otherwise, create a new team
      const [insertedTeam] = await db.insert(teams).values({
        name: `${email}'s Team`
      }).returning();
      if (!insertedTeam) {
        return res.status(400).json({ error: 'Failed to create team.' });
      }
      teamId = insertedTeam.id;
      userRole = 'owner';
      createdTeam = insertedTeam;

      // Log creation
      await logActivity(teamId, createdUser.id, ActivityType.CREATE_TEAM, req.ip);
    }

    // 5) Insert row into teamMembers
    await db.insert(teamMembers).values({
      userId: createdUser.id,
      teamId: teamId,
      role: userRole
    });

    await logActivity(teamId, createdUser.id, ActivityType.SIGN_UP, req.ip);

    // 6) setSession to automatically log them in
    await setSession(createdUser);

    // 7) Return JSON
    return res.json({
      success: true,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role
        // etc.
      },
      // If needed, team: createdTeam
    });
  } catch (error) {
    console.error('[signup] error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
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
    // If you want to log the sign-out, you need the user's ID from the cookie
    const sessionCookie = req.cookies?.session;
    if (sessionCookie) {
      // decode token to get user
      try {
        const decoded = await verifyToken(sessionCookie);
        const userId = decoded?.user?.id;
        if (userId) {
          const userWithTeam = await getUserWithTeam(userId);
          await logActivity(userWithTeam?.teamId, userId, ActivityType.SIGN_OUT, req.ip);
        }
      } catch (err) {
        // no-op if token invalid
      }
    }

    // Now remove the cookie
    // This logic parallels what you do in `signOut` on Next.js:
    // If production, set domain = ".vairality.fun", sameSite = "none", etc.
    res.clearCookie('session', {
      httpOnly: true,
      secure: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: process.env.NODE_ENV === 'production' ? '.vairality.fun' : undefined
    });

    // Alternatively, to forcibly overwrite the cookie with an expired date:
    // res.cookie('session', '', {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: 'none',
    //   domain: '.vairality.fun',
    //   expires: new Date(0),
    // });

    return res.json({ success: true });
  } catch (error) {
    console.error('[signout] error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
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
    const sessionCookie = req.cookies?.session;
    if (!sessionCookie) {
      return res.status(401).json({ error: 'No session cookie found.' });
    }

    // verifyToken from session.js
    const decoded = await verifyToken(sessionCookie); 
    // => { user: { id: ... }, expires: ... }

    // If token is expired or invalid, an error is thrown
    if (!decoded?.user?.id) {
      return res.status(401).json({ error: 'Invalid session.' });
    }

    // Fetch user from DB
    const userId = decoded.user.id;
    const [foundUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!foundUser) {
      return res.status(401).json({ error: 'User not found for this session.' });
    }

    return res.json({
      user: {
        id: foundUser.id,
        email: foundUser.email,
        role: foundUser.role,
        // other fields if needed
      }
    });
  } catch (error) {
    console.error('[session] error:', error);
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
});

export default router;
