import { gql } from "graphql-tag";
import { manifest } from "../config.ts";
import type { Context } from "../connectionResolvers.ts";

// Every type and operation is prefixed with the plugin name: the gateway
// composes all plugins into one supergraph, so names must be unique across it.
export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@key"])

  type __Pascal__Status {
    plugin: String!
    version: String!
    subdomain: String!
    userId: String
    userEmail: String
  }

  type __Pascal__Sample {
    _id: String!
    label: String!
    createdAt: String
  }

  type Query {
    __camel__Status: __Pascal__Status!
    __camel__Samples: [__Pascal__Sample!]!
  }
`;

export const resolvers = {
  Query: {
    __camel__Status: (_parent: unknown, _args: unknown, { subdomain, user }: Context) => ({
      plugin: manifest.name,
      version: manifest.version,
      subdomain,
      userId: user?._id ?? null,
      userEmail: user?.email ?? null,
    }),
    __camel__Samples: async (_parent: unknown, _args: unknown, { models }: Context) =>
      (await models.Samples.list()).map((sample) => ({
        ...sample,
        createdAt: sample.createdAt?.toISOString?.() ?? null,
      })),
  },
};
