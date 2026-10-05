import { describe, expect, test } from "bun:test";
import { renderMagicLinkEmail } from "../src/lib/server/integrations/email";

describe("sign-in email", () => {
  test("button and fallback preserve the same escaped sign-in URL", () => {
    const link =
      'https://echo-link.example/login/verify?token=abc&next="<app>"';
    const html = renderMagicLinkEmail(link, 30);
    const escaped =
      "https://echo-link.example/login/verify?token=abc&amp;next=&quot;&lt;app&gt;&quot;";

    expect(html.match(/href="[^"]+"/g)).toEqual([
      `href="${escaped}"`,
      `href="${escaped}"`,
    ]);
    expect(html).toContain(`>${escaped}</a>`);
    expect(html).toContain("<strong>30 minutes</strong>");
    expect(html).not.toContain(link);
  });
});
