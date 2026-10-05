import { useQuery } from "@apollo/client";
import { IconSandbox, IconSettings } from "@tabler/icons-react";
// Root imports on purpose: core-ui shares `erxes-ui`/`ui-modules` as Module
// Federation singletons keyed on the bare specifier, so deep imports would
// bundle second private copies instead of reusing the host's.
import { Breadcrumb, Button, Separator, Spinner } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { STATUS_QUERY, type StatusQuery } from "../graphql";

const { path } = manifest.ui;

type FieldProps = { label: string; value: string | null };

const Field = ({ label, value }: FieldProps) => (
  <div className="__twPrefix__:flex __twPrefix__:justify-between __twPrefix__:gap-4 __twPrefix__:border-b __twPrefix__:border-border __twPrefix__:py-2 __twPrefix__:text-sm __twPrefix__:last:border-b-0">
    <dt className="__twPrefix__:text-muted-foreground">{label}</dt>
    <dd className="__twPrefix__:font-medium">{value ?? "—"}</dd>
  </div>
);

const StatusCard = () => {
  const { data, loading, error, refetch } = useQuery<StatusQuery>(STATUS_QUERY);
  const status = data?.__camel__Status;

  if (loading)
    return (
      <p className="__twPrefix__:flex __twPrefix__:items-center __twPrefix__:gap-2 __twPrefix__:text-sm __twPrefix__:text-muted-foreground">
        <Spinner /> Checking the API…
      </p>
    );

  if (error)
    return (
      <div className="__twPrefix__:flex __twPrefix__:flex-col __twPrefix__:items-start __twPrefix__:gap-2">
        <p className="__twPrefix__:text-sm __twPrefix__:text-destructive">{error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );

  if (!status) return null;

  return (
    <dl className="__twPrefix__:mt-4">
      <Field label="Plugin" value={`${status.plugin}@${status.version}`} />
      <Field label="Subdomain" value={status.subdomain} />
      <Field label="User" value={status.userEmail ?? status.userId} />
    </dl>
  );
};

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
    <div className="__twPrefix__:flex-1 __twPrefix__:overflow-auto __twPrefix__:p-6">
      <section className="__twPrefix__:max-w-xl __twPrefix__:rounded-lg __twPrefix__:border __twPrefix__:border-border __twPrefix__:bg-background __twPrefix__:p-6">
        <h2 className="__twPrefix__:text-lg __twPrefix__:font-semibold">{manifest.title}</h2>
        <p className="__twPrefix__:text-sm __twPrefix__:text-muted-foreground">
          {manifest.description}
        </p>
        <StatusCard />
      </section>
      <p className="__twPrefix__:mt-4 __twPrefix__:text-xs __twPrefix__:text-muted-foreground">
        Edit ui/src/pages/IndexPage.tsx. Build lists with RecordTable and forms
        with Form from erxes-ui; see docs/erxes-integration.md.
      </p>
    </div>
  </div>
);
