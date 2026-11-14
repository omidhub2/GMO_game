export default async function run(page) {
  const before = await page.evaluate(() => ({ button: document.querySelector(".wallet-connect-button")?.textContent, hasTronLink: Boolean(window.tronLink) }));
  await page.evaluate(() => document.querySelector(".wallet-connect-button")?.click());
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ status: document.querySelector("[role=status]")?.textContent, button: document.querySelector(".wallet-connect-button")?.textContent }));
  return { before, after };
}
