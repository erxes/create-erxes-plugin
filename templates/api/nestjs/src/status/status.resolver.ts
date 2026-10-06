import { Context as GqlContext, Query, Resolver } from "@nestjs/graphql";
import { manifest } from "../config.ts";
import type { Context } from "../context.ts";
import { __Pascal__Status } from "./status.model.ts";

@Resolver(() => __Pascal__Status)
export class StatusResolver {
  @Query(() => __Pascal__Status, { name: "__camel__Status" })
  status(@GqlContext() context: Context): __Pascal__Status {
    const { subdomain, user } = context;
    return {
      plugin: manifest.name,
      version: manifest.version,
      subdomain,
      userId: user?._id ?? null,
      userEmail: user?.email ?? null,
    };
  }
}
