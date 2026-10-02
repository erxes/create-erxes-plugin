import { gql } from "@apollo/client";

// Operation names are global across erxes; keep the plugin prefix.
export const STATUS_QUERY = gql`
  query __camel__Status {
    __camel__Status {
      plugin
      version
      subdomain
      userId
      userEmail
    }
  }
`;

export type StatusQuery = {
  __camel__Status: {
    plugin: string;
    version: string;
    subdomain: string;
    userId: string | null;
    userEmail: string | null;
  };
};
