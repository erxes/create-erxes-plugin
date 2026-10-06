import { Field, ObjectType } from "@nestjs/graphql";

// Every type is prefixed with the plugin name: the gateway composes all
// plugins into one supergraph, so names must be unique across it.
@ObjectType("__Pascal__Status")
export class __Pascal__Status {
  @Field(() => String)
  plugin!: string;

  @Field(() => String)
  version!: string;

  @Field(() => String)
  subdomain!: string;

  @Field(() => String, { nullable: true })
  userId!: string | null;

  @Field(() => String, { nullable: true })
  userEmail!: string | null;
}
