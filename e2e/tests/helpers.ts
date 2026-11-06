// Shared steps for the browser tests.
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "demo-password"; // seeded demo accounts (test database only)

export async function signIn(page: Page, handle: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(`${handle}@milife.com.gh`);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** From a fresh wizard, fills the required fields and stops on the Plan step. */
export async function wizardToPlanStep(page: Page, title: string) {
  await page.goto("/changes/new");
  await expect(page.getByRole("heading", { name: "Classify the change" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Summary").fill("Add a mobile money payout option for approved claims.");
  await page.getByLabel("Business justification").fill("Faster settlement for claimants.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Plan the change" })).toBeVisible();
}
