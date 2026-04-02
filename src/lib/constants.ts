import { VaccinationType, DocumentType } from "@/types";

export const vaccinationNames: Record<VaccinationType, string> = {
  [VaccinationType.RABIES]: "Rabia",
  [VaccinationType.DHPP]: "DHPP (Moquillo/Parvo)",
  [VaccinationType.BORDETELLA]: "Bordetella (Tos de las Perreras)",
  [VaccinationType.CANINE_INFLUENZA]: "Influenza Canina",
  [VaccinationType.LEPTOSPIROSIS]: "Leptospirosis",
  [VaccinationType.LYME]: "Lyme",
};

export const documentNames: Record<DocumentType, string> = {
  [DocumentType.LIABILITY_WAIVER]: "Acuerdo de Responsabilidad",
  [DocumentType.VACCINATION_RECORD]: "Registro de Vacunas",
  [DocumentType.VET_CERTIFICATE]: "Certificado Veterinario",
  [DocumentType.SPAY_NEUTER_CERTIFICATE]: "Certificado de Esterilización",
  [DocumentType.TRAINING_AGREEMENT]: "Acuerdo de Entrenamiento",
  [DocumentType.EMERGENCY_CONSENT]: "Consentimiento de Emergencia",
};
