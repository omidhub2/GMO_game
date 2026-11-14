import "server-only";

/** One USDT equals this many whole GMO tokens. Set only after approving the business rate. */
export function convertUsdtToGmoBaseUnits(usdtBaseUnits: bigint) {
  const rate = process.env.USDT_TO_GMO_RATE?.trim() ?? "";
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(rate) || Number(rate) <= 0) return null;
  const [whole, fraction = ""] = rate.split(".");
  const rateBaseUnits = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  return { gmoBaseUnits: usdtBaseUnits * rateBaseUnits / 1_000_000n };
}

export function convertGmoToUsdtBaseUnits(gmoBaseUnits: bigint) {
  const rate = convertUsdtToGmoBaseUnits(1_000_000n);
  if (!rate) return null;
  const amount = gmoBaseUnits * 1_000_000n / rate.gmoBaseUnits;
  return amount > 0n ? amount : null;
}
