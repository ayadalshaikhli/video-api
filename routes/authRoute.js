// File: routes/authRoutes.js
import express from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

// ----- Import from your existing code -----
import { db } from '../lib/db/drizzle.js';
import { users, profiles, clinics, userRoles } from '../lib/db/schema.js';
import {
  hashPassword,
  comparePasswords,
  setSession,
  verifyToken,
  clearSession
} from '../lib/auth/session.js';
import { getUser } from '../lib/db/queries.js';
import {
    register,
    login,
    logout,
    getMe,
    updateProfile,
    changePassword
} from '../controllers/AuthController.js';
import { setupDefaultClinicData } from '../lib/db/clinicSetup.js';
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
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  // Clinic information
  clinicName: z.string().min(1, 'Clinic name is required'),
  clinicAddress: z.string().optional(),
  clinicPhone: z.string().optional(),
  clinicEmail: z.string().email().optional(),
  clinicWebsite: z.string().optional(),
  clinicDescription: z.string().optional(),
  role: z.enum(['admin', 'doctor']).default('doctor'),
});

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
 * Simple authentication for medical clinic users
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
    
    // 4. Get complete user data with profile and clinic (like session route does)
    const [userWithProfile] = await db
      .select({
        user: users,
        profile: profiles
      })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.id))
      .where(eq(users.id, userRecord.id))
      .limit(1);

    // Get user's clinic and role (include both active and pending users)
    const [userRole] = await db
      .select({
        role: userRoles.role,
        status: userRoles.status,
        isActive: userRoles.isActive,
        clinic: clinics
      })
      .from(userRoles)
      .leftJoin(clinics, eq(userRoles.clinicId, clinics.id))
      .where(eq(userRoles.userId, userRecord.id))
      .limit(1);

    console.log('[signin] User role query result:', userRole ? 'FOUND' : 'NOT FOUND');
    if (userRole) {
      console.log('[signin] User role data:', {
        role: userRole.role,
        status: userRole.status,
        isActive: userRole.isActive,
        clinicId: userRole.clinic?.id
      });
    }

    const responseData = {
      success: true,
      user: {
        id: userWithProfile.user.id,
        email: userWithProfile.user.email,
        firstName: userWithProfile.profile?.firstName,
        lastName: userWithProfile.profile?.lastName,
        phone: userWithProfile.profile?.phone,
        status: userRole?.status || 'active'
      }
    };

    // Add clinic data if user has one
    if (userRole?.clinic) {
      responseData.clinic = {
        id: userRole.clinic.id,
        name: userRole.clinic.name,
        address: userRole.clinic.address,
        phone: userRole.clinic.phone,
        email: userRole.clinic.email
      };
      responseData.userRole = {
        role: userRole.role
      };
    }

    // If no userRole found, check if this is a pending user who signed up via invitation
    if (!userRole) {
      console.log('[signin] No userRole found, checking if user has pending status in userRoles table');
      
      // Check if there's a userRole record with pending status for this user
      const pendingUserRole = await db
        .select({
          role: userRoles.role,
          status: userRoles.status,
          isActive: userRoles.isActive,
          clinic: clinics
        })
        .from(userRoles)
        .leftJoin(clinics, eq(userRoles.clinicId, clinics.id))
        .where(and(
          eq(userRoles.userId, userRecord.id),
          eq(userRoles.status, 'pending')
        ))
        .limit(1);
      
      if (pendingUserRole.length > 0) {
        console.log('[signin] Found pending userRole:', pendingUserRole[0]);
        responseData.user.status = 'pending';
        
        if (pendingUserRole[0].clinic) {
          responseData.clinic = {
            id: pendingUserRole[0].clinic.id,
            name: pendingUserRole[0].clinic.name,
            address: pendingUserRole[0].clinic.address,
            phone: pendingUserRole[0].clinic.phone,
            email: pendingUserRole[0].clinic.email
          };
          responseData.userRole = {
            role: pendingUserRole[0].role
          };
        }
      }
    }

    console.log('[signin] Signin successful for user:', userRecord.email);
    console.log('[signin] Returning complete user data with clinic info');
    
    return res.json(responseData);
  } catch (error) {
    console.error('[signin] Error during signin:', error);
    return handleError(error, res);
  }
});

/**
 * signUp
 * Registration for medical clinic doctors/admins with clinic creation
 */
router.post('/signup', async (req, res) => {    
  try {
    // Validate request body
    const validatedData = signUpSchema.parse(req.body);
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      phone,
      clinicName,
      clinicAddress,
      clinicPhone,
      clinicEmail,
      clinicWebsite,
      clinicDescription,
      role
    } = validatedData;

    // Start a transaction to ensure data consistency
    const result = await db.transaction(async (trx) => {
      // 1. Check if user already exists
      const existingUser = await trx
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new Error('USER_EXISTS');
      }

      // 2. Hash password
      const passwordHash = await hashPassword(password);

      // 3. Create user
      const [createdUser] = await trx
        .insert(users)
        .values({
          email,
          passwordHash
        })
        .returning();

      if (!createdUser) {
        throw new Error('FAILED_TO_CREATE_USER');
      }

      // 4. Create profile
      const [createdProfile] = await trx
        .insert(profiles)
        .values({
          id: createdUser.id,
          email,
          firstName,
          lastName,
          phone: phone || null
        })
        .returning();

      // 5. Create clinic
      const [createdClinic] = await trx
        .insert(clinics)
        .values({
          name: clinicName,
          address: clinicAddress || null,
          phone: clinicPhone || null,
          email: clinicEmail || null,
          website: clinicWebsite || null,
          description: clinicDescription || null,
          isActive: true
        })
        .returning();

      if (!createdClinic) {
        throw new Error('FAILED_TO_CREATE_CLINIC');
      }

      // 6. Create user role (doctor/admin of the clinic)
      await trx
        .insert(userRoles)
        .values({
          userId: createdUser.id,
          clinicId: createdClinic.id,
          role: role,
          isActive: true
        });

      return { 
        user: createdUser, 
        profile: createdProfile, 
        clinic: createdClinic 
      };
    });

    // Set session after successful transaction
    await setSession(res, result.user);

    // Setup default clinic data (appointment types, departments, services)
    try {
      console.log('[signup] Setting up default clinic data for:', result.clinic.name);
      await setupDefaultClinicData(result.clinic.id);
      console.log('[signup] Default clinic data setup completed');
    } catch (setupError) {
      console.error('[signup] Error setting up default clinic data:', setupError);
      // Don't fail the signup if clinic setup fails, just log the error
      // The user can still use the system and create types manually
    }

    console.log('[signup] Successfully created user, profile, clinic, and role for:', email);

    // Return complete user data matching signin format
    const responseData = {
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.profile.firstName,
        lastName: result.profile.lastName,
        phone: result.profile.phone
      },
      clinic: {
        id: result.clinic.id,
        name: result.clinic.name,
        address: result.clinic.address,
        phone: result.clinic.phone,
        email: result.clinic.email
      },
      userRole: {
        role: role
      }
    };

    console.log('[signup] Returning complete user data with clinic info');
    return res.json(responseData);
  } catch (error) {
    // Handle specific error cases
    if (error.message === 'USER_EXISTS') {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }
    if (error.message === 'FAILED_TO_CREATE_USER') {
      return res.status(400).json({ error: 'Failed to create user.' });
    }
    if (error.message === 'FAILED_TO_CREATE_CLINIC') {
      return res.status(400).json({ error: 'Failed to create clinic.' });
    }
    
    return handleError(error, res);
  }
});

/**
 * signOut
 *  - Clear the cookie so the session is invalid
 */
router.post('/signout', async (req, res) => {
  try {
    console.log('[signout] Processing signout request');
    
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
    console.log('[session] ================================');
    console.log('[session] Checking session...');
    
    const sessionCookie = req.cookies?.session;
    console.log('[session] Session cookie exists:', !!sessionCookie);
    console.log('[session] Session cookie length:', sessionCookie ? sessionCookie.length : 0);
    
    if (!sessionCookie) {
      console.log('[session] No session cookie found');
      return res.status(401).json({ error: 'No session cookie found.' });
    }

    // verifyToken from session.js
    const decoded = await verifyToken(sessionCookie); 
    console.log('[session] Token decoded successfully');
    console.log('[session] Decoded payload:', JSON.stringify(decoded, null, 2));
    console.log('[session] User ID from token:', decoded?.user?.id);

    // Check if token is expired
    if (decoded.expires && new Date() > new Date(decoded.expires)) {
      console.log('[session] Token has expired at:', decoded.expires);
      console.log('[session] Current time:', new Date().toISOString());
      return res.status(401).json({ error: 'Session expired.' });
    }

    // If token is expired or invalid, an error is thrown
    if (!decoded?.user?.id) {
      console.log('[session] Invalid token payload - missing user ID');
      return res.status(401).json({ error: 'Invalid session.' });
    }

    // Fetch user with profile and clinic from DB
    const userId = decoded.user.id;
    console.log('[session] Fetching user data for ID:', userId);
    
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
    
    console.log('[session] User query result:', userWithProfile ? 'FOUND' : 'NOT FOUND');
    if (userWithProfile) {
      console.log('[session] User data:', {
        id: userWithProfile.user.id,
        email: userWithProfile.user.email,
        hasProfile: !!userWithProfile.profile
      });
      if (userWithProfile.profile) {
        console.log('[session] Profile data:', {
          firstName: userWithProfile.profile.firstName,
          lastName: userWithProfile.profile.lastName,
          phone: userWithProfile.profile.phone
        });
      }
    }
    
    if (!userWithProfile) {
      console.log('[session] User not found in database for ID:', userId);
      return res.status(401).json({ error: 'User not found for this session.' });
    }

    // Get user's clinic and role
    console.log('[session] Fetching clinic and role data...');
    const [userRole] = await db
      .select({
        role: userRoles.role,
        clinic: clinics
      })
      .from(userRoles)
      .leftJoin(clinics, eq(userRoles.clinicId, clinics.id))
      .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)))
      .limit(1);

    console.log('[session] User role query result:', userRole ? 'FOUND' : 'NOT FOUND');
    if (userRole) {
      console.log('[session] Role data:', {
        role: userRole.role,
        hasClinic: !!userRole.clinic
      });
      if (userRole.clinic) {
        console.log('[session] Clinic data:', {
          id: userRole.clinic.id,
          name: userRole.clinic.name,
          address: userRole.clinic.address
        });
      }
    }

    console.log('[session] Session valid for user:', userWithProfile.user.email);
    
    const responseData = {
      user: {
        id: userWithProfile.user.id,
        email: userWithProfile.user.email,
        firstName: userWithProfile.profile?.firstName,
        lastName: userWithProfile.profile?.lastName,
        phone: userWithProfile.profile?.phone
      }
    };

    // Add clinic data if user has one
    if (userRole?.clinic) {
      responseData.clinic = {
        id: userRole.clinic.id,
        name: userRole.clinic.name,
        address: userRole.clinic.address,
        phone: userRole.clinic.phone,
        email: userRole.clinic.email
      };
      responseData.userRole = {
        role: userRole.role
      };
    }

    console.log('[session] Final response data:', JSON.stringify(responseData, null, 2));
    console.log('[session] ================================');
    
    return res.json(responseData);
  } catch (error) {
    console.error('[session] Session validation error:', error);
    console.error('[session] Error stack:', error.stack);
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
});

// Authentication routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', getMe);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

export default router;
