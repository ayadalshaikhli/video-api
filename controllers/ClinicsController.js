import { db } from '../lib/db/drizzle.js';
import { clinics, users, userRoles } from '../lib/db/schema.js';
import { eq, and } from 'drizzle-orm';

export const getClinicDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's clinic through userRoles
    const userRole = await db
      .select({
        clinic: clinics
      })
      .from(userRoles)
      .leftJoin(clinics, eq(userRoles.clinicId, clinics.id))
      .where(eq(userRoles.userId, userId))
      .limit(1);

    if (!userRole || userRole.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const clinic = userRole[0].clinic;
    if (!clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    res.json({ clinic });
  } catch (error) {
    console.error('Error getting clinic details:', error);
    res.status(500).json({ error: 'Failed to get clinic details' });
  }
};

export const updateClinic = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;
    
    // Get user's clinic ID through userRoles
    const userRole = await db
      .select({
        clinicId: userRoles.clinicId
      })
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .limit(1);

    if (!userRole || userRole.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const clinicId = userRole[0].clinicId;
    
    // Update clinic
    const updatedClinic = await db
      .update(clinics)
      .set(updateData)
      .where(eq(clinics.id, clinicId))
      .returning();

    if (!updatedClinic || updatedClinic.length === 0) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    res.json({ clinic: updatedClinic[0] });
  } catch (error) {
    console.error('Error updating clinic:', error);
    res.status(500).json({ error: 'Failed to update clinic' });
  }
}; 