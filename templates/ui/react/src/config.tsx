import "./styles.css";
import { IconSandbox } from "@tabler/icons-react";
import type { IUIConfig } from "erxes-ui";
import { lazy, Suspense } from "react";
import manifest from "../../erxes.json" with { type: "json" };

const { name, path } = manifest.ui;

const Navigation = lazy(() =>
  import("./modules/Navigation").then((module) => ({
    default: module.Navigation,
  })),
);
const SettingsNavigation = lazy(() =>
  import("./modules/SettingsNavigation").then((module) => ({
    default: module.SettingsNavigation,
  })),
);

// core-ui registers `/<path>/*` for the `./<name>` expose and
// `/settings/<path>/*` for `./<name>Settings`. Typing against erxes-ui's
// IUIConfig keeps this honest — the interface is the contract the host reads
// at runtime.
export const CONFIG: IUIConfig = {
  name,
  path,
  navigationGroup: {
    name: manifest.title,
    icon: IconSandbox,
    content: () => (
      <Suspense fallback={<div />}>
        <Navigation />
      </Suspense>
    ),
  },
  settingsNavigation: () => (
    <Suspense fallback={<div />}>
      <SettingsNavigation />
    </Suspense>
  ),
  modules: [{ name, icon: IconSandbox, path }],
};
