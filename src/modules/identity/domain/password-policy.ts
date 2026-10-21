import { z } from "zod";

// Better Auth hashes at most this many characters (its maxPasswordLength).
const MAX_PASSWORD_LENGTH = 128;

// The password policy: the college's shortest length, and Better Auth's longest. Length is what
// makes a password strong (NIST SP 800-63B), so there are no character-class rules.
export function newPasswordSchema(minLength: number) {
  return z.string().min(minLength).max(MAX_PASSWORD_LENGTH);
}

// A temporary password: issued by an admin or admin:create, typed once, then replaced. Twelve
// characters from an alphabet without look-alikes (0 and o, 1 and l) carry about 59 bits.
const TEMPORARY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const TEMPORARY_LENGTH = 12;

export function temporaryPassword(random: (length: number) => Uint8Array) {
  // 256 is not a multiple of the alphabet's length, so bytes above the last full round are
  // rejected rather than folded, which would favor the first letters.
  const limit = 256 - (256 % TEMPORARY_ALPHABET.length);
  let password = "";
  while (password.length < TEMPORARY_LENGTH) {
    for (const byte of random(TEMPORARY_LENGTH)) {
      if (byte < limit && password.length < TEMPORARY_LENGTH) {
        password += TEMPORARY_ALPHABET[byte % TEMPORARY_ALPHABET.length];
      }
    }
  }
  return password;
}
