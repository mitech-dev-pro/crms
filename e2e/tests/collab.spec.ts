// Forgot password (through the emailed link), the discussion, and copying a change.
import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { backendDir } from "../test-env";
import { signIn, signOut } from "./helpers";

/** The newest email written to the test outbox (the API never really sends mail in tests). */
function latestEmail(subject: string) {
  const dir = path.join(backendDir, ".e2e-mail");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".eml"))
    .map((f) => path.join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const match = files.map((f) => readFileSync(f, "utf8")).find((t) => t.includes(subject));
  if (!match) throw new Error(`No email with subject "${subject}"`);
  return match.replace(/=\r?\n/g, "").replace(/=3D/g, "="); // undo quoted-printable line wrapping
}

test("forgot password: request a link, choose a new password, sign in with it", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page.getByLabel("Email").fill("kwabena.ofori@milifeghana.com");
  await page.getByRole("button", { name: "Email me a reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  let link = "";
  await expect.poll(() => {
    try {
      link = latestEmail("Reset your ChangeHub password").match(/http:\/\/localhost:\d+\/reset-password\?token=[\w-]+/)![0];
      return true;
    } catch {
      return false;
    }
  }).toBe(true);
  await page.goto(link.replace(/^http:\/\/localhost:\d+/, ""));
  await page.getByLabel("New password", { exact: true }).fill("Kwabena2026!");
  await page.getByLabel("Confirm new password").fill("Kwabena2026!");
  await expect(page.getByText("Both new passwords match (met)")).toBeAttached();
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("heading", { name: "Password changed" })).toBeVisible();

  await page.getByRole("link", { name: "Go to sign in" }).click();
  await page.getByLabel("Email").fill("kwabena.ofori@milifeghana.com");
  await page.getByLabel("Password", { exact: true }).fill("Kwabena2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // The link worked once only.
  await page.goto(link.replace(/^http:\/\/localhost:\d+/, ""));
  await page.getByLabel("New password", { exact: true }).fill("Another2026x");
  await page.getByLabel("Confirm new password").fill("Another2026x");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText(/expired or has already been used/)).toBeVisible();
});

test("discussion: a comment shows on the change for everyone involved", async ({ page }) => {
  await signIn(page, "kwame.boateng");
  await page.goto("/changes/CHG-2026-0144?tab=discussion");
  await expect(page.getByRole("tab", { name: /Discussion/ })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Add a comment").fill("Can this move to the weekend window?");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Comment posted" })).toBeVisible();
  await signOut(page);

  await signIn(page, "ama.mensah");
  await page.goto("/changes/CHG-2026-0144");
  await page.getByRole("tab", { name: /Discussion/ }).click();
  await expect(page.getByText("Can this move to the weekend window?")).toBeVisible();
});

test("copy a change into a new request", async ({ page }) => {
  await signIn(page, "ama.mensah");
  await page.goto("/changes/CHG-2026-0144");
  const title = await page.getByRole("heading", { level: 2 }).first().textContent();
  await page.getByRole("link", { name: "Copy as new request" }).click();
  await expect(page).toHaveURL(/\/changes\/new\?copy=CHG-2026-0144/);
  await expect(page.getByText(/Copied from CHG-2026-0144/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Title")).toHaveValue(`Copy of ${title}`);
});
