import type { CorrectionField } from "@/shared/corrections";

export const CORRECTION_FIELD_GROUPS: { title: string; fields: CorrectionField[] }[] = [
  { title: "Documents", fields: ["profilePhotoId", "nationalIdImageId", "studentIdImageId"] },
  { title: "Personal information", fields: ["fullNameThai", "fullNameEnglish", "nicknameThai", "nicknameEnglish", "sex", "birthDate", "nationalIdNumber"] },
  { title: "Registration", fields: ["faculty", "jerseyNumber"] },
  { title: "Contact details", fields: ["email", "lineId", "instagram", "preferredContact"] },
  { title: "Emergency contact", fields: ["emergencyContactName", "emergencyContactRelationship", "guardianPhone"] },
  { title: "Health information", fields: ["drugAllergies", "foodAllergies", "medicalConditions", "hospitalizationHistory"] },
];
