export default async function run(page) {
  await page.locator(".wallet-action-card").nth(2).click();
  const historyHeading = page.getByRole("heading", { name: "تاریخچهٔ کامل تراکنش‌ها" });
  const visible = await historyHeading.isVisible();
  const filters = await page.locator(".wallet-filters select, .wallet-filters input[type=date]").count();
  const screenshot = await page.screenshot({ fullPage: true });
  return { historyOpened: visible, filterControls: filters, historyText: visible ? await page.locator(".wallet-history-panel").last().innerText() : "history heading not visible", screenshotBytes: screenshot.length };
}
