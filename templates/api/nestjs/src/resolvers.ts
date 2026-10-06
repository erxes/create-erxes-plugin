import { StatusResolver } from "./status/status.resolver.ts";

// AppModule and print-schema.ts both read this list; register every new
// resolver class here so the printed SDL matches the running API.
export const RESOLVERS = [StatusResolver];
