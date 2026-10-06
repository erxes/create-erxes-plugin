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
      // JS-injected styles: a federated remote has no separate CSS file the
      // host would load, so style-loader is the reliable path.
      { test: /\.css$/, use: ["style-loader", "css-loader", "postcss-loader"] },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: remote,
      filename: "remoteEntry.js",
      // core-ui loads `<remote>/config` for CONFIG, `<remote>/<name>` for the
      // page at `/<path>/*`, `<remote>/<name>Settings` at `/settings/<path>/*`
      // and `<remote>/notificationWidget` for `<name>:<module>.<action>`
      // notifications in the inbox.
      exposes: {
        "./config": "./src/config.tsx",
        [`./${name}`]: "./src/Main.tsx",
        [`./${name}Settings`]: "./src/Settings.tsx",
        "./notificationWidget": "./src/widgets/NotificationWidget.tsx",
      },
      shared: Object.fromEntries(
        hostShared.map((lib) => [lib, { singleton: true, import: false, requiredVersion: false }]),
      ),
      dts: false,
    }),
  ],
  // rspack serve enables lazy compilation for dynamic imports by default; its
  // browser proxy calls the dev server with a relative URL, which 404s when
  // core-ui loads this remote cross-origin. A federated remote cannot use it.
  lazyCompilation: false,
  devServer: {
    port,
    headers: { "Access-Control-Allow-Origin": "*" },
    allowedHosts: "all",
  },
});
