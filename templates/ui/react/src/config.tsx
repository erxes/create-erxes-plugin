import "./styles.css";
import { Link } from "react-router";
import manifest from "../../erxes.json" with { type: "json" };
import { PluginIcon } from "./PluginIcon";

const { name, path } = manifest.ui;

// Structural copy of erxes-ui `IUIConfig`. core-ui registers the route
// `/<path>/*` and renders the `./<name>` expose there.
export const CONFIG = {
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
