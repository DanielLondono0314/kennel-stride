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

export const DOG_BREEDS = [
  "Affenpinscher", "Akita", "Alaskan Malamute", "American Bulldog",
  "American Staffordshire Terrier", "Basenji", "Basset Hound",
  "Beagle", "Bichon Frisé", "Border Collie", "Boston Terrier",
  "Boxer", "Braco Alemán", "Bulldog Francés", "Bulldog Inglés",
  "Bull Terrier", "Cane Corso", "Caniche", "Cavalier King Charles Spaniel",
  "Chihuahua", "Chow Chow", "Cocker Spaniel", "Dachshund",
  "Dálmata", "Dobermann", "Dogo Argentino", "Dogo de Burdeos",
  "English Springer Spaniel", "Fox Terrier", "Golden Retriever",
  "Gran Danés", "Greyhound", "Husky Siberiano", "Jack Russell Terrier",
  "Labrador Retriever", "Lhasa Apso", "Malinois Belga", "Maltés",
  "Mastín", "Mastín Napolitano", "Mestizo", "Miniature Schnauzer",
  "Papillón", "Pastor Alemán", "Pastor Australiano", "Pastor Bernés",
  "Pastor de Shetland", "Pekinés", "Pit Bull Terrier", "Pointer",
  "Pomerania", "Poodle", "Pug", "Rottweiler", "Rough Collie",
  "Saluki", "Samoyedo", "Schnauzer", "Setter Irlandés", "Shiba Inu",
  "Shih Tzu", "Staffordshire Bull Terrier", "Teckel", "Terranova",
  "Vizsla", "Weimaraner", "West Highland Terrier", "Whippet",
  "Yorkshire Terrier",
].sort();
