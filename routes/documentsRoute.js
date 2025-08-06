import express from 'express';
import { requireAuth } from '../middleware/auth.js';
// import {
//     getDocuments,
//     getDocument,
//     uploadDocument,
//     deleteDocument
// } from '../controllers/DocumentsController.js';

const router = express.Router();

// All routes use auth context - clinic ID comes from authenticated user
// Note: Controllers not implemented yet - uncomment when ready
// router.get('/', requireAuth, getDocuments);              // Gets documents from user's clinic
// router.get('/:documentId', requireAuth, getDocument);    // Gets specific document (if owned by user's clinic)
// router.post('/upload', requireAuth, uploadDocument);     // Uploads document to user's clinic
// router.delete('/:documentId', requireAuth, deleteDocument); // Deletes document (if owned by user's clinic)

export default router; 