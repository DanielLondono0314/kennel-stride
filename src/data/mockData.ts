import {
  Customer,
  Dog,
  DogFlag,
  Reservation,
  Service,
  Location,
  Notice,
  Package,
  User,
  UserRole,
  ReservationStatus,
  ServiceType,
  FlagType,
  FlagSeverity,
  NoticeSeverity,
  PackageStatus,
  Document,
  DocumentType,
  DocumentStatus,
  VaccinationType,
} from '@/types';

// Mock Users/Staff
export const mockUsers: User[] = [
  {
    id: 'usr_1',
    email: 'admin@kennelops.com',
    role: UserRole.ADMIN,
    firstName: 'Maria',
    lastName: 'García',
    phone: '+1 555-0100',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'usr_2',
    email: 'trainer@kennelops.com',
    role: UserRole.TRAINER,
    firstName: 'Carlos',
    lastName: 'Rodríguez',
    phone: '+1 555-0101',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'usr_3',
    email: 'frontdesk@kennelops.com',
    role: UserRole.FRONT_DESK,
    firstName: 'Ana',
    lastName: 'Martínez',
    phone: '+1 555-0102',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
];

// Required vaccinations by service type
export const requiredVaccinationsByService: Record<ServiceType, VaccinationType[]> = {
  [ServiceType.DAYCARE]: [VaccinationType.RABIES, VaccinationType.DHPP, VaccinationType.BORDETELLA],
  [ServiceType.BOARD_AND_TRAIN]: [VaccinationType.RABIES, VaccinationType.DHPP, VaccinationType.BORDETELLA, VaccinationType.CANINE_INFLUENZA],
  [ServiceType.TRAINING_SESSION]: [VaccinationType.RABIES, VaccinationType.DHPP],
  [ServiceType.GROOMING]: [VaccinationType.RABIES],
  [ServiceType.EVALUATION]: [VaccinationType.RABIES],
};

// Required documents by service type
export const requiredDocumentsByService: Record<ServiceType, DocumentType[]> = {
  [ServiceType.DAYCARE]: [DocumentType.LIABILITY_WAIVER],
  [ServiceType.BOARD_AND_TRAIN]: [DocumentType.LIABILITY_WAIVER, DocumentType.TRAINING_AGREEMENT, DocumentType.EMERGENCY_CONSENT],
  [ServiceType.TRAINING_SESSION]: [DocumentType.LIABILITY_WAIVER, DocumentType.TRAINING_AGREEMENT],
  [ServiceType.GROOMING]: [DocumentType.LIABILITY_WAIVER],
  [ServiceType.EVALUATION]: [DocumentType.LIABILITY_WAIVER],
};

// Vaccination display names
export const vaccinationNames: Record<VaccinationType, string> = {
  [VaccinationType.RABIES]: 'Rabia',
  [VaccinationType.DHPP]: 'DHPP (Moquillo/Parvo)',
  [VaccinationType.BORDETELLA]: 'Bordetella (Tos de las Perreras)',
  [VaccinationType.CANINE_INFLUENZA]: 'Influenza Canina',
  [VaccinationType.LEPTOSPIROSIS]: 'Leptospirosis',
  [VaccinationType.LYME]: 'Lyme',
};

// Document display names
export const documentNames: Record<DocumentType, string> = {
  [DocumentType.LIABILITY_WAIVER]: 'Acuerdo de Responsabilidad',
  [DocumentType.VACCINATION_RECORD]: 'Registro de Vacunas',
  [DocumentType.VET_CERTIFICATE]: 'Certificado Veterinario',
  [DocumentType.SPAY_NEUTER_CERTIFICATE]: 'Certificado de Esterilización',
  [DocumentType.TRAINING_AGREEMENT]: 'Acuerdo de Entrenamiento',
  [DocumentType.EMERGENCY_CONSENT]: 'Consentimiento de Emergencia',
};

// Mock Customers
export const mockCustomers: Customer[] = [
  {
    id: 'cust_1',
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan.perez@email.com',
    phone: '+1 555-1001',
    address: '123 Main St',
    city: 'Miami',
    state: 'FL',
    zipCode: '33101',
    emergencyContactName: 'Laura Pérez',
    emergencyContactPhone: '+1 555-1002',
    balance: 0,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: 'cust_2',
    firstName: 'Sofia',
    lastName: 'López',
    email: 'sofia.lopez@email.com',
    phone: '+1 555-2001',
    address: '456 Oak Ave',
    city: 'Miami',
    state: 'FL',
    zipCode: '33102',
    emergencyContactName: 'Miguel López',
    emergencyContactPhone: '+1 555-2002',
    balance: -150.00,
    notes: 'VIP client - 3+ years',
    createdAt: new Date('2023-06-15'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: 'cust_3',
    firstName: 'Roberto',
    lastName: 'Sánchez',
    email: 'roberto.sanchez@email.com',
    phone: '+1 555-3001',
    address: '789 Palm Blvd',
    city: 'Miami',
    state: 'FL',
    zipCode: '33103',
    balance: 250.00,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
];

// Mock Documents
export const mockDocuments: Document[] = [
  {
    id: 'doc_1',
    dogId: 'dog_1',
    customerId: 'cust_1',
    type: DocumentType.LIABILITY_WAIVER,
    name: 'Acuerdo de Responsabilidad',
    status: DocumentStatus.APPROVED,
    signedAt: new Date('2024-01-10'),
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: 'doc_2',
    dogId: 'dog_2',
    customerId: 'cust_2',
    type: DocumentType.LIABILITY_WAIVER,
    name: 'Acuerdo de Responsabilidad',
    status: DocumentStatus.APPROVED,
    signedAt: new Date('2023-06-15'),
    createdAt: new Date('2023-06-15'),
    updatedAt: new Date('2023-06-15'),
  },
  {
    id: 'doc_3',
    dogId: 'dog_3',
    customerId: 'cust_2',
    type: DocumentType.LIABILITY_WAIVER,
    name: 'Acuerdo de Responsabilidad',
    status: DocumentStatus.APPROVED,
    signedAt: new Date('2023-06-15'),
    createdAt: new Date('2023-06-15'),
    updatedAt: new Date('2023-06-15'),
  },
  {
    id: 'doc_4',
    dogId: 'dog_4',
    customerId: 'cust_3',
    type: DocumentType.LIABILITY_WAIVER,
    name: 'Acuerdo de Responsabilidad',
    status: DocumentStatus.PENDING,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: 'doc_5',
    dogId: 'dog_4',
    customerId: 'cust_3',
    type: DocumentType.TRAINING_AGREEMENT,
    name: 'Acuerdo de Entrenamiento',
    status: DocumentStatus.PENDING,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
];

// Mock Dogs with enhanced vaccination and document data
export const mockDogs: Dog[] = [
  {
    id: 'dog_1',
    customerId: 'cust_1',
    name: 'Max',
    breed: 'Golden Retriever',
    birthDate: new Date('2022-03-15'),
    weight: 32,
    color: 'Golden',
    gender: 'male',
    isNeutered: true,
    notes: 'Loves to swim',
    behaviorNotes: 'Friendly with all dogs',
    flags: [],
    vaccinations: [
      {
        id: 'vax_1',
        dogId: 'dog_1',
        name: 'Rabia',
        type: VaccinationType.RABIES,
        administeredAt: new Date('2024-01-15'),
        expiresAt: new Date('2025-01-15'),
        verified: true,
        verifiedBy: 'usr_1',
        verifiedAt: new Date('2024-01-15'),
      },
      {
        id: 'vax_2',
        dogId: 'dog_1',
        name: 'DHPP',
        type: VaccinationType.DHPP,
        administeredAt: new Date('2024-01-15'),
        expiresAt: new Date('2025-01-15'),
        verified: true,
        verifiedBy: 'usr_1',
        verifiedAt: new Date('2024-01-15'),
      },
      {
        id: 'vax_3',
        dogId: 'dog_1',
        name: 'Bordetella',
        type: VaccinationType.BORDETELLA,
        administeredAt: new Date('2024-01-15'),
        expiresAt: new Date('2024-07-15'),
        verified: true,
        verifiedBy: 'usr_1',
        verifiedAt: new Date('2024-01-15'),
      },
    ],
    documents: mockDocuments.filter(d => d.dogId === 'dog_1'),
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  },
  {
    id: 'dog_2',
    customerId: 'cust_2',
    name: 'Luna',
    breed: 'German Shepherd',
    birthDate: new Date('2021-08-20'),
    weight: 28,
    color: 'Black and Tan',
    gender: 'female',
    isNeutered: true,
    behaviorNotes: 'Reactive to small dogs - needs separate play group',
    flags: [
      {
        id: 'flag_1',
        dogId: 'dog_2',
        type: FlagType.BEHAVIOR_ALERT,
        severity: FlagSeverity.WARNING,
        message: 'Reactiva a perros pequeños - grupo separado',
        createdAt: new Date('2024-01-01'),
      },
    ],
    vaccinations: [
      {
        id: 'vax_4',
        dogId: 'dog_2',
        name: 'Rabia',
        type: VaccinationType.RABIES,
        administeredAt: new Date('2023-12-01'),
        expiresAt: new Date('2024-12-01'),
        verified: true,
        verifiedBy: 'usr_1',
        verifiedAt: new Date('2023-12-01'),
      },
      {
        id: 'vax_5',
        dogId: 'dog_2',
        name: 'DHPP',
        type: VaccinationType.DHPP,
        administeredAt: new Date('2023-12-01'),
        expiresAt: new Date('2024-12-01'),
        verified: true,
        verifiedBy: 'usr_1',
        verifiedAt: new Date('2023-12-01'),
      },
      {
        id: 'vax_6',
        dogId: 'dog_2',
        name: 'Bordetella',
        type: VaccinationType.BORDETELLA,
        administeredAt: new Date('2023-12-01'),
        expiresAt: new Date('2024-06-01'),
        verified: true,
        verifiedBy: 'usr_1',
        verifiedAt: new Date('2023-12-01'),
      },
    ],
    documents: mockDocuments.filter(d => d.dogId === 'dog_2'),
    createdAt: new Date('2023-06-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'dog_3',
    customerId: 'cust_2',
    name: 'Rocky',
    breed: 'French Bulldog',
    birthDate: new Date('2023-01-10'),
    weight: 12,
    color: 'Fawn',
    gender: 'male',
    isNeutered: false,
    medicalNotes: 'Braquicefálico - monitorear en calor',
    flags: [
      {
        id: 'flag_2',
        dogId: 'dog_3',
        type: FlagType.MEDICAL_CONDITION,
        severity: FlagSeverity.INFO,
        message: 'Raza braquicefálica - monitorear respiración',
        createdAt: new Date('2024-01-01'),
      },
    ],
    vaccinations: [
      {
        id: 'vax_7',
        dogId: 'dog_3',
        name: 'Rabia',
        type: VaccinationType.RABIES,
        administeredAt: new Date('2024-01-10'),
        expiresAt: new Date('2025-01-10'),
        verified: true,
        verifiedBy: 'usr_1',
        verifiedAt: new Date('2024-01-10'),
      },
      {
        id: 'vax_8',
        dogId: 'dog_3',
        name: 'DHPP',
        type: VaccinationType.DHPP,
        administeredAt: new Date('2024-01-10'),
        expiresAt: new Date('2025-01-10'),
        verified: true,
        verifiedBy: 'usr_1',
        verifiedAt: new Date('2024-01-10'),
      },
    ],
    documents: mockDocuments.filter(d => d.dogId === 'dog_3'),
    createdAt: new Date('2023-06-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'dog_4',
    customerId: 'cust_3',
    name: 'Bella',
    breed: 'Labrador Retriever',
    birthDate: new Date('2020-05-01'),
    weight: 30,
    color: 'Chocolate',
    gender: 'female',
    isNeutered: true,
    flags: [
      {
        id: 'flag_3',
        dogId: 'dog_4',
        type: FlagType.VACCINATION_EXPIRED,
        severity: FlagSeverity.CRITICAL,
        message: 'Vacuna de rabia vencida',
        createdAt: new Date('2024-02-01'),
      },
      {
        id: 'flag_4',
        dogId: 'dog_4',
        type: FlagType.DOCUMENT_PENDING,
        severity: FlagSeverity.WARNING,
        message: 'Acuerdo de responsabilidad no firmado',
        createdAt: new Date('2024-02-01'),
      },
    ],
    vaccinations: [
      {
        id: 'vax_9',
        dogId: 'dog_4',
        name: 'Rabia',
        type: VaccinationType.RABIES,
        administeredAt: new Date('2023-01-15'),
        expiresAt: new Date('2024-01-15'), // Expired!
        verified: true,
        verifiedBy: 'usr_1',
        verifiedAt: new Date('2023-01-15'),
      },
    ],
    documents: mockDocuments.filter(d => d.dogId === 'dog_4'),
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
];

// Mock Services with required vaccinations and documents
export const mockServices: Service[] = [
  {
    id: 'svc_1',
    name: 'Guardería Día Completo',
    type: ServiceType.DAYCARE,
    description: 'Día completo de juego supervisado y socialización',
    duration: 480,
    price: 45.00,
    isActive: true,
    requiredVaccinations: requiredVaccinationsByService[ServiceType.DAYCARE],
    requiredDocuments: requiredDocumentsByService[ServiceType.DAYCARE],
  },
  {
    id: 'svc_2',
    name: 'Guardería Medio Día',
    type: ServiceType.DAYCARE,
    description: 'Medio día de juego supervisado',
    duration: 240,
    price: 30.00,
    isActive: true,
    requiredVaccinations: requiredVaccinationsByService[ServiceType.DAYCARE],
    requiredDocuments: requiredDocumentsByService[ServiceType.DAYCARE],
  },
  {
    id: 'svc_3',
    name: 'Internado + Entrenamiento - Básico',
    type: ServiceType.BOARD_AND_TRAIN,
    description: 'Programa de obediencia básica de 2 semanas',
    duration: 20160,
    price: 2500.00,
    isActive: true,
    requiredVaccinations: requiredVaccinationsByService[ServiceType.BOARD_AND_TRAIN],
    requiredDocuments: requiredDocumentsByService[ServiceType.BOARD_AND_TRAIN],
  },
  {
    id: 'svc_4',
    name: 'Sesión de Entrenamiento Privada',
    type: ServiceType.TRAINING_SESSION,
    description: 'Sesión privada de entrenamiento de 1 hora',
    duration: 60,
    price: 85.00,
    isActive: true,
    requiredVaccinations: requiredVaccinationsByService[ServiceType.TRAINING_SESSION],
    requiredDocuments: requiredDocumentsByService[ServiceType.TRAINING_SESSION],
  },
  {
    id: 'svc_5',
    name: 'Evaluación de Cachorro',
    type: ServiceType.EVALUATION,
    description: 'Evaluación de temperamento para cachorro nuevo',
    duration: 30,
    price: 25.00,
    isActive: true,
    requiredVaccinations: requiredVaccinationsByService[ServiceType.EVALUATION],
    requiredDocuments: requiredDocumentsByService[ServiceType.EVALUATION],
  },
];

// Mock Locations
export const mockLocations: Location[] = [
  { id: 'loc_1', name: 'Patio Perros Grandes', type: 'yard', capacity: 15, isActive: true },
  { id: 'loc_2', name: 'Patio Perros Pequeños', type: 'yard', capacity: 10, isActive: true },
  { id: 'loc_3', name: 'Sala de Entrenamiento A', type: 'room', capacity: 4, isActive: true },
  { id: 'loc_4', name: 'Sala de Entrenamiento B', type: 'room', capacity: 4, isActive: true },
  { id: 'loc_5', name: 'Suite 1', type: 'suite', capacity: 2, isActive: true },
  { id: 'loc_6', name: 'Suite 2', type: 'suite', capacity: 2, isActive: true },
  { id: 'loc_7', name: 'Caniles Bloque A', type: 'kennel', capacity: 8, isActive: true },
];

// Mock Reservations (for today)
const today = new Date();
const todayStart = new Date(today.setHours(7, 0, 0, 0));
const todayEnd = new Date(today.setHours(18, 0, 0, 0));

export const mockReservations: Reservation[] = [
  {
    id: 'res_1',
    customerId: 'cust_1',
    dogId: 'dog_1',
    serviceId: 'svc_1',
    locationId: 'loc_1',
    staffId: 'usr_2',
    status: ReservationStatus.SCHEDULED,
    startDate: new Date(todayStart),
    endDate: new Date(todayEnd),
    totalPrice: 45.00,
    usePackageCredits: true,
    packageId: 'pkg_1',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: 'res_2',
    customerId: 'cust_2',
    dogId: 'dog_2',
    serviceId: 'svc_1',
    locationId: 'loc_1',
    staffId: 'usr_2',
    status: ReservationStatus.CHECKED_IN,
    startDate: new Date(todayStart),
    endDate: new Date(todayEnd),
    checkInTime: new Date(new Date().setHours(7, 30, 0, 0)),
    notes: 'Separar de perros pequeños',
    totalPrice: 45.00,
    usePackageCredits: false,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: 'res_3',
    customerId: 'cust_2',
    dogId: 'dog_3',
    serviceId: 'svc_2',
    locationId: 'loc_2',
    staffId: 'usr_2',
    status: ReservationStatus.CHECKED_IN,
    startDate: new Date(new Date().setHours(9, 0, 0, 0)),
    endDate: new Date(new Date().setHours(13, 0, 0, 0)),
    checkInTime: new Date(new Date().setHours(9, 15, 0, 0)),
    totalPrice: 30.00,
    usePackageCredits: false,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: 'res_4',
    customerId: 'cust_3',
    dogId: 'dog_4',
    serviceId: 'svc_4',
    locationId: 'loc_3',
    staffId: 'usr_2',
    status: ReservationStatus.REQUESTED,
    startDate: new Date(new Date().setHours(14, 0, 0, 0)),
    endDate: new Date(new Date().setHours(15, 0, 0, 0)),
    notes: 'Primera sesión de entrenamiento - reactividad en correa',
    totalPrice: 85.00,
    usePackageCredits: false,
    createdAt: new Date('2024-02-05'),
    updatedAt: new Date('2024-02-05'),
  },
  {
    id: 'res_5',
    customerId: 'cust_1',
    dogId: 'dog_1',
    serviceId: 'svc_3',
    locationId: 'loc_5',
    staffId: 'usr_2',
    status: ReservationStatus.IN_PROGRESS,
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)),
    endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
    checkInTime: new Date(new Date().setDate(new Date().getDate() - 7)),
    employeeNotes: 'Día 7 - Gran progreso con sentado y quieto',
    totalPrice: 2500.00,
    usePackageCredits: false,
    createdAt: new Date('2024-01-25'),
    updatedAt: new Date('2024-02-05'),
  },
];

// Mock Notices
export const mockNotices: Notice[] = [
  {
    id: 'notice_1',
    title: 'Vacuna Vencida',
    message: 'La vacuna de rabia de Bella venció el 15 de enero. No puede ingresar hasta actualizarla.',
    severity: NoticeSeverity.CRITICAL,
    entityType: 'dog',
    entityId: 'dog_4',
    suggestedActions: [
      { label: 'Ver Perfil', action: 'navigate', params: { path: '/dogs/dog_4' } },
      { label: 'Contactar Dueño', action: 'contact', params: { customerId: 'cust_3' } },
    ],
    isRead: false,
    createdAt: new Date(),
  },
  {
    id: 'notice_2',
    title: 'Solicitud Pendiente',
    message: 'Roberto Sánchez solicitó una sesión de entrenamiento para Bella hoy a las 2:00 PM.',
    severity: NoticeSeverity.WARNING,
    entityType: 'reservation',
    entityId: 'res_4',
    suggestedActions: [
      { label: 'Aprobar', action: 'approve', params: { reservationId: 'res_4' } },
      { label: 'Rechazar', action: 'reject', params: { reservationId: 'res_4' } },
    ],
    isRead: false,
    createdAt: new Date(),
  },
  {
    id: 'notice_3',
    title: 'Saldo Pendiente',
    message: 'Sofia López tiene un saldo pendiente de $150.00.',
    severity: NoticeSeverity.WARNING,
    entityType: 'customer',
    entityId: 'cust_2',
    suggestedActions: [
      { label: 'Ver Facturas', action: 'navigate', params: { path: '/customers/cust_2/invoices' } },
      { label: 'Enviar Recordatorio', action: 'sendReminder', params: { customerId: 'cust_2' } },
    ],
    isRead: true,
    createdAt: new Date(new Date().setHours(-24)),
  },
  {
    id: 'notice_4',
    title: 'Paquete Por Vencer',
    message: 'El paquete de 10 días de guardería de Juan Pérez vence en 5 días con 3 sesiones restantes.',
    severity: NoticeSeverity.INFO,
    entityType: 'customer',
    entityId: 'cust_1',
    suggestedActions: [
      { label: 'Ver Paquete', action: 'navigate', params: { path: '/customers/cust_1/packages' } },
      { label: 'Contactar Cliente', action: 'contact', params: { customerId: 'cust_1' } },
    ],
    isRead: false,
    createdAt: new Date(),
  },
];

// Mock Packages
export const mockPackages: Package[] = [
  {
    id: 'pkg_1',
    customerId: 'cust_1',
    name: 'Paquete 10 Días Guardería',
    serviceType: ServiceType.DAYCARE,
    totalCredits: 10,
    remainingCredits: 3,
    price: 400.00,
    purchaseDate: new Date('2024-01-15'),
    expiresAt: new Date(new Date().setDate(new Date().getDate() + 5)),
    status: PackageStatus.ACTIVE,
  },
  {
    id: 'pkg_2',
    customerId: 'cust_2',
    name: 'Paquete 5 Sesiones Entrenamiento',
    serviceType: ServiceType.TRAINING_SESSION,
    totalCredits: 5,
    remainingCredits: 5,
    price: 375.00,
    purchaseDate: new Date('2024-02-01'),
    expiresAt: new Date('2024-08-01'),
    status: PackageStatus.ACTIVE,
  },
];

// Helper function to get populated reservation
export function getPopulatedReservation(reservation: Reservation): Reservation {
  const pkg = mockPackages.find(p => p.id === reservation.packageId);
  return {
    ...reservation,
    customer: mockCustomers.find(c => c.id === reservation.customerId),
    dog: mockDogs.find(d => d.id === reservation.dogId),
    service: mockServices.find(s => s.id === reservation.serviceId),
    location: mockLocations.find(l => l.id === reservation.locationId),
    staff: mockUsers.find(u => u.id === reservation.staffId),
    package: pkg,
  };
}

export function getPopulatedReservations(): Reservation[] {
  return mockReservations.map(getPopulatedReservation);
}

// Helper to get customer packages
export function getCustomerPackages(customerId: string): Package[] {
  return mockPackages.filter(p => p.customerId === customerId && p.status === PackageStatus.ACTIVE);
}

// Helper to get package by service type for a customer
export function getAvailablePackageForService(customerId: string, serviceType: ServiceType): Package | undefined {
  return mockPackages.find(
    p => p.customerId === customerId && 
    p.serviceType === serviceType && 
    p.status === PackageStatus.ACTIVE &&
    p.remainingCredits > 0
  );
}
