import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { derivePluginNames, validatePluginName } from "../src/naming.ts";

describe("validatePluginName", () => {
  it("accepts lowercase names with single dashes", () => {
    for (const name of ["inventory", "erxes-agent-v2", "crm2", "sales-report"]) {
      assert.equal(validatePluginName(name), undefined, name);
    }
  });

  it("rejects invalid, reserved and existing plugin names", () => {
    for (const name of [
      "",
      "Inventory",
      "2crm",
      "my_plugin",
      "a--b",
      "a-",
      "-a",
      "core",
      "sales",
    ]) {
      assert.ok(validatePluginName(name), name);
    }
  });
});

describe("derivePluginNames", () => {
  it("derives every erxes-facing name from a dashed name", () => {
    assert.deepEqual(derivePluginNames("erxes-agent-v2"), {
      name: "erxes-agent-v2",
      id: "erxes_agent_v2",
      remote: "erxes_agent_v2_ui",
      camel: "erxesAgentV2",
      pascal: "ErxesAgentV2",
      title: "Erxes Agent V2",
      cssPrefix: "erxesagentv",
    });
  });

  it("keeps a single-word name unchanged", () => {
    const names = derivePluginNames("inventory", " Stock ");
    assert.equal(names.id, "inventory");
    assert.equal(names.remote, "inventory_ui");
    assert.equal(names.camel, "inventory");
    assert.equal(names.pascal, "Inventory");
    assert.equal(names.title, "Stock");
  });
});
