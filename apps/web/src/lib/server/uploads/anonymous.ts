import { createHash } from "node:crypto";
import { env } from "../env";

export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${env().ANONYMOUS_IP_SALT}:${ip}`)
    .digest("base64url");
}
