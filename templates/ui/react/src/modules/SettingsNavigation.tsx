// @ts-expect-error — erxes-ui's packaged declarations are incomplete; the
// exports exist at runtime (the package resolves to its TypeScript source).
import { SettingsNavigationMenuLinkItem, Sidebar } from "erxes-ui";
import manifest from "../../../erxes.json" with { type: "json" };

// SettingsNavigationMenuLinkItem prepends `settings/` to pathPrefix, so this
// links to `/settings/<path>`.
export const SettingsNavigation = () => (
  <Sidebar.Group>
    <Sidebar.GroupLabel className="__twPrefix__:h-4">
      {manifest.title}
    </Sidebar.GroupLabel>
    <Sidebar.GroupContent className="__twPrefix__:pt-1">
      <Sidebar.Menu>
        <SettingsNavigationMenuLinkItem
          pathPrefix={manifest.ui.path}
          path=""
          name="General"
        />
      </Sidebar.Menu>
    </Sidebar.GroupContent>
  </Sidebar.Group>
);
