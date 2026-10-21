import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ts from "typescript";
import { TEMPLATES } from "../src/templates.generated.ts";

// Exercise template resolver behavior without starting Mongo/Redis. The E2E
// fixture independently executes the compiled deliverable with real imports.
const templateModule = (file: string, imports: Record<string, unknown>) => {
  const source = TEMPLATES[file];
  assert.ok(source, file);
  const { outputText } = ts.transpileModule(source.replaceAll("__camel__", "inventory"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", outputText)((name: string) => {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  }, exports);
  return exports;
};

class GraphQLError extends Error {
  constructor(
    message: string,
    public options?: unknown,
  ) {
    super(message);
  }
}

type ResolverContext = {
  subdomain: string;
  user: { _id: string } | null;
  checkPermission: (action: string) => Promise<void>;
  models: { Samples: { list: (page: { limit: number; offset: number }) => Promise<unknown[]> } };
};

describe("platform sample security", () => {
  const { resolvers } = templateModule("api/platform/src/graphql/schema.ts", {
    "graphql-tag": { gql: () => "schema" },
    graphql: { GraphQLError },
    "../config.ts": { manifest: { name: "inventory", version: "0.1.0" } },
    "../permissions.ts": { SAMPLE_READ: "inventorySamplesRead" },
  }) as {
    resolvers: {
      Query: {
        inventorySamples: (
          parent: null,
          args: Record<string, unknown>,
          context: ResolverContext,
        ) => Promise<{ label: string }[]>;
      };
    };
  };
  const resolve = resolvers.Query.inventorySamples;

  it("denies anonymous, missing tenant and denied action before model access", async () => {
    const context: ResolverContext = {
      subdomain: "tenant-a",
      user: { _id: "u" },
      checkPermission: async () => {
        throw new Error("Permission required");
      },
      models: {
        Samples: {
          list: async () => {
            assert.fail("unauthorized DB access");
          },
        },
      },
    };
    await assert.rejects(resolve(null, {}, { ...context, user: null }), /Login required/);
    await assert.rejects(resolve(null, {}, { ...context, subdomain: "" }), /Tenant required/);
    await assert.rejects(resolve(null, {}, context), /Permission required/);
    for (const args of [
      { limit: 0 },
      { limit: 101 },
      { limit: null },
      { limit: 1.5 },
      { offset: -1 },
      { offset: 10001 },
      { offset: null },
    ]) {
      await assert.rejects(
        resolve(null, args, { ...context, checkPermission: async () => {} }),
        /Use limit/,
      );
    }
  });

  it("awaits the registered action and reads only the supplied tenant model with bounded pagination", async () => {
    for (const tenant of ["tenant-a", "tenant-b"]) {
      let authorized = false;
      const context: ResolverContext = {
        subdomain: tenant,
        user: { _id: "u" },
        checkPermission: async (action) => {
          await Promise.resolve();
          assert.equal(action, "inventorySamplesRead");
          authorized = true;
        },
        models: {
          Samples: {
            list: async (page) => {
              assert.ok(authorized);
              assert.deepEqual(page, { limit: 20, offset: 0 });
              return [{ label: tenant }];
            },
          },
        },
      };
      assert.equal((await resolve(null, {}, context))[0]?.label, tenant);
    }
  });

  it("registers an all-tenant read action without unsupported own/group grants", () => {
    const { permissions } = templateModule("api/platform/src/permissions.ts", {
      "./config.ts": { manifest: { name: "inventory" } },
    }) as {
      permissions: {
        plugin: string;
        modules: { scopes: { name: string }[]; actions: { name: string }[] }[];
        defaultGroups?: unknown;
      };
    };
    assert.equal(permissions.plugin, "inventory");
    assert.deepEqual(
      permissions.modules[0]?.scopes.map(({ name }) => name),
      ["all"],
    );
    assert.equal(permissions.modules[0]?.actions[0]?.name, "inventorySamplesRead");
    assert.equal(permissions.defaultGroups, undefined);
    assert.match(TEMPLATES["api/platform/src/main.ts"] ?? "", /meta: \{ permissions \}/);
  });
});
