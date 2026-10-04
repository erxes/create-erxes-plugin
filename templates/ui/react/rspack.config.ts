import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { defineConfig } from "@rspack/cli";
import manifest from "../erxes.json" with { type: "json" };

const { name, remote, port } = manifest.ui;

// erxes core-ui owns these (its `coreLibraries` shared set). The remote never
// bundles its own copy, so hooks, context (ApolloProvider, Router, Jotai,
// i18n) and the design system all resolve to the host's instances.
const hostShared = [
  "react",
  "react-dom",
  "react-router",
  "react-router-dom",
  "@apollo/client",
  "jotai",
  "react-i18next",
  "erxes-ui",
  "ui-modules",
];

export default defineConfig({
  entry: {},
  output: { publicPath: "auto", uniqueName: remote, clean: true },
  resolve: { extensions: [".tsx", ".ts", ".js"] },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "builtin:swc-loader",
        options: {
          jsc: {
            parser: { syntax: "typescript", tsx: true },
            transform: { react: { runtime: "automatic" } },
          },
        },
      },
      { test: /\.css$/, use: ["postcss-loader"], type: "css" },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: remote,
      filename: "remoteEntry.js",
      // core-ui loads `<remote>/config` for CONFIG and `<remote>/<name>` for the page.
      exposes: {
        "./config": "./src/config.tsx",
        [`./${name}`]: "./src/Main.tsx",
      },
      shared: Object.fromEntries(
        hostShared.map((lib) => [lib, { singleton: true, import: false, requiredVersion: false }]),
      ),
      dts: false,
    }),
  ],
  devServer: {
    port,
    headers: { "Access-Control-Allow-Origin": "*" },
    allowedHosts: "all",
  },
});
