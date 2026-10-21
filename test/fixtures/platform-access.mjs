// Copied into the generated external API after compilation (CommonJS).
const assert = require("node:assert/strict");
const { resolvers } = require("./dist/graphql/schema.js");
const { permissions, SAMPLE_READ } = require("./dist/permissions.js");
const { loadSampleClass } = require("./dist/modules/sample/db/models/Sample.js");

async function main() {
  const resolve = resolvers.Query.__camel__Samples;
  assert.ok(
    permissions.modules.some((module) =>
      module.actions.some((action) => action.name === SAMPLE_READ),
    ),
  );
  assert.equal(SAMPLE_READ, "__camel__SamplesRead");
  let reads = 0;
  const context = (tenant) => ({
    user: { _id: "user-1" },
    subdomain: tenant,
    checkPermission: async (action) => assert.equal(action, SAMPLE_READ),
    models: {
      Samples: {
        list: async (page) => {
          reads++;
          assert.deepEqual(page, { limit: 20, offset: 0 });
          return [{ _id: tenant, label: tenant, createdAt: new Date("2026-01-01") }];
        },
      },
    },
  });
  await assert.rejects(resolve(null, {}, { ...context("a"), user: null }), /Login required/);
  await assert.rejects(resolve(null, {}, context("")), /Tenant required/);
  await assert.rejects(
    resolve(
      null,
      {},
      {
        ...context("a"),
        checkPermission: async () => {
          throw new Error("denied");
        },
      },
    ),
    /denied/,
  );
  assert.equal(reads, 0, "no DB access before authentication and authorization");
  for (const page of [
    { limit: 0 },
    { limit: 101 },
    { limit: null },
    { limit: 1.5 },
    { offset: -1 },
    { offset: 10001 },
    { offset: null },
  ]) {
    await assert.rejects(resolve(null, page, context("a")), /Use limit/);
  }
  assert.equal(reads, 0, "no DB access with invalid pagination");
  assert.equal((await resolve(null, {}, context("a")))[0].label, "a");
  assert.equal((await resolve(null, {}, context("b")))[0].label, "b");

  // The model itself must apply pagination before executing the query.
  const calls = [];
  const query = {
    sort: (sort) => {
      calls.push(["sort", sort]);
      return query;
    },
    skip: (offset) => {
      calls.push(["skip", offset]);
      return query;
    },
    limit: (limit) => {
      calls.push(["limit", limit]);
      return query;
    },
    lean: () => {
      calls.push(["lean"]);
      return [];
    },
  };
  const schema = loadSampleClass({ Samples: { find: () => query } });
  schema.statics.list({ limit: 10, offset: 20 });
  assert.deepEqual(calls, [
    ["sort", { createdAt: -1, _id: -1 }],
    ["skip", 20],
    ["limit", 10],
    ["lean"],
  ]);
}
// Published api-shared initializes background clients on import. This isolated
// fixture owns its process; terminate after every assertion has completed.
main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
