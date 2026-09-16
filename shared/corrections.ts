export const CORRECTION_FIELDS = {
  signature: "ลายมือชื่อ / Signature",
  profilePhotoId: "รูปนักศึกษา / Student photo",
  nationalIdImageId: "บัตรประชาชน / National ID image",
  studentIdImageId: "บัตรนักศึกษา / Student ID image",
  fullNameThai: "ชื่อ-สกุลภาษาไทย / Thai full name",
  fullNameEnglish: "English full name",
  nicknameThai: "ชื่อเล่นภาษาไทย / Thai nickname",
  nicknameEnglish: "English nickname",
  faculty: "คณะ / Faculty",
  sex: "เพศ / Sex",
  email: "อีเมล / Email",
  lineId: "LINE ID",
  instagram: "Instagram",
  preferredContact: "ช่องทางติดต่อ / Preferred contact",
  nationalIdNumber: "เลขประจำตัวประชาชน / National ID number",
  birthDate: "วันเกิด / Date of birth",
  guardianPhone: "เบอร์ติดต่อฉุกเฉิน / Emergency phone",
  emergencyContactName: "ชื่อผู้ติดต่อฉุกเฉิน / Emergency contact",
  emergencyContactRelationship: "ความสัมพันธ์ / Emergency relationship",
  jerseyNumber: "เลขเสื้อ / Jersey number",
  drugAllergies: "แพ้ยา / Drug allergies",
  foodAllergies: "แพ้อาหาร / Food allergies",
  hospitalizationHistory: "ประวัติการรักษา / Hospitalization history",
  medicalConditions: "โรคประจำตัว / Medical conditions",
} as const;
export type CorrectionField = keyof typeof CORRECTION_FIELDS;
export type CorrectionRequest = { field: CorrectionField; note: string; status: "requested" | "submitted" };
export const DOCUMENT_KEYS = { profile: "profilePhotoId", nationalId: "nationalIdImageId", studentId: "studentIdImageId" } as const;
export function isDocumentField(field: string) {
  return Object.values(DOCUMENT_KEYS).some(key => key === field);
}
export function activeCorrections(requests: CorrectionRequest[] = []) {
  return requests.filter(request => request.status === "requested");
}
