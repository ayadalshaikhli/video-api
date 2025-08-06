import { db } from './drizzle.js';
import { 
    clinics, 
    users, 
    profiles, 
    userRoles, 
    patients, 
    appointmentTypes, 
    appointments, 
    visits, 
    prescriptions, 
    labOrders,
    services,
    invoices,
    payments
} from './schema.js';
import { hashPassword } from '../auth/session.js';
import { eq } from 'drizzle-orm';

async function createClinic() {
  console.log('Creating clinic...');
  
  const [clinic] = await db.insert(clinics).values({
    name: 'Central Medical Clinic',
    address: '123 Main Street, City, State 12345',
    phone: '(555) 123-4567',
    email: 'contact@centralmedical.com',
    website: 'https://centralmedical.com',
    description: 'A comprehensive medical clinic providing quality healthcare services.',
    timezone: 'America/New_York',
    isActive: true,
  }).returning();

  console.log('✅ Clinic created successfully');
  return clinic;
}

async function createAdminUser(clinicId) {
  console.log('Creating admin user...');
  
  const email = 'admin@centralmedical.com';
  
  // Check if user already exists
  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  let user;
  if (existingUser.length === 0) {
    const password = 'admin123';
    const passwordHash = await hashPassword(password);
    
    [user] = await db.insert(users).values({
      email: email,
      passwordHash: passwordHash,
    }).returning();
    
    // Create profile
    await db.insert(profiles).values({
      id: user.id,
      email: email,
      firstName: 'Admin',
      lastName: 'User',
      phone: '(555) 123-4567',
    });
    
    console.log('✅ Admin user created');
  } else {
    user = existingUser[0];
    console.log('✅ Admin user already exists');
  }

  // Create user role
  await db.insert(userRoles).values({
    userId: user.id,
    clinicId: clinicId,
    role: 'admin',
    isActive: true,
  });

  console.log('✅ Admin role assigned');
  return user;
}

async function createDepartments(clinicId) {
  console.log('Creating departments...');
  
  const departmentData = [
    {
      clinicId: clinicId,
      name: 'General Medicine',
      description: 'General medical consultations and checkups',
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'Pediatrics',
      description: 'Medical care for children and adolescents',
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'Cardiology',
      description: 'Heart and cardiovascular care',
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'Dermatology',
      description: 'Skin and dermatological treatments',
      isActive: true,
    },
  ];

  await db.insert(departments).values(departmentData);
  console.log('✅ Departments created successfully');
}

async function createAppointmentTypes(clinicId) {
  console.log('Creating appointment types...');
  
  const appointmentTypeData = [
    {
      clinicId: clinicId,
      name: 'Consultation',
      description: 'General medical consultation',
      durationMinutes: 30,
      color: '#3B82F6',
      defaultPrice: '75.00',
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'Follow-up',
      description: 'Follow-up appointment',
      durationMinutes: 15,
      color: '#10B981',
      defaultPrice: '50.00',
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'Physical Exam',
      description: 'Annual physical examination',
      durationMinutes: 45,
      color: '#F59E0B',
      defaultPrice: '150.00',
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'Vaccination',
      description: 'Vaccination appointment',
      durationMinutes: 15,
      color: '#EF4444',
      defaultPrice: '25.00',
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'Lab Review',
      description: 'Review of laboratory results',
      durationMinutes: 20,
      color: '#8B5CF6',
      defaultPrice: '40.00',
      isActive: true,
    },
  ];

  await db.insert(appointmentTypes).values(appointmentTypeData);
  console.log('✅ Appointment types created successfully');
}

async function createServices(clinicId) {
  console.log('Creating services...');
  
  const serviceData = [
    {
      clinicId: clinicId,
      name: 'General Consultation',
      description: 'Standard medical consultation',
      price: '75.00',
      durationMinutes: 30,
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'Blood Test',
      description: 'Complete blood count and basic metabolic panel',
      price: '85.00',
      durationMinutes: 10,
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'EKG',
      description: 'Electrocardiogram',
      price: '120.00',
      durationMinutes: 15,
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'X-Ray',
      description: 'Standard X-ray imaging',
      price: '150.00',
      durationMinutes: 20,
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'Flu Shot',
      description: 'Annual influenza vaccination',
      price: '25.00',
      durationMinutes: 5,
      isActive: true,
    },
    {
      clinicId: clinicId,
      name: 'Physical Therapy Session',
      description: 'One-hour physical therapy session',
      price: '95.00',
      durationMinutes: 60,
      isActive: true,
    },
  ];

  await db.insert(services).values(serviceData);
  console.log('✅ Services created successfully');
}

async function createSamplePatients(clinicId, createdBy) {
  console.log('Creating sample patients...');
  
  const samplePatients = [
    {
      clinicId: clinicId,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1985-03-15',
      gender: 'Male',
      email: 'john.doe@email.com',
      phone: '(555) 234-5678',
      address: '456 Oak Street, City, State 12345',
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '(555) 234-5679',
      bloodType: 'O+',
      allergies: ['Penicillin'],
      medicalConditions: ['Hypertension'],
      notes: 'Patient has history of high blood pressure.',
      needsFollowUp: false,
      consentForCommunication: true,
      consentForTreatment: true,
      createdBy: createdBy,
    },
    {
      clinicId: clinicId,
      firstName: 'Sarah',
      lastName: 'Smith',
      dateOfBirth: '1990-07-22',
      gender: 'Female',
      email: 'sarah.smith@email.com',
      phone: '(555) 345-6789',
      address: '789 Pine Avenue, City, State 12345',
      emergencyContactName: 'Michael Smith',
      emergencyContactPhone: '(555) 345-6790',
      bloodType: 'A+',
      allergies: ['Shellfish'],
      medicalConditions: ['Asthma'],
      notes: 'Patient uses inhaler as needed.',
      needsFollowUp: true,
      consentForCommunication: true,
      consentForTreatment: true,
      createdBy: createdBy,
    },
  ];

  const createdPatients = await db.insert(patients).values(samplePatients).returning();
  console.log('✅ Sample patients created successfully');
  
  return createdPatients;
}

async function createSampleMedicalData(clinicId, adminUserId, patientsData) {
  console.log('Creating sample medical data...');
  
  if (!patientsData || patientsData.length === 0) {
    console.log('No patients found, skipping medical data creation');
    return;
  }

  const [patient1, patient2] = patientsData;

  // Create sample medical visits
  const sampleVisits = [
    {
      clinicId: clinicId,
      patientId: patient1.id,
      providerId: adminUserId,
      visitDate: new Date('2024-01-15'),
      visitType: 'Annual Physical',
      chiefComplaint: 'Annual checkup and blood pressure monitoring',
      visitNotes: 'Patient is doing well overall. Blood pressure is well controlled with current medication.',
      diagnosis: ['Hypertension - well controlled'],
      treatmentPlan: 'Continue current medication regimen. Lifestyle modifications discussed.',
      followUpInstructions: 'Follow up in 6 months or sooner if symptoms worsen.',
      followUpDate: '2024-07-15',
      status: 'completed',
      createdBy: adminUserId,
      recordedBy: adminUserId,
    },
    {
      clinicId: clinicId,
      patientId: patient2.id,
      providerId: adminUserId,
      visitDate: new Date('2024-01-20'),
      visitType: 'Follow-up',
      chiefComplaint: 'Asthma follow-up and inhaler refill',
      visitNotes: 'Patient reports good asthma control with current inhaler. No recent exacerbations.',
      diagnosis: ['Asthma - well controlled'],
      treatmentPlan: 'Continue current inhaler. Reviewed proper inhaler technique.',
      followUpInstructions: 'Use inhaler as needed. Return if symptoms worsen.',
      followUpDate: '2024-04-20',
      status: 'active',
      createdBy: adminUserId,
      recordedBy: adminUserId,
    }
  ];

  const createdVisits = await db.insert(visits).values(sampleVisits).returning();

  // Create sample prescriptions
  const samplePrescriptions = [
    {
      clinicId: clinicId,
      patientId: patient1.id,
      medicalVisitId: createdVisits[0].id,
      prescribedBy: adminUserId,
      prescriptionDate: new Date('2024-01-15'),
      status: 'active',
      notes: 'Continue current blood pressure medication',
    },
    {
      clinicId: clinicId,
      patientId: patient2.id,
      medicalVisitId: createdVisits[1].id,
      prescribedBy: adminUserId,
      prescriptionDate: new Date('2024-01-20'),
      status: 'active',
      notes: 'Inhaler refill for asthma control',
    }
  ];

  const createdPrescriptions = await db.insert(prescriptions).values(samplePrescriptions).returning();

  // Create prescription items
  const prescriptionItemsData = [
    {
      prescriptionId: createdPrescriptions[0].id,
      medicationName: 'Lisinopril',
      dosage: '10mg',
      frequency: 'Once daily',
      route: 'Oral',
      duration: '90 days',
      quantity: 90,
      refills: 3,
      instructions: 'Take with food, preferably in the morning',
    },
    {
      prescriptionId: createdPrescriptions[1].id,
      medicationName: 'Albuterol Inhaler',
      dosage: '90mcg',
      frequency: 'As needed',
      route: 'Inhalation',
      quantity: 1,
      refills: 2,
      instructions: 'Use as needed for asthma symptoms. Shake well before use.',
    }
  ];

  await db.insert(prescriptionItems).values(prescriptionItemsData);

  // Create sample lab orders
  const sampleLabOrders = [
    {
      clinicId: clinicId,
      patientId: patient1.id,
      medicalVisitId: createdVisits[0].id,
      orderedBy: adminUserId,
      orderDate: new Date('2024-01-15'),
      status: 'completed',
      notes: 'Routine annual labs for hypertension monitoring',
    },
    {
      clinicId: clinicId,
      patientId: patient2.id,
      medicalVisitId: createdVisits[1].id,
      orderedBy: adminUserId,
      orderDate: new Date('2024-01-20'),
      status: 'ordered',
      notes: 'Allergy testing as requested',
    }
  ];

  const createdLabOrders = await db.insert(labOrders).values(sampleLabOrders).returning();

  // Create lab order items
  const labOrderItemsData = [
    {
      labOrderId: createdLabOrders[0].id,
      testName: 'Complete Blood Count (CBC)',
      testCode: 'CBC',
      instructions: 'Fasting not required',
      status: 'completed',
      resultNotes: 'All values within normal limits',
      resultDate: new Date('2024-01-17'),
    },
    {
      labOrderId: createdLabOrders[0].id,
      testName: 'Basic Metabolic Panel (BMP)',
      testCode: 'BMP',
      instructions: 'Fasting for 8-12 hours required',
      status: 'completed',
      resultNotes: 'Glucose slightly elevated, recommend dietary modifications',
      resultDate: new Date('2024-01-17'),
    },
    {
      labOrderId: createdLabOrders[1].id,
      testName: 'Allergy Panel - Environmental',
      testCode: 'ALL-ENV',
      instructions: 'No special preparation required',
      status: 'ordered',
    }
  ];

  await db.insert(labOrderItems).values(labOrderItemsData);

  console.log('✅ Sample medical data created successfully');
}

async function seed() {
  try {
    console.log('🌱 Starting medical clinic seed process...');
    
    // Create clinic
    const clinic = await createClinic();
    
    // Create admin user
    const adminUser = await createAdminUser(clinic.id);
    
    // Create departments
    await createDepartments(clinic.id);
    
    // Create appointment types
    await createAppointmentTypes(clinic.id);
    
    // Create services
    await createServices(clinic.id);
    
    // Create sample patients
    const createdPatients = await createSamplePatients(clinic.id, adminUser.id);
    
    // Create sample medical data
    await createSampleMedicalData(clinic.id, adminUser.id, createdPatients);
    
    console.log('🎉 Medical clinic seed process completed successfully!');
    console.log('');
    console.log('📋 Login credentials:');
    console.log('   Email: admin@centralmedical.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('✅ Your medical clinic is ready to use!');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
