import type { IUIConfig } from "erxes-ui";
import { Link } from "react-router";
import manifest from "../../erxes.json" with { type: "json" };
import { PluginIcon } from "./PluginIcon";

const { name, path } = manifest.ui;

// core-ui registers the route `/<path>/*` and renders the `./<name>` expose
// there. Typing against erxes-ui's IUIConfig keeps this honest — the interface
// is the contract the host reads at runtime.
export const CONFIG: IUIConfig = {
  name,
  path,
  navigationGroup: {
    name: manifest.title,
    defaultPath: path,
    icon: PluginIcon,
    content: () => (
      <Link
        to={`/${path}`}
        className="__twPrefix__:block __twPrefix__:rounded-md __twPrefix__:px-2 __twPrefix__:py-1 __twPrefix__:text-sm __twPrefix__:hover:bg-accent"
      >
        {manifest.title}
      </Link>
    ),
  },
  modules: [{ name, icon: PluginIcon, path }],
};
