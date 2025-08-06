import { db } from '../lib/db/drizzle.js';
import { patients, profiles, clinics, visits } from '../lib/db/schema.js';
import { eq, and, like, desc, asc, or, sql } from 'drizzle-orm';
// Removed getSession import - using middleware instead

// Get all patients for a clinic with advanced search, sorting, and pagination
export const getPatients = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;
        const { 
            search, 
            searchType = 'all',
            page = 1, 
            limit = 10, 
            sort = 'created_at_desc' 
        } = req.query;
        
        console.log(`[Patients] Getting patients for clinic ${clinicId}, user ${req.user.id}`);
        console.log(`[Patients] Query params:`, { search, searchType, page, limit, sort });
        console.log(`[Patients] Search validation:`, { 
          hasSearch: !!search, 
          searchIsUndefined: search === 'undefined', 
          searchTrimmed: search?.trim() 
        });

        // Build the base query with patient data and last visit info
        let query = db
            .select({
                id: patients.id,
                firstName: patients.firstName,
                lastName: patients.lastName,
                email: patients.email,
                phone: patients.phone,
                dateOfBirth: patients.dateOfBirth,
                gender: patients.gender,
                status: patients.status,
                needsFollowUp: patients.needsFollowUp,
                createdAt: patients.createdAt,
                lastVisitDate: sql`(
                    SELECT MAX(${visits.visitDate}) 
                    FROM ${visits} 
                    WHERE ${visits.patientId} = ${patients.id} 
                    AND ${visits.clinicId} = ${clinicId}
                )`.as('lastVisitDate')
            })
            .from(patients)
            .where(eq(patients.clinicId, clinicId));

        // Add search functionality with different search types
        if (search && search !== 'undefined' && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            
            switch (searchType) {
                case 'name':
                    query = query.where(
                        or(
                            like(patients.firstName, searchTerm),
                            like(patients.lastName, searchTerm),
                            like(sql`CONCAT(${patients.firstName}, ' ', ${patients.lastName})`, searchTerm)
                        )
                    );
                    break;
                case 'phone':
                    query = query.where(like(patients.phone, searchTerm));
                    break;
                case 'email':
                    query = query.where(like(patients.email, searchTerm));
                    break;
                default: // 'all'
                    query = query.where(
                        or(
                            like(patients.firstName, searchTerm),
                            like(patients.lastName, searchTerm),
                            like(sql`CONCAT(${patients.firstName}, ' ', ${patients.lastName})`, searchTerm),
                            like(patients.email, searchTerm),
                            like(patients.phone, searchTerm)
                        )
                    );
            }
        }

        // Apply sorting
        switch (sort) {
            case 'created_at_desc':
                query = query.orderBy(desc(patients.createdAt));
                break;
            case 'created_at_asc':
                query = query.orderBy(asc(patients.createdAt));
                break;
            case 'name_asc':
                query = query.orderBy(asc(patients.firstName), asc(patients.lastName));
                break;
            case 'name_desc':
                query = query.orderBy(desc(patients.firstName), desc(patients.lastName));
                break;
            case 'last_visit_desc':
                query = query.orderBy(desc(sql`(
                    SELECT MAX(${visits.visitDate}) 
                    FROM ${visits} 
                    WHERE ${visits.patientId} = ${patients.id} 
                    AND ${visits.clinicId} = ${clinicId}
                )`));
                break;
            default:
                query = query.orderBy(desc(patients.createdAt));
        }

        // Get total count for pagination
        let countQuery = db
            .select({ count: sql`count(*)` })
            .from(patients)
            .where(eq(patients.clinicId, clinicId));

        // Apply same search conditions to count query
        if (search && search !== 'undefined' && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            
            switch (searchType) {
                case 'name':
                    countQuery = countQuery.where(
                        or(
                            like(patients.firstName, searchTerm),
                            like(patients.lastName, searchTerm),
                            like(sql`CONCAT(${patients.firstName}, ' ', ${patients.lastName})`, searchTerm)
                        )
                    );
                    break;
                case 'phone':
                    countQuery = countQuery.where(like(patients.phone, searchTerm));
                    break;
                case 'email':
                    countQuery = countQuery.where(like(patients.email, searchTerm));
                    break;
                default: // 'all'
                    countQuery = countQuery.where(
                        or(
                            like(patients.firstName, searchTerm),
                            like(patients.lastName, searchTerm),
                            like(sql`CONCAT(${patients.firstName}, ' ', ${patients.lastName})`, searchTerm),
                            like(patients.email, searchTerm),
                            like(patients.phone, searchTerm)
                        )
                    );
            }
        }

        const [{ count: total }] = await countQuery;

        // Apply pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const patientsList = await query
            .limit(parseInt(limit))
            .offset(offset);

        console.log(`[Patients] Found ${patientsList.length} patients out of ${total} total`);

        res.json({
            patients: patientsList,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(total),
                hasMore: offset + patientsList.length < total
            }
        });

    } catch (error) {
        console.error('Get patients error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get single patient
export const getPatient = async (req, res) => {
    try {
        // Auth already verified by middleware
        const { id } = req.params;
        const userClinicId = req.userClinic.id;

        console.log(`[Patients] Getting patient ${id} for user ${req.user.id} in clinic ${userClinicId}`);

        // Verify patient belongs to user's clinic
        const [patient] = await db
            .select()
            .from(patients)
            .where(and(
                eq(patients.id, id),
                eq(patients.clinicId, userClinicId) // Security: ensure patient belongs to user's clinic
            ))
            .limit(1);

        if (!patient) {
            console.log(`[Patients] Patient ${id} not found or not accessible to user ${req.user.id}`);
            return res.status(404).json({ error: 'Patient not found or access denied' });
        }

        console.log(`[Patients] Successfully retrieved patient ${id}`);
        res.json({ patient });

    } catch (error) {
        console.error('[Patients] Get patient error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create new patient
export const createPatient = async (req, res) => {
    try {
        // Auth already verified by middleware
        const userClinicId = req.userClinic.id;
        
        const {
            clinicId = userClinicId, // Default to user's clinic, but verify it matches
            firstName,
            lastName,
            dateOfBirth,
            gender,
            email,
            phone,
            address,
            emergencyContactName,
            emergencyContactPhone,
            bloodType,
            allergies,
            medicalConditions,
            notes,
            consentForCommunication,
            consentForTreatment
        } = req.body;

        // Verify user is trying to create patient in their own clinic
        if (clinicId.toString() !== userClinicId.toString()) {
            console.warn(`[SECURITY] User ${req.user.id} attempted to create patient in clinic ${clinicId} but only has access to ${userClinicId}`);
            return res.status(403).json({ error: 'Access denied. You can only create patients in your own clinic.' });
        }

        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }

        console.log(`[Patients] Creating new patient for user ${req.user.id} in clinic ${userClinicId}`);

        const [newPatient] = await db
            .insert(patients)
            .values({
                clinicId: userClinicId, // Always use user's clinic ID for security
                firstName,
                lastName,
                dateOfBirth: dateOfBirth || null,
                gender: gender || null,
                email: email || null,
                phone: phone || null,
                address: address || null,
                emergencyContactName: emergencyContactName || null,
                emergencyContactPhone: emergencyContactPhone || null,
                bloodType: bloodType || null,
                allergies: allergies || [],
                medicalConditions: medicalConditions || [],
                notes: notes || null,
                consentForCommunication: consentForCommunication || false,
                consentForTreatment: consentForTreatment || false,
                createdBy: req.user.id, // Use user from middleware
            })
            .returning();

        console.log(`[Patients] Successfully created patient ${newPatient.id}`);
        res.status(201).json({
            message: 'Patient created successfully',
            patient: newPatient
        });

    } catch (error) {
        console.error('[Patients] Create patient error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update patient
export const updatePatient = async (req, res) => {
    try {
        // Auth already verified by middleware
        const { id } = req.params;
        const userClinicId = req.userClinic.id;
        const updates = req.body;

        console.log(`[Patients] Updating patient ${id} for user ${req.user.id} in clinic ${userClinicId}`);

        // Remove fields that shouldn't be updated
        delete updates.id;
        delete updates.createdAt;
        delete updates.createdBy;
        delete updates.clinicId; // Prevent clinic changes

        // Verify patient belongs to user's clinic before updating
        const [updatedPatient] = await db
            .update(patients)
            .set({
                ...updates,
                updatedAt: new Date(),
            })
            .where(and(
                eq(patients.id, id),
                eq(patients.clinicId, userClinicId) // Security: only update patients in user's clinic
            ))
            .returning();

        if (!updatedPatient) {
            console.log(`[Patients] Patient ${id} not found or not accessible to user ${req.user.id}`);
            return res.status(404).json({ error: 'Patient not found or access denied' });
        }

        console.log(`[Patients] Successfully updated patient ${id}`);
        res.json({
            message: 'Patient updated successfully',
            patient: updatedPatient
        });

    } catch (error) {
        console.error('[Patients] Update patient error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Delete patient (soft delete by changing status)
export const deletePatient = async (req, res) => {
    try {
        // Auth already verified by middleware
        const { id } = req.params;
        const userClinicId = req.userClinic.id;

        console.log(`[Patients] Deactivating patient ${id} for user ${req.user.id} in clinic ${userClinicId}`);

        // Verify patient belongs to user's clinic before deactivating
        const [updatedPatient] = await db
            .update(patients)
            .set({
                status: 'inactive',
                updatedAt: new Date(),
            })
            .where(and(
                eq(patients.id, id),
                eq(patients.clinicId, userClinicId) // Security: only deactivate patients in user's clinic
            ))
            .returning();

        if (!updatedPatient) {
            console.log(`[Patients] Patient ${id} not found or not accessible to user ${req.user.id}`);
            return res.status(404).json({ error: 'Patient not found or access denied' });
        }

        console.log(`[Patients] Successfully deactivated patient ${id}`);
        res.json({ message: 'Patient deactivated successfully' });

    } catch (error) {
        console.error('[Patients] Delete patient error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Search patients
export const searchPatients = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;  // Get clinic ID from authenticated user
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        console.log(`[Patients] Searching patients in clinic ${clinicId} for query: "${q}" by user ${req.user.id}`);

        const searchResults = await db
            .select({
                id: patients.id,
                firstName: patients.firstName,
                lastName: patients.lastName,
                email: patients.email,
                phone: patients.phone,
                dateOfBirth: patients.dateOfBirth,
            })
            .from(patients)
            .where(
                and(
                    eq(patients.clinicId, clinicId),
                    eq(patients.status, 'active')
                )
            )
            .limit(20);

        // Filter results based on search query (in-memory for now)
        const filteredResults = searchResults.filter(patient => 
            patient.firstName.toLowerCase().includes(q.toLowerCase()) ||
            patient.lastName.toLowerCase().includes(q.toLowerCase()) ||
            (patient.email && patient.email.toLowerCase().includes(q.toLowerCase())) ||
            (patient.phone && patient.phone.includes(q))
        );

        console.log(`[Patients] Found ${filteredResults.length} patients matching search query`);
        res.json({ patients: filteredResults });

    } catch (error) {
        console.error('[Patients] Search patients error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}; 