import { db } from '../lib/db/drizzle.js';
import { users, profiles } from '../lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, comparePasswords, setSession, clearSession, getSession } from '../lib/auth/session.js';

// Register new user
export const register = async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user already exists
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const [newUser] = await db
            .insert(users)
            .values({
                email,
                passwordHash: hashedPassword,
            })
            .returning();

        // Create profile
        const [newProfile] = await db
            .insert(profiles)
            .values({
                id: newUser.id,
                email,
                firstName: firstName || null,
                lastName: lastName || null,
                phone: phone || null,
            })
            .returning();

        // Set session
        await setSession(res, { id: newUser.id });

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newProfile.id,
                email: newProfile.email,
                firstName: newProfile.firstName,
                lastName: newProfile.lastName,
                phone: newProfile.phone,
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Login user
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isPasswordValid = await comparePasswords(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Get profile
        const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, user.id))
            .limit(1);

        // Set session
        await setSession(res, { id: user.id });

        res.json({
            message: 'Login successful',
            user: {
                id: profile.id,
                email: profile.email,
                firstName: profile.firstName,
                lastName: profile.lastName,
                phone: profile.phone,
                avatarUrl: profile.avatarUrl,
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Logout user
export const logout = async (req, res) => {
    try {
        clearSession(res);
        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get current user
export const getMe = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Get profile
        const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.id, session.user.id))
            .limit(1);

        if (!profile) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: profile.id,
                email: profile.email,
                firstName: profile.firstName,
                lastName: profile.lastName,
                phone: profile.phone,
                avatarUrl: profile.avatarUrl,
            }
        });

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update profile
export const updateProfile = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { firstName, lastName, phone, avatarUrl } = req.body;

        // Update profile
        const [updatedProfile] = await db
            .update(profiles)
            .set({
                firstName: firstName || null,
                lastName: lastName || null,
                phone: phone || null,
                avatarUrl: avatarUrl || null,
                updatedAt: new Date(),
            })
            .where(eq(profiles.id, session.user.id))
            .returning();

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedProfile.id,
                email: updatedProfile.email,
                firstName: updatedProfile.firstName,
                lastName: updatedProfile.lastName,
                phone: updatedProfile.phone,
                avatarUrl: updatedProfile.avatarUrl,
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Change password
export const changePassword = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        // Get user
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, session.user.id))
            .limit(1);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await comparePasswords(currentPassword, user.passwordHash);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await hashPassword(newPassword);

        // Update password
        await db
            .update(users)
            .set({
                passwordHash: hashedNewPassword,
                updatedAt: new Date(),
            })
            .where(eq(users.id, session.user.id));

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}; 