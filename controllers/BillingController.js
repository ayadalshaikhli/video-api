import { db } from '../lib/db/drizzle.js'
import { 
    invoices, 
    invoiceItems, 
    payments, 
    services, 
    patients, 
    appointments, 
    profiles,
    userRoles,
    cashDrawers,
    paymentTracking
} from '../lib/db/schema.js'
import { eq, and, desc, asc, gte, lte, sum, count, sql } from 'drizzle-orm'
import { getSession } from '../lib/auth/session.js'

// Helper function to generate invoice number
const generateInvoiceNumber = async (clinicId) => {
    const currentYear = new Date().getFullYear()
    const prefix = `INV-${currentYear}-`
    
    // Get the last invoice number for this clinic and year
    const lastInvoice = await db
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(and(
            eq(invoices.clinicId, clinicId),
            sql`${invoices.invoiceNumber} LIKE ${prefix + '%'}`
        ))
        .orderBy(desc(invoices.createdAt))
        .limit(1)
    
    if (lastInvoice.length === 0) {
        return `${prefix}001`
    }
    
    // Extract the sequence number and increment
    const lastNumber = lastInvoice[0].invoiceNumber.split('-').pop()
    const nextNumber = (parseInt(lastNumber) + 1).toString().padStart(3, '0')
    
    return `${prefix}${nextNumber}`
}

// Get financial summary
export const getFinancialSummary = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { startDate, endDate } = req.query

        // Default to current month if no dates provided
        const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
        const end = endDate || new Date().toISOString().split('T')[0]

        // Total invoiced amount for period
        const totalInvoicedResult = await db
            .select({ total: sql`COALESCE(SUM(${invoices.total}), 0)` })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                gte(invoices.issueDate, start),
                lte(invoices.issueDate, end)
            ))

        // Total paid amount for period
        const totalPaidResult = await db
            .select({ total: sql`COALESCE(SUM(${payments.amount}), 0)` })
            .from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .where(and(
                eq(invoices.clinicId, clinicId),
                gte(payments.paymentDate, start),
                lte(payments.paymentDate, end)
            ))

        // Total outstanding (all pending invoices)
        const totalOutstandingResult = await db
            .select({ total: sql`COALESCE(SUM(${invoices.total}), 0)` })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                eq(invoices.status, 'pending')
            ))

        // Overdue invoices (due date passed and still pending)
        const overdueResult = await db
            .select({ 
                total: sql`COALESCE(SUM(${invoices.total}), 0)`,
                count: count(invoices.id)
            })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                eq(invoices.status, 'pending'),
                sql`${invoices.dueDate} < CURRENT_DATE`
            ))

        const summary = {
            totalInvoiced: parseFloat(totalInvoicedResult[0]?.total || 0),
            totalPaid: parseFloat(totalPaidResult[0]?.total || 0),
            totalOutstanding: parseFloat(totalOutstandingResult[0]?.total || 0),
            overdue: {
                count: overdueResult[0]?.count || 0,
                total: parseFloat(overdueResult[0]?.total || 0)
            }
        }

        res.json({ summary })

    } catch (error) {
        console.error('Get financial summary error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Get all invoices for clinic
export const getInvoices = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { status, patientId, appointmentId, startDate, endDate, page = 1, limit = 50 } = req.query

        const offset = (page - 1) * limit
        
        let whereConditions = [eq(invoices.clinicId, clinicId)]
        
        if (status) {
            whereConditions.push(eq(invoices.status, status))
        }
        
        if (patientId) {
            whereConditions.push(eq(invoices.patientId, patientId))
        }
        
        if (appointmentId) {
            whereConditions.push(eq(invoices.appointmentId, appointmentId))
        }
        
        if (startDate) {
            whereConditions.push(gte(invoices.issueDate, startDate))
        }
        
        if (endDate) {
            whereConditions.push(lte(invoices.issueDate, endDate))
        }

        const invoicesList = await db
            .select({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                issueDate: invoices.issueDate,
                dueDate: invoices.dueDate,
                amount: invoices.amount,
                tax: invoices.tax,
                total: invoices.total,
                status: invoices.status,
                notes: invoices.notes,
                createdAt: invoices.createdAt,
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                    email: patients.email,
                    phone: patients.phone
                },
                createdBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName
                }
            })
            .from(invoices)
            .leftJoin(patients, eq(invoices.patientId, patients.id))
            .leftJoin(profiles, eq(invoices.createdBy, profiles.id))
            .where(and(...whereConditions))
            .orderBy(desc(invoices.createdAt))
            .limit(limit)
            .offset(offset)

        res.json({ invoices: invoicesList })

    } catch (error) {
        console.error('Get invoices error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Get specific invoice with items
export const getInvoice = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const { invoiceId } = req.params

        const invoice = await db
            .select({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                issueDate: invoices.issueDate,
                dueDate: invoices.dueDate,
                amount: invoices.amount,
                tax: invoices.tax,
                total: invoices.total,
                status: invoices.status,
                notes: invoices.notes,
                createdAt: invoices.createdAt,
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName,
                    email: patients.email,
                    phone: patients.phone,
                    address: patients.address
                },
                createdBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName
                }
            })
            .from(invoices)
            .leftJoin(patients, eq(invoices.patientId, patients.id))
            .leftJoin(profiles, eq(invoices.createdBy, profiles.id))
            .where(eq(invoices.id, invoiceId))
            .limit(1)

        if (!invoice.length) {
            return res.status(404).json({ error: 'Invoice not found' })
        }

        // Get invoice items
        const items = await db
            .select({
                id: invoiceItems.id,
                description: invoiceItems.description,
                quantity: invoiceItems.quantity,
                price: invoiceItems.price,
                total: invoiceItems.total,
                service: {
                    id: services.id,
                    name: services.name,
                    description: services.description
                }
            })
            .from(invoiceItems)
            .leftJoin(services, eq(invoiceItems.serviceId, services.id))
            .where(eq(invoiceItems.invoiceId, invoiceId))

        // Get payments for this invoice
        const invoicePayments = await db
            .select({
                id: payments.id,
                amount: payments.amount,
                paymentDate: payments.paymentDate,
                paymentMethod: payments.paymentMethod,
                referenceNumber: payments.referenceNumber,
                notes: payments.notes,
                recordedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName
                }
            })
            .from(payments)
            .leftJoin(profiles, eq(payments.recordedBy, profiles.id))
            .where(eq(payments.invoiceId, invoiceId))
            .orderBy(desc(payments.paymentDate))

        res.json({
            invoice: {
                ...invoice[0],
                items,
                payments: invoicePayments
            }
        })

    } catch (error) {
        console.error('Get invoice error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Create new invoice
export const createInvoice = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { 
            patientId, 
            appointmentId, 
            visitId,
            dueDate, 
            tax = 0, 
            notes, 
            items = [] 
        } = req.body

        if (!patientId || !dueDate || !items.length) {
            return res.status(400).json({ 
                error: 'Patient ID, due date, and items are required' 
            })
        }

        // Calculate totals
        const amount = items.reduce((sum, item) => sum + (parseFloat(item.unitPrice || item.price) * item.quantity), 0)
        const taxAmount = parseFloat(tax)
        const total = amount + taxAmount

        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(clinicId)

        // Create invoice
        const [newInvoice] = await db
            .insert(invoices)
            .values({
                clinicId,
                patientId,
                appointmentId: appointmentId || null,
                visitId: visitId || null,
                invoiceNumber,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate,
                amount: amount.toFixed(2),
                tax: taxAmount.toFixed(2),
                total: total.toFixed(2),
                status: 'pending',
                notes,
                createdBy: session.user.id
            })
            .returning()

        // Create invoice items
        const itemsToInsert = items.map(item => ({
            invoiceId: newInvoice.id,
            serviceId: item.serviceId || null,
            description: item.description,
            quantity: item.quantity,
            price: parseFloat(item.unitPrice || item.price).toFixed(2),
            total: (parseFloat(item.unitPrice || item.price) * item.quantity).toFixed(2)
        }))

        await db.insert(invoiceItems).values(itemsToInsert)

        res.status(201).json({
            message: 'Invoice created successfully',
            invoice: newInvoice
        })

    } catch (error) {
        console.error('Create invoice error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Update invoice
export const updateInvoice = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const { invoiceId } = req.params
        const { dueDate, tax, notes, status } = req.body

        const updateData = {}
        if (dueDate) updateData.dueDate = dueDate
        if (tax !== undefined) updateData.tax = parseFloat(tax).toFixed(2)
        if (notes !== undefined) updateData.notes = notes
        if (status) updateData.status = status
        
        updateData.updatedAt = new Date()

        const [updatedInvoice] = await db
            .update(invoices)
            .set(updateData)
            .where(eq(invoices.id, invoiceId))
            .returning()

        res.json({
            message: 'Invoice updated successfully',
            invoice: updatedInvoice
        })

    } catch (error) {
        console.error('Update invoice error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Delete invoice
export const deleteInvoice = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const { invoiceId } = req.params

        // Check if invoice has payments
        const existingPayments = await db
            .select()
            .from(payments)
            .where(eq(payments.invoiceId, invoiceId))
            .limit(1)

        if (existingPayments.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete invoice with recorded payments' 
            })
        }

        // Delete invoice items first
        await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId))
        
        // Delete invoice
        await db.delete(invoices).where(eq(invoices.id, invoiceId))

        res.json({ message: 'Invoice deleted successfully' })

    } catch (error) {
        console.error('Delete invoice error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Get payments
export const getPayments = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { invoiceId, startDate, endDate, page = 1, limit = 50 } = req.query

        const offset = (page - 1) * limit
        
        let whereConditions = [eq(invoices.clinicId, clinicId)]
        
        if (invoiceId) {
            whereConditions.push(eq(payments.invoiceId, invoiceId))
        }
        
        if (startDate) {
            whereConditions.push(gte(payments.paymentDate, startDate))
        }
        
        if (endDate) {
            whereConditions.push(lte(payments.paymentDate, endDate))
        }

        const paymentsList = await db
            .select({
                id: payments.id,
                amount: payments.amount,
                paymentDate: payments.paymentDate,
                paymentMethod: payments.paymentMethod,
                referenceNumber: payments.referenceNumber,
                notes: payments.notes,
                createdAt: payments.createdAt,
                invoice: {
                    id: invoices.id,
                    invoiceNumber: invoices.invoiceNumber,
                    total: invoices.total,
                    status: invoices.status
                },
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName
                },
                recordedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName
                }
            })
            .from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .leftJoin(patients, eq(invoices.patientId, patients.id))
            .leftJoin(profiles, eq(payments.recordedBy, profiles.id))
            .where(and(...whereConditions))
            .orderBy(desc(payments.paymentDate))
            .limit(limit)
            .offset(offset)

        res.json({ payments: paymentsList })

    } catch (error) {
        console.error('Get payments error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Get specific payment
export const getPayment = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const { paymentId } = req.params

        const payment = await db
            .select({
                id: payments.id,
                amount: payments.amount,
                paymentDate: payments.paymentDate,
                paymentMethod: payments.paymentMethod,
                referenceNumber: payments.referenceNumber,
                notes: payments.notes,
                createdAt: payments.createdAt,
                invoice: {
                    id: invoices.id,
                    invoiceNumber: invoices.invoiceNumber,
                    total: invoices.total,
                    status: invoices.status
                },
                patient: {
                    id: patients.id,
                    firstName: patients.firstName,
                    lastName: patients.lastName
                },
                recordedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName
                }
            })
            .from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .leftJoin(patients, eq(invoices.patientId, patients.id))
            .leftJoin(profiles, eq(payments.recordedBy, profiles.id))
            .where(eq(payments.id, paymentId))
            .limit(1)

        if (!payment.length) {
            return res.status(404).json({ error: 'Payment not found' })
        }

        res.json({ payment: payment[0] })

    } catch (error) {
        console.error('Get payment error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Create payment
export const createPayment = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const { 
            invoiceId, 
            amount, 
            paymentDate, 
            paymentMethod, 
            referenceNumber, 
            notes 
        } = req.body

        if (!invoiceId || !amount || !paymentDate || !paymentMethod) {
            return res.status(400).json({ 
                error: 'Invoice ID, amount, payment date, and payment method are required' 
            })
        }

        // Check if invoice exists
        const invoice = await db
            .select()
            .from(invoices)
            .where(eq(invoices.id, invoiceId))
            .limit(1)

        if (!invoice.length) {
            return res.status(404).json({ error: 'Invoice not found' })
        }

        // Calculate remaining balance
        const existingPayments = await db
            .select({ total: sql`COALESCE(SUM(${payments.amount}), 0)` })
            .from(payments)
            .where(eq(payments.invoiceId, invoiceId))

        const totalPaid = parseFloat(existingPayments[0]?.total || 0)
        const invoiceTotal = parseFloat(invoice[0].total)
        const remainingBalance = invoiceTotal - totalPaid
        const paymentAmount = parseFloat(amount)

        if (paymentAmount > remainingBalance) {
            return res.status(400).json({ 
                error: `Payment amount exceeds remaining balance (${remainingBalance.toFixed(2)})` 
            })
        }

        // Create payment
        const [newPayment] = await db
            .insert(payments)
            .values({
                invoiceId,
                amount: paymentAmount.toFixed(2),
                paymentDate,
                paymentMethod,
                referenceNumber: referenceNumber || null,
                notes: notes || null,
                recordedBy: session.user.id
            })
            .returning()

        // Check if invoice is fully paid and update status
        const newTotalPaid = totalPaid + paymentAmount
        if (newTotalPaid >= invoiceTotal) {
            await db
                .update(invoices)
                .set({ status: 'paid', updatedAt: new Date() })
                .where(eq(invoices.id, invoiceId))
        }

        res.status(201).json({
            message: 'Payment recorded successfully',
            payment: newPayment
        })

    } catch (error) {
        console.error('Create payment error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Get services
export const getServices = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { isActive } = req.query

        let whereConditions = [eq(services.clinicId, clinicId)]
        
        if (isActive !== undefined) {
            whereConditions.push(eq(services.isActive, isActive === 'true'))
        }

        const servicesList = await db
            .select()
            .from(services)
            .where(and(...whereConditions))
            .orderBy(asc(services.name))

        res.json({ services: servicesList })

    } catch (error) {
        console.error('Get services error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

export const getService = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const { serviceId } = req.params
        const clinicId = req.userClinic.id

        // Get the service and verify it belongs to the user's clinic
        const service = await db
            .select()
            .from(services)
            .where(and(
                eq(services.id, serviceId),
                eq(services.clinicId, clinicId)
            ))
            .limit(1)

        if (!service || service.length === 0) {
            return res.status(404).json({ error: 'Service not found' })
        }

        res.json({
            message: 'Service retrieved successfully',
            service: service[0]
        })

    } catch (error) {
        console.error('Get service error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Create service
export const createService = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id; // Get clinic ID from authenticated user
        const { name, description, price, durationMinutes } = req.body

        if (!name || !price) {
            return res.status(400).json({ error: 'Name and price are required' })
        }

        const [newService] = await db
            .insert(services)
            .values({
                clinicId,
                name,
                description: description || null,
                price: parseFloat(price).toFixed(2),
                durationMinutes: durationMinutes || null,
                isActive: true
            })
            .returning()

        res.status(201).json({
            message: 'Service created successfully',
            service: newService
        })

    } catch (error) {
        console.error('Create service error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Update service
export const updateService = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const { serviceId } = req.params
        const { name, description, price, durationMinutes, isActive } = req.body

        const updateData = {}
        if (name) updateData.name = name
        if (description !== undefined) updateData.description = description
        if (price !== undefined) updateData.price = parseFloat(price).toFixed(2)
        if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes
        if (isActive !== undefined) updateData.isActive = isActive
        
        updateData.updatedAt = new Date()

        const [updatedService] = await db
            .update(services)
            .set(updateData)
            .where(eq(services.id, serviceId))
            .returning()

        res.json({
            message: 'Service updated successfully',
            service: updatedService
        })

    } catch (error) {
        console.error('Update service error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Delete service
export const deleteService = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const { serviceId } = req.params

        // Check if service is used in any invoice items
        const existingInvoiceItems = await db
            .select()
            .from(invoiceItems)
            .where(eq(invoiceItems.serviceId, serviceId))
            .limit(1)

        if (existingInvoiceItems.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete service that has been used in invoices' 
            })
        }

        await db.delete(services).where(eq(services.id, serviceId))

        res.json({ message: 'Service deleted successfully' })

    } catch (error) {
        console.error('Delete service error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
} 

// ===== CASH DRAWER MANAGEMENT =====

// Open cash drawer
export const openCashDrawer = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id
        const { openingAmount = 0, notes } = req.body

        // Check if there's already an open drawer
        const openDrawer = await db
            .select()
            .from(cashDrawers)
            .where(and(
                eq(cashDrawers.clinicId, clinicId),
                eq(cashDrawers.status, 'open')
            ))
            .limit(1)

        if (openDrawer.length > 0) {
            return res.status(400).json({ 
                error: 'There is already an open cash drawer. Please close it first.' 
            })
        }

        const [newDrawer] = await db
            .insert(cashDrawers)
            .values({
                clinicId,
                openedBy: session.user.id,
                openingAmount: parseFloat(openingAmount).toFixed(2),
                notes: notes || null
            })
            .returning()

        res.status(201).json({
            message: 'Cash drawer opened successfully',
            drawer: newDrawer
        })

    } catch (error) {
        console.error('Open cash drawer error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Close cash drawer
export const closeCashDrawer = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id
        const { closingAmount, notes } = req.body

        if (!closingAmount) {
            return res.status(400).json({ error: 'Closing amount is required' })
        }

        // Get the open drawer
        const [openDrawer] = await db
            .select()
            .from(cashDrawers)
            .where(and(
                eq(cashDrawers.clinicId, clinicId),
                eq(cashDrawers.status, 'open')
            ))
            .limit(1)

        if (!openDrawer) {
            return res.status(404).json({ error: 'No open cash drawer found' })
        }

        // Calculate totals from payments made during this drawer session
        const paymentTotals = await db
            .select({
                cashTotal: sql`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'cash' THEN ${payments.amount} ELSE 0 END), 0)`,
                cardTotal: sql`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'card' THEN ${payments.amount} ELSE 0 END), 0)`,
                otherTotal: sql`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} NOT IN ('cash', 'card') THEN ${payments.amount} ELSE 0 END), 0)`
            })
            .from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .where(and(
                eq(invoices.clinicId, clinicId),
                gte(payments.createdAt, openDrawer.openedAt)
            ))

        const [updatedDrawer] = await db
            .update(cashDrawers)
            .set({
                closedBy: session.user.id,
                closedAt: new Date(),
                closingAmount: parseFloat(closingAmount).toFixed(2),
                totalCashCollected: parseFloat(paymentTotals[0]?.cashTotal || 0).toFixed(2),
                totalCardCollected: parseFloat(paymentTotals[0]?.cardTotal || 0).toFixed(2),
                totalOtherCollected: parseFloat(paymentTotals[0]?.otherTotal || 0).toFixed(2),
                status: 'closed',
                notes: notes || null,
                updatedAt: new Date()
            })
            .where(eq(cashDrawers.id, openDrawer.id))
            .returning()

        res.json({
            message: 'Cash drawer closed successfully',
            drawer: updatedDrawer,
            summary: {
                openingAmount: openDrawer.openingAmount,
                closingAmount: closingAmount,
                cashCollected: paymentTotals[0]?.cashTotal || 0,
                cardCollected: paymentTotals[0]?.cardTotal || 0,
                otherCollected: paymentTotals[0]?.otherTotal || 0
            }
        })

    } catch (error) {
        console.error('Close cash drawer error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Get current cash drawer status
export const getCashDrawerStatus = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id

        // Get current open drawer
        const openDrawer = await db
            .select({
                id: cashDrawers.id,
                openedAt: cashDrawers.openedAt,
                openingAmount: cashDrawers.openingAmount,
                notes: cashDrawers.notes,
                openedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName
                }
            })
            .from(cashDrawers)
            .leftJoin(profiles, eq(cashDrawers.openedBy, profiles.id))
            .where(and(
                eq(cashDrawers.clinicId, clinicId),
                eq(cashDrawers.status, 'open')
            ))
            .limit(1)

        if (openDrawer.length === 0) {
            return res.json({ 
                status: 'closed',
                message: 'No open cash drawer'
            })
        }

        // Get payment totals for this drawer session
        const paymentTotals = await db
            .select({
                cashTotal: sql`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'cash' THEN ${payments.amount} ELSE 0 END), 0)`,
                cardTotal: sql`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'card' THEN ${payments.amount} ELSE 0 END), 0)`,
                otherTotal: sql`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} NOT IN ('cash', 'card') THEN ${payments.amount} ELSE 0 END), 0)`,
                totalPayments: count(payments.id)
            })
            .from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .where(and(
                eq(invoices.clinicId, clinicId),
                gte(payments.createdAt, openDrawer[0].openedAt)
            ))

        res.json({
            status: 'open',
            drawer: openDrawer[0],
            totals: {
                cashCollected: parseFloat(paymentTotals[0]?.cashTotal || 0),
                cardCollected: parseFloat(paymentTotals[0]?.cardTotal || 0),
                otherCollected: parseFloat(paymentTotals[0]?.otherTotal || 0),
                totalPayments: paymentTotals[0]?.totalPayments || 0
            }
        })

    } catch (error) {
        console.error('Get cash drawer status error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
}

// Get cash drawer history
export const getCashDrawerHistory = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id
        const { startDate, endDate, page = 1, limit = 50 } = req.query

        const offset = (page - 1) * limit
        
        let whereConditions = [eq(cashDrawers.clinicId, clinicId)]
        
        if (startDate) {
            whereConditions.push(gte(cashDrawers.openedAt, startDate))
        }
        
        if (endDate) {
            whereConditions.push(lte(cashDrawers.openedAt, endDate))
        }

        // First get the basic drawer data
        const drawers = await db
            .select({
                id: cashDrawers.id,
                drawerNumber: cashDrawers.id,
                openedAt: cashDrawers.openedAt,
                closedAt: cashDrawers.closedAt,
                openingAmount: cashDrawers.openingAmount,
                closingAmount: cashDrawers.closingAmount,
                totalCashCollected: cashDrawers.totalCashCollected,
                totalCardCollected: cashDrawers.totalCardCollected,
                totalOtherCollected: cashDrawers.totalOtherCollected,
                status: cashDrawers.status,
                notes: cashDrawers.notes,
                closedBy: cashDrawers.closedBy,
                openedBy: {
                    id: profiles.id,
                    firstName: profiles.firstName,
                    lastName: profiles.lastName
                }
            })
            .from(cashDrawers)
            .leftJoin(profiles, eq(cashDrawers.openedBy, profiles.id))
            .where(and(...whereConditions))
            .orderBy(desc(cashDrawers.openedAt))
            .limit(limit)
            .offset(offset)

        // Add closedBy information for each drawer
        const drawersWithClosedBy = await Promise.all(
            drawers.map(async (drawer) => {
                if (drawer.closedAt && drawer.closedBy) {
                    const closedByUser = await db
                        .select({
                            id: profiles.id,
                            firstName: profiles.firstName,
                            lastName: profiles.lastName
                        })
                        .from(profiles)
                        .where(eq(profiles.id, drawer.closedBy))
                        .limit(1);
                    
                    return {
                        ...drawer,
                        closedBy: closedByUser[0] || null
                    };
                }
                return {
                    ...drawer,
                    closedBy: null
                };
            })
        );

        res.json({ drawers: drawersWithClosedBy })

    } catch (error) {
        console.error('Get cash drawer history error:', error)
        res.status(500).json({ error: 'Internal server error' })
    }
} 

// Get advanced financial reports
export const getAdvancedReports = async (req, res) => {
    try {
        const session = await getSession(req)
        if (!session) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        const clinicId = req.userClinic.id
        const { startDate, endDate, period = 'month' } = req.query

        // Default to current month if no dates provided
        const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
        const end = endDate || new Date().toISOString().split('T')[0]

        // 1. Revenue Trends (daily/weekly/monthly breakdown)
        const revenueTrends = await getRevenueTrends(clinicId, start, end, period)

        // 2. Service Performance (revenue by service)
        const servicePerformance = await getServicePerformance(clinicId, start, end)

        // 3. Cash Flow Analysis
        const cashFlow = await getCashFlowAnalysis(clinicId, start, end)

        // 4. Top Revenue Services
        const topServices = await getTopServices(clinicId, start, end)

        // 5. Monthly Comparison
        const monthlyComparison = await getMonthlyComparison(clinicId)

        res.json({
            success: true,
            reports: {
                revenueTrends,
                servicePerformance,
                cashFlow,
                topServices,
                monthlyComparison
            }
        })

    } catch (error) {
        console.error('Error getting advanced reports:', error)
        res.status(500).json({ error: 'Failed to get advanced reports' })
    }
}

// Helper function to get revenue trends
const getRevenueTrends = async (clinicId, startDate, endDate, period) => {
    try {
        let dateFormat, groupBy
        switch (period) {
            case 'week':
                dateFormat = sql`TO_CHAR(${invoices.issueDate}, 'YYYY-WW')`
                groupBy = sql`TO_CHAR(${invoices.issueDate}, 'YYYY-WW')`
                break
            case 'month':
                dateFormat = sql`TO_CHAR(${invoices.issueDate}, 'YYYY-MM')`
                groupBy = sql`TO_CHAR(${invoices.issueDate}, 'YYYY-MM')`
                break
            case 'quarter':
                dateFormat = sql`TO_CHAR(${invoices.issueDate}, 'YYYY-Q')`
                groupBy = sql`TO_CHAR(${invoices.issueDate}, 'YYYY-Q')`
                break
            case 'year':
                dateFormat = sql`TO_CHAR(${invoices.issueDate}, 'YYYY')`
                groupBy = sql`TO_CHAR(${invoices.issueDate}, 'YYYY')`
                break
            default:
                dateFormat = sql`TO_CHAR(${invoices.issueDate}, 'YYYY-MM-DD')`
                groupBy = sql`TO_CHAR(${invoices.issueDate}, 'YYYY-MM-DD')`
        }

        const trends = await db
            .select({
                period: dateFormat,
                revenue: sql`COALESCE(SUM(${invoices.total}), 0)`,
                count: count(invoices.id)
            })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                gte(invoices.issueDate, startDate),
                lte(invoices.issueDate, endDate)
            ))
            .groupBy(groupBy)
            .orderBy(asc(groupBy))

        return trends.map(trend => ({
            period: trend.period,
            revenue: parseFloat(trend.revenue),
            count: trend.count
        }))

    } catch (error) {
        console.error('Error getting revenue trends:', error)
        return []
    }
}

// Helper function to get service performance
const getServicePerformance = async (clinicId, startDate, endDate) => {
    try {
        const performance = await db
            .select({
                serviceName: services.name,
                revenue: sql`COALESCE(SUM(${invoiceItems.total}), 0)`,
                count: count(invoiceItems.id)
            })
            .from(invoiceItems)
            .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
            .leftJoin(services, eq(invoiceItems.serviceId, services.id))
            .where(and(
                eq(invoices.clinicId, clinicId),
                gte(invoices.issueDate, startDate),
                lte(invoices.issueDate, endDate)
            ))
            .groupBy(services.name)
            .orderBy(desc(sql`COALESCE(SUM(${invoiceItems.total}), 0)`))

        return performance.map(item => ({
            name: item.serviceName || 'Other Services',
            revenue: parseFloat(item.revenue),
            count: item.count
        }))

    } catch (error) {
        console.error('Error getting service performance:', error)
        return []
    }
}

// Helper function to get cash flow analysis
const getCashFlowAnalysis = async (clinicId, startDate, endDate) => {
    try {
        const cashFlow = []

        // Income from payments
        const incomeResult = await db
            .select({
                total: sql`COALESCE(SUM(${payments.amount}), 0)`
            })
            .from(payments)
            .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
            .where(and(
                eq(invoices.clinicId, clinicId),
                gte(payments.paymentDate, startDate),
                lte(payments.paymentDate, endDate)
            ))

        if (parseFloat(incomeResult[0].total) > 0) {
            cashFlow.push({
                category: 'Income',
                description: 'Patient payments received',
                amount: parseFloat(incomeResult[0].total),
                type: 'income'
            })
        }

        // Outstanding invoices (potential income)
        const outstandingResult = await db
            .select({
                total: sql`COALESCE(SUM(${invoices.total}), 0)`
            })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                eq(invoices.status, 'pending'),
                gte(invoices.issueDate, startDate),
                lte(invoices.issueDate, endDate)
            ))

        if (parseFloat(outstandingResult[0].total) > 0) {
            cashFlow.push({
                category: 'Outstanding',
                description: 'Pending payments',
                amount: parseFloat(outstandingResult[0].total),
                type: 'pending'
            })
        }

        // Overdue invoices
        const overdueResult = await db
            .select({
                total: sql`COALESCE(SUM(${invoices.total}), 0)`
            })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                eq(invoices.status, 'pending'),
                sql`${invoices.dueDate} < CURRENT_DATE`,
                gte(invoices.issueDate, startDate),
                lte(invoices.issueDate, endDate)
            ))

        if (parseFloat(overdueResult[0].total) > 0) {
            cashFlow.push({
                category: 'Overdue',
                description: 'Past due payments',
                amount: parseFloat(overdueResult[0].total),
                type: 'overdue'
            })
        }

        return cashFlow

    } catch (error) {
        console.error('Error getting cash flow analysis:', error)
        return []
    }
}

// Helper function to get top services
const getTopServices = async (clinicId, startDate, endDate) => {
    try {
        // Get total revenue first
        const totalRevenueResult = await db
            .select({
                total: sql`COALESCE(SUM(${invoices.total}), 0)`
            })
            .from(invoices)
            .where(and(
                eq(invoices.clinicId, clinicId),
                gte(invoices.issueDate, startDate),
                lte(invoices.issueDate, endDate)
            ))

        const totalRevenue = parseFloat(totalRevenueResult[0].total)

        if (totalRevenue === 0) return []

        // Get top services
        const topServices = await db
            .select({
                serviceName: services.name,
                revenue: sql`COALESCE(SUM(${invoiceItems.total}), 0)`
            })
            .from(invoiceItems)
            .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
            .leftJoin(services, eq(invoiceItems.serviceId, services.id))
            .where(and(
                eq(invoices.clinicId, clinicId),
                gte(invoices.issueDate, startDate),
                lte(invoices.issueDate, endDate)
            ))
            .groupBy(services.name)
            .orderBy(desc(sql`COALESCE(SUM(${invoiceItems.total}), 0)`))
            .limit(5)

        return topServices.map(service => ({
            name: service.serviceName || 'Other Services',
            revenue: parseFloat(service.revenue),
            percentage: totalRevenue > 0 ? ((parseFloat(service.revenue) / totalRevenue) * 100).toFixed(1) : 0
        }))

    } catch (error) {
        console.error('Error getting top services:', error)
        return []
    }
}

// Helper function to get monthly comparison
const getMonthlyComparison = async (clinicId) => {
    try {
        const currentYear = new Date().getFullYear()
        const months = []

        for (let month = 0; month < 12; month++) {
            const startOfMonth = new Date(currentYear, month, 1)
            const endOfMonth = new Date(currentYear, month + 1, 0)

            // Current month data
            const currentMonthResult = await db
                .select({
                    revenue: sql`COALESCE(SUM(${invoices.total}), 0)`,
                    visits: count(invoices.id)
                })
                .from(invoices)
                .where(and(
                    eq(invoices.clinicId, clinicId),
                    gte(invoices.issueDate, startOfMonth.toISOString().split('T')[0]),
                    lte(invoices.issueDate, endOfMonth.toISOString().split('T')[0])
                ))

            // Previous month data for comparison
            const prevStartOfMonth = new Date(currentYear, month - 1, 1)
            const prevEndOfMonth = new Date(currentYear, month, 0)

            const prevMonthResult = await db
                .select({
                    revenue: sql`COALESCE(SUM(${invoices.total}), 0)`
                })
                .from(invoices)
                .where(and(
                    eq(invoices.clinicId, clinicId),
                    gte(invoices.issueDate, prevStartOfMonth.toISOString().split('T')[0]),
                    lte(invoices.issueDate, prevEndOfMonth.toISOString().split('T')[0])
                ))

            const currentRevenue = parseFloat(currentMonthResult[0].revenue)
            const prevRevenue = parseFloat(prevMonthResult[0].revenue)
            const growth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue * 100) : 0

            months.push({
                month: startOfMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                revenue: currentRevenue,
                visits: currentMonthResult[0].visits,
                growth: growth.toFixed(1)
            })
        }

        return months

    } catch (error) {
        console.error('Error getting monthly comparison:', error)
        return []
    }
} 