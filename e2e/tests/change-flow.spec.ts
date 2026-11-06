// The core journey, clicked through like a person would: raise a change in the
// wizard, approve it as the next approver, and check the result.
import { expect, test } from "@playwright/test";
import { signIn, signOut } from "./helpers";

test("requester raises a change and the line manager approves it", async ({ page }) => {
  const title = `E2E payout change ${Date.now()}`;

  // 1. Ama (requester) fills in the wizard.
  await signIn(page, "ama.mensah");
  await page.getByRole("link", { name: "New request" }).first().click();
  await expect(page.getByRole("heading", { name: "Classify the change" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Validation: an empty Describe step can't be skipped.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Title is required")).toBeVisible();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Summary").fill("Add a mobile money payout option for approved claims.");
  await page.getByLabel("Business justification").fill("Faster settlement for claimants.");
  await page.getByRole("button", { name: "Continue" }).click();

  // Risk: default Moderate × Unlikely = Low (score 2), Claims' Low route = Line Manager only.
  await expect(page.getByText("Calculated risk: Low (score 2/9)")).toBeVisible();
  await expect(page.getByText(/Approval route: Low · 1 stages/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Typed day-first; on leaving the field it is shown in words. 8 Dec is outside every freeze window.
  await page.getByLabel("Planned date").fill("8/12/2026");
  await page.getByLabel("Planned date").press("Tab");
  await expect(page.getByLabel("Planned date")).toHaveValue("Tue, 8 Dec 2026");
  await page.getByLabel("Implementer").selectOption({ label: "Kojo Frimpong" });
  await page.getByLabel("Rollback plan").fill("Switch the feature flag off.");
  await page.getByRole("button", { name: "Continue" }).click();

  // Review: the declaration must be ticked.
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page.getByText("Please confirm the declaration")).toBeVisible();
  await page.getByLabel(/I confirm the information is accurate/).check();
  await page.getByRole("button", { name: "Submit for approval" }).click();

  // Lands on the new change, waiting for the Line Manager.
  await expect(page).toHaveURL(/\/changes\/CHG-\d{4}-\d{4}$/);
  const ref = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Pending approval").first()).toBeVisible();
  await expect(page.getByText(/waiting at the Line Manager stage/)).toBeVisible();
  await signOut(page);

  // 2. Kwame (line manager) sees it in his notifications and approves it.
  await signIn(page, "kwame.boateng");
  await page.getByRole("button", { name: /Notifications/ }).click();
  await page.getByRole("region", { name: "Needs your attention" }).getByRole("link", { name: new RegExp(title) }).click();
  await expect(page).toHaveURL(new RegExp(`/changes/${ref}$`));

  // Rejecting needs a comment.
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("A comment is required to reject.")).toBeVisible();

  await page.getByLabel("Decision comment").fill("Looks good. Go ahead.");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Scheduled").first()).toBeVisible(); // only stage approved + planned date → Scheduled

  await page.getByRole("tab", { name: "Approvals" }).click();
  await expect(page.getByText("“Looks good. Go ahead.”")).toBeVisible();
  await signOut(page);

  // 3. Ama sees the outcome.
  await signIn(page, "ama.mensah");
  await page.goto(`/changes/${ref}`);
  await expect(page.getByText("Scheduled").first()).toBeVisible();
});

test("segregation of duties: the requester can't approve their own change", async ({ page }) => {
  // CHG-2026-0144 was raised by Ama and waits at Line Manager; Kwame raised nothing here.
  await signIn(page, "kwame.boateng");
  await page.goto("/changes/CHG-2026-0144");
  await expect(page.getByText(/Your decision is required · Line Manager review/)).toBeVisible();
  await signOut(page);

  await signIn(page, "ama.mensah");
  await page.goto("/changes/CHG-2026-0144");
  await expect(page.getByText(/waiting at the Line Manager stage/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
});
