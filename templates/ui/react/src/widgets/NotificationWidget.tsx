import "../styles.css";
import {
  IconBell,
  IconExternalLink,
  IconInfoCircle,
} from "@tabler/icons-react";
// Root imports on purpose: core-ui shares `erxes-ui`/`ui-modules` as Module
// Federation singletons keyed on the bare specifier, so deep imports would
// bundle second private copies instead of reusing the host's.
import {
  Avatar,
  Badge,
  Button,
  Empty,
  RelativeDateDisplay,
  readImage,
} from "erxes-ui";
import type { TNotification } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };

const { path } = manifest.ui;

const TYPE_BADGE = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "destructive",
} as const;

// core-ui mounts this for every `<name>:<module>.<action>` notification; the
// notification object arrives as props. `system.welcome` is rendered by the
// host itself and never reaches this component.
export const NotificationWidget = (notification: TNotification) => {
  const {
    title,
    message,
    type,
    fromUser,
    contentType,
    contentTypeId,
    action,
    createdAt,
  } = notification;
  const [, moduleName = "", notificationAction = ""] = (contentType ?? "")
    .replace(":", ".")
    .split(".");

  if (!title && !message) {
    return (
      <div className="__twPrefix__:flex __twPrefix__:min-h-dvh __twPrefix__:items-center __twPrefix__:justify-center __twPrefix__:p-6">
        <Empty>
          <Empty.Header>
            <Empty.Media variant="icon">
              <IconInfoCircle />
            </Empty.Media>
            <Empty.Title>Notification content unavailable</Empty.Title>
            <Empty.Description>
              This notification has no linked detail view yet.
            </Empty.Description>
          </Empty.Header>
        </Empty>
      </div>
    );
  }

  const actorName =
    fromUser?.details?.fullName || fromUser?.email || "System";

  return (
    <article className="__twPrefix__:mx-auto __twPrefix__:flex __twPrefix__:min-h-dvh __twPrefix__:w-full __twPrefix__:max-w-3xl __twPrefix__:flex-col __twPrefix__:px-6 __twPrefix__:py-8">
      <header className="__twPrefix__:flex __twPrefix__:items-start __twPrefix__:justify-between __twPrefix__:gap-4">
        <div className="__twPrefix__:flex __twPrefix__:flex-col __twPrefix__:gap-3">
          <div className="__twPrefix__:flex __twPrefix__:size-12 __twPrefix__:items-center __twPrefix__:justify-center __twPrefix__:rounded-2xl __twPrefix__:bg-accent">
            <IconBell className="__twPrefix__:size-6" />
          </div>
          <p className="__twPrefix__:text-xs __twPrefix__:font-medium __twPrefix__:uppercase __twPrefix__:tracking-wide __twPrefix__:text-muted-foreground">
            {manifest.title} · {moduleName || "notification"}
          </p>
          <h2 className="__twPrefix__:text-2xl __twPrefix__:font-semibold">
            {title}
          </h2>
          <div className="__twPrefix__:flex __twPrefix__:flex-wrap __twPrefix__:items-center __twPrefix__:gap-2 __twPrefix__:text-sm __twPrefix__:text-muted-foreground">
            <span className="__twPrefix__:inline-flex __twPrefix__:items-center __twPrefix__:gap-2">
              <Avatar className="__twPrefix__:size-5">
                <Avatar.Image
                  src={readImage(fromUser?.details?.avatar ?? "")}
                  alt={actorName}
                />
                <Avatar.Fallback className="__twPrefix__:text-[10px]">
                  {actorName.charAt(0).toUpperCase()}
                </Avatar.Fallback>
              </Avatar>
              {actorName}
            </span>
            <span>·</span>
            <RelativeDateDisplay.Value value={createdAt} />
            <Badge variant={TYPE_BADGE[type] ?? "secondary"}>{type}</Badge>
          </div>
        </div>
        <Button variant="secondary" asChild>
          {/* The page can read the linked record via the `id` search param. */}
          <Link
            to={`/${path}${contentTypeId ? `?id=${contentTypeId}` : ""}`}
          >
            <IconExternalLink />
            Open {manifest.title}
          </Link>
        </Button>
      </header>
      <p className="__twPrefix__:py-6 __twPrefix__:text-sm __twPrefix__:leading-6">
        {message}
      </p>
      {(notificationAction || action) && (
        <p className="__twPrefix__:text-xs __twPrefix__:text-muted-foreground">
          Action: {notificationAction || action}
        </p>
      )}
    </article>
  );
};
