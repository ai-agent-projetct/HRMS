/** Server-side password hashing (scrypt). Format: s1$<salt hex>$<key hex> — fits hr_users.password (120). */
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

export const isHashed = (p: string) => p.startsWith("s1$");

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  return `s1$${salt}$${scryptSync(plain, salt, 32).toString("hex")}`;
}

/** Also accepts a legacy plaintext value (rows saved before hashing). */
export function verifyPassword(plain: string, stored: string): boolean {
  if (!isHashed(stored)) return stored !== "" && plain === stored;
  const [, salt, key] = stored.split("$");
  const got = scryptSync(plain, salt, 32);
  return timingSafeEqual(got, Buffer.from(key, "hex"));
}

if (process.argv[1]?.endsWith("password.ts")) {
  const h = hashPassword("Secret@1");
  console.assert(h.length <= 120 && verifyPassword("Secret@1", h) && !verifyPassword("secret@1", h), "hash/verify");
  console.assert(verifyPassword("old", "old") && !verifyPassword("", ""), "legacy");
  console.log("password self-check ok");
}
