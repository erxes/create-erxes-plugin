import { useQuery } from "@apollo/client";
import type { ComponentType, ReactNode } from "react";
import {
  IconBell,
  IconBook,
  IconDatabase,
  IconExternalLink,
  IconLayoutDashboard,
  IconSandbox,
  IconSettings,
} from "@tabler/icons-react";
// Root imports on purpose: core-ui shares `erxes-ui`/`ui-modules` as Module
// Federation singletons keyed on the bare specifier, so deep imports would
// bundle second private copies instead of reusing the host's.
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Separator,
  Skeleton,
  cn,
} from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { STATUS_QUERY } from "../graphql";

const { path } = manifest.ui;

const Dot = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "__twPrefix__:inline-block __twPrefix__:size-2 __twPrefix__:rounded-full",
      className,
    )}
  />
);

const StatusRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="__twPrefix__:flex __twPrefix__:items-center __twPrefix__:justify-between __twPrefix__:gap-4 __twPrefix__:text-sm">
    <span className="__twPrefix__:text-muted-foreground">{label}</span>
    <span className="__twPrefix__:flex __twPrefix__:items-center __twPrefix__:gap-2 __twPrefix__:font-medium">
      {children}
    </span>
  </div>
);

const ConnectionCard = () => {
  const { data, loading, error, refetch } = useQuery(STATUS_QUERY);
  const status = data?.__camel__Status;

  const pending = (
    <>
      <Dot className="__twPrefix__:animate-pulse __twPrefix__:bg-muted-foreground" />
      <Skeleton className="__twPrefix__:h-4 __twPrefix__:w-24" />
    </>
  );

  return (
    <Card className="__twPrefix__:w-full __twPrefix__:md:w-80 __twPrefix__:shrink-0">
      <Card.Header>
        <Card.Title className="__twPrefix__:text-sm">Connection</Card.Title>
        <Card.Description>
          Live status of this plugin inside erxes
        </Card.Description>
      </Card.Header>
      <Card.Content className="__twPrefix__:flex __twPrefix__:flex-col __twPrefix__:gap-3">
        <StatusRow label="API">
          {loading ? (
            pending
          ) : error ? (
            <>
              <Dot className="__twPrefix__:bg-destructive" />
              <span>Unreachable</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </>
          ) : (
            <>
              <Dot className="__twPrefix__:bg-success" />
              <span>Connected · v{status?.version}</span>
            </>
          )}
        </StatusRow>
        <StatusRow label="Gateway">
          {loading ? (
            pending
          ) : error ? (
            <>
              <Dot className="__twPrefix__:bg-destructive" />
              <span
                className="__twPrefix__:truncate __twPrefix__:max-w-40"
                title={error.message}
              >
                {error.message}
              </span>
            </>
          ) : (
            <>
              <Dot className="__twPrefix__:bg-success" />
              <span>Federated as {status?.plugin}</span>
            </>
          )}
        </StatusRow>
        <StatusRow label="Tenant">
          {loading ? pending : (status?.subdomain ?? "—")}
        </StatusRow>
        <StatusRow label="Signed in">
          {loading
            ? pending
            : (status && (status.userEmail ?? status.userId ?? "Anonymous")) ||
              "—"}
        </StatusRow>
      </Card.Content>
    </Card>
  );
};

const StepCard = ({
  icon: Icon,
  title,
  description,
  code,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  code: string;
}) => (
  <Card>
    <Card.Header>
      <div className="__twPrefix__:flex __twPrefix__:size-9 __twPrefix__:items-center __twPrefix__:justify-center __twPrefix__:rounded-lg __twPrefix__:bg-accent">
        <Icon className="__twPrefix__:size-5" />
      </div>
      <Card.Title>{title}</Card.Title>
      <Card.Description>{description}</Card.Description>
    </Card.Header>
    <Card.Content>
      <code className="__twPrefix__:rounded __twPrefix__:bg-muted __twPrefix__:px-1.5 __twPrefix__:py-0.5 __twPrefix__:font-mono __twPrefix__:text-xs">
        {code}
      </code>
    </Card.Content>
  </Card>
);

const STEPS = [
  {
    icon: IconDatabase,
    title: "Model your data",
    description:
      "Define the records this plugin owns and expose them on the federated graph.",
    code: "__apiEntryHint__",
  },
  {
    icon: IconLayoutDashboard,
    title: "Build the page",
    description:
      "Replace this overview with your module: lists with RecordTable, forms with Form, details in a Sheet.",
    code: "ui/src/pages/IndexPage.tsx",
  },
  {
    icon: IconBell,
    title: "Notify people",
    description:
      "Notifications your API sends open in the host inbox and render through this widget.",
    code: "ui/src/widgets/NotificationWidget.tsx",
  },
];

export const IndexPage = () => (
  <div className="__twPrefix__:flex __twPrefix__:h-full __twPrefix__:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="__twPrefix__:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}`}>
                  <IconSandbox />
                  {manifest.title}
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton
          breadcrumb={[manifest.title]}
          icon="IconSandbox"
        />
      </PageHeader.Start>
      <PageHeader.End>
        <Button variant="outline" asChild>
          <Link to={`/settings/${path}`}>
            <IconSettings />
            Settings
          </Link>
        </Button>
      </PageHeader.End>
    </PageHeader>
    <div className="__twPrefix__:flex-1 __twPrefix__:overflow-auto">
      <div className="__twPrefix__:mx-auto __twPrefix__:flex __twPrefix__:w-full __twPrefix__:max-w-5xl __twPrefix__:flex-col __twPrefix__:gap-6 __twPrefix__:p-6">
        <section className="__twPrefix__:relative __twPrefix__:overflow-hidden __twPrefix__:rounded-xl __twPrefix__:border __twPrefix__:border-border __twPrefix__:bg-background __twPrefix__:p-8 __twPrefix__:shadow-xs">
          <div
            aria-hidden
            className="__twPrefix__:pointer-events-none __twPrefix__:absolute __twPrefix__:inset-0 __twPrefix__:bg-gradient-to-br __twPrefix__:from-primary/10 __twPrefix__:via-transparent __twPrefix__:to-transparent"
          />
          <div className="__twPrefix__:relative __twPrefix__:flex __twPrefix__:flex-col __twPrefix__:gap-6 __twPrefix__:md:flex-row __twPrefix__:md:items-start __twPrefix__:md:justify-between">
            <div className="__twPrefix__:flex __twPrefix__:max-w-xl __twPrefix__:flex-col __twPrefix__:gap-4">
              <div>
                <Badge variant="info">Plugin · v{manifest.version}</Badge>
              </div>
              <h1 className="__twPrefix__:text-2xl __twPrefix__:font-semibold __twPrefix__:tracking-tight">
                Welcome to {manifest.title}
              </h1>
              <p className="__twPrefix__:text-sm __twPrefix__:leading-relaxed __twPrefix__:text-muted-foreground">
                {manifest.description}
              </p>
              <div className="__twPrefix__:flex __twPrefix__:flex-wrap __twPrefix__:gap-2">
                <Button asChild>
                  <Link to={`/settings/${path}`}>
                    <IconSettings />
                    Open settings
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href="https://erxes.io/docs/create-plugin-standalone"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconBook />
                    Developer guide
                    <IconExternalLink />
                  </a>
                </Button>
              </div>
            </div>
            <ConnectionCard />
          </div>
        </section>
        <div className="__twPrefix__:grid __twPrefix__:gap-4 __twPrefix__:md:grid-cols-3">
          {STEPS.map((step) => (
            <StepCard key={step.title} {...step} />
          ))}
        </div>
      </div>
    </div>
  </div>
);
