import { serve } from "@hono/node-server";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { createYoga } from "graphql-yoga";
import { Hono } from "hono";
import { env, manifest } from "./config.ts";
import { createContext } from "./context.ts";
import { joinErxesGateway } from "./gateway.ts";
import { resolvers, typeDefs } from "./graphql/schema.ts";

const app = new Hono();

const yoga = createYoga({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
  graphqlEndpoint: manifest.api.graphql,
  landingPage: false,
  context: ({ request }) => createContext(request.headers),
});

app.get(manifest.api.health, (c) => c.json({ ok: true }));
app.on(["GET", "POST", "OPTIONS"], manifest.api.graphql, (c) => yoga.fetch(c.req.raw));

const server = serve({ fetch: app.fetch, port: env.PORT });
console.log(
  `${manifest.name} API listening on http://localhost:${env.PORT}${manifest.api.graphql}`,
);

const address = await joinErxesGateway();
console.log(`${manifest.name} joined the erxes gateway as ${address}`);

const shutdown = async () => {
  server.close();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
