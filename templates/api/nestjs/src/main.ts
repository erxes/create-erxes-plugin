import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.ts";
import { env, manifest } from "./config.ts";
import { joinErxesGateway } from "./gateway.ts";

const bootstrap = async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableShutdownHooks();
  await app.listen(env.PORT, "0.0.0.0");
  console.log(
    `${manifest.name} API listening on http://localhost:${env.PORT}${manifest.api.graphql}`,
  );

  const address = await joinErxesGateway();
  console.log(`${manifest.name} joined the erxes gateway as ${address}`);
};

void bootstrap();
