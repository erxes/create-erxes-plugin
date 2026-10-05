import { IconSandbox } from "@tabler/icons-react";
// Root import on purpose: core-ui shares `erxes-ui` as a Module Federation
// singleton keyed on the bare specifier, so deep imports would bundle a second
// private copy instead of reusing the host's.
// @ts-expect-error — erxes-ui's packaged declarations are incomplete; the
// export exists at runtime (the package resolves to its TypeScript source).
import { NavigationMenuLinkItem } from "erxes-ui";
import manifest from "../../../erxes.json" with { type: "json" };

export const Navigation = () => (
  <NavigationMenuLinkItem
    name={manifest.title}
    icon={IconSandbox}
    path={manifest.ui.path}
  />
);
