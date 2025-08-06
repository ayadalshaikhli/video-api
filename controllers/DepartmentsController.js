import { db } from '../lib/db/drizzle.js';
import { departments, userRoles } from '../lib/db/schema.js';
import { eq, and } from 'drizzle-orm';

export const getDepartments = async (req, res) => {
  try {
    const userId = req.user.id;
    
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
    
    // Get departments for the clinic
    const clinicDepartments = await db
      .select()
      .from(departments)
      .where(eq(departments.clinicId, clinicId));

    res.json({ departments: clinicDepartments });
  } catch (error) {
    console.error('Error getting departments:', error);
    res.status(500).json({ error: 'Failed to get departments' });
  }
};

export const createDepartment = async (req, res) => {
  try {
    const userId = req.user.id;
    const departmentData = req.body;
    
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
    
    // Create department
    const newDepartment = await db
      .insert(departments)
      .values({
        ...departmentData,
        clinicId
      })
      .returning();

    res.status(201).json({ department: newDepartment[0] });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
};

export const updateDepartment = async (req, res) => {
  try {
    const userId = req.user.id;
    const departmentId = req.params.id;
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
    
    // Update department (ensure it belongs to the user's clinic)
    const updatedDepartment = await db
      .update(departments)
      .set(updateData)
      .where(and(
        eq(departments.id, departmentId),
        eq(departments.clinicId, clinicId)
      ))
      .returning();

    if (!updatedDepartment || updatedDepartment.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json({ department: updatedDepartment[0] });
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
};

export const deleteDepartment = async (req, res) => {
  try {
    const userId = req.user.id;
    const departmentId = req.params.id;
    
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
    
    // Delete department (ensure it belongs to the user's clinic)
    const deletedDepartment = await db
      .delete(departments)
      .where(and(
        eq(departments.id, departmentId),
        eq(departments.clinicId, clinicId)
      ))
      .returning();

    if (!deletedDepartment || deletedDepartment.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
}; 