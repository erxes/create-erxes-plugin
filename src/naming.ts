import { EXISTING_PLUGIN_PATTERN } from "./existing-plugins.ts";

// Lowercase words separated by single dashes, e.g. `inventory` or `erxes-agent-v2`.
const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

// Names erxes itself owns as services or gateway routes.
const RESERVED_NAMES = new Set(["core", "gateway", "api", "graphql", "health"]);

export type PluginNames = {
  /** Plugin name: Redis keys, gateway service, route path, CDN folder. */
  name: string;
  /** Underscored name: Module Federation container prefix and `CONFIG.name`. */
  id: string;
  /** Module Federation remote name core-ui loads (`<id>_ui`). */
  remote: string;
  /** camelCase prefix for GraphQL operations and fields. */
  camel: string;
  /** PascalCase prefix for GraphQL types and React components. */
  pascal: string;
  /** Human-readable label for navigation and docs. */
  title: string;
  /** Tailwind class prefix; Tailwind only accepts lowercase letters. */
  cssPrefix: string;
};

export const validatePluginName = (name: string): string | undefined => {
  if (!NAME_PATTERN.test(name)) {
    return "Use lowercase letters and digits, optionally separated by single dashes (e.g. inventory, erxes-agent-v2), starting with a letter.";
  }
  if (RESERVED_NAMES.has(name)) {
    return `"${name}" is reserved by erxes.`;
  }
  if (EXISTING_PLUGIN_PATTERN.test(name)) {
    return `"${name}" is already an erxes plugin.`;
  }
  return undefined;
};

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export const derivePluginNames = (name: string, title?: string): PluginNames => {
  const words = name.split("-");
  const id = words.join("_");
  const pascal = words.map(capitalize).join("");

  return {
    name,
    id,
    remote: `${id}_ui`,
    camel: pascal.charAt(0).toLowerCase() + pascal.slice(1),
    pascal,
    title: title?.trim() || words.map(capitalize).join(" "),
    cssPrefix: name.replace(/[^a-z]/g, ""),
  };
};
