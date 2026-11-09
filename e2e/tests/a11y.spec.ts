// Automatic accessibility checks (axe-core) on every main screen, in light and dark mode.
// Fails on any WCAG 2.1 A/AA problem axe can detect: missing labels, low contrast, bad ARIA…
// Automated checks find roughly a third of real issues, so they complement, not replace,
// trying the app with a keyboard and a screen reader.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

async function expectNoViolations(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[role="status"][aria-label="Loading"]')).toHaveCount(0); // skeletons gone
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal") // Next's dev/build overlay, not our UI
    .analyze();
  // A11Y_DEBUG=1 npm run test:e2e prints every failing element, handy when fixing a violation.
  if (process.env.A11Y_DEBUG) {
    for (const v of results.violations) for (const n of v.nodes.slice(0, 6)) console.log(`A11Y|${v.id}|${n.target.join(" ")}|${n.html.slice(0, 140).replace(/\s+/g, " ")}|${(n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 160)}`);
  }
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n    ")}`);
  expect.soft(summary, `Accessibility problems on ${label}`).toEqual([]); // soft: report every page, not just the first
}

// Animations off: axe would otherwise measure contrast mid-fade.
test.use({ reducedMotion: "reduce" });

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} mode`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    });

    test("signed-out screens", async ({ page }) => {
      for (const path of ["/login", "/forgot-password", "/reset-password?token=not-a-real-token-but-long-enough"]) {
        await page.goto(path);
        await expectNoViolations(page, `${path} (${theme})`);
      }
    });

    test("requester screens", async ({ page }) => {
      await signIn(page, "ama.mensah");
      for (const path of ["/dashboard", "/changes", "/changes/CHG-2026-0144", "/changes/new", "/calendar", "/flows"]) {
        await page.goto(path);
        await expectNoViolations(page, `${path} (${theme})`);
      }
    });

    test("approver and manager screens", async ({ page }) => {
      await signIn(page, "yaw.owusu");
      for (const path of ["/approvals", "/reports", "/audit"]) {
        await page.goto(path);
        await expectNoViolations(page, `${path} (${theme})`);
      }
    });

    test("administration", async ({ page }) => {
      await signIn(page, "selorm.dzidzienyo");
      await page.goto("/admin");
      for (const tab of ["Departments", "Change types", "Roles & permissions", "Approval workflows", "Users & access", "Stand-ins"]) {
        await page.getByRole("tab", { name: tab }).click();
        await expectNoViolations(page, `/admin › ${tab} (${theme})`);
      }
    });
  });
}
