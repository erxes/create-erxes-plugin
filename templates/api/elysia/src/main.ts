import { buildSubgraphSchema } from "@apollo/subgraph";
import { Elysia } from "elysia";
import { createYoga } from "graphql-yoga";
import { env, manifest } from "./config.ts";
import { createContext } from "./context.ts";
import { joinErxesGateway } from "./gateway.ts";
import { resolvers, typeDefs } from "./graphql/schema.ts";

const yoga = createYoga({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
  graphqlEndpoint: manifest.api.graphql,
  landingPage: false,
  context: ({ request }) => createContext(request.headers),
});

const app = new Elysia()
  .get(manifest.api.health, () => ({ ok: true }))
  .all(manifest.api.graphql, ({ request }) => yoga.fetch(request))
  .listen(env.PORT);

console.log(
  `${manifest.name} API listening on http://localhost:${env.PORT}${manifest.api.graphql}`,
);

const address = await joinErxesGateway();
console.log(`${manifest.name} joined the erxes gateway as ${address}`);

const shutdown = async () => {
  await app.stop();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
