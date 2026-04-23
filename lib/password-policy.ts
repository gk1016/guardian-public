import { z } from "zod";

const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

const RULES = [
  { test: /[A-Z]/, message: "at least one uppercase letter" },
  { test: /[a-z]/, message: "at least one lowercase letter" },
  { test: /[0-9]/, message: "at least one digit" },
  { test: /[^A-Za-z0-9]/, message: "at least one special character" },
] as const;

/**
 * Validates a password string against the policy.
 * Returns null if valid, or an error message string.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (password.length > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} characters.`;
  }
  const failing = RULES.filter((r) => !r.test.test(password));
  if (failing.length > 0) {
    return `Password requires: ${failing.map((r) => r.message).join(", ")}.`;
  }
  return null;
}

/** Zod schema for a required password field with policy enforcement. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN)
  .max(PASSWORD_MAX)
  .refine(
    (pw) => validatePassword(pw) === null,
    (pw) => ({ message: validatePassword(pw) ?? "Invalid password." }),
  );

/** Zod schema for an optional password field (empty string = no change). */
export const optionalPasswordSchema = z
  .string()
  .max(PASSWORD_MAX)
  .optional()
  .or(z.literal(""))
  .refine(
    (pw) => !pw || pw.trim().length === 0 || validatePassword(pw) === null,
    (pw) => ({ message: pw ? (validatePassword(pw) ?? "Invalid password.") : "Invalid password." }),
  );
