import { ConvexError } from "convex/values";

/** Only deliberate validation messages may be displayed verbatim. */
export class UserFacingError extends Error {}

const explanations: Record<string, string> = {
  "Authentication required": "Your staff session has ended. Sign in again, then retry this action.",
  "Staff access is not active": "Your staff account is inactive. Ask an administrator to restore access.",
  "Read-only access": "Your account has viewer access. Ask a registrar or administrator to make this change.",
  "Administrator access required": "Only an administrator can make this change. Ask an administrator for help.",
  "Participant not found": "This participant record is no longer available. Close the record and refresh the participant list.",
  "Another participant already uses this Student ID": "This Student ID belongs to another participant. Check the ID or open the existing record to edit it.",
  "Choose a supported faculty": "Choose Medicine, Liberal Arts, or Chulabhorn International College of Medicine from the Faculty dropdown.",
  "Upload session expired": "This upload session has expired or was already submitted. Start verification again before uploading.",
  "Verification session expired": "Your verification session has expired. Refresh the page and verify your details again.",
  "The information does not match our registration record": "The Student ID and details do not match our records. Check them against your registration, or ask staff to correct the record.",
  "Invalid staff invitation code": "The invitation code is incorrect. Check the code provided by your administrator.",
  "Staff registration has not been configured": "Staff registration is not available yet. Ask an administrator to configure invitations.",
  "Image upload failed": "The image upload did not finish. Check your connection and try uploading again.",
  "Secure session is still loading": "Your secure session is still starting. Wait a moment, then try again.",
};

export function errorMessage(error: unknown, action = "Complete this action"): string {
  const raw = error instanceof Error ? error.message : "";
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Reconnect to the internet, then try again.";
  }
  if (/InvalidAccountId|InvalidSecret|Invalid password/i.test(raw)) return "The email or password is incorrect. Check both and try signing in again.";
  if (/TooManyFailedAttempts|rate.?limit/i.test(raw)) return "There have been too many attempts. Wait a few minutes before trying again.";
  const trusted = error instanceof ConvexError && typeof error.data === "string" ? error.data : error instanceof UserFacingError ? error.message : null;
  if (trusted) return explanations[trusted] ?? trusted;
  if (/Failed to fetch|NetworkError|Load failed|network request failed/i.test(raw)) return `Could not ${action.charAt(0).toLowerCase() + action.slice(1)} because the connection was interrupted. Check your connection and try again.`;
  // Unknown server errors may contain stack traces or private implementation details.
  return `Could not ${action.charAt(0).toLowerCase() + action.slice(1)} because of an unexpected problem. Try again. If it continues, contact staff and tell them which action failed.`;
}
