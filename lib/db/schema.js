import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    numeric,
    integer,
    jsonb,
    boolean,
    date,
    time,
    pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const appointmentStatusEnum = pgEnum('appointment_status', ['scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'doctor', 'nurse', 'receptionist']);
export const visitOriginEnum = pgEnum('visit_origin', ['scheduled', 'walk_in']);
export const visitStatusEnum = pgEnum('visit_status', ['scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show']);

// Core Tables
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable('profiles', {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const clinics = pgTable('clinics', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    address: text('address'),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 255 }),
    website: varchar('website', { length: 255 }),
    description: text('description'),
    timezone: varchar('timezone', { length: 50 }).default('UTC'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userRoles = pgTable('user_roles', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    clinicId: uuid('clinic_id').notNull(),
    role: userRoleEnum('role').default('doctor').notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const patients = pgTable('patients', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    dateOfBirth: date('date_of_birth'),
    gender: varchar('gender', { length: 20 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 20 }),
    address: text('address'),
    emergencyContactName: varchar('emergency_contact_name', { length: 255 }),
    emergencyContactPhone: varchar('emergency_contact_phone', { length: 20 }),
    bloodType: varchar('blood_type', { length: 10 }),
    allergies: jsonb('allergies').default([]),
    medicalConditions: jsonb('medical_conditions').default([]),
    notes: text('notes'),
    status: varchar('status', { length: 20 }).default('active'),
    needsFollowUp: boolean('needs_follow_up').default(false),
    consentForCommunication: boolean('consent_for_communication').default(false),
    consentForTreatment: boolean('consent_for_treatment').default(false),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const appointmentTypes = pgTable('appointment_types', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    durationMinutes: integer('duration_minutes').default(30).notNull(),
    color: varchar('color', { length: 7 }),
    defaultPrice: numeric('default_price', { precision: 10, scale: 2 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const appointments = pgTable('appointments', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    patientId: uuid('patient_id'),
    doctorId: uuid('doctor_id').notNull(),
    appointmentTypeId: uuid('appointment_type_id').notNull(),
    status: appointmentStatusEnum('status').default('scheduled').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    title: varchar('title', { length: 255 }),
    notes: text('notes'),
    reason: text('reason'),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// New Tables
export const appointmentReminders = pgTable('appointment_reminders', {
    id: uuid('id').primaryKey().defaultRandom(),
    appointmentId: uuid('appointment_id').notNull(),
    reminderTime: timestamp('reminder_time', { withTimezone: true }).notNull(),
    reminderType: text('reminder_type').notNull(),
    sent: boolean('sent').default(false).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id'),
    tableName: text('table_name').notNull(),
    recordId: uuid('record_id').notNull(),
    action: text('action').notNull(),
    oldData: jsonb('old_data'),
    newData: jsonb('new_data'),
    userId: uuid('user_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const departments = pgTable('departments', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable('documents', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    filePath: text('file_path').notNull(),
    fileSize: integer('file_size'),
    type: text('type'),
    mimeType: text('mime_type'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
    uploadedBy: uuid('uploaded_by').notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
});

export const invoices = pgTable('invoices', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    patientId: uuid('patient_id'),
    appointmentId: uuid('appointment_id'),
    visitId: uuid('visit_id'),
    invoiceNumber: text('invoice_number').notNull(),
    issueDate: date('issue_date').defaultNow().notNull(),
    dueDate: date('due_date').notNull(),
    amount: numeric('amount').notNull(),
    tax: numeric('tax').default('0').notNull(),
    total: numeric('total').notNull(),
    status: text('status').default('pending').notNull(),
    notes: text('notes'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const invoiceItems = pgTable('invoice_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id').notNull(),
    serviceId: uuid('service_id'),
    description: text('description').notNull(),
    quantity: integer('quantity').default(1).notNull(),
    price: numeric('price').notNull(),
    total: numeric('total').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const visits = pgTable('visits', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull(),
    clinicId: uuid('clinic_id').notNull(),
    appointmentId: uuid('appointment_id'),
    providerId: uuid('provider_id'),
    visitDate: timestamp('visit_date', { withTimezone: true }).notNull(),
    visitType: text('visit_type').notNull(),
    chiefComplaint: text('chief_complaint'),
    visitNotes: text('visit_notes'),
    diagnosis: jsonb('diagnosis').default([]),
    treatmentPlan: text('treatment_plan'),
    followUpInstructions: text('follow_up_instructions'),
    followUpDate: date('follow_up_date'),
    clinicalFindings: jsonb('clinical_findings').default([]),
    soapNotes: jsonb('soap_notes').default({}),
    origin: visitOriginEnum('origin').default('scheduled').notNull(),
    status: visitStatusEnum('status').default('scheduled').notNull(),
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(),
    recordedBy: uuid('recorded_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const patientDocuments = pgTable('patient_documents', {
    id: uuid('id').primaryKey().defaultRandom(),
    patientId: uuid('patient_id').notNull(),
    clinicId: uuid('clinic_id').notNull(),
    medicalVisitId: uuid('medical_visit_id'),
    documentType: text('document_type').notNull(),
    title: text('title').notNull(),
    fileUrl: text('file_url'),
    notes: text('notes'),
    uploadedBy: uuid('uploaded_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const labOrders = pgTable('lab_orders', {
    id: uuid('id').primaryKey().defaultRandom(),
    medicalVisitId: uuid('medical_visit_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    clinicId: uuid('clinic_id').notNull(),
    orderedBy: uuid('ordered_by').notNull(),
    orderDate: timestamp('order_date', { withTimezone: true }).notNull(),
    status: text('status').default('ordered').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const labOrderItems = pgTable('lab_order_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    labOrderId: uuid('lab_order_id').notNull(),
    testName: text('test_name').notNull(),
    testCode: text('test_code'),
    instructions: text('instructions'),
    status: text('status').default('ordered').notNull(),
    resultDocumentId: uuid('result_document_id'),
    resultNotes: text('result_notes'),
    resultDate: timestamp('result_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable('payments', {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id').notNull(),
    amount: numeric('amount').notNull(),
    paymentDate: date('payment_date').defaultNow().notNull(),
    paymentMethod: text('payment_method').notNull(),
    referenceNumber: text('reference_number'),
    notes: text('notes'),
    recordedBy: uuid('recorded_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Cash drawer tracking for daily collections
export const cashDrawers = pgTable('cash_drawers', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    openedBy: uuid('opened_by').notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
    closedBy: uuid('closed_by'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    openingAmount: numeric('opening_amount').default('0').notNull(),
    closingAmount: numeric('closing_amount'),
    totalCashCollected: numeric('total_cash_collected').default('0').notNull(),
    totalCardCollected: numeric('total_card_collected').default('0').notNull(),
    totalOtherCollected: numeric('total_other_collected').default('0').notNull(),
    status: text('status').default('open').notNull(), // 'open', 'closed'
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Payment tracking for better cash management
export const paymentTracking = pgTable('payment_tracking', {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id').notNull(),
    cashDrawerId: uuid('cash_drawer_id'),
    amount: numeric('amount').notNull(),
    paymentMethod: text('payment_method').notNull(),
    paymentDate: date('payment_date').defaultNow().notNull(),
    collectedBy: uuid('collected_by').notNull(),
    patientName: text('patient_name'),
    invoiceNumber: text('invoice_number'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const prescriptions = pgTable('prescriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    medicalVisitId: uuid('medical_visit_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    clinicId: uuid('clinic_id').notNull(),
    prescribedBy: uuid('prescribed_by').notNull(),
    prescriptionDate: timestamp('prescription_date', { withTimezone: true }).notNull(),
    status: text('status').default('active').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const prescriptionItems = pgTable('prescription_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    prescriptionId: uuid('prescription_id').notNull(),
    medicationName: text('medication_name').notNull(),
    dosage: text('dosage').notNull(),
    frequency: text('frequency').notNull(),
    route: text('route').notNull(),
    duration: text('duration'),
    quantity: integer('quantity'),
    refills: integer('refills').default(0).notNull(),
    instructions: text('instructions'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const services = pgTable('services', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    price: numeric('price').notNull(),
    durationMinutes: integer('duration_minutes'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Staff Scheduling Tables
export const shiftTypes = pgTable('shift_types', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull().references(() => clinics.id),
    name: varchar('name', { length: 255 }).notNull(), // e.g., "Morning Shift", "Evening Shift"
    startTime: time('start_time').notNull(), // e.g., "09:00:00"
    endTime: time('end_time').notNull(), // e.g., "17:00:00"
    color: varchar('color', { length: 7 }), // hex color for calendar display
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const staffSchedules = pgTable('staff_schedules', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    clinicId: uuid('clinic_id').notNull().references(() => clinics.id),
    shiftTypeId: uuid('shift_type_id').references(() => shiftTypes.id),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    monday: boolean('monday').default(false).notNull(),
    tuesday: boolean('tuesday').default(false).notNull(),
    wednesday: boolean('wednesday').default(false).notNull(),
    thursday: boolean('thursday').default(false).notNull(),
    friday: boolean('friday').default(false).notNull(),
    saturday: boolean('saturday').default(false).notNull(),
    sunday: boolean('sunday').default(false).notNull(),
    isRecurring: boolean('is_recurring').default(true).notNull(), // true for weekly recurring, false for one-time
    startDate: date('start_date'), // for one-time schedules
    endDate: date('end_date'), // for one-time schedules
    isActive: boolean('is_active').default(true).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const staffTimeOff = pgTable('staff_time_off', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    clinicId: uuid('clinic_id').notNull().references(() => clinics.id),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    startTime: time('start_time'), // optional, for partial day time off
    endTime: time('end_time'), // optional, for partial day time off
    reason: text('reason'),
    type: varchar('type', { length: 50 }).default('vacation').notNull(), // vacation, sick, personal, etc.
    status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, approved, rejected
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const scheduleOverrides = pgTable('schedule_overrides', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    clinicId: uuid('clinic_id').notNull().references(() => clinics.id),
    date: date('date').notNull(),
    originalStartTime: time('original_start_time'),
    originalEndTime: time('original_end_time'),
    newStartTime: time('new_start_time'),
    newEndTime: time('new_end_time'),
    reason: text('reason'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const vitals = pgTable('vitals', {
    id: uuid('id').primaryKey().defaultRandom(),
    medicalVisitId: uuid('medical_visit_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    clinicId: uuid('clinic_id').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    temperature: numeric('temperature'),
    bloodPressureSystolic: integer('blood_pressure_systolic'),
    bloodPressureDiastolic: integer('blood_pressure_diastolic'),
    pulseRate: integer('pulse_rate'),
    respiratoryRate: integer('respiratory_rate'),
    oxygenSaturation: numeric('oxygen_saturation'),
    height: numeric('height'),
    weight: numeric('weight'),
    bmi: numeric('bmi'),
    notes: text('notes'),
    recordedBy: uuid('recorded_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
    profile: one(profiles, {
        fields: [users.id],
        references: [profiles.id],
    }),
    userRoles: many(userRoles),
    createdPatients: many(patients, { relationName: 'PatientCreator' }),
    doctorAppointments: many(appointments, { relationName: 'DoctorAppointments' }),
    createdAppointments: many(appointments, { relationName: 'AppointmentCreator' }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
    user: one(users, {
        fields: [profiles.id],
        references: [users.id],
    }),
}));

export const clinicsRelations = relations(clinics, ({ many }) => ({
    userRoles: many(userRoles),
    patients: many(patients),
    appointmentTypes: many(appointmentTypes),
    appointments: many(appointments),
    departments: many(departments),
    documents: many(documents),
    invoices: many(invoices),
    medicalVisits: many(visits),
    patientDocuments: many(patientDocuments),
    labOrders: many(labOrders),
    prescriptions: many(prescriptions),
    services: many(services),
    staffSchedules: many(staffSchedules),
    staffTimeOff: many(staffTimeOff),
    vitals: many(vitals),
    auditLogs: many(auditLogs),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
    user: one(users, {
        fields: [userRoles.userId],
        references: [users.id],
    }),
    clinic: one(clinics, {
        fields: [userRoles.clinicId],
        references: [clinics.id],
    }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [patients.clinicId],
        references: [clinics.id],
    }),
    createdBy: one(users, {
        fields: [patients.createdBy],
        references: [users.id],
        relationName: 'PatientCreator',
    }),
    appointments: many(appointments),
    documents: many(documents),
    invoices: many(invoices),
    medicalVisits: many(visits),
    patientDocuments: many(patientDocuments),
    labOrders: many(labOrders),
    prescriptions: many(prescriptions),
    vitals: many(vitals),
}));

export const appointmentTypesRelations = relations(appointmentTypes, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [appointmentTypes.clinicId],
        references: [clinics.id],
    }),
    appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [appointments.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [appointments.patientId],
        references: [patients.id],
    }),
    doctor: one(users, {
        fields: [appointments.doctorId],
        references: [users.id],
        relationName: 'DoctorAppointments',
    }),
    appointmentType: one(appointmentTypes, {
        fields: [appointments.appointmentTypeId],
        references: [appointmentTypes.id],
    }),
    createdBy: one(users, {
        fields: [appointments.createdBy],
        references: [users.id],
        relationName: 'AppointmentCreator',
    }),
    reminders: many(appointmentReminders),
    invoices: many(invoices),
    medicalVisits: many(visits),
}));

// New table relations
export const appointmentRemindersRelations = relations(appointmentReminders, ({ one }) => ({
    appointment: one(appointments, {
        fields: [appointmentReminders.appointmentId],
        references: [appointments.id],
    }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    user: one(profiles, {
        fields: [auditLogs.userId],
        references: [profiles.id],
    }),
    clinic: one(clinics, {
        fields: [auditLogs.clinicId],
        references: [clinics.id],
    }),
}));

export const departmentsRelations = relations(departments, ({ one }) => ({
    clinic: one(clinics, {
        fields: [departments.clinicId],
        references: [clinics.id],
    }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
    clinic: one(clinics, {
        fields: [documents.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [documents.patientId],
        references: [patients.id],
    }),
    uploadedBy: one(profiles, {
        fields: [documents.uploadedBy],
        references: [profiles.id],
    }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [invoices.clinicId],
        references: [clinics.id],
    }),
    patient: one(patients, {
        fields: [invoices.patientId],
        references: [patients.id],
    }),
    appointment: one(appointments, {
        fields: [invoices.appointmentId],
        references: [appointments.id],
    }),
    createdBy: one(profiles, {
        fields: [invoices.createdBy],
        references: [profiles.id],
    }),
    items: many(invoiceItems),
    payments: many(payments),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
    invoice: one(invoices, {
        fields: [invoiceItems.invoiceId],
        references: [invoices.id],
    }),
    service: one(services, {
        fields: [invoiceItems.serviceId],
        references: [services.id],
    }),
}));

export const visitsRelations = relations(visits, ({ one, many }) => ({
    patient: one(patients, {
        fields: [visits.patientId],
        references: [patients.id],
    }),
    clinic: one(clinics, {
        fields: [visits.clinicId],
        references: [clinics.id],
    }),
    appointment: one(appointments, {
        fields: [visits.appointmentId],
        references: [appointments.id],
    }),
    provider: one(profiles, {
        fields: [visits.providerId],
        references: [profiles.id],
    }),
    createdBy: one(profiles, {
        fields: [visits.createdBy],
        references: [profiles.id],
    }),
    recordedBy: one(profiles, {
        fields: [visits.recordedBy],
        references: [profiles.id],
    }),
    documents: many(patientDocuments),
    labOrders: many(labOrders),
    prescriptions: many(prescriptions),
    vitals: many(vitals),
}));

export const patientDocumentsRelations = relations(patientDocuments, ({ one }) => ({
    patient: one(patients, {
        fields: [patientDocuments.patientId],
        references: [patients.id],
    }),
    clinic: one(clinics, {
        fields: [patientDocuments.clinicId],
        references: [clinics.id],
    }),
    medicalVisit: one(visits, {
        fields: [patientDocuments.medicalVisitId],
        references: [visits.id],
    }),
    uploadedBy: one(profiles, {
        fields: [patientDocuments.uploadedBy],
        references: [profiles.id],
    }),
}));

export const labOrdersRelations = relations(labOrders, ({ one, many }) => ({
    medicalVisit: one(visits, {
        fields: [labOrders.medicalVisitId],
        references: [visits.id],
    }),
    patient: one(patients, {
        fields: [labOrders.patientId],
        references: [patients.id],
    }),
    clinic: one(clinics, {
        fields: [labOrders.clinicId],
        references: [clinics.id],
    }),
    orderedBy: one(profiles, {
        fields: [labOrders.orderedBy],
        references: [profiles.id],
    }),
    items: many(labOrderItems),
}));

export const labOrderItemsRelations = relations(labOrderItems, ({ one }) => ({
    labOrder: one(labOrders, {
        fields: [labOrderItems.labOrderId],
        references: [labOrders.id],
    }),
    resultDocument: one(patientDocuments, {
        fields: [labOrderItems.resultDocumentId],
        references: [patientDocuments.id],
    }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
    invoice: one(invoices, {
        fields: [payments.invoiceId],
        references: [invoices.id],
    }),
    recordedBy: one(profiles, {
        fields: [payments.recordedBy],
        references: [profiles.id],
    }),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one, many }) => ({
    medicalVisit: one(visits, {
        fields: [prescriptions.medicalVisitId],
        references: [visits.id],
    }),
    patient: one(patients, {
        fields: [prescriptions.patientId],
        references: [patients.id],
    }),
    clinic: one(clinics, {
        fields: [prescriptions.clinicId],
        references: [clinics.id],
    }),
    prescribedBy: one(profiles, {
        fields: [prescriptions.prescribedBy],
        references: [profiles.id],
    }),
    items: many(prescriptionItems),
}));

export const prescriptionItemsRelations = relations(prescriptionItems, ({ one }) => ({
    prescription: one(prescriptions, {
        fields: [prescriptionItems.prescriptionId],
        references: [prescriptions.id],
    }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [services.clinicId],
        references: [clinics.id],
    }),
    invoiceItems: many(invoiceItems),
}));

export const shiftTypesRelations = relations(shiftTypes, ({ one, many }) => ({
    clinic: one(clinics, {
        fields: [shiftTypes.clinicId],
        references: [clinics.id],
    }),
    staffSchedules: many(staffSchedules),
}));

export const staffSchedulesRelations = relations(staffSchedules, ({ one }) => ({
    user: one(users, {
        fields: [staffSchedules.userId],
        references: [users.id],
    }),
    clinic: one(clinics, {
        fields: [staffSchedules.clinicId],
        references: [clinics.id],
    }),
    shiftType: one(shiftTypes, {
        fields: [staffSchedules.shiftTypeId],
        references: [shiftTypes.id],
    }),
}));

export const staffTimeOffRelations = relations(staffTimeOff, ({ one }) => ({
    user: one(users, {
        fields: [staffTimeOff.userId],
        references: [users.id],
    }),
    clinic: one(clinics, {
        fields: [staffTimeOff.clinicId],
        references: [clinics.id],
    }),
    approvedByUser: one(users, {
        fields: [staffTimeOff.approvedBy],
        references: [users.id],
    }),
}));

export const scheduleOverridesRelations = relations(scheduleOverrides, ({ one }) => ({
    user: one(users, {
        fields: [scheduleOverrides.userId],
        references: [users.id],
    }),
    clinic: one(clinics, {
        fields: [scheduleOverrides.clinicId],
        references: [clinics.id],
    }),
}));

// Staff Invitation Table (for invitation codes)
export const staffInvitations = pgTable('staff_invitations', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull().references(() => clinics.id),
    code: varchar('code', { length: 8 }).notNull().unique(),
    role: userRoleEnum('role').default('doctor').notNull(),
    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    notes: text('notes'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isUsed: boolean('is_used').default(false).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedBy: uuid('used_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const vitalsRelations = relations(vitals, ({ one }) => ({
    medicalVisit: one(visits, {
        fields: [vitals.medicalVisitId],
        references: [visits.id],
    }),
    patient: one(patients, {
        fields: [vitals.patientId],
        references: [patients.id],
    }),
    clinic: one(clinics, {
        fields: [vitals.clinicId],
        references: [clinics.id],
    }),
    recordedBy: one(profiles, {
        fields: [vitals.recordedBy],
        references: [profiles.id],
    }),
}));

// Staff Invitation Relations
export const staffInvitationsRelations = relations(staffInvitations, ({ one }) => ({
    clinic: one(clinics, {
        fields: [staffInvitations.clinicId],
        references: [clinics.id],
    }),
    usedBy: one(users, {
        fields: [staffInvitations.usedBy],
        references: [users.id],
    }),
}));

// Notifications Table
export const notifications = pgTable('notifications', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull().references(() => clinics.id),
    type: varchar('type', { length: 50 }).notNull(), // 'appointment_reminder', 'system', 'billing', etc.
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    data: jsonb('data').default({}), // Additional data for the notification
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notifications Relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
    clinic: one(clinics, {
        fields: [notifications.clinicId],
        references: [clinics.id],
    }),
}));

// Activity logging for comprehensive audit trail
export const activityLogs = pgTable('activity_logs', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    userId: uuid('user_id').notNull(),
    action: text('action').notNull(), // 'create', 'update', 'delete', 'view', 'login', 'logout', 'export'
    entityType: text('entity_type').notNull(), // 'patient', 'visit', 'invoice', 'payment', 'user', 'settings'
    entityId: uuid('entity_id'), // ID of the affected record
    oldValues: jsonb('old_values'), // Previous state (for updates)
    newValues: jsonb('new_values'), // New state (for updates)
    description: text('description'), // Human-readable description
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    sessionId: text('session_id'),
    metadata: jsonb('metadata').default({}), // Additional context
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Audit trail for sensitive operations
export const auditTrails = pgTable('audit_trails', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    userId: uuid('user_id').notNull(),
    action: text('action').notNull(), // 'data_export', 'settings_change', 'user_access', 'financial_operation'
    resource: text('resource').notNull(), // What was accessed/modified
    details: jsonb('details').notNull(), // Detailed information
    riskLevel: text('risk_level').default('low'), // 'low', 'medium', 'high', 'critical'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// System health monitoring
export const systemMetrics = pgTable('system_metrics', {
    id: uuid('id').primaryKey().defaultRandom(),
    clinicId: uuid('clinic_id').notNull(),
    metricType: text('metric_type').notNull(), // 'performance', 'error', 'usage', 'security'
    metricName: text('metric_name').notNull(), // 'api_response_time', 'error_rate', 'active_users'
    value: numeric('value').notNull(),
    unit: text('unit'), // 'ms', 'count', 'percentage'
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata').default({}),
});

// User session tracking
export const userSessions = pgTable('user_sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    clinicId: uuid('clinic_id').notNull(),
    sessionToken: text('session_token').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    deviceInfo: jsonb('device_info').default({}),
    loginTime: timestamp('login_time', { withTimezone: true }).defaultNow().notNull(),
    logoutTime: timestamp('logout_time', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    lastActivity: timestamp('last_activity', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});