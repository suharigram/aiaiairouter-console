import { describe, expect, it } from "vitest";
import { brandedEmail } from "@/lib/email/templates";

describe("transactional email templates", () => {
  it("escapes user-controlled content and includes a plain-text alternative", () => {
    const email = brandedEmail({ title: "Account <created>", body: "Safe & secure", action: { label: "Verify", url: "https://example.com/?a=1&b=2" } });
    expect(email.html).toContain("Account &lt;created&gt;");
    expect(email.html).toContain("Safe &amp; secure");
    expect(email.text).toContain("Account <created>");
  });
});
