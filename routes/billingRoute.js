import express from 'express'
import { requireAuth } from '../middleware/auth.js';
import {
    getFinancialSummary,
    getAdvancedReports,
    getInvoices,
    getInvoice,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    getPayments,
    createPayment,
    getServices,
    createService,
    updateService,
    deleteService,
    getService,
    getPayment,
    openCashDrawer,
    closeCashDrawer,
    getCashDrawerStatus,
    getCashDrawerHistory
} from '../controllers/BillingController.js'

const router = express.Router()

// All routes use auth context - clinic ID comes from authenticated user
router.get('/summary', requireAuth, getFinancialSummary);        // Gets financial summary from user's clinic
router.get('/advanced-reports', requireAuth, getAdvancedReports); // Gets advanced financial reports from user's clinic
router.get('/invoices', requireAuth, getInvoices);              // Gets invoices from user's clinic
router.post('/invoices', requireAuth, createInvoice);           // Creates invoice in user's clinic
router.get('/payments', requireAuth, getPayments);              // Gets payments from user's clinic

// Individual resource routes (clinic verification happens in controllers)
router.get('/invoices/:invoiceId', requireAuth, getInvoice);     // Get specific invoice (if owned by user's clinic)
router.put('/invoices/:invoiceId', requireAuth, updateInvoice);  // Update invoice (if owned by user's clinic)
router.delete('/invoices/:invoiceId', requireAuth, deleteInvoice); // Delete invoice (if owned by user's clinic)
router.get('/payments/:paymentId', requireAuth, getPayment);     // Get specific payment (if owned by user's clinic)
router.post('/payments', requireAuth, createPayment);           // Create payment in user's clinic

// Service routes
router.get('/services', requireAuth, getServices);
router.post('/services', requireAuth, createService);
router.get('/services/:serviceId', requireAuth, getService);
router.put('/services/:serviceId', requireAuth, updateService);
router.delete('/services/:serviceId', requireAuth, deleteService);

// Cash drawer routes
router.get('/cash-drawer/status', requireAuth, getCashDrawerStatus);
router.post('/cash-drawer/open', requireAuth, openCashDrawer);
router.post('/cash-drawer/close', requireAuth, closeCashDrawer);
router.get('/cash-drawer/history', requireAuth, getCashDrawerHistory);

export default router; 