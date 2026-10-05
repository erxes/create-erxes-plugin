import { IconSandbox, IconSettings } from "@tabler/icons-react";
import { Breadcrumb, Button, Separator } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };

const { path } = manifest.ui;

export const SettingsPage = () => (
  <div className="__twPrefix__:flex __twPrefix__:h-full __twPrefix__:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="__twPrefix__:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/settings/${path}`}>
                  <IconSettings />
                  {manifest.title} settings
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton
          breadcrumb={[manifest.title, "settings"]}
          icon="IconSettings"
        />
      </PageHeader.Start>
      <PageHeader.End>
        <Button variant="outline" asChild>
          <Link to={`/${path}`}>
            <IconSandbox />
            Back to {manifest.title}
          </Link>
        </Button>
      </PageHeader.End>
    </PageHeader>
    <div className="__twPrefix__:flex-1 __twPrefix__:overflow-auto __twPrefix__:p-6">
      <section className="__twPrefix__:max-w-xl __twPrefix__:rounded-lg __twPrefix__:border __twPrefix__:border-border __twPrefix__:bg-background __twPrefix__:p-6">
        <h2 className="__twPrefix__:text-lg __twPrefix__:font-semibold">General</h2>
        <p className="__twPrefix__:text-sm __twPrefix__:text-muted-foreground">
          Configure {manifest.title} here. This page is mounted at
          /settings/{path} by core-ui.
        </p>
      </section>
    </div>
  </div>
);
