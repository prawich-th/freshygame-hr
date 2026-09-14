import { ConvexError } from "convex/values";
import { ageOnDate } from "../shared/personalInformation";

type Information = { jerseyNumber?: string; allergies?: string; medicalConditions?: string; nationalIdNumber?: string; birthDate?: string; guardianPhone?: string; emergencyContactName?: string; emergencyContactRelationship?: string; drugAllergies?: string; foodAllergies?: string; hospitalizationHistory?: string; sex?: string };

export function normalizeInformation(input: Information, required = false, requireJersey = required) {
  const result: Information & { age?: number } = {};
  for (const key of ["jerseyNumber", "nationalIdNumber", "birthDate", "guardianPhone", "emergencyContactName", "emergencyContactRelationship", "drugAllergies", "foodAllergies", "medicalConditions", "hospitalizationHistory", "sex"] as const) {
    if (key === "jerseyNumber" && required && !requireJersey) continue;
    if (input[key] === undefined && !required) continue;
    let value = input[key]?.trim() ?? "";
    if (required && !value) throw new ConvexError(`Please complete ${key === "jerseyNumber" ? "jersey number" : key}. Your personal information is required. Enter None for health histories that do not apply.`);
    if (value.length > (key === "jerseyNumber" ? 10 : 2000)) throw new ConvexError("Jersey number must be at most 10 characters; health information at most 2,000 characters per field.");
    if (key === "jerseyNumber" && value && !/^\d{1,10}$/.test(value)) throw new ConvexError("Enter the number on your event-day jersey using digits only.");
    if (key === "nationalIdNumber" && value && !/^\d{13}$/.test(value)) throw new ConvexError("National ID number must contain 13 digits");
    if (key === "guardianPhone" && value) {
      value = value.replace(/[\s()-]/g, "");
      if (!/^\+?\d{9,15}$/.test(value)) throw new ConvexError("Enter a valid parent or guardian phone number");
    }
    if (key === "birthDate") {
      const age = ageOnDate(value);
      if (value && age === null) throw new ConvexError("Enter a valid date of birth, not in the future (Gregorian year)");
      result.age = age ?? undefined;
    }
    result[key] = value;
  }
  if (input.allergies !== undefined) {
    if (input.allergies.length > 2000) throw new ConvexError("Allergy information must be at most 2,000 characters");
    result.allergies = input.allergies.trim();
  }
  return result;
}
