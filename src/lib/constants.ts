import { VaccinationType, DocumentType } from "@/types";

export const vaccinationNames: Record<VaccinationType, string> = {
  [VaccinationType.RABIES]: "Rabia",
  [VaccinationType.DHPP]: "DHPP (Moquillo/Parvo)",
  [VaccinationType.BORDETELLA]: "Bordetella (Tos de las Perreras)",
  [VaccinationType.CANINE_INFLUENZA]: "Influenza Canina",
  [VaccinationType.LEPTOSPIROSIS]: "Leptospirosis",
};

export const documentNames: Record<DocumentType, string> = {
  [DocumentType.LIABILITY_WAIVER]: "Acuerdo de Responsabilidad",
  [DocumentType.VACCINATION_RECORD]: "Registro de Vacunas",
  [DocumentType.VET_CERTIFICATE]: "Certificado Veterinario",
};
