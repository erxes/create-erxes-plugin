import { IconAdjustments, IconSandbox, IconSettings } from "@tabler/icons-react";
import { Breadcrumb, Button, Card, Empty, Separator } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };

const { path } = manifest.ui;

const IDENTITY: [string, string][] = [
  ["Name", manifest.name],
  ["Route", `/${path}`],
  ["Remote", manifest.ui.remote],
  ["API", `:${manifest.api.port}${manifest.api.graphql}`],
  ["Version", manifest.version],
];

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
    <div className="__twPrefix__:flex-1 __twPrefix__:overflow-auto">
      <div className="__twPrefix__:mx-auto __twPrefix__:flex __twPrefix__:w-full __twPrefix__:max-w-3xl __twPrefix__:flex-col __twPrefix__:gap-6 __twPrefix__:p-6">
        <Card>
          <Card.Header>
            <Card.Title>General</Card.Title>
            <Card.Description>
              Plugin identity comes from erxes.json; change it there and
              restart.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <dl className="__twPrefix__:grid __twPrefix__:grid-cols-[8rem_1fr] __twPrefix__:gap-y-2 __twPrefix__:text-sm">
              {IDENTITY.map(([label, value]) => (
                <div
                  key={label}
                  className="__twPrefix__:contents"
                >
                  <dt className="__twPrefix__:text-muted-foreground">{label}</dt>
                  <dd>
                    <code className="__twPrefix__:rounded __twPrefix__:bg-muted __twPrefix__:px-1.5 __twPrefix__:py-0.5 __twPrefix__:font-mono __twPrefix__:text-xs">
                      {value}
                    </code>
                  </dd>
                </div>
              ))}
            </dl>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>Your settings</Card.Title>
            <Card.Description>
              Add this plugin's own configuration here: forms with Form from
              erxes-ui, saved through a prefixed mutation.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Empty>
              <Empty.Header>
                <Empty.Media variant="icon">
                  <IconAdjustments />
                </Empty.Media>
                <Empty.Title>No settings yet</Empty.Title>
                <Empty.Description>
                  Edit ui/src/pages/SettingsPage.tsx to add them.
                </Empty.Description>
              </Empty.Header>
            </Empty>
          </Card.Content>
        </Card>
      </div>
    </div>
  </div>
);
