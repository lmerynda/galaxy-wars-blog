import { spawn } from "node:child_process";
import { once } from "node:events";
import { expect } from "@playwright/test";

export async function verifyProcessRestart(
  postPath: string,
  imagePath: string,
) {
  const source = new URL(process.env.DATABASE_URL!);
  if (
    !["localhost", "127.0.0.1"].includes(source.hostname) ||
    source.port !== "5548"
  )
    throw new Error("Restart smoke test requires local blog services.");
  source.pathname = "/galaxy_wars_blog_e2e";
  // Each iteration starts a fresh application process against the saved post.
  for (let iteration = 0; iteration < 2; iteration++) {
    const child = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--port",
        "3028",
        "--hostname",
        "127.0.0.1",
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: source.toString(),
          APP_URL: "http://localhost:3028",
        },
        stdio: "ignore",
      },
    );
    const exited = once(child, "exit");
    try {
      await expect
        .poll(
          async () => {
            try {
              return (await fetch("http://localhost:3028/api/health")).status;
            } catch {
              return 0;
            }
          },
          { timeout: 15000 },
        )
        .toBe(200);
      const post = await fetch(`http://localhost:3028${postPath}`);
      expect(post.status).toBe(200);
      expect(await post.text()).toContain(
        "Ammunition gets a physical identity",
      );
      const image = await fetch(`http://localhost:3028${imagePath}`);
      expect(image.status).toBe(200);
      expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(0);
    } finally {
      child.kill();
      await exited;
    }
  }
}
