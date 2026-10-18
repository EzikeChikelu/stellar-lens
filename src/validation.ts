import { StrKey } from "@stellar/stellar-sdk";
export type LookupKind = "account" | "transaction" | "secret" | "invalid";
export function classifyLookup(value: string): LookupKind {
  const input = value.trim();
  if (StrKey.isValidEd25519SecretSeed(input)) return "secret";
  if (StrKey.isValidEd25519PublicKey(input)) return "account";
  if (/^[0-9a-fA-F]{64}$/.test(input)) return "transaction";
  return "invalid";
}
