import type { IPermissionConfig } from "erxes-api-shared/core-types";
import { manifest } from "./config.ts";

// Action names are global across the platform, not local to this plugin.
export const SAMPLE_READ = "__camel__SamplesRead";

export const permissions: IPermissionConfig = {
  plugin: manifest.name,
  modules: [{
    name: "__camel__Samples",
    description: `${manifest.title} sample records`,
    scopeField: null,
    ownerFields: [],
    // This example grants tenant-wide reads only; do not advertise own/group
    // scopes unless the model query actually filters for those scopes.
    scopes: [{ name: "all", description: "All sample records in this tenant" }],
    actions: [{
      name: SAMPLE_READ,
      title: "Read sample records",
      description: `View ${manifest.title} sample records`,
    }],
  }],
};
