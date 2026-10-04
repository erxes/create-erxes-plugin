import { ApolloServer } from "@apollo/server";
import { buildSubgraphSchema } from "@apollo/subgraph";
import fastifyApollo, { fastifyApolloDrainPlugin } from "@as-integrations/fastify";
import Fastify from "fastify";
import { env, manifest } from "./config.ts";
import { type Context, createContext } from "./context.ts";
import { joinErxesGateway } from "./gateway.ts";
import { resolvers, typeDefs } from "./graphql/schema.ts";

const fastify = Fastify({ logger: false });

const apollo = new ApolloServer<Context>({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
  plugins: [fastifyApolloDrainPlugin(fastify)],
});
await apollo.start();

fastify.get(manifest.api.health, async () => ({ ok: true }));

await fastify.register(fastifyApollo(apollo), {
  path: manifest.api.graphql,
  context: async (request) => createContext(request.headers),
});

await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
console.log(
  `${manifest.name} API listening on http://localhost:${env.PORT}${manifest.api.graphql}`,
);

const address = await joinErxesGateway();
console.log(`${manifest.name} joined the erxes gateway as ${address}`);

const shutdown = async () => {
  await apollo.stop();
  await fastify.close();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
