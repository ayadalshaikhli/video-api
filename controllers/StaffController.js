import { db } from '../lib/db/drizzle.js';
import { users, clinics, staffInvitations, userRoles, profiles } from '../lib/db/schema.js';
import { eq, and, or, desc, gt } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

class StaffController {
  // Get all staff for a clinic
  static async getStaff(req, res) {
    try {
      const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
      const { role, status } = req.query;  // Get optional filters
      
      let whereConditions = [eq(userRoles.clinicId, clinicId)];
      
      // Add role filter if provided
      if (role) {
        whereConditions.push(eq(userRoles.role, role));
      }
      
      // Add status filter if provided
      if (status) {
        whereConditions.push(eq(userRoles.status, status));
      }
      
      const staff = await db
        .select({
          id: users.id,
          email: users.email,
          role: userRoles.role,
          status: userRoles.status,
          isActive: userRoles.isActive,
          createdAt: userRoles.createdAt,
          profile: {
            firstName: profiles.firstName,
            lastName: profiles.lastName,
            avatarUrl: profiles.avatarUrl
          }
        })
        .from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.id))
        .where(and(...whereConditions))
        .orderBy(desc(userRoles.createdAt));

      res.json({ staff });
    } catch (error) {
      console.error('Error getting staff:', error);
      res.status(500).json({ error: 'Failed to get staff' });
    }
  }

  // Get specific staff member
  static async getStaffMember(req, res) {
    try {
      const { id } = req.params;
      const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user

      const staffMember = await db
        .select({
          id: users.id,
          email: users.email,
          role: userRoles.role,
          status: userRoles.status,
          isActive: userRoles.isActive,
          createdAt: userRoles.createdAt,
          profile: {
            firstName: profiles.firstName,
            lastName: profiles.lastName,
            avatarUrl: profiles.avatarUrl
          }
        })
        .from(userRoles)
        .innerJoin(users, eq(userRoles.userId, users.id))
        .innerJoin(profiles, eq(users.id, profiles.id))
        .where(and(
          eq(userRoles.userId, id),
          eq(userRoles.clinicId, clinicId)
        ))
        .limit(1);

      if (!staffMember.length) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      res.json({ staffMember: staffMember[0] });
    } catch (error) {
      console.error('Error getting staff member:', error);
      res.status(500).json({ error: 'Failed to get staff member' });
    }
  }

  // Generate invitation code
  static async generateInvitationCode(req, res) {
    try {
      const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
      const { role, firstName, lastName, notes } = req.body;

      // Generate a unique 8-character code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      console.log(`[StaffController] Generating invitation code: ${code} for clinic: ${clinicId}`);
      
      // Create invitation record
      const [invitation] = await db
        .insert(staffInvitations)
        .values({
          clinicId,
          code,
          role,
          firstName: firstName || null,
          lastName: lastName || null,
          notes: notes || null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          isUsed: false
        })
        .returning();

      console.log(`[StaffController] Created invitation with ID: ${invitation.id}`);

      res.json({ 
        invitation: {
          id: invitation.id,
          code: invitation.code,
          role: invitation.role,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error) {
      console.error('Error generating invitation code:', error);
      res.status(500).json({ error: 'Failed to generate invitation code' });
    }
  }

  // Validate invitation code
  static async validateInvitationCode(req, res) {
    try {
      const { code } = req.params;
      
      console.log(`[StaffController] Validating invitation code: ${code}`);

      // First, let's check if the code exists at all
      const allInvitations = await db
        .select()
        .from(staffInvitations)
        .where(eq(staffInvitations.code, code));

      console.log(`[StaffController] Total invitations with code ${code}:`, allInvitations.length);
      if (allInvitations.length > 0) {
        console.log(`[StaffController] All invitations with this code:`, allInvitations.map(inv => ({
          id: inv.id,
          code: inv.code,
          isUsed: inv.isUsed,
          expiresAt: inv.expiresAt,
          clinicId: inv.clinicId
        })));
      }

      const currentDate = new Date();
      console.log(`[StaffController] Current date: ${currentDate.toISOString()}`);
      console.log(`[StaffController] Expires at: ${allInvitations[0].expiresAt.toISOString()}`);
      console.log(`[StaffController] Is expired: ${allInvitations[0].expiresAt <= currentDate}`);

      const invitation = await db
        .select()
        .from(staffInvitations)
        .where(and(
          eq(staffInvitations.code, code),
          eq(staffInvitations.isUsed, false),
          or(
            eq(staffInvitations.expiresAt, null),
            gt(staffInvitations.expiresAt, currentDate)
          )
        ))
        .limit(1);

      console.log(`[StaffController] Found valid invitation:`, invitation.length > 0 ? 'Yes' : 'No');
      if (invitation.length > 0) {
        console.log(`[StaffController] Valid invitation details:`, {
          id: invitation[0].id,
          code: invitation[0].code,
          isUsed: invitation[0].isUsed,
          expiresAt: invitation[0].expiresAt,
          clinicId: invitation[0].clinicId
        });
      }

      if (!invitation.length) {
        return res.status(404).json({ error: 'Invalid or expired invitation code' });
      }

      // Get clinic info
      const clinic = await db
        .select({
          id: clinics.id,
          name: clinics.name,
          address: clinics.address
        })
        .from(clinics)
        .where(eq(clinics.id, invitation[0].clinicId))
        .limit(1);

      res.json({ 
        valid: true,
        invitation: {
          ...invitation[0],
          clinic: clinic[0]
        }
      });
    } catch (error) {
      console.error('Error validating invitation code:', error);
      res.status(500).json({ error: 'Failed to validate invitation code' });
    }
  }

  // Use invitation code during signup
  static async useInvitationCode(req, res) {
    try {
      const { code, email, firstName, lastName, password } = req.body;

      // Validate invitation code
      const currentDate = new Date();
      const invitation = await db
        .select()
        .from(staffInvitations)
        .where(and(
          eq(staffInvitations.code, code),
          eq(staffInvitations.isUsed, false),
          or(
            eq(staffInvitations.expiresAt, null),
            gt(staffInvitations.expiresAt, currentDate)
          )
        ))
        .limit(1);

      if (!invitation.length) {
        return res.status(400).json({ error: 'Invalid or expired invitation code' });
      }

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Create user
      const [user] = await db
        .insert(users)
        .values({
          email,
          passwordHash: await bcrypt.hash(password, 10)
        })
        .returning();

      // Create user profile
      await db
        .insert(profiles)
        .values({
          id: user.id,
          email: user.email,
          firstName,
          lastName
        });

      // Create staff member record
      await db
        .insert(userRoles)
        .values({
          userId: user.id,
          clinicId: invitation[0].clinicId,
          role: invitation[0].role,
          status: 'pending', // New staff members start as pending
          isActive: false // Pending staff are not active until approved
        });

      // Mark invitation as used
      await db
        .update(staffInvitations)
        .set({ isUsed: true, usedAt: new Date(), usedBy: user.id })
        .where(eq(staffInvitations.id, invitation[0].id));

      res.json({ 
        success: true,
        message: 'Staff member created successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: firstName,
          lastName: lastName,
          status: 'pending' // New staff members are pending approval
        }
      });
    } catch (error) {
      console.error('Error using invitation code:', error);
      res.status(500).json({ error: 'Failed to create staff member' });
    }
  }

  // Legacy invite staff method (for backward compatibility)
  static async inviteStaff(req, res) {
    try {
      const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
      const { email, role, firstName, lastName, notes } = req.body;

      // Generate invitation code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      // Create invitation record
      const [invitation] = await db
        .insert(staffInvitations)
        .values({
          clinicId,
          code,
          role,
          firstName: firstName || null,
          lastName: lastName || null,
          notes: notes || null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          isUsed: false
        })
        .returning();

      // TODO: Send email invitation with code
      // For now, just return the code
      res.json({ 
        success: true,
        message: 'Invitation sent successfully',
        invitation: {
          id: invitation.id,
          code: invitation.code,
          role: invitation.role,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error) {
      console.error('Error inviting staff:', error);
      res.status(500).json({ error: 'Failed to send invitation' });
    }
  }

  // Update staff role
  static async updateStaffRole(req, res) {
    try {
      const { id } = req.params;
      const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
      const { role } = req.body;

      const result = await db
        .update(userRoles)
        .set({ role })
        .where(and(
          eq(userRoles.userId, id),
          eq(userRoles.clinicId, clinicId)
        ));

      res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
      console.error('Error updating staff role:', error);
      res.status(500).json({ error: 'Failed to update role' });
    }
  }

  // Deactivate staff member
  static async deactivateStaff(req, res) {
    try {
      const { id } = req.params;
      const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user

      await db
        .update(userRoles)
        .set({ isActive: false })
        .where(and(
          eq(userRoles.userId, id),
          eq(userRoles.clinicId, clinicId)
        ));

      res.json({ success: true, message: 'Staff member deactivated' });
    } catch (error) {
      console.error('Error deactivating staff:', error);
      res.status(500).json({ error: 'Failed to deactivate staff member' });
    }
  }

  // Placeholder methods for other staff features
  static async getStaffSchedules(req, res) {
    res.json({ schedules: [] });
  }

  static async getStaffSchedule(req, res) {
    res.json({ schedule: {} });
  }

  static async createStaffSchedule(req, res) {
    res.json({ success: true });
  }

  static async updateStaffSchedule(req, res) {
    res.json({ success: true });
  }

  static async getTimeOffRequests(req, res) {
    res.json({ requests: [] });
  }

  static async requestTimeOff(req, res) {
    res.json({ success: true });
  }

  static async approveTimeOff(req, res) {
    res.json({ success: true });
  }

  static async rejectTimeOff(req, res) {
    res.json({ success: true });
  }

  // Get all invitations for a clinic
  static async getInvitations(req, res) {
    try {
      const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user

      console.log(`[StaffController] Getting invitations for clinic: ${clinicId}`);

      const invitationsList = await db
        .select({
          id: staffInvitations.id,
          code: staffInvitations.code,
          role: staffInvitations.role,
          firstName: staffInvitations.firstName,
          lastName: staffInvitations.lastName,
          notes: staffInvitations.notes,
          expiresAt: staffInvitations.expiresAt,
          isUsed: staffInvitations.isUsed,
          usedAt: staffInvitations.usedAt,
          usedBy: staffInvitations.usedBy,
          createdAt: staffInvitations.createdAt,
        })
        .from(staffInvitations)
        .where(eq(staffInvitations.clinicId, clinicId))
        .orderBy(desc(staffInvitations.createdAt));

      console.log(`[StaffController] Found ${invitationsList.length} invitations for clinic ${clinicId}`);
      if (invitationsList.length > 0) {
        console.log(`[StaffController] Sample invitation:`, {
          code: invitationsList[0].code,
          isUsed: invitationsList[0].isUsed,
          expiresAt: invitationsList[0].expiresAt
        });
      }

      res.json({ invitations: invitationsList });
    } catch (error) {
      console.error('Get invitations error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete invitation
  static async deleteInvitation(req, res) {
    try {
      const { id } = req.params;
      const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user

      const [deletedInvitation] = await db
        .delete(staffInvitations)
        .where(and(
          eq(staffInvitations.id, id),
          eq(staffInvitations.clinicId, clinicId),
          eq(staffInvitations.isUsed, false)
        ))
        .returning();

      if (!deletedInvitation) {
        return res.status(404).json({ error: 'Invitation not found or already used' });
      }

      res.json({ message: 'Invitation deleted successfully' });
    } catch (error) {
      console.error('Delete invitation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Approve staff member (change status from pending to active)
  static async approveStaff(req, res) {
    try {
      const { id } = req.params;
      const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user

      const [updatedStaff] = await db
        .update(userRoles)
        .set({
          status: 'active',
          isActive: true,
          updatedAt: new Date(),
        })
        .where(and(
          eq(userRoles.userId, id),
          eq(userRoles.clinicId, clinicId)
        ))
        .returning();

      if (!updatedStaff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      res.json({ message: 'Staff member approved successfully' });
    } catch (error) {
      console.error('Approve staff error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Reject staff member (remove from clinic)
  static async rejectStaff(req, res) {
    try {
      const { id } = req.params;
      const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user

      const [deletedStaff] = await db
        .delete(userRoles)
        .where(and(
          eq(userRoles.userId, id),
          eq(userRoles.clinicId, clinicId)
        ))
        .returning();

      if (!deletedStaff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      res.json({ message: 'Staff member rejected and removed from clinic' });
    } catch (error) {
      console.error('Reject staff error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default StaffController; 