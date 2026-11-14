import "server-only";

import { TronWeb } from "tronweb";
import { getDepositConfiguration } from "@/lib/deposit-proof";

type TronEvent = { event_name?: string; transaction_id?: string; block_number?: number; block_timestamp?: number; result?: Record<string, string>; contract_address?: string; topics?: string[]; data?: string };
type TronTransaction = {
  txID?: string;
  ret?: { contractRet?: string }[];
  raw_data?: { contract?: Array<{ type?: string; parameter?: { value?: Record<string, string> } }> };
};

function topicAddress(topic: string | undefined) {
  const clean = (topic ?? "").replace(/^0x/, "");
  if (!/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(clean)) return "";
  try { return TronWeb.address.fromHex(`41${clean.slice(-40)}`); } catch { return ""; }
}

export async function verifyTronUsdtDeposit(input: { txHash: string; expectedAmount: string; expectedSender?: string; destination?: string; minTimestamp?: number; maxTimestamp?: number }) {
  const config = getDepositConfiguration();
  if (!config.address || !config.tokenContract) throw new Error("آدرس دریافت یا قرارداد USDT در تنظیمات سرور تعیین نشده است.");
  if (!TronWeb.isAddress(config.address) || !TronWeb.isAddress(config.tokenContract)) throw new Error("تنظیمات آدرس TRON معتبر نیست.");

  const baseUrl = (process.env.TRONGRID_URL?.trim() || "https://api.trongrid.io").replace(/\/$/, "");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.TRONGRID_API_KEY) headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;

  const [transactionResponse, eventsResponse] = await Promise.all([
    fetch(`${baseUrl}/wallet/gettransactionbyid`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ value: input.txHash }), cache: "no-store", signal: AbortSignal.timeout(12000) }),
    fetch(`${baseUrl}/v1/transactions/${input.txHash}/events?only_confirmed=true`, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) }),
  ]);
  if (!transactionResponse.ok || !eventsResponse.ok) throw new Error("بررسی تراکنش در شبکهٔ ترون ممکن نشد؛ کمی بعد دوباره تلاش کن.");
  const transaction = await transactionResponse.json() as TronTransaction;
  const eventPayload = await eventsResponse.json() as { data?: TronEvent[] };
  if (transaction.txID?.toLowerCase() !== input.txHash.toLowerCase() || !transaction.ret?.length || transaction.ret.some((result) => result.contractRet !== "SUCCESS")) return { valid: false as const, reason: "تراکنش پیدا نشد یا در شبکه ناموفق است." };

  const expectedBaseUnits = (() => {
    const [whole, fraction = ""] = input.expectedAmount.split(".");
    return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  })();
  const normalizeAddress = (address: string) => TronWeb.address.fromHex(TronWeb.address.toHex(address));
  const destination = normalizeAddress(input.destination ?? config.address);
  const sender = input.expectedSender ? normalizeAddress(input.expectedSender) : null;
  const normalizedToken = normalizeAddress(config.tokenContract);
  const events = eventPayload.data ?? [];
  const matchingTransfer = events.find((event) => {
    if (event.event_name !== "Transfer") return false;
    if (!event.contract_address || !TronWeb.isAddress(event.contract_address) || normalizeAddress(event.contract_address) !== normalizedToken) return false;
    if (event.transaction_id?.toLowerCase() !== input.txHash.toLowerCase()) return false;
    if (input.minTimestamp !== undefined && (!event.block_timestamp || event.block_timestamp < input.minTimestamp)) return false;
    if (input.maxTimestamp !== undefined && (!event.block_timestamp || event.block_timestamp > input.maxTimestamp)) return false;
    const values = event.result ?? {};
    const from = values.from ? topicAddress(values.from) || (TronWeb.isAddress(values.from) ? normalizeAddress(values.from) : "") : topicAddress(event.topics?.[1]);
    const to = values.to ? topicAddress(values.to) || (TronWeb.isAddress(values.to) ? normalizeAddress(values.to) : "") : topicAddress(event.topics?.[2]);
    const rawValue = values.value ?? values["2"];
    let transferred = 0n;
    try { transferred = rawValue !== undefined ? BigInt(rawValue) : BigInt(`0x${event.data ?? "0"}`); } catch { return false; }
    return (!sender || from === sender) && to === destination && transferred === expectedBaseUnits;
  });

  if (!matchingTransfer) return { valid: false as const, reason: "در این تراکنش، واریز مبلغ اعلام‌شده به آدرس رسمی پیدا نشد." };
  return { valid: true as const, blockNumber: matchingTransfer.block_number ?? null };
}
