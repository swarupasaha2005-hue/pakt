import { describe, expect, it } from "vitest";
import { originAllowed } from "../src/index";

const list = "http://localhost:3000, https://*.vercel.app";
describe("originAllowed", () => {
  it("matches exact and one-label wildcard origins", () => {
    expect(originAllowed(list, "http://localhost:3000")).toBe(true);
    expect(originAllowed(list, "https://pakt-git-staging-p1-team.vercel.app")).toBe(true);
  });
  it("rejects lookalikes", () => {
    for (const o of ["http://localhost:3001", "https://vercel.app", "https://a.b.vercel.app", "https://evil.com/.vercel.app", "https://x.vercel.app.evil.com", "http://x.vercel.app"])
      expect(originAllowed(list, o), o).toBe(false);
  });
});
