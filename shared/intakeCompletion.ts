import { ageOnDate } from "./personalInformation";

const REQUIRED = ["fullNameThai", "fullNameEnglish", "faculty", "sex", "nationalIdNumber", "birthDate", "guardianPhone", "emergencyContactName", "emergencyContactRelationship", "drugAllergies", "foodAllergies", "hospitalizationHistory", "medicalConditions"] as const;
export function isIntakeProfileComplete(profile: Partial<Record<string, string | undefined>>, requiresJersey: boolean) {
  if (REQUIRED.some(field => !profile[field]?.trim())) return false;
  if (!["คณะแพทยศาสตร์", "คณะศิลปศาสตร์", "วิทยาลัยแพทยศาสตร์นานาชาติจุฬาภรณ์"].includes(profile.faculty!)) return false;
  if (!/^\d{13}$/.test(profile.nationalIdNumber!.trim()) || ageOnDate(profile.birthDate!.trim()) === null) return false;
  if (!/^\+?\d{9,15}$/.test(profile.guardianPhone!.replace(/[\s()-]/g, ""))) return false;
  if (requiresJersey && !/^\d{1,10}$/.test(profile.jerseyNumber?.trim() ?? "")) return false;
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) return false;
  return Object.values(profile).every(value => !value || value.length <= 2000);
}
