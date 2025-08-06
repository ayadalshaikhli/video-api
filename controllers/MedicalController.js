import { db } from '../lib/db/drizzle.js';
import { 
    visits, 
    prescriptions, 
    labOrders, 
    patients, 
    profiles,
    prescriptionItems,
    labOrderItems,
    vitals,
    patientDocuments
} from '../lib/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { getSession } from '../lib/auth/session.js';

// Get all medical visits for a clinic
export const getMedicalVisits = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { page = 1, limit = 50, appointmentId } = req.query;

        const offset = (page - 1) * limit;

        // Build where conditions
        let whereConditions = [eq(visits.clinicId, clinicId)];
        
        // Add appointmentId filter if provided
        if (appointmentId) {
            whereConditions.push(eq(visits.appointmentId, appointmentId));
        }

        const visitsList = await db
            .select({
                id: visits.id,
                appointmentId: visits.appointmentId,
                visitDate: visits.visitDate,
                visitType: visits.visitType,
                chiefComplaint: visits.chiefComplaint,
                status: visits.status,
                createdAt: visits.createdAt,
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                },
                provider: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                }
            })
            .from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(profiles, eq(visits.providerId, profiles.id))
            .where(and(...whereConditions))
            .orderBy(desc(visits.visitDate))
            .limit(parseInt(limit))
            .offset(offset);

        res.json({
            visits: visitsList,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: visitsList.length
            }
        });

    } catch (error) {
        console.error('Get medical visits error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get medical visits for a specific patient
export const getPatientMedicalVisits = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { patientId } = req.params;
        const { limit = 10 } = req.query;

        const visitsList = await db
            .select({
                id: visits.id,
                visitDate: visits.visitDate,
                visitType: visits.visitType,
                chiefComplaint: visits.chiefComplaint,
                visitNotes: visits.visitNotes,
                diagnosis: visits.diagnosis,
                treatmentPlan: visits.treatmentPlan,
                status: visits.status,
                createdAt: visits.createdAt,
                provider: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                }
            })
            .from(visits)
            .leftJoin(profiles, eq(visits.providerId, profiles.id))
            .where(eq(visits.patientId, patientId))
            .orderBy(desc(visits.visitDate))
            .limit(parseInt(limit));

        res.json({ visits: visitsList });

    } catch (error) {
        console.error('Get patient medical visits error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get prescriptions for a specific patient
export const getPatientPrescriptions = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { patientId } = req.params;
        const { limit = 10 } = req.query;

        const prescriptionsList = await db
            .select({
                id: prescriptions.id,
                prescriptionDate: prescriptions.prescriptionDate,
                status: prescriptions.status,
                notes: prescriptions.notes,
                createdAt: prescriptions.createdAt,
                prescriber: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                },
                medicalVisit: {
                    id: visits.id,
                    visitType: visits.visitType,
                    chiefComplaint: visits.chiefComplaint,
                }
            })
            .from(prescriptions)
            .leftJoin(profiles, eq(prescriptions.prescribedBy, profiles.id))
            .leftJoin(visits, eq(prescriptions.medicalVisitId, visits.id))
            .where(eq(prescriptions.patientId, patientId))
            .orderBy(desc(prescriptions.prescriptionDate))
            .limit(parseInt(limit));

        // Get prescription items for each prescription
        for (let prescription of prescriptionsList) {
            const items = await db
                .select()
                .from(prescriptionItems)
                .where(eq(prescriptionItems.prescriptionId, prescription.id));
            prescription.items = items;
        }

        res.json({ prescriptions: prescriptionsList });

    } catch (error) {
        console.error('Get patient prescriptions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get lab orders for a specific patient
export const getPatientLabOrders = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { patientId } = req.params;
        const { limit = 10 } = req.query;

        const labOrdersList = await db
            .select({
                id: labOrders.id,
                orderDate: labOrders.orderDate,
                status: labOrders.status,
                notes: labOrders.notes,
                createdAt: labOrders.createdAt,
                orderedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                },
                medicalVisit: {
                    id: visits.id,
                    visitType: visits.visitType,
                    chiefComplaint: visits.chiefComplaint,
                }
            })
            .from(labOrders)
            .leftJoin(profiles, eq(labOrders.orderedBy, profiles.id))
            .leftJoin(visits, eq(labOrders.medicalVisitId, visits.id))
            .where(eq(labOrders.patientId, patientId))
            .orderBy(desc(labOrders.orderDate))
            .limit(parseInt(limit));

        // Get lab order items for each order
        for (let labOrder of labOrdersList) {
            const items = await db
                .select()
                .from(labOrderItems)
                .where(eq(labOrderItems.labOrderId, labOrder.id));
            labOrder.items = items;
        }

        res.json({ labOrders: labOrdersList });

    } catch (error) {
        console.error('Get patient lab orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get latest vitals for a specific patient
export const getPatientVitals = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { patientId } = req.params;
        const { limit = 5 } = req.query;

        const vitalsList = await db
            .select({
                id: vitals.id,
                recordedAt: vitals.recordedAt,
                temperature: vitals.temperature,
                bloodPressureSystolic: vitals.bloodPressureSystolic,
                bloodPressureDiastolic: vitals.bloodPressureDiastolic,
                pulseRate: vitals.pulseRate,
                respiratoryRate: vitals.respiratoryRate,
                oxygenSaturation: vitals.oxygenSaturation,
                height: vitals.height,
                weight: vitals.weight,
                bmi: vitals.bmi,
                notes: vitals.notes,
                recordedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                },
                medicalVisit: {
                    id: visits.id,
                    visitType: visits.visitType,
                }
            })
            .from(vitals)
            .leftJoin(profiles, eq(vitals.recordedBy, profiles.id))
            .leftJoin(visits, eq(vitals.medicalVisitId, visits.id))
            .where(eq(vitals.patientId, patientId))
            .orderBy(desc(vitals.recordedAt))
            .limit(parseInt(limit));

        res.json({ vitals: vitalsList });

    } catch (error) {
        console.error('Get patient vitals error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get documents for a specific patient
export const getPatientDocuments = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { patientId } = req.params;
        const { limit = 10 } = req.query;

        const documentsList = await db
            .select({
                id: patientDocuments.id,
                documentType: patientDocuments.documentType,
                title: patientDocuments.title,
                fileUrl: patientDocuments.fileUrl,
                notes: patientDocuments.notes,
                createdAt: patientDocuments.createdAt,
                uploadedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                },
                medicalVisit: {
                    id: visits.id,
                    visitType: visits.visitType,
                }
            })
            .from(patientDocuments)
            .leftJoin(profiles, eq(patientDocuments.uploadedBy, profiles.id))
            .leftJoin(visits, eq(patientDocuments.medicalVisitId, visits.id))
            .where(eq(patientDocuments.patientId, patientId))
            .orderBy(desc(patientDocuments.createdAt))
            .limit(parseInt(limit));

        res.json({ documents: documentsList });

    } catch (error) {
        console.error('Get patient documents error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get patient medical summary - useful overview for doctors
export const getPatientMedicalSummary = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { patientId } = req.params;

        // Get latest medical visit
        const [latestVisit] = await db
            .select({
                id: visits.id,
                visitDate: visits.visitDate,
                visitType: visits.visitType,
                chiefComplaint: visits.chiefComplaint,
                diagnosis: visits.diagnosis,
                provider: {
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                }
            })
            .from(visits)
            .leftJoin(profiles, eq(visits.providerId, profiles.id))
            .where(eq(visits.patientId, patientId))
            .orderBy(desc(visits.visitDate))
            .limit(1);

        // Get latest vitals
        const [latestVitals] = await db
            .select()
            .from(vitals)
            .where(eq(vitals.patientId, patientId))
            .orderBy(desc(vitals.recordedAt))
            .limit(1);

        // Get active prescriptions count
        const activePrescriptions = await db
            .select({ count: prescriptions.id })
            .from(prescriptions)
            .where(and(
                eq(prescriptions.patientId, patientId),
                eq(prescriptions.status, 'active')
            ));

        // Get pending lab orders count
        const pendingLabOrders = await db
            .select({ count: labOrders.id })
            .from(labOrders)
            .where(and(
                eq(labOrders.patientId, patientId),
                eq(labOrders.status, 'ordered')
            ));

        // Get total visits count
        const totalVisits = await db
            .select({ count: visits.id })
            .from(visits)
            .where(eq(visits.patientId, patientId));

        res.json({
            summary: {
                latestVisit: latestVisit || null,
                latestVitals: latestVitals || null,
                activePrescriptionsCount: activePrescriptions.length,
                pendingLabOrdersCount: pendingLabOrders.length,
                totalVisitsCount: totalVisits.length
            }
        });

    } catch (error) {
        console.error('Get patient medical summary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get single medical visit
export const getMedicalVisit = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { id } = req.params;

        const [visit] = await db
            .select({
                id: visits.id,
                clinicId: visits.clinicId,
                patientId: visits.patientId,
                visitDate: visits.visitDate,
                visitType: visits.visitType,
                chiefComplaint: visits.chiefComplaint,
                visitNotes: visits.visitNotes,
                diagnosis: visits.diagnosis,
                treatmentPlan: visits.treatmentPlan,
                followUpInstructions: visits.followUpInstructions,
                followUpDate: visits.followUpDate,
                clinicalFindings: visits.clinicalFindings,
                soapNotes: visits.soapNotes,
                status: visits.status,
                createdAt: visits.createdAt,
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                    email: patients.email,
                    phone: patients.phone,
                },
                provider: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                }
            })
            .from(visits)
            .leftJoin(patients, eq(visits.patientId, patients.id))
            .leftJoin(profiles, eq(visits.providerId, profiles.id))
            .where(and(
                eq(visits.id, id),
                eq(visits.clinicId, clinicId)
            ))
            .limit(1);

        if (!visit) {
            return res.status(404).json({ error: 'Medical visit not found' });
        }

        res.json({ visit });

    } catch (error) {
        console.error('Get medical visit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get all prescriptions for a clinic
export const getPrescriptions = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { page = 1, limit = 50 } = req.query;

        const offset = (page - 1) * limit;

        const prescriptionsList = await db
            .select({
                id: prescriptions.id,
                prescriptionDate: prescriptions.prescriptionDate,
                status: prescriptions.status,
                notes: prescriptions.notes,
                createdAt: prescriptions.createdAt,
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                },
                prescriber: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                },
                medicalVisit: {
                    id: visits.id,
                    visitType: visits.visitType,
                    chiefComplaint: visits.chiefComplaint,
                }
            })
            .from(prescriptions)
            .leftJoin(patients, eq(prescriptions.patientId, patients.id))
            .leftJoin(profiles, eq(prescriptions.prescribedBy, profiles.id))
            .leftJoin(visits, eq(prescriptions.medicalVisitId, visits.id))
            .where(eq(prescriptions.clinicId, clinicId))
            .orderBy(desc(prescriptions.prescriptionDate))
            .limit(parseInt(limit))
            .offset(offset);

        res.json({
            prescriptions: prescriptionsList,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: prescriptionsList.length
            }
        });

    } catch (error) {
        console.error('Get prescriptions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get single prescription
export const getPrescription = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { id } = req.params;

        const [prescription] = await db
            .select({
                id: prescriptions.id,
                prescriptionDate: prescriptions.prescriptionDate,
                status: prescriptions.status,
                notes: prescriptions.notes,
                createdAt: prescriptions.createdAt,
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                },
                prescriber: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                }
            })
            .from(prescriptions)
            .leftJoin(patients, eq(prescriptions.patientId, patients.id))
            .leftJoin(profiles, eq(prescriptions.prescribedBy, profiles.id))
            .where(eq(prescriptions.id, id))
            .limit(1);

        if (!prescription) {
            return res.status(404).json({ error: 'Prescription not found' });
        }

        // Get prescription items
        const items = await db
            .select()
            .from(prescriptionItems)
            .where(eq(prescriptionItems.prescriptionId, id));

        res.json({ 
            prescription: {
                ...prescription,
                items
            }
        });

    } catch (error) {
        console.error('Get prescription error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get all lab orders for a clinic
export const getLabOrders = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { page = 1, limit = 50 } = req.query;

        const offset = (page - 1) * limit;

        const labOrdersList = await db
            .select({
                id: labOrders.id,
                orderDate: labOrders.orderDate,
                status: labOrders.status,
                notes: labOrders.notes,
                createdAt: labOrders.createdAt,
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                },
                orderedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                },
                medicalVisit: {
                    id: visits.id,
                    visitType: visits.visitType,
                    chiefComplaint: visits.chiefComplaint,
                }
            })
            .from(labOrders)
            .leftJoin(patients, eq(labOrders.patientId, patients.id))
            .leftJoin(profiles, eq(labOrders.orderedBy, profiles.id))
            .leftJoin(visits, eq(labOrders.medicalVisitId, visits.id))
            .where(eq(labOrders.clinicId, clinicId))
            .orderBy(desc(labOrders.orderDate))
            .limit(parseInt(limit))
            .offset(offset);

        res.json({
            labOrders: labOrdersList,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: labOrdersList.length
            }
        });

    } catch (error) {
        console.error('Get lab orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get single lab order
export const getLabOrder = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { id } = req.params;

        const [labOrder] = await db
            .select({
                id: labOrders.id,
                orderDate: labOrders.orderDate,
                status: labOrders.status,
                notes: labOrders.notes,
                createdAt: labOrders.createdAt,
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                },
                orderedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                }
            })
            .from(labOrders)
            .leftJoin(patients, eq(labOrders.patientId, patients.id))
            .leftJoin(profiles, eq(labOrders.orderedBy, profiles.id))
            .where(eq(labOrders.id, id))
            .limit(1);

        if (!labOrder) {
            return res.status(404).json({ error: 'Lab order not found' });
        }

        // Get lab order items
        const items = await db
            .select()
            .from(labOrderItems)
            .where(eq(labOrderItems.labOrderId, id));

        res.json({ 
            labOrder: {
                ...labOrder,
                items
            }
        });

    } catch (error) {
        console.error('Get lab order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create medical visit
export const createMedicalVisit = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;

        const {
            patientId,
            appointmentId,
            providerId,
            visitDate,
            visitType,
            chiefComplaint,
            visitNotes,
            diagnosis,
            treatmentPlan,
            followUpInstructions,
            followUpDate,
            clinicalFindings,
            soapNotes
        } = req.body;

        if (!patientId || !visitDate || !visitType) {
            return res.status(400).json({ 
                error: 'Patient ID, visit date, and visit type are required' 
            });
        }

        const [newVisit] = await db
            .insert(visits)
            .values({
                clinicId,
                patientId,
                appointmentId: appointmentId || null,
                providerId: providerId || req.user.id,
                visitDate: new Date(visitDate),
                visitType,
                chiefComplaint: chiefComplaint || null,
                visitNotes: visitNotes || null,
                diagnosis: diagnosis || [],
                treatmentPlan: treatmentPlan || null,
                followUpInstructions: followUpInstructions || null,
                followUpDate: followUpDate ? new Date(followUpDate) : null,
                clinicalFindings: clinicalFindings || [],
                soapNotes: soapNotes || {},
                status: 'checked_in', // Changed from 'active' to valid enum value
                createdBy: req.user.id,
                recordedBy: req.user.id,
            })
            .returning();

        res.status(201).json({
            message: 'Medical visit created successfully',
            visit: newVisit
        });

    } catch (error) {
        console.error('Create medical visit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update medical visit
export const updateMedicalVisit = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;
        const { id } = req.params;

        const {
            visitNotes,
            diagnosis,
            treatmentPlan,
            followUpInstructions,
            followUpDate,
            clinicalFindings,
            soapNotes,
            status
        } = req.body;

        // Verify the visit belongs to the user's clinic
        const existingVisit = await db
            .select()
            .from(visits)
            .where(and(
                eq(visits.id, id),
                eq(visits.clinicId, clinicId)
            ))
            .limit(1);

        if (existingVisit.length === 0) {
            return res.status(404).json({ error: 'Medical visit not found' });
        }

        const [updatedVisit] = await db
            .update(visits)
            .set({
                visitNotes: visitNotes !== undefined ? visitNotes : existingVisit[0].visitNotes,
                diagnosis: diagnosis !== undefined ? diagnosis : existingVisit[0].diagnosis,
                treatmentPlan: treatmentPlan !== undefined ? treatmentPlan : existingVisit[0].treatmentPlan,
                followUpInstructions: followUpInstructions !== undefined ? followUpInstructions : existingVisit[0].followUpInstructions,
                followUpDate: followUpDate !== undefined ? (followUpDate ? new Date(followUpDate) : null) : existingVisit[0].followUpDate,
                clinicalFindings: clinicalFindings !== undefined ? clinicalFindings : existingVisit[0].clinicalFindings,
                soapNotes: soapNotes !== undefined ? soapNotes : existingVisit[0].soapNotes,
                status: status !== undefined ? status : existingVisit[0].status,
                updatedAt: new Date()
            })
            .where(and(
                eq(visits.id, id),
                eq(visits.clinicId, clinicId)
            ))
            .returning();

        res.status(200).json({
            message: 'Medical visit updated successfully',
            visit: updatedVisit
        });

    } catch (error) {
        console.error('Update medical visit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create prescription
export const createPrescription = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;

        const {
            patientId,
            medicalVisitId,
            prescribedBy,
            prescriptionDate,
            notes,
            items
        } = req.body;

        if (!patientId || !prescriptionDate) {
            return res.status(400).json({ 
                error: 'Patient ID and prescription date are required' 
            });
        }

        const [newPrescription] = await db
            .insert(prescriptions)
            .values({
                clinicId,
                patientId,
                medicalVisitId: medicalVisitId || null,
                prescribedBy: prescribedBy || req.user.id,
                prescriptionDate: new Date(prescriptionDate),
                status: 'active',
                notes: notes || null,
            })
            .returning();

        // Add prescription items if provided
        if (items && items.length > 0) {
            const itemsToInsert = items.map(item => {
                // Parse quantity as integer, default to null if invalid
                let quantity = null;
                if (item.quantity) {
                    const parsed = parseInt(item.quantity);
                    if (!isNaN(parsed)) {
                        quantity = parsed;
                    }
                }

                // Parse refills as integer, default to 0 if invalid
                let refills = 0;
                if (item.refills) {
                    const parsed = parseInt(item.refills);
                    if (!isNaN(parsed)) {
                        refills = parsed;
                    }
                }

                return {
                    prescriptionId: newPrescription.id,
                    medicationName: item.medicationName,
                    dosage: item.dosage,
                    frequency: item.frequency,
                    route: item.route,
                    duration: item.duration || null,
                    quantity: quantity,
                    refills: refills,
                    instructions: item.instructions || null,
                };
            });

            await db.insert(prescriptionItems).values(itemsToInsert);
        }

        res.status(201).json({
            message: 'Prescription created successfully',
            prescription: newPrescription
        });

    } catch (error) {
        console.error('Create prescription error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create lab order
export const createLabOrder = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const {
            clinicId,
            patientId,
            medicalVisitId,
            orderedBy,
            orderDate,
            notes,
            items
        } = req.body;

        if (!clinicId || !patientId || !orderDate) {
            return res.status(400).json({ 
                error: 'Clinic ID, patient ID, and order date are required' 
            });
        }

        const [newLabOrder] = await db
            .insert(labOrders)
            .values({
                clinicId,
                patientId,
                medicalVisitId: medicalVisitId || null,
                orderedBy: orderedBy || session.user.id,
                orderDate: new Date(orderDate),
                status: 'ordered',
                notes: notes || null,
            })
            .returning();

        // Add lab order items if provided
        if (items && items.length > 0) {
            const itemsToInsert = items.map(item => ({
                labOrderId: newLabOrder.id,
                testName: item.testName,
                testCode: item.testCode || null,
                instructions: item.instructions || null,
                status: 'ordered',
            }));

            await db.insert(labOrderItems).values(itemsToInsert);
        }

        res.status(201).json({
            message: 'Lab order created successfully',
            labOrder: newLabOrder
        });

    } catch (error) {
        console.error('Create lab order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update lab order
export const updateLabOrder = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;
        const { id } = req.params;

        const {
            testName,
            testCode,
            priority,
            status,
            notes,
            results,
            resultDate,
            labName,
            labAddress,
            labPhone
        } = req.body;

        // Verify the lab order belongs to the user's clinic
        const existingLabOrder = await db
            .select()
            .from(labOrders)
            .where(and(
                eq(labOrders.id, id),
                eq(labOrders.clinicId, clinicId)
            ))
            .limit(1);

        if (existingLabOrder.length === 0) {
            return res.status(404).json({ error: 'Lab order not found' });
        }

        const [updatedLabOrder] = await db
            .update(labOrders)
            .set({
                testName: testName !== undefined ? testName : existingLabOrder[0].testName,
                testCode: testCode !== undefined ? testCode : existingLabOrder[0].testCode,
                priority: priority !== undefined ? priority : existingLabOrder[0].priority,
                status: status !== undefined ? status : existingLabOrder[0].status,
                notes: notes !== undefined ? notes : existingLabOrder[0].notes,
                results: results !== undefined ? results : existingLabOrder[0].results,
                resultDate: resultDate !== undefined ? (resultDate ? new Date(resultDate) : null) : existingLabOrder[0].resultDate,
                labName: labName !== undefined ? labName : existingLabOrder[0].labName,
                labAddress: labAddress !== undefined ? labAddress : existingLabOrder[0].labAddress,
                labPhone: labPhone !== undefined ? labPhone : existingLabOrder[0].labPhone,
                updatedAt: new Date()
            })
            .where(and(
                eq(labOrders.id, id),
                eq(labOrders.clinicId, clinicId)
            ))
            .returning();

        res.status(200).json({
            message: 'Lab order updated successfully',
            labOrder: updatedLabOrder
        });

    } catch (error) {
        console.error('Update lab order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Update prescription
export const updatePrescription = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;
        const { id } = req.params;

        const {
            prescriptionDate,
            status,
            notes,
            items
        } = req.body;

        // Verify the prescription belongs to the user's clinic
        const existingPrescription = await db
            .select()
            .from(prescriptions)
            .where(and(
                eq(prescriptions.id, id),
                eq(prescriptions.clinicId, clinicId)
            ))
            .limit(1);

        if (existingPrescription.length === 0) {
            return res.status(404).json({ error: 'Prescription not found' });
        }

        const [updatedPrescription] = await db
            .update(prescriptions)
            .set({
                prescriptionDate: prescriptionDate !== undefined ? new Date(prescriptionDate) : existingPrescription[0].prescriptionDate,
                status: status !== undefined ? status : existingPrescription[0].status,
                notes: notes !== undefined ? notes : existingPrescription[0].notes,
                updatedAt: new Date()
            })
            .where(and(
                eq(prescriptions.id, id),
                eq(prescriptions.clinicId, clinicId)
            ))
            .returning();

        // Update prescription items if provided
        if (items && Array.isArray(items)) {
            // Delete existing items
            await db
                .delete(prescriptionItems)
                .where(eq(prescriptionItems.prescriptionId, id));

            // Insert new items
            if (items.length > 0) {
                await db
                    .insert(prescriptionItems)
                    .values(items.map(item => ({
                        prescriptionId: id,
                        medicationName: item.medicationName,
                        dosage: item.dosage,
                        frequency: item.frequency,
                        duration: item.duration,
                        instructions: item.instructions,
                        quantity: item.quantity,
                        refills: item.refills
                    })));
            }
        }

        res.status(200).json({
            message: 'Prescription updated successfully',
            prescription: updatedPrescription
        });

    } catch (error) {
        console.error('Update prescription error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Create vitals record
export const createVitals = async (req, res) => {
    try {
        const session = await getSession(req);
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const {
            clinicId,
            patientId,
            medicalVisitId,
            recordedAt,
            temperature,
            bloodPressureSystolic,
            bloodPressureDiastolic,
            pulseRate,
            respiratoryRate,
            oxygenSaturation,
            height,
            weight,
            bmi,
            notes
        } = req.body;

        if (!patientId || !recordedAt) {
            return res.status(400).json({ 
                error: 'Patient ID and recorded at date are required' 
            });
        }

        const [newVitals] = await db
            .insert(vitals)
            .values({
                clinicId: clinicId || null,
                patientId,
                medicalVisitId: medicalVisitId || null,
                recordedAt: new Date(recordedAt),
                temperature: temperature || null,
                bloodPressureSystolic: bloodPressureSystolic || null,
                bloodPressureDiastolic: bloodPressureDiastolic || null,
                pulseRate: pulseRate || null,
                respiratoryRate: respiratoryRate || null,
                oxygenSaturation: oxygenSaturation || null,
                height: height || null,
                weight: weight || null,
                bmi: bmi || null,
                notes: notes || null,
                recordedBy: session.user.id,
            })
            .returning();

        res.status(201).json({
            message: 'Vitals created successfully',
            vitals: newVitals
        });

    } catch (error) {
        console.error('Create vitals error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}; 



export const getVisitPrescriptions = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;
        const { visitId } = req.params;

        // First verify the visit belongs to the user's clinic
        const [visit] = await db
            .select({ id: visits.id })
            .from(visits)
            .where(and(
                eq(visits.id, visitId),
                eq(visits.clinicId, clinicId)
            ))
            .limit(1);

        if (!visit) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        const prescriptionsList = await db
            .select({
                id: prescriptions.id,
                prescriptionDate: prescriptions.prescriptionDate,
                status: prescriptions.status,
                notes: prescriptions.notes,
                items: prescriptionItems
            })
            .from(prescriptions)
            .leftJoin(prescriptionItems, eq(prescriptions.id, prescriptionItems.prescriptionId))
            .where(eq(prescriptions.medicalVisitId, visitId));

        res.json({ prescriptions: prescriptionsList });

    } catch (error) {
        console.error('Get visit prescriptions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getVisitVitals = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;
        const { visitId } = req.params;

        // First verify the visit belongs to the user's clinic
        const [visit] = await db
            .select({ id: visits.id })
            .from(visits)
            .where(and(
                eq(visits.id, visitId),
                eq(visits.clinicId, clinicId)
            ))
            .limit(1);

        if (!visit) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        const [vitalData] = await db
            .select({
                id: vitals.id,
                recordedAt: vitals.recordedAt,
                temperature: vitals.temperature,

                bloodPressureSystolic: vitals.bloodPressureSystolic,
                bloodPressureDiastolic: vitals.bloodPressureDiastolic,
                heartRate: vitals.pulseRate,
                respiratoryRate: vitals.respiratoryRate,
                oxygenSaturation: vitals.oxygenSaturation,
                height: vitals.height,
                weight: vitals.weight,
                bmi: vitals.bmi,
                notes: vitals.notes,
                recordedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName,
                }
            })
            .from(vitals)
            .leftJoin(profiles, eq(vitals.recordedBy, profiles.id))
            .where(eq(vitals.medicalVisitId, visitId))
            .limit(1);

        res.json({ vitals: vitalData });

    } catch (error) {
        console.error('Get visit vitals error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getVisitLabOrders = async (req, res) => {
    try {
        // Auth and clinic access already verified by middleware
        const clinicId = req.userClinic.id;
        const { visitId } = req.params;

        // First verify the visit belongs to the user's clinic
        const [visit] = await db
            .select({ id: visits.id })
            .from(visits)
            .where(and(
                eq(visits.id, visitId),
                eq(visits.clinicId, clinicId)
            ))
            .limit(1);

        if (!visit) {
            return res.status(404).json({ error: 'Visit not found' });
        }

        const labOrdersList = await db
            .select({
                id: labOrders.id,
                orderDate: labOrders.orderDate,
                status: labOrders.status,
                notes: labOrders.notes,
                items: {
                    id: labOrderItems.id,
                    testName: labOrderItems.testName,
                    testCode: labOrderItems.testCode,
                    instructions: labOrderItems.instructions,
                    status: labOrderItems.status,

                }
            })
            .from(labOrders)
            .leftJoin(labOrderItems, eq(labOrders.id, labOrderItems.labOrderId))
            .where(eq(labOrders.medicalVisitId, visitId));

        res.json({ labOrders: labOrdersList });

    } catch (error) {
        console.error('Get visit lab orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};