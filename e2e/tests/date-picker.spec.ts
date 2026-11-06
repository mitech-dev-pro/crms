// The shared DatePicker, exercised on the wizard's Plan step.
import { expect, test } from "@playwright/test";
import { signIn, wizardToPlanStep } from "./helpers";

test.beforeEach(async ({ page }) => {
  await signIn(page, "ama.mensah");
  await wizardToPlanStep(page, "Date picker check");
});

test("typed dates are read day-first in several formats", async ({ page }) => {
  const field = page.getByLabel("Planned date");
  for (const [typed, shown] of [
    ["20/12/1998", "Sun, 20 Dec 1998"],
    ["20-12-98", "Sun, 20 Dec 1998"],
    ["3 March 2027", "Wed, 3 Mar 2027"],
    ["2027-01-15", "Fri, 15 Jan 2027"],
  ]) {
    await field.fill(typed);
    await field.press("Enter");
    await expect(field).toHaveValue(shown);
  }

  await field.fill("31/02/2027");
  await field.press("Tab");
  await expect(page.getByText("Enter a date like 20/12/1998")).toBeVisible();
  await expect(field).toHaveValue("31/02/2027"); // kept so it can be corrected
});

test("the calendar jumps by year and month", async ({ page }) => {
  await page.getByRole("button", { name: "Choose date from calendar" }).click();
  const picker = page.getByRole("dialog", { name: "Choose a date" });

  await picker.getByRole("button", { name: /^Choose year/ }).click();
  // Page back through the 12-year blocks until 1998 is shown, then pick it.
  while (!(await picker.getByRole("button", { name: "1998", exact: true }).isVisible())) {
    await picker.getByRole("button", { name: "Previous years" }).click();
  }
  await picker.getByRole("button", { name: "1998", exact: true }).click();
  await picker.getByRole("button", { name: "December 1998" }).click();
  await picker.getByRole("button", { name: /20 December 1998/ }).click();

  await expect(picker).toBeHidden();
  await expect(page.getByLabel("Planned date")).toHaveValue("Sun, 20 Dec 1998");
});
