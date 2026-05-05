// KennelOps Type Definitions
// All enums and interfaces for the dog training center management system

// ============================================
// ENUMS
// ============================================

export enum UserRole {
  ADMIN = 'admin',
  FRONT_DESK = 'front_desk',
  TRAINER = 'trainer',
  MANAGER = 'manager',
  PET_PARENT = 'pet_parent',
}

export enum ReservationStatus {
  REQUESTED = 'requested',
  SCHEDULED = 'scheduled',
  CHECKED_IN = 'checked_in',
  IN_PROGRESS = 'in_progress',
  READY = 'ready',
  PICKED_UP = 'picked_up',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ServiceType {
  DAYCARE = 'daycare',
  BOARD_AND_TRAIN = 'board_and_train',
  TRAINING_SESSION = 'training_session',
  GROOMING = 'grooming',
  EVALUATION = 'evaluation',
}

export enum FlagType {
  VACCINATION_EXPIRED = 'vaccination_expired',
  DOCUMENT_PENDING = 'document_pending',
  PAYMENT_OVERDUE = 'payment_overdue',
  BEHAVIOR_ALERT = 'behavior_alert',
  MEDICAL_CONDITION = 'medical_condition',
  VIP_CLIENT = 'vip_client',
}

export enum FlagSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export enum NoticeSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export enum PackageStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DEPLETED = 'depleted',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum MembershipStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum DocumentType {
  LIABILITY_WAIVER = 'liability_waiver',
  VACCINATION_RECORD = 'vaccination_record',
  VET_CERTIFICATE = 'vet_certificate',
  SPAY_NEUTER_CERTIFICATE = 'spay_neuter_certificate',
  TRAINING_AGREEMENT = 'training_agreement',
  EMERGENCY_CONSENT = 'emergency_consent',
}

export enum DocumentStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum VaccinationType {
  RABIES = 'rabies',
  DHPP = 'dhpp',
  BORDETELLA = 'bordetella',
  CANINE_INFLUENZA = 'canine_influenza',
  LEPTOSPIROSIS = 'leptospirosis',
  LYME = 'lyme',
}

// ============================================
// INTERFACES
// ============================================

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dog {
  id: string;
  customerId: string;
  name: string;
  breed: string;
  birthDate?: Date;
  weight?: number;
  color?: string;
  gender: 'male' | 'female';
  isNeutered: boolean;
  microchipNumber?: string;
  avatarUrl?: string;
  notes?: string;
  behaviorNotes?: string;
  medicalNotes?: string;
  flags: DogFlag[];
  vaccinations: Vaccination[];
  documents: Document[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DogFlag {
  id: string;
  dogId: string;
  type: FlagType;
  severity: FlagSeverity;
  message: string;
  expiresAt?: Date;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface Vaccination {
  id: string;
  dogId: string;
  name: string;
  type: VaccinationType;
  administeredAt: Date;
  expiresAt: Date;
  documentUrl?: string;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
}

export interface Document {
  id: string;
  dogId: string;
  customerId: string;
  type: DocumentType;
  name: string;
  status: DocumentStatus;
  fileUrl?: string;
  signedAt?: Date;
  expiresAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  description?: string;
  duration: number; // in minutes
  price: number;
  isActive: boolean;
  requiredVaccinations: VaccinationType[];
  requiredDocuments: DocumentType[];
}

export interface Location {
  id: string;
  name: string;
  type: 'yard' | 'room' | 'kennel' | 'suite';
  capacity: number;
  isActive: boolean;
}

export interface Reservation {
  id: string;
  customerId: string;
  dogId: string;
  serviceId: string;
  locationId?: string;
  staffId?: string;
  status: ReservationStatus;
  startDate: Date;
  endDate: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  addOns?: AddOn[];
  notes?: string;
  employeeNotes?: string;
  totalPrice: number;
  packageId?: string;
  usePackageCredits: boolean;
  creditsUsed?: number;
  createdAt: Date;
  updatedAt: Date;
  // Populated fields
  customer?: Customer;
  dog?: Dog;
  service?: Service;
  location?: Location;
  staff?: User;
  package?: Package;
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Package {
  id: string;
  customerId: string;
  name: string;
  serviceType: ServiceType;
  totalCredits: number;
  remainingCredits: number;
  price: number;
  purchaseDate: Date;
  expiresAt: Date;
  status: PackageStatus;
}

export interface Membership {
  id: string;
  customerId: string;
  name: string;
  monthlyPrice: number;
  benefits: string[];
  startDate: Date;
  nextBillingDate: Date;
  status: MembershipStatus;
}

export interface Invoice {
  id: string;
  customerId: string;
  reservationId?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date;
  createdAt: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReportCard {
  id: string;
  reservationId: string;
  dogId: string;
  trainerId: string;
  content: string;
  photos: string[];
  videos: string[];
  metrics: ReportMetric[];
  sentAt?: Date;
  createdAt: Date;
}

export interface ReportMetric {
  name: string;
  value: number; // 1-5 scale
  notes?: string;
}

export interface Notice {
  id: string;
  title: string;
  message: string;
  severity: NoticeSeverity;
  entityType: 'reservation' | 'customer' | 'dog' | 'payment';
  entityId: string;
  suggestedActions: SuggestedAction[];
  isRead: boolean;
  createdAt: Date;
}

export interface SuggestedAction {
  label: string;
  action: string;
  params?: Record<string, string>;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  targetSegment: CampaignSegment;
  template: string;
  scheduledAt?: Date;
  sentAt?: Date;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  stats?: CampaignStats;
  createdAt: Date;
}

export interface CampaignSegment {
  type: 'inactive' | 'new' | 'vip' | 'custom';
  filters?: Record<string, unknown>;
}

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}

// ============================================
// CHECK-IN/CHECK-OUT TYPES
// ============================================

export interface ValidationResult {
  isValid: boolean;
  canOverride: boolean;
  alerts: ValidationAlert[];
}

export interface ValidationAlert {
  id: string;
  type: 'vaccination' | 'document' | 'flag' | 'payment' | 'package';
  severity: FlagSeverity;
  title: string;
  message: string;
  blocksOperation: boolean;
  details?: VaccinationDetail | DocumentDetail | FlagDetail | PaymentDetail;
  suggestedAction?: SuggestedAction;
}

export interface VaccinationDetail {
  vaccinationType: VaccinationType;
  vaccineName: string;
  expiredAt?: Date;
  daysOverdue?: number;
}

export interface DocumentDetail {
  documentType: DocumentType;
  documentName: string;
  status: DocumentStatus;
}

export interface FlagDetail {
  flagType: FlagType;
  message: string;
}

export interface PaymentDetail {
  balance: number;
  invoiceId?: string;
}

export interface CheckInData {
  reservationId: string;
  notes?: string;
  overrideAlerts: string[];
  overrideReason?: string;
  overrideBy?: string;
}

export interface CheckOutData {
  reservationId: string;
  notes?: string;
  usePackageCredits: boolean;
  packageId?: string;
  creditsToUse?: number;
  generateInvoice: boolean;
  paymentMethod?: 'cash' | 'card' | 'package' | 'invoice';
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardKPIs {
  expected: number;
  checkedIn: number;
  goingHome: number;
  overnight: number;
  total: number;
}

export interface OpsTabCounts {
  notices: number;
  expected: number;
  goingHome: number;
  checkedIn: number;
  requested: number;
}
