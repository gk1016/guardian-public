import test from "node:test";
import assert from "node:assert";
import { generateSecret, totpUri, verifyTotp } from "./totp.ts";

test("TOTP lib", async (t) => {
  await t.test("generateSecret returns a 32-char base32 string", () => {
    const secret = generateSecret();
    assert.strictEqual(typeof secret, "string");
    assert.strictEqual(secret.length, 32);
    assert.match(secret, /^[A-Z2-7]+$/);
  });

  await t.test("totpUri generates correct URI", () => {
    const params = {
      secret: "JBSWY3DPEHPK3PXP",
      account: "user@example.com",
      issuer: "Guardian",
    };
    const uri = totpUri(params);
    assert.ok(uri.includes("otpauth://totp/Guardian:user%40example.com"));
    assert.ok(uri.includes("secret=JBSWY3DPEHPK3PXP"));
    assert.ok(uri.includes("issuer=Guardian"));
    assert.ok(uri.includes("algorithm=SHA1"));
    assert.ok(uri.includes("digits=6"));
    assert.ok(uri.includes("period=30"));
  });

  await t.test("verifyTotp validates codes correctly with clock skew", (t) => {
    const secret = "JBSWY3DPEHPK3PXP";

    t.mock.timers.enable({ apis: ["Date"] });
    const now = 1700000000000; // Fixed timestamp
    t.mock.timers.setTime(now);

    const validCodeCurrent = "324550";
    assert.strictEqual(verifyTotp(secret, validCodeCurrent), true, "Current window code should be valid");

    const validCodePrev = "822542";
    assert.strictEqual(verifyTotp(secret, validCodePrev), true, "Previous window code should be valid");

    const validCodeNext = "367665";
    assert.strictEqual(verifyTotp(secret, validCodeNext), true, "Next window code should be valid");

    const invalidCodeFar = "968785";
    assert.strictEqual(verifyTotp(secret, invalidCodeFar), false, "Code from 2 windows ago should be invalid");

    assert.strictEqual(verifyTotp(secret, "000000"), false, "Incorrect code should be invalid");
    assert.strictEqual(verifyTotp(secret, "abc"), false, "Malformed code should be invalid");
    assert.strictEqual(verifyTotp(secret, "12345"), false, "Short code should be invalid");
    assert.strictEqual(verifyTotp(secret, "1234567"), false, "Long code should be invalid");
  });
});
