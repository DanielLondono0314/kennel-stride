import {
  Dog,
  Service,
  Customer,
  Reservation,
  ValidationResult,
  ValidationAlert,
  VaccinationType,
  DocumentType,
  DocumentStatus,
  FlagType,
  FlagSeverity,
} from '@/types';
import { vaccinationNames, documentNames } from '@/lib/constants';
import { differenceInDays } from 'date-fns';

// Balance thresholds for check-in blocking. These are business rules configurable
// per organization in a future settings feature — for now centralized here.
const BALANCE_BLOCK_THRESHOLD = -500;    // blocks check-in entirely
const BALANCE_CRITICAL_THRESHOLD = -200; // shows critical warning but doesn't block

/**
 * Validates if a dog can be checked in for a reservation
 * Returns validation result with alerts for vaccines, documents, flags, and payments
 */
export function validateCheckIn(
  reservation: Reservation,
  dog: Dog,
  customer: Customer,
  service: Service
): ValidationResult {
  const alerts: ValidationAlert[] = [];
  const today = new Date();

  // 1. Check vaccinations
  const requiredVaccinations = service.requiredVaccinations || [];
  for (const requiredVax of requiredVaccinations) {
    const vaccination = dog.vaccinations.find(v => v.type === requiredVax);
    
    if (!vaccination) {
      // Missing vaccination
      alerts.push({
        id: `vax_missing_${requiredVax}`,
        type: 'vaccination',
        severity: FlagSeverity.CRITICAL,
        title: 'Vacuna Faltante',
        message: `${dog.name} no tiene registro de ${vaccinationNames[requiredVax]}`,
        blocksOperation: true,
        details: {
          vaccinationType: requiredVax,
          vaccineName: vaccinationNames[requiredVax],
        },
        suggestedAction: {
          label: 'Actualizar Vacunas',
          action: 'updateVaccinations',
          params: { dogId: dog.id },
        },
      });
    } else if (vaccination.expiresAt < today) {
      // Expired vaccination
      const daysOverdue = differenceInDays(today, vaccination.expiresAt);
      alerts.push({
        id: `vax_expired_${requiredVax}`,
        type: 'vaccination',
        severity: FlagSeverity.CRITICAL,
        title: 'Vacuna Vencida',
        message: `${vaccinationNames[requiredVax]} venció hace ${daysOverdue} días`,
        blocksOperation: true,
        details: {
          vaccinationType: requiredVax,
          vaccineName: vaccinationNames[requiredVax],
          expiredAt: vaccination.expiresAt,
          daysOverdue,
        },
        suggestedAction: {
          label: 'Actualizar Vacuna',
          action: 'updateVaccination',
          params: { dogId: dog.id, vaccinationId: vaccination.id },
        },
      });
    } else if (!vaccination.verified) {
      // Unverified vaccination
      alerts.push({
        id: `vax_unverified_${requiredVax}`,
        type: 'vaccination',
        severity: FlagSeverity.WARNING,
        title: 'Vacuna No Verificada',
        message: `${vaccinationNames[requiredVax]} requiere verificación`,
        blocksOperation: false,
        details: {
          vaccinationType: requiredVax,
          vaccineName: vaccinationNames[requiredVax],
        },
        suggestedAction: {
          label: 'Verificar',
          action: 'verifyVaccination',
          params: { dogId: dog.id, vaccinationId: vaccination.id },
        },
      });
    }
  }

  // 2. Check required documents
  const requiredDocuments = service.requiredDocuments || [];
  for (const requiredDoc of requiredDocuments) {
    const document = dog.documents?.find(d => d.type === requiredDoc);
    
    if (!document) {
      alerts.push({
        id: `doc_missing_${requiredDoc}`,
        type: 'document',
        severity: FlagSeverity.WARNING,
        title: 'Documento Faltante',
        message: `${documentNames[requiredDoc]} no encontrado`,
        blocksOperation: requiredDoc === DocumentType.LIABILITY_WAIVER,
        details: {
          documentType: requiredDoc,
          documentName: documentNames[requiredDoc],
          status: DocumentStatus.PENDING,
        },
        suggestedAction: {
          label: 'Solicitar Documento',
          action: 'requestDocument',
          params: { customerId: customer.id, documentType: requiredDoc },
        },
      });
    } else if (document.status === DocumentStatus.PENDING) {
      alerts.push({
        id: `doc_pending_${requiredDoc}`,
        type: 'document',
        severity: FlagSeverity.WARNING,
        title: 'Documento Pendiente',
        message: `${documentNames[requiredDoc]} aún no firmado`,
        blocksOperation: requiredDoc === DocumentType.LIABILITY_WAIVER,
        details: {
          documentType: requiredDoc,
          documentName: documentNames[requiredDoc],
          status: DocumentStatus.PENDING,
        },
        suggestedAction: {
          label: 'Enviar Recordatorio',
          action: 'sendDocumentReminder',
          params: { customerId: customer.id, documentId: document.id },
        },
      });
    } else if (document.status === DocumentStatus.EXPIRED) {
      alerts.push({
        id: `doc_expired_${requiredDoc}`,
        type: 'document',
        severity: FlagSeverity.WARNING,
        title: 'Documento Vencido',
        message: `${documentNames[requiredDoc]} necesita renovación`,
        blocksOperation: requiredDoc === DocumentType.LIABILITY_WAIVER,
        details: {
          documentType: requiredDoc,
          documentName: documentNames[requiredDoc],
          status: DocumentStatus.EXPIRED,
        },
        suggestedAction: {
          label: 'Renovar Documento',
          action: 'renewDocument',
          params: { customerId: customer.id, documentId: document.id },
        },
      });
    }
  }

  // 3. Check dog flags (behavior, medical)
  for (const flag of dog.flags) {
    if (flag.resolvedAt) continue; // Skip resolved flags

    let blocksOperation = false;
    if (flag.type === FlagType.VACCINATION_EXPIRED) {
      blocksOperation = true;
    } else if (flag.type === FlagType.DOCUMENT_PENDING) {
      blocksOperation = false; // Already handled above
    } else if (flag.type === FlagType.PAYMENT_OVERDUE && customer.balance < BALANCE_BLOCK_THRESHOLD) {
      blocksOperation = true;
    }

    // Skip vaccination and document flags as we handle them separately
    if (flag.type === FlagType.VACCINATION_EXPIRED || flag.type === FlagType.DOCUMENT_PENDING) {
      continue;
    }

    alerts.push({
      id: `flag_${flag.id}`,
      type: 'flag',
      severity: flag.severity,
      title: getFlagTitle(flag.type),
      message: flag.message,
      blocksOperation,
      details: {
        flagType: flag.type,
        message: flag.message,
      },
    });
  }

  // 4. Check customer balance (payment status)
  if (customer.balance < 0) {
    const severity = customer.balance < BALANCE_CRITICAL_THRESHOLD ? FlagSeverity.CRITICAL : FlagSeverity.WARNING;
    const blocksOperation = customer.balance < BALANCE_BLOCK_THRESHOLD;
    
    alerts.push({
      id: 'payment_balance',
      type: 'payment',
      severity,
      title: 'Saldo Pendiente',
      message: `El cliente tiene un saldo de $${Math.abs(customer.balance).toFixed(2)} pendiente`,
      blocksOperation,
      details: {
        balance: customer.balance,
      },
      suggestedAction: {
        label: 'Ver Facturas',
        action: 'viewInvoices',
        params: { customerId: customer.id },
      },
    });
  }

  // Calculate overall validation result
  const blockingAlerts = alerts.filter(a => a.blocksOperation);
  const isValid = blockingAlerts.length === 0;
  const canOverride = blockingAlerts.every(a => 
    a.type !== 'vaccination' || a.severity !== FlagSeverity.CRITICAL
  );

  return {
    isValid,
    canOverride,
    alerts,
  };
}

function getFlagTitle(flagType: FlagType): string {
  const titles: Record<FlagType, string> = {
    [FlagType.VACCINATION_EXPIRED]: 'Vacuna Vencida',
    [FlagType.DOCUMENT_PENDING]: 'Documento Pendiente',
    [FlagType.PAYMENT_OVERDUE]: 'Pago Vencido',
    [FlagType.BEHAVIOR_ALERT]: 'Alerta de Comportamiento',
    [FlagType.MEDICAL_CONDITION]: 'Condición Médica',
    [FlagType.VIP_CLIENT]: 'Cliente VIP',
  };
  return titles[flagType];
}

/**
 * Validates if a reservation can be checked out
 */
export function validateCheckOut(
  reservation: Reservation,
  customer: Customer
): ValidationResult {
  const alerts: ValidationAlert[] = [];

  // Check if already checked in
  if (!reservation.checkInTime) {
    alerts.push({
      id: 'not_checked_in',
      type: 'flag',
      severity: FlagSeverity.CRITICAL,
      title: 'No Registrado',
      message: 'Esta reserva no ha sido registrada (check-in)',
      blocksOperation: true,
      details: {
        flagType: FlagType.DOCUMENT_PENDING,
        message: 'Check-in requerido',
      },
    });
  }

  return {
    isValid: alerts.filter(a => a.blocksOperation).length === 0,
    canOverride: false,
    alerts,
  };
}
