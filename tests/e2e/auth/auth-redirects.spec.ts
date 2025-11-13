import { expect, test } from "@playwright/test";

test.describe("auth + canonical redirects", () => {
  test("unauthenticated guest account routes redirect to /signin", async ({ page }) => {
    await page.goto("/my-bookings");
    await expect(page).toHaveURL(/\/signin\?redirectedFrom=%2Fmy-bookings/);
  });

  test("unauthenticated ops routes redirect to /ops/login", async ({ page }) => {
    await page.goto("/ops");
    await expect(page).toHaveURL(/\/ops\/login\?redirectedFrom=%2Fops/);
  });

  test("legal aliases redirect to canonical /terms", async ({ request }) => {
    const tos = await request.get("/tos", { maxRedirects: 0 });
    expect(tos.status()).toBe(308);
    expect(tos.headers()["location"]).toBe("/terms");

    const venue = await request.get("/terms/venue", { maxRedirects: 0 });
    expect(venue.status()).toBe(308);
    expect(venue.headers()["location"]).toBe("/terms");
  });
});
