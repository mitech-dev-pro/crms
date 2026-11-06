// Sign-in and access control as seen in the browser.
import { expect, test } from "@playwright/test";

test("signed-out visitors are sent to the login page, then back", async ({ page }) => {
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/login\?next=%2Freports/);
  await page.getByLabel("Email").fill("yaw.owusu@milife.com.gh");
  await page.getByLabel("Password").fill("demo-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByText("Change requests raised")).toBeVisible();
});

test("a wrong password gets one generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("yaw.owusu@milife.com.gh");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Scope to the form: Next also renders an (empty) route-announcer alert for screen readers.
  await expect(page.locator("form").getByRole("alert")).toHaveText("Email or password is incorrect");
});

test("roles only see their screens, and get a 403 page elsewhere", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ama.mensah@milife.com.gh");
  await page.getByLabel("Password").fill("demo-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Change requests" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Administration" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Audit trail" })).toHaveCount(0);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
});
