import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";
import { verifyProcessRestart } from "../support/restart";

test("owner publishes a screenshot story and anonymous readers can browse it", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await mkdir("artifacts/visual", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByText("First transmission coming soon.")).toBeVisible();
  await page.screenshot({
    path: "artifacts/visual/home-empty-desktop.png",
    fullPage: true,
  });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Owner password").fill("incorrect-password");
  await page.getByRole("button", { name: "Enter the studio" }).click();
  await expect(page.locator(".form-error")).toContainText("Unable to sign in");
  await page.getByLabel("Owner password").fill("local-e2e-password-only");
  await page.getByRole("button", { name: "Enter the studio" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const session = (await page.context().cookies()).find(
    (c) => c.name === "gw_owner",
  );
  expect(session).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
  await page.getByRole("link", { name: "New update" }).click();
  await page.getByRole("button", { name: "Start writing" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  const editUrl = page.url();
  const postId = editUrl.split("/").at(-2)!;
  await page
    .getByLabel("Update title")
    .fill("Ammunition gets a physical identity");
  await page
    .getByLabel("What needed improvement?")
    .fill(
      "The ammunition market used text-only rows with fixed-width labels. Long names could clip, and it was hard to tell different ammunition types apart at a glance.",
    );
  await page
    .getByLabel("What changed?")
    .fill(
      "Each ammunition type now has its own miniature, with room for its name, details, and purchase controls. The layout adapts to the available width so pilots can compare their options more easily.",
    );
  await page.getByRole("button", { name: "Publish update" }).click();
  await expect(page.locator(".form-error")).toContainText("both screenshots");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Draft saved. Only you can see it."),
  ).toBeVisible();
  const generated = await sharp({
    create: { width: 1280, height: 720, channels: 3, background: "#243c2e" },
  })
    .png()
    .toBuffer();
  const before = process.env.E2E_BEFORE_IMAGE
    ? await readFile(process.env.E2E_BEFORE_IMAGE)
    : generated;
  const after = process.env.E2E_AFTER_IMAGE
    ? await readFile(process.env.E2E_AFTER_IMAGE)
    : generated;
  await page.locator("#beforeFile").setInputFiles({
    name: "before.png",
    mimeType: "image/png",
    buffer: before,
  });
  await expect(page.getByAltText("before upload preview")).toBeVisible();
  await page
    .locator("#afterFile")
    .setInputFiles({ name: "after.png", mimeType: "image/png", buffer: after });
  await expect(page.getByAltText("after upload preview")).toBeVisible();
  await page
    .locator("#beforeAlt")
    .fill(
      "Before: text-only ammunition rows with a clipped precision-charge label.",
    );
  await page
    .locator("#afterAlt")
    .fill(
      "After: ammunition miniatures and clearly separated purchase controls.",
    );
  await page
    .getByLabel("YouTube video link")
    .fill("https://youtu.be/dQw4w9WgXcQ");
  const imageUrl = await page
    .getByAltText("after upload preview")
    .getAttribute("src");
  await page.route("**/api/posts/*/images", (route) => route.abort());
  await page.locator("#afterFile").setInputFiles({
    name: "failed.png",
    mimeType: "image/png",
    buffer: after,
  });
  await expect(page.locator(".form-error")).toContainText("Upload interrupted");
  await expect(page.getByAltText("after upload preview")).toHaveAttribute(
    "src",
    imageUrl!,
  );
  await expect(page.getByLabel("Update title")).toHaveValue(
    "Ammunition gets a physical identity",
  );
  await page.unroute("**/api/posts/*/images");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Draft saved. Only you can see it."),
  ).toBeVisible();
  const anonymous = await browser.newContext({
    baseURL: "http://localhost:3018",
  });
  expect((await anonymous.request.get(imageUrl!)).status()).toBe(404);
  expect(
    (
      await anonymous.request.post(`/api/posts/${postId}/images`, {
        headers: { Origin: "http://localhost:3018" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.post(`/api/posts/${postId}/images`, {
        headers: { Origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(400);
  await page.getByRole("button", { name: "Preview update" }).click();
  await expect(page.locator(".preview-surface h1")).toHaveText(
    "Ammunition gets a physical identity",
  );
  await expect(page.locator(".preview-surface .post-copy p")).toHaveCount(2);
  await page.getByRole("button", { name: "Back to editor" }).click();
  await page.screenshot({
    path: "artifacts/visual/editor-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Publish update" }).click();
  await expect(
    page.getByText("Published and saved. Your update is live."),
  ).toBeVisible();
  const publicUrl = await page
    .getByRole("link", { name: "View public page" })
    .getAttribute("href");
  await verifyProcessRestart(publicUrl!, imageUrl!);
  const reader = await anonymous.newPage();
  await reader.setViewportSize({ width: 1440, height: 1000 });
  await reader.goto(publicUrl!);
  await expect(reader.locator(".post-copy p")).toHaveCount(2);
  await expect(reader.locator(".comparison img")).toHaveCount(2);
  await expect(
    reader.getByRole("link", { name: "See it in motion" }),
  ).toHaveAttribute("href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await expect
    .poll(() =>
      reader
        .locator(".comparison img")
        .evaluateAll((images) =>
          images.every((i) => (i as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await reader.screenshot({
    path: "artifacts/visual/post-desktop.png",
    fullPage: true,
  });
  await reader.goto("/");
  await expect(
    reader.getByRole("heading", {
      name: "Ammunition gets a physical identity",
    }),
  ).toBeVisible();
  await reader.screenshot({
    path: "artifacts/visual/home-desktop.png",
    fullPage: true,
  });
  await reader.setViewportSize({ width: 390, height: 844 });
  await reader.screenshot({
    path: "artifacts/visual/home-mobile.png",
    fullPage: true,
  });
  await reader.setViewportSize({ width: 320, height: 720 });
  expect(
    await reader
      .locator(".hero-copy h1")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  expect(
    await reader.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await reader.setViewportSize({ width: 390, height: 844 });
  await reader.goto(publicUrl!);
  await reader.screenshot({
    path: "artifacts/visual/post-mobile.png",
    fullPage: true,
  });
  expect(
    await reader.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/visual/editor-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Update title").fill("A clearer ammunition market");
  await page.getByLabel("YouTube video link").fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Published and saved. Your update is live."),
  ).toBeVisible();
  await reader.reload();
  await expect(
    reader.getByRole("heading", { name: "A clearer ammunition market" }),
  ).toBeVisible();
  await expect(reader.locator(".video-link")).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(
    page.getByText("Unpublished. Your post is now a private draft."),
  ).toBeVisible();
  expect((await anonymous.request.get(publicUrl!)).status()).toBe(404);
  expect((await anonymous.request.get(imageUrl!)).status()).toBe(404);
  await page.getByRole("link", { name: "Your updates" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto(editUrl);
  await expect(page).toHaveURL(/\/admin\/login/);
  expect(errors).toEqual([]);
  await anonymous.close();
});
