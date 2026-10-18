import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { classifyLookup } from "../src/validation";
describe("classifyLookup", () => {
  it("recognizes a valid Stellar public key", () => expect(classifyLookup(Keypair.random().publicKey())).toBe("account"));
  it("recognizes a valid secret seed so it can be rejected safely", () => expect(classifyLookup(Keypair.random().secret())).toBe("secret"));
  it("recognizes a 64-character transaction hash", () => expect(classifyLookup("a".repeat(64))).toBe("transaction"));
  it("trims whitespace before classifying", () => expect(classifyLookup(` ${Keypair.random().publicKey()} `)).toBe("account"));
  it("rejects malformed input", () => { expect(classifyLookup("G-not-a-real-key")).toBe("invalid"); expect(classifyLookup("abc123")).toBe("invalid"); expect(classifyLookup("f".repeat(63))).toBe("invalid"); });
});
