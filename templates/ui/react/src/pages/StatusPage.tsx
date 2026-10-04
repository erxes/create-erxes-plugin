import { useQuery } from "@apollo/client";
// Root import on purpose: core-ui shares `erxes-ui` as a Module Federation
// singleton keyed on the bare specifier, so deep imports would bundle a second
// private copy instead of reusing the host's.
import { Button } from "erxes-ui";
import manifest from "../../../erxes.json" with { type: "json" };
import { STATUS_QUERY, type StatusQuery } from "../graphql";

type FieldProps = { label: string; value: string | null };

const Field = ({ label, value }: FieldProps) => (
  <div className="__twPrefix__:flex __twPrefix__:justify-between __twPrefix__:gap-4 __twPrefix__:border-b __twPrefix__:border-border __twPrefix__:py-2 __twPrefix__:text-sm __twPrefix__:last:border-b-0">
    <dt className="__twPrefix__:text-muted-foreground">{label}</dt>
    <dd className="__twPrefix__:font-medium">{value ?? "—"}</dd>
  </div>
);

export const StatusPage = () => {
  const { data, loading, error, refetch } = useQuery<StatusQuery>(STATUS_QUERY);
  const status = data?.__camel__Status;

  return (
    <div className="__twPrefix__:flex __twPrefix__:flex-col __twPrefix__:gap-4 __twPrefix__:p-6">
      <header>
        <h1 className="__twPrefix__:text-xl __twPrefix__:font-semibold">{manifest.title}</h1>
        <p className="__twPrefix__:text-sm __twPrefix__:text-muted-foreground">
          {manifest.description}
        </p>
      </header>

      <section className="__twPrefix__:max-w-md __twPrefix__:rounded-lg __twPrefix__:border __twPrefix__:border-border __twPrefix__:bg-background __twPrefix__:p-4">
        {loading && (
          <p className="__twPrefix__:text-sm __twPrefix__:text-muted-foreground">Loading…</p>
        )}
        {error && (
          <div className="__twPrefix__:flex __twPrefix__:flex-col __twPrefix__:items-start __twPrefix__:gap-2">
            <p className="__twPrefix__:text-sm __twPrefix__:text-destructive">{error.message}</p>
            {/* Host-singleton erxes-ui component: styles and code come from core-ui. */}
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}
        {status && (
          <dl>
            <Field label="Plugin" value={`${status.plugin}@${status.version}`} />
            <Field label="Subdomain" value={status.subdomain} />
            <Field label="User" value={status.userEmail ?? status.userId} />
          </dl>
        )}
      </section>
    </div>
  );
};
