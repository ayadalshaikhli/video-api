import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
    getMedicalVisits,
    getMedicalVisit,
    getPrescriptions,
    getPrescription,
    getLabOrders,
    getLabOrder,
    createMedicalVisit,
    updateMedicalVisit,
    createPrescription,
    updatePrescription,
    createLabOrder,
    updateLabOrder,
    createVitals,
    getPatientMedicalVisits,
    getPatientPrescriptions,
    getPatientLabOrders,
    getPatientVitals,
    getPatientDocuments,
    getPatientMedicalSummary,
    getVisitVitals,
    getVisitPrescriptions,
    getVisitLabOrders
} from '../controllers/MedicalController.js';

const router = express.Router();

// All routes use auth context - clinic ID comes from authenticated user
router.get('/visits', requireAuth, getMedicalVisits);                    // Gets medical visits from user's clinic
router.get('/prescriptions', requireAuth, getPrescriptions);            // Gets prescriptions from user's clinic
router.get('/lab-orders', requireAuth, getLabOrders);                   // Gets lab orders from user's clinic

// Individual resource routes (clinic verification happens in controllers)
router.get('/visit/:id', requireAuth, getMedicalVisit);                 // Get specific visit (if owned by user's clinic)
router.post('/visit', requireAuth, createMedicalVisit);                 // Create visit in user's clinic
router.put('/visit/:id', requireAuth, updateMedicalVisit);              // Update visit in user's clinic
router.get('/prescription/:id', requireAuth, getPrescription);          // Get specific prescription (if owned by user's clinic)
router.post('/prescription', requireAuth, createPrescription);          // Create prescription in user's clinic
router.put('/prescription/:id', requireAuth, updatePrescription);       // Update prescription in user's clinic
router.get('/lab-order/:id', requireAuth, getLabOrder);                 // Get specific lab order (if owned by user's clinic)
router.post('/lab-order', requireAuth, createLabOrder);                 // Create lab order in user's clinic
router.put('/lab-order/:id', requireAuth, updateLabOrder);              // Update lab order in user's clinic
router.post('/vitals', requireAuth, createVitals);                      // Create vitals in user's clinic

// Visit-specific routes (clinic verification in controller)
router.get('/visit/:visitId/vitals', requireAuth, getVisitVitals);      // Get vitals for specific visit (if owned by user's clinic)
router.get('/visit/:visitId/prescriptions', requireAuth, getVisitPrescriptions); // Get prescriptions for specific visit (if owned by user's clinic)
router.get('/visit/:visitId/lab-orders', requireAuth, getVisitLabOrders); // Get lab orders for specific visit (if owned by user's clinic)

// Patient-specific routes (clinic verification in controller)
router.get('/patient/:patientId/visits', requireAuth, getPatientMedicalVisits);     // Get visits for specific patient (if owned by user's clinic)
router.get('/patient/:patientId/prescriptions', requireAuth, getPatientPrescriptions); // Get prescriptions for specific patient (if owned by user's clinic)
router.get('/patient/:patientId/lab-orders', requireAuth, getPatientLabOrders);     // Get lab orders for specific patient (if owned by user's clinic)
router.get('/patient/:patientId/vitals', requireAuth, getPatientVitals);           // Get vitals for specific patient (if owned by user's clinic)
router.get('/patient/:patientId/documents', requireAuth, getPatientDocuments);     // Get documents for specific patient (if owned by user's clinic)
router.get('/patient/:patientId/summary', requireAuth, getPatientMedicalSummary);  // Get medical summary for specific patient (if owned by user's clinic)

export default router; 