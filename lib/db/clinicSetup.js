import { db } from './drizzle.js';
import { 
  appointmentTypes, 
  services, 
  departments
} from './schema.js';

/**
 * Creates default appointment types for a new clinic
 */
export async function createDefaultAppointmentTypes(clinicId) {
  console.log('Creating default appointment types for clinic:', clinicId);
  
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
    {
      clinicId: clinicId,
      name: 'Emergency',
      description: 'Emergency consultation',
      durationMinutes: 60,
      color: '#DC2626',
      defaultPrice: '200.00',
      isActive: true,
    },
  ];

  const createdAppointmentTypes = await db.insert(appointmentTypes).values(appointmentTypeData).returning();
  console.log('✅ Default appointment types created:', createdAppointmentTypes.length);
  return createdAppointmentTypes;
}

/**
 * Creates default departments for a new clinic
 */
export async function createDefaultDepartments(clinicId) {
  console.log('Creating default departments for clinic:', clinicId);
  
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
    {
      clinicId: clinicId,
      name: 'Orthopedics',
      description: 'Bone and joint care',
      isActive: true,
    },
  ];

  const createdDepartments = await db.insert(departments).values(departmentData).returning();
  console.log('✅ Default departments created:', createdDepartments.length);
  return createdDepartments;
}

/**
 * Creates default services for a new clinic
 */
export async function createDefaultServices(clinicId) {
  console.log('Creating default services for clinic:', clinicId);
  
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
    {
      clinicId: clinicId,
      name: 'Allergy Testing',
      description: 'Comprehensive allergy testing',
      price: '180.00',
      durationMinutes: 30,
      isActive: true,
    },
  ];

  const createdServices = await db.insert(services).values(serviceData).returning();
  console.log('✅ Default services created:', createdServices.length);
  return createdServices;
}

/**
 * Sets up all default clinic data when a new clinic is created
 */
export async function setupDefaultClinicData(clinicId) {
  console.log('🏥 Setting up default clinic data for clinic:', clinicId);
  
  try {
    // Create all default data in parallel for better performance
    const [appointmentTypes, departments, services] = await Promise.all([
      createDefaultAppointmentTypes(clinicId),
      createDefaultDepartments(clinicId),
      createDefaultServices(clinicId),
    ]);

    console.log('🎉 Clinic setup completed successfully!');
    console.log('📊 Created:', {
      appointmentTypes: appointmentTypes.length,
      departments: departments.length,
      services: services.length,
    });

    return {
      appointmentTypes,
      departments,
      services,
    };
  } catch (error) {
    console.error('❌ Error setting up clinic data:', error);
    throw error;
  }
}

/**
 * Gets all default clinic data that will be created (for preview purposes)
 */
export function getDefaultClinicDataPreview() {
  return {
    appointmentTypes: [
      'Consultation',
      'Follow-up',
      'Physical Exam',
      'Vaccination',
      'Lab Review',
      'Emergency',
    ],
    departments: [
      'General Medicine',
      'Pediatrics',
      'Cardiology',
      'Dermatology',
      'Orthopedics',
    ],
    services: [
      'General Consultation',
      'Blood Test',
      'EKG',
      'X-Ray',
      'Flu Shot',
      'Physical Therapy Session',
      'Allergy Testing',
    ],
  };
} 