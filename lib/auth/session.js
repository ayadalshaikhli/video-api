import { compare, hash } from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '../db/drizzle.js';
import { users, profiles, clinics, userRoles } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

// Ensure you have an AUTH_SECRET in your .env
const key = new TextEncoder().encode(process.env.AUTH_SECRET);
const SALT_ROUNDS = 10;

/**
 * Hash a plaintext password using bcrypt
 */
export async function hashPassword(password) {
  return hash(password, SALT_ROUNDS);
}

/**
 * Compare a plaintext password to a hashed password
 */
export async function comparePasswords(plainTextPassword, hashedPassword) {
  return compare(plainTextPassword, hashedPassword);
}

/**
 * Sign a JWT with a 1-day expiration by default
 */
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1 day')
    .sign(key);
}

/**
 * Verify a token and return its payload
 */
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['HS256'],
  });
  return payload;
}

/**
 * Get the session from the "session" cookie in an Express request
 * - If no cookie or invalid token, returns null
 * - Fetches complete user and clinic data from database
 */
export async function getSession(req) {
  const sessionCookie = req.cookies?.session;
  if (!sessionCookie) return null;

  try {
    const decoded = await verifyToken(sessionCookie);
    
    // Check if token is expired
    if (decoded.expires && new Date() > new Date(decoded.expires)) {
      return null;
    }

    if (!decoded?.user?.id) {
      return null;
    }

    // Fetch user with profile and clinic from DB
    const userId = decoded.user.id;
    
    // Get user with profile
    const [userWithProfile] = await db
      .select({
        user: users,
        profile: profiles
      })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.id))
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!userWithProfile) {
      return null;
    }

    // Get user's clinic and role (include both active and pending users)
    console.log('[session] Fetching clinic and role data for user:', userId);
    
    // First try to find any userRole for this user
    let [userRole] = await db
      .select({
        role: userRoles.role,
        status: userRoles.status,
        isActive: userRoles.isActive,
        clinic: clinics
      })
      .from(userRoles)
      .leftJoin(clinics, eq(userRoles.clinicId, clinics.id))
      .where(eq(userRoles.userId, userId))
      .limit(1);
    
    // If not found, try specifically for pending status
    if (!userRole) {
      console.log('[session] No userRole found in initial query, trying pending status specifically');
      [userRole] = await db
        .select({
          role: userRoles.role,
          status: userRoles.status,
          isActive: userRoles.isActive,
          clinic: clinics
        })
        .from(userRoles)
        .leftJoin(clinics, eq(userRoles.clinicId, clinics.id))
        .where(and(
          eq(userRoles.userId, userId),
          eq(userRoles.status, 'pending')
        ))
        .limit(1);
      
      if (userRole) {
        console.log('[session] Found userRole with pending status:', userRole);
      }
    }
    
    console.log('[session] User role query result:', userRole ? 'FOUND' : 'NOT FOUND');
    if (userRole) {
      console.log('[session] User role data:', {
        role: userRole.role,
        status: userRole.status,
        isActive: userRole.isActive,
        clinicId: userRole.clinic?.id
      });
    }

    const sessionData = {
      user: {
        id: userWithProfile.user.id,
        email: userWithProfile.user.email,
        firstName: userWithProfile.profile?.firstName,
        lastName: userWithProfile.profile?.lastName,
        phone: userWithProfile.profile?.phone,
        status: userRole?.status || 'active',
        isActive: userRole?.isActive ?? false
      }
    };

    // Add clinic data if user has one
    if (userRole?.clinic) {
      sessionData.clinic = {
        id: userRole.clinic.id,
        name: userRole.clinic.name,
        address: userRole.clinic.address,
        phone: userRole.clinic.phone,
        email: userRole.clinic.email
      };
      sessionData.userRole = {
        role: userRole.role
      };
    }

    // If no userRole found at all, this user might not have been properly set up
    if (!userRole) {
      console.log('[session] No userRole found at all for user:', userId);
    }

    console.log('[session] Final session data:', JSON.stringify(sessionData, null, 2));
    return sessionData;
  } catch (error) {
    // Token invalid or expired
    return null;
  }
}

/**
 * Set the "session" cookie with a JWT that expires in 1 day
 * - Accepts the Express "res" object so we can set cookies
 */
export async function setSession(res, user) {
  // Customize if you want domain, secure, sameSite, etc. based on environment
  const isProduction = process.env.NODE_ENV === 'production';
  const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Data to store in token
  const sessionPayload = {
    user: { id: user.id },
    expires: expiresInOneDay.toISOString(),
  };

  // Sign the token
  const encryptedSession = await signToken(sessionPayload);

  // Set cookie options
  res.cookie('session', encryptedSession, {
    expires: expiresInOneDay,
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    // domain: isProduction ? '.yourdomain.com' : undefined,
  });
}

/**
 * Clear the "session" cookie (e.g. sign out)
 */
export function clearSession(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Clear with both path variations to ensure complete removal
  res.clearCookie('session', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    // domain: isProduction ? '.yourdomain.com' : undefined,
  });
  
  // Also set an expired session cookie to ensure clearing
  res.cookie('session', '', {
    expires: new Date(0),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });
  
  console.log('[Session] Session cookie cleared successfully');
}
