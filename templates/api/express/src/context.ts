import type { IncomingHttpHeaders } from "node:http";
import { z } from "zod";

// The gateway forwards the signed-in user as base64 JSON in the `user` header
// and the request host in `hostname` (or `nginx-hostname` behind nginx).
const userSchema = z
  .object({
    _id: z.string(),
    email: z.string().optional(),
    username: z.string().optional(),
    isOwner: z.boolean().optional(),
  })
  .loose();

export type ErxesUser = z.infer<typeof userSchema>;

export type Context = {
  /** Tenant: first label of the erxes host (`acme` in acme.app.erxes.io). */
  subdomain: string;
  /** Signed-in erxes user, or null for anonymous requests. */
  user: ErxesUser | null;
};

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const parseUser = (header: string | undefined): ErxesUser | null => {
  if (!header) return null;
  try {
    const result = userSchema.safeParse(JSON.parse(Buffer.from(header, "base64").toString("utf8")));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

const parseSubdomain = (host: string) => host.replace(/^\w+:\/\//, "").split(/[.:]/)[0] ?? "";

export const createContext = (headers: IncomingHttpHeaders): Context => ({
  subdomain: parseSubdomain(
    single(headers["nginx-hostname"]) ?? single(headers.hostname) ?? single(headers.host) ?? "",
  ),
  user: parseUser(single(headers.user)),
});
