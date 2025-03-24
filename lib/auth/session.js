import { compare, hash } from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';

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
 */
export async function getSession(req) {
  const sessionCookie = req.cookies?.session;
  if (!sessionCookie) return null;

  try {
    const sessionPayload = await verifyToken(sessionCookie);
    return sessionPayload; // e.g. { user: { id: ... }, expires: ... }
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
  res.clearCookie('session', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    // domain: isProduction ? '.yourdomain.com' : undefined,
  });
}
