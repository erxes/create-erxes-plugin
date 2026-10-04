import { ApolloFederationDriver, type ApolloFederationDriverConfig } from "@nestjs/apollo";
import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { manifest } from "./config.ts";
import { createContext, type HeaderSource } from "./context.ts";
import { HealthController } from "./health.controller.ts";
import { StatusResolver } from "./status/status.resolver.ts";

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      autoSchemaFile: { federation: 2 },
      path: manifest.api.graphql,
      playground: false,
      context: ({ req }: { req: { headers: HeaderSource } }) => createContext(req.headers),
    }),
  ],
  controllers: [HealthController],
  providers: [StatusResolver],
})
export class AppModule {}
