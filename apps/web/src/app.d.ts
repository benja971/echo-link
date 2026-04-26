import type { SessionPayload } from '$server/auth';

declare global {
  namespace App {
    interface Locals {
      session: SessionPayload | null;
    }
    interface PageData {
      session: { email: string; userId: string; accountId: string } | null;
    }
  }
}

export {};
