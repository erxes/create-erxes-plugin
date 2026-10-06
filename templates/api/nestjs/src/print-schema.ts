import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from "@nestjs/graphql";
import { printSchema } from "graphql";
import { mkdirSync, writeFileSync } from "node:fs";
import { RESOLVERS } from "./resolvers.ts";

// Builds the schema from the resolver classes without starting the HTTP
// server or joining the gateway; AppModule registers the same RESOLVERS list.
const main = async () => {
  const app = await NestFactory.create(GraphQLSchemaBuilderModule, { logger: false });
  await app.init();
  const schema = await app.get(GraphQLSchemaFactory).create(RESOLVERS);
  mkdirSync("generated", { recursive: true });
  writeFileSync("generated/schema.graphql", printSchema(schema));
  await app.close();
};

main().catch((error) => { console.error(error); process.exit(1); });
