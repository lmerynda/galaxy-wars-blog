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
  await expect(page.locator(".form-error").first()).toContainText(
    "Unable to sign in",
  );
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
  await page.locator("#galleryFiles").setInputFiles({
    name: "before.png",
    mimeType: "image/png",
    buffer: before,
  });
  await expect(page.locator(".upload-preview img").nth(0)).toBeVisible();
  await page
    .locator("#galleryFiles")
    .setInputFiles({ name: "after.png", mimeType: "image/png", buffer: after });
  await expect(page.locator(".upload-preview img").nth(1)).toBeVisible();
  await page
    .getByLabel("Image 1 description", { exact: true })
    .fill(
      "Before: text-only ammunition rows with a clipped precision-charge label.",
    );
  await page
    .getByLabel("Image 2 description", { exact: true })
    .fill(
      "After: ammunition miniatures and clearly separated purchase controls.",
    );
  await page
    .getByLabel("YouTube video link")
    .fill("https://youtu.be/dQw4w9WgXcQ");
  const imageUrl = await page
    .locator(".upload-preview img")
    .nth(1)
    .getAttribute("src");
  await page.route("**/api/posts/*/images", (route) => route.abort());
  await page.locator("#galleryFiles").setInputFiles({
    name: "failed.png",
    mimeType: "image/png",
    buffer: after,
  });
  await expect(page.locator(".form-error").first()).toContainText(
    "Upload interrupted",
  );
  await expect(page.locator(".upload-preview img").nth(1)).toHaveAttribute(
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
    reader
      .locator(".post-card")
      .getByText("Ammunition gets a physical identity", { exact: true }),
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

test("multiple published entries share a daily page and remain independently editable", async ({
  page,
  browser,
}) => {
  await page.goto("/admin/login");
  await page.getByLabel("Owner password").fill("local-e2e-password-only");
  await page.getByRole("button", { name: "Enter the studio" }).click();
  await expect(page).toHaveURL(/\/admin$/);
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
  async function publish(
    title: string,
    paragraphOne: string,
    paragraphTwo: string,
    video = false,
  ) {
    await page.goto("/admin/new");
    await page.getByRole("button", { name: "Start writing" }).click();
    await page.getByLabel("Update title").fill(title);
    await page.getByLabel("What needed improvement?").fill(paragraphOne);
    await page.getByLabel("What changed?").fill(paragraphTwo);
    await page.locator("#galleryFiles").setInputFiles({
      name: "before.png",
      mimeType: "image/png",
      buffer: before,
    });
    await expect(page.locator(".upload-preview img").nth(0)).toBeVisible();
    await page.locator("#galleryFiles").setInputFiles({
      name: "after.png",
      mimeType: "image/png",
      buffer: after,
    });
    await expect(page.locator(".upload-preview img").nth(1)).toBeVisible();
    await page
      .getByLabel("Image 1 description", { exact: true })
      .fill("Original ammunition market with text-only rows.");
    await page
      .getByLabel("Image 2 description", { exact: true })
      .fill("Updated market with miniatures and separated purchase controls.");
    if (video)
      await page
        .getByLabel("YouTube video link")
        .fill("https://youtu.be/dQw4w9WgXcQ");
    await page.getByRole("button", { name: "Publish update" }).click();
    await expect(
      page.getByText("Published and saved. Your update is live."),
    ).toBeVisible();
    return {
      editUrl: page.url(),
      publicUrl: (await page
        .getByRole("link", { name: "View public page" })
        .getAttribute("href"))!,
      imageUrl: (await page
        .locator(".upload-preview img")
        .nth(1)
        .getAttribute("src"))!,
    };
  }
  const first = await publish(
    "Ammunition miniatures",
    "Text-only listings made ammunition types difficult to distinguish at a glance.",
    "Physical miniatures give laser charges, precision charges, and rockets a recognizable identity.",
    true,
  );
  const second = await publish(
    "Room for purchase controls",
    "Fixed-width rows could clip long labels and crowd the controls on smaller screens.",
    "The market now adapts each row to the available width, keeping names, details, and purchase buttons separate.",
  );
  const dayPath = first.publicUrl.split("#")[0];
  expect(dayPath).toMatch(/^\/days\/\d{4}-\d{2}-\d{2}$/);
  expect(second.publicUrl.split("#")[0]).toBe(dayPath);
  expect(second.publicUrl).not.toBe(first.publicUrl);
  const anonymous = await browser.newContext({
    baseURL: "http://localhost:3018",
  });
  const reader = await anonymous.newPage();
  await reader.setViewportSize({ width: 1440, height: 1000 });
  await reader.goto("/");
  await expect(reader.locator(".post-card")).toHaveCount(1);
  await expect(reader.locator(".image-badge")).toHaveText("2 updates");
  await expect(reader.locator(".post-card")).toHaveAttribute("href", dayPath);
  await reader.screenshot({
    path: "artifacts/visual/daily-home-desktop.png",
    fullPage: true,
  });
  await reader.locator(".post-card").click();
  await expect(reader.locator("h1")).toHaveCount(1);
  await expect(reader.locator(".day-entry h2")).toHaveText([
    "Ammunition miniatures",
    "Room for purchase controls",
  ]);
  await expect(reader.locator(".post-copy p")).toHaveCount(4);
  await expect(reader.locator(".comparison img")).toHaveCount(4);
  await expect(reader.locator(".video-link")).toHaveCount(1);
  await expect(reader.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `http://localhost:3018${dayPath}`,
  );
  await expect
    .poll(() =>
      reader
        .locator(".comparison img")
        .evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await reader.screenshot({
    path: "artifacts/visual/day-desktop.png",
    fullPage: true,
  });
  await reader
    .getByRole("navigation", { name: "This day’s updates" })
    .getByRole("link", { name: /Room for purchase controls/ })
    .click();
  await expect(reader).toHaveURL(`http://localhost:3018${second.publicUrl}`);
  await reader.goto("/updates/ammunition-miniatures");
  await expect(reader).toHaveURL(`http://localhost:3018${first.publicUrl}`);
  await reader.goto(dayPath);
  await reader.setViewportSize({ width: 390, height: 844 });
  await reader.screenshot({
    path: "artifacts/visual/day-mobile.png",
    fullPage: true,
  });
  expect(
    await reader.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // A third private draft must not appear in the day's page or its count.
  await page.goto("/admin/new");
  await page.getByRole("button", { name: "Start writing" }).click();
  await page.getByLabel("Update title").fill("Private third entry");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Draft saved. Only you can see it."),
  ).toBeVisible();
  await reader.reload();
  await expect(reader.locator(".day-entry")).toHaveCount(2);
  await expect(reader.getByText("Private third entry")).toHaveCount(0);
  await page.goto(second.editUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(
    page.getByText("Unpublished. Your post is now a private draft."),
  ).toBeVisible();
  await reader.reload();
  await expect(reader.locator(".day-entry h2")).toHaveText([
    "Ammunition miniatures",
  ]);
  expect((await anonymous.request.get(second.imageUrl)).status()).toBe(404);
  await reader.goto("/");
  await expect(reader.locator(".image-badge")).toHaveText("1 update");
  await page.goto(first.editUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(
    page.getByText("Unpublished. Your post is now a private draft."),
  ).toBeVisible();
  expect((await anonymous.request.get(dayPath)).status()).toBe(404);
  expect(
    (await anonymous.request.get("/updates/ammunition-miniatures")).status(),
  ).toBe(404);
  await reader.reload();
  await expect(reader.locator(".post-card")).toHaveCount(0);
  await anonymous.close();
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
  await page.getByRole("button", { name: "Start writing" }).click();
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
  await page.getByRole("button", { name: "Publish update" }).click();
  await expect(
    page.getByText("Published and saved. Your update is live."),
  ).toBeVisible();
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
  await guest.close();
});
