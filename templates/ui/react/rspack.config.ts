import { ModuleFederationPlugin } from "@module-federation/enhanced/rspack";
import { defineConfig } from "@rspack/cli";
import manifest from "../erxes.json" with { type: "json" };

const { name, remote, port } = manifest.ui;

// erxes core-ui owns these. The remote never bundles its own copy, so hooks
// and context (ApolloProvider, Router) resolve to the host's instances.
const hostShared = ["react", "react-dom", "react-router", "@apollo/client"];

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
