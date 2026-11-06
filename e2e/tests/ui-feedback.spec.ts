// App-wide UI: quick jump (Ctrl+K), confirm dialogs, toasts and the unsaved-changes guard.
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("Ctrl+K jumps to a change by its number", async ({ page }) => {
  await signIn(page, "yaw.owusu");
  await page.keyboard.press("Control+K");
  const palette = page.getByRole("dialog", { name: "Quick jump" });
  await expect(palette).toBeVisible();
  await palette.getByRole("combobox").fill("144");
  await expect(palette.getByRole("option", { name: /CHG-2026-0144/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/changes\/CHG-2026-0144$/);
  await expect(page).toHaveTitle("CHG-2026-0144 · MiLife ChangeHub");
});

test("removing a freeze asks first, and both actions confirm with a toast", async ({ page }) => {
  const name = `E2E freeze ${Date.now()}`;
  await signIn(page, "yaw.owusu");
  await page.goto("/calendar");
  await expect(page).toHaveTitle("Change calendar · MiLife ChangeHub");
  await page.getByRole("button", { name: "Add freeze window" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("From", { exact: true }).fill("1/3/2031");
  await page.getByLabel("To", { exact: true }).fill("3/3/2031");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: `Freeze window "${name}" added` })).toBeVisible();

  // Cancel first: nothing happens.
  await page.getByRole("button", { name: `Remove ${name}` }).click();
  const dialog = page.getByRole("dialog", { name: `Remove the "${name}" freeze?` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: `Remove ${name}` })).toBeVisible(); // still listed

  await page.getByRole("button", { name: `Remove ${name}` }).click();
  await dialog.getByRole("button", { name: "Remove freeze" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Freeze window removed" })).toBeVisible();
  await expect(page.getByRole("button", { name: `Remove ${name}` })).toHaveCount(0);
});

test("leaving a half-filled request asks first", async ({ page }) => {
  await signIn(page, "ama.mensah");
  await page.goto("/changes/new");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Title").fill("Half-finished idea");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click();
  const dialog = page.getByRole("dialog", { name: "Leave without saving?" });
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(/\/changes\/new$/);
  await expect(page.getByLabel("Title")).toHaveValue("Half-finished idea");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Dashboard" }).click();
  await dialog.getByRole("button", { name: "Leave page" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
