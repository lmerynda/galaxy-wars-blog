import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";
import { verifyProcessRestart } from "../support/restart";
async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Owner password").fill("local-e2e-password-only");
  await page.getByRole("button", { name: "Enter the studio" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
async function fillEntry(page: Page, title: string) {
  await page.getByLabel("Update title").fill(title);
  await page
    .getByLabel("What needed improvement?")
    .fill("The original design was difficult to read.");
  await page
    .getByLabel("What changed?")
    .fill("The updated design makes the choices easier to follow.");
}
test("save creates a public entry directly and live edits preserve images and dates", async ({
  page,
  browser,
}) => {
  await mkdir("artifacts/visual", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin");
  await expect(page).toHaveURL(/login/);
  await login(page);
  await page.goto("/admin/new");
  await expect(
    page.getByRole("button", {
      name: /Publish|Unpublish|Save draft|Preview update/,
    }),
  ).toHaveCount(0);
  const guest = await browser.newContext({ baseURL: "http://localhost:3018" });
  expect(
    (
      await guest.request.post("/api/images", {
        headers: { origin: "http://localhost:3018" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await page.request.post("/api/images", {
        headers: { origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(400);
  const reader = await guest.newPage();
  await reader.goto("/");
  await expect(reader.locator(".post-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.locator(".form-error")).not.toBeEmpty();
  await reader.reload();
  await expect(reader.locator(".post-card")).toHaveCount(0);
  await fillEntry(page, "Ammunition gets a physical identity");
  await page.getByLabel("Entry date", { exact: true }).fill("2024-02-29");
  const png = await sharp({
    create: { width: 1280, height: 720, channels: 3, background: "#324f3f" },
  })
    .png()
    .toBuffer();
  await page
    .locator("#galleryFiles")
    .setInputFiles({ name: "before.png", mimeType: "image/png", buffer: png });
  await expect(page.locator(".upload-preview img")).toHaveCount(1);
  const imageUrl = (await page
    .locator(".upload-preview img")
    .getAttribute("src"))!;
  expect((await guest.request.get(imageUrl)).status()).toBe(404);
  await page
    .getByLabel("Image 1 description", { exact: true })
    .fill("Clearer ammunition choices");
  await page
    .getByLabel("YouTube video link", { exact: true })
    .fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Add video", exact: true }).click();
  await page
    .getByLabel("YouTube video link 2", { exact: true })
    .fill("https://youtu.be/abcdefghijk");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("Saved. Your update is live.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/posts\/[^/]+\/edit$/);
  const publicUrl = (await page
    .getByRole("link", { name: "View public page" })
    .getAttribute("href"))!;
  expect(publicUrl).toContain("2024-02-29");
  await reader.goto(publicUrl);
  await expect(reader.locator(".day-entry h2")).toHaveText([
    "Ammunition gets a physical identity",
  ]);
  await expect(reader.locator(".embedded-video iframe")).toHaveCount(2);
  expect((await guest.request.get(imageUrl)).status()).toBe(200);
  await verifyProcessRestart(publicUrl, imageUrl);
  await page.reload();
  await expect(page.getByLabel("Entry date", { exact: true })).toHaveValue(
    "2024-02-29",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "artifacts/visual/save-entry-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/visual/save-entry-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Entry date", { exact: true }).fill("2023-12-31");
  await page.getByLabel("Update title").fill("Corrected ammunition entry");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved. Your update is live.")).toBeVisible();
  await reader.goto("/days/2023-12-31");
  await expect(reader.locator(".day-entry h2")).toHaveText([
    "Corrected ammunition entry",
  ]);
  expect((await guest.request.get("/days/2024-02-29")).status()).toBe(404);
  expect(errors).toEqual([]);
  await guest.close();
});
test("new entry visits create no records and same-day entries stay newest first", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/admin");
  const count = await page.locator(".admin-row").count();
  await page.goto("/admin/new");
  await page.goto("/admin/new");
  await page.goto("/admin");
  await expect(page.locator(".admin-row")).toHaveCount(count);
  for (const title of ["Earlier update", "Latest update"]) {
    await page.goto("/admin/new");
    await fillEntry(page, title);
    await page.getByLabel("Entry date", { exact: true }).fill("2022-06-01");
    await page.getByRole("button", { name: "Save entry" }).click();
    await expect(page.getByText("Saved. Your update is live.")).toBeVisible();
  }
  const reader = await browser.newPage();
  await reader.goto("/days/2022-06-01");
  await expect(reader.locator(".day-entry h2")).toHaveText([
    "Latest update",
    "Earlier update",
  ]);
  await reader.close();
});
test("gallery, threaded comments and design votes work for guests and owners", async ({
  page,
  browser,
}) => {
  await page.goto("/admin/login");
  await page.getByLabel("Owner password").fill("local-e2e-password-only");
  await page.getByRole("button", { name: "Enter the studio" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/new");
  await page.getByLabel("Update title").fill("Choose the next interceptor");
  await page
    .getByLabel("What needed improvement?")
    .fill(
      "The interceptor needs a stronger silhouette. These proposals explore different wing shapes and engine arrangements.",
    );
  await page
    .getByLabel("What changed?")
    .fill(
      "Compare the three proposals below and tell us which direction you prefer. Your comments will guide the next iteration.",
    );
  const png = process.env.E2E_AFTER_IMAGE
    ? await readFile(process.env.E2E_AFTER_IMAGE)
    : await sharp({
        create: {
          width: 1280,
          height: 720,
          channels: 3,
          background: "#324f3f",
        },
      })
        .png()
        .toBuffer();
  await page.locator("#galleryFiles").setInputFiles(
    [1, 2, 3].map((i) => ({
      name: `proposal-${i}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  await expect(page.locator(".upload-preview img")).toHaveCount(3);
  for (let i = 1; i <= 3; i++)
    await page
      .getByLabel(`Image ${i} description`, { exact: true })
      .fill(`Proposal ${String.fromCharCode(64 + i)}`);
  await page
    .getByRole("button", { name: "Move up", exact: true })
    .nth(2)
    .click();
  await expect(
    page.getByLabel("Image 2 description", { exact: true }),
  ).toHaveValue("Proposal C");
  await page.getByRole("button", { name: "Save entry" }).click();
  await expect(page.getByText("Saved. Your update is live.")).toBeVisible();
  await page
    .getByLabel("Question", { exact: true })
    .fill("Which interceptor design should we develop?");
  await page
    .getByLabel("Choices, one per line")
    .fill("Proposal A\nProposal B\nProposal C");
  await page.getByRole("button", { name: "Create poll", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save poll", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved. Your update is live.")).toBeVisible();
  const link = await page
    .getByRole("link", { name: "View public page" })
    .getAttribute("href");
  const guest = await browser.newContext();
  const reader = await guest.newPage();
  await reader.goto(link!);
  const entry = reader.locator("article.day-entry").filter({
    has: reader.getByRole("heading", { name: "Choose the next interceptor" }),
  });
  await expect(entry.locator("figure")).toHaveCount(3);
  await entry.getByRole("button", { name: "Proposal A", exact: true }).click();
  await expect(
    entry.getByRole("button", { name: "Proposal A ✓", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await entry.getByRole("button", { name: "Proposal C", exact: true }).click();
  await expect(entry.getByText(/1 vote ·/)).toBeVisible();
  await entry.getByLabel("Your name").fill("Nova Pilot");
  await entry
    .getByLabel("Your comment")
    .fill("Proposal C has the clearest silhouette.");
  await entry
    .getByRole("button", { name: "Post comment", exact: true })
    .click();
  await expect(entry.locator(".comment")).toHaveCount(1);
  await entry.getByRole("button", { name: "Reply", exact: true }).click();
  await entry
    .getByLabel("Your reply")
    .fill("The wing shape reads well at a distance.");
  await entry.getByRole("button", { name: "Post reply", exact: true }).click();
  await expect(entry.locator(".comment")).toHaveCount(2);
  await expect(
    reader.getByRole("link", { name: "2 total comments", exact: true }),
  ).toBeVisible();
  await reader.reload();
  await expect(
    entry.getByRole("button", { name: "Proposal C ✓", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await reader.setViewportSize({ width: 1440, height: 1000 });
  await entry
    .getByRole("heading", { name: "Choose the next interceptor" })
    .click();
  await entry.screenshot({
    path: "artifacts/visual/gallery-discussion-desktop.png",
  });
  await reader.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      reader.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await entry.screenshot({
    path: "artifacts/visual/gallery-discussion-mobile.png",
  });
  await page.reload();
  await page.getByRole("button", { name: "Hide", exact: true }).first().click();
  await expect(
    page.getByText("Comment removed", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Voting closed").check();
  await page.getByRole("button", { name: "Save poll", exact: true }).click();
  await expect(page.getByText("Poll closed", { exact: true })).toBeVisible();
  await reader.reload();
  await expect(
    entry.getByText("Comment removed", { exact: true }),
  ).toBeVisible();
  await expect(
    entry.getByText("The wing shape reads well at a distance."),
  ).toBeVisible();
  await expect(
    entry.getByRole("button", { name: "Proposal A", exact: true }),
  ).toBeDisabled();
  await reader.goto("/");
  await expect(
    reader.getByRole("link", { name: "1 total comment", exact: true }),
  ).toBeVisible();
  await reader
    .getByRole("link", { name: "1 total comment", exact: true })
    .click();
  await expect(
    reader.getByRole("heading", { name: "Latest comments." }),
  ).toBeVisible();
  await expect(reader.locator(".recent-comment")).toHaveCount(1);
  await expect(reader.locator(".recent-comment")).toContainText(
    "The wing shape reads well at a distance.",
  );
  await expect(reader.locator(".recent-comment")).not.toContainText(
    "Proposal C has the clearest silhouette.",
  );
  await reader.setViewportSize({ width: 390, height: 844 });
  await reader.screenshot({
    path: "artifacts/visual/comments-mobile.png",
    fullPage: true,
  });
  expect(
    await reader.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await reader.setViewportSize({ width: 1440, height: 1000 });
  await reader.screenshot({
    path: "artifacts/visual/comments-desktop.png",
    fullPage: true,
  });
  await guest.close();
});
