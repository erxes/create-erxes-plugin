import assert from "node:assert/strict";
// The Bun-only stack has no compiled API; all other standalone stacks do.
const { createContext } = await import(process.argv[2]);
const user = Buffer.from(JSON.stringify({ _id: "u1", email: "user@example.com" })).toString(
  "base64",
);
assert.deepEqual(createContext({ hostname: "acme.example.com", user }).user._id, "u1");
assert.equal(createContext(new Headers({ hostname: "acme.example.com", user })).subdomain, "acme");
assert.equal(
  createContext({ "nginx-hostname": "tenant.example.com", hostname: "other.example.com" })
    .subdomain,
  "tenant",
);
for (const value of [undefined, "not-json", Buffer.from('{"email":"x"}').toString("base64")]) {
  assert.equal(createContext({ user: value }).user, null);
}
// Parsing is deliberately NOT authentication. A forged well-formed assertion
// also parses: deployment MUST restrict direct API access to the gateway.
const forged = Buffer.from(JSON.stringify({ _id: "attacker", isOwner: true })).toString("base64");
assert.equal(createContext({ user: forged }).user.isOwner, true);
