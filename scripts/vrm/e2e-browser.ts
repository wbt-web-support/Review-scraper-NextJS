/**
 * Drives a real browser through the actual login form -- the server action path
 * that a human exercises. scripts/e2e-auth.ts injects a session cookie directly,
 * so it can pass even if signIn() itself is broken. This closes that gap.
 *
 *   npm run dev
 *   npx tsx --env-file=.env.local scripts/e2e-browser.ts [baseUrl]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";

async function login(email: string, password: string, expectedPath: string) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  console.log(`\n${email}`);
  await page.goto(`${BASE}/video/login`, { waitUntil: "networkidle" });

  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');

  // Either we navigate, or an error message renders in the form.
  await page
    .waitForURL((u) => new URL(u).pathname === expectedPath, { timeout: 15000 })
    .catch(() => {});

  const path = new URL(page.url()).pathname;
  const alert = await page.locator('[role="alert"]').first().textContent().catch(() => null);

  if (path === expectedPath) {
    const heading = await page.locator("h1").first().textContent();
    console.log(`  PASS  landed on ${path}  (h1: "${heading?.trim()}")`);
  } else {
    console.log(`  FAIL  still on ${path}`);
    if (alert) console.log(`        form error: "${alert.trim()}"`);
    await page.screenshot({ path: `login-failure-${email.split("@")[0]}.png` });
    console.log(`        screenshot: login-failure-${email.split("@")[0]}.png`);
  }

  if (consoleErrors.length) {
    console.log(`        browser console errors:`);
    for (const e of consoleErrors.slice(0, 5)) console.log(`          ${e}`);
  }

  await browser.close();
  return path === expectedPath;
}

async function main() {
  console.log(`Driving the real login form at ${BASE}`);

  const a = await login(
    process.env.SEED_SUPER_ADMIN_EMAIL!,
    process.env.SEED_SUPER_ADMIN_PASSWORD!,
    "/video/admin",
  );
  const b = await login(
    process.env.SEED_TENANT_ADMIN_EMAIL!,
    process.env.SEED_TENANT_ADMIN_PASSWORD!,
    "/video/dashboard",
  );

  console.log(`\n${[a, b].filter(Boolean).length}/2 logins succeeded`);
  process.exit(a && b ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
