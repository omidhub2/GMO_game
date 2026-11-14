import { afterEach, describe, expect, it, vi } from "vitest";
import { TronWeb } from "tronweb";
import { verifyTronUsdtDeposit } from "./tron-payment-verifier";

const senderHex = `41${"1".repeat(40)}`;
const receiverHex = `41${"2".repeat(40)}`;
const tokenHex = `41${"3".repeat(40)}`;
const sender = TronWeb.address.fromHex(senderHex);
const receiver = TronWeb.address.fromHex(receiverHex);
const token = TronWeb.address.fromHex(tokenHex);
const txHash = "a".repeat(64);

function network(eventOverrides: Record<string, unknown> = {}) {
  vi.stubEnv("TRON_MASTER_ADDRESS", receiver);
  vi.stubEnv("TRON_USDT_CONTRACT", token);
  const event = { event_name: "Transfer", contract_address: token, transaction_id: txHash, block_number: 100, block_timestamp: 1000, result: { from: `0x${senderHex.slice(2)}`, to: `0x${receiverHex.slice(2)}`, value: "10000000" }, ...eventOverrides };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ txID: txHash, ret: [{ contractRet: "SUCCESS" }] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [event] }) }));
}

describe("TRON USDT deposit verification", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("accepts decimal event amounts and Ethereum-style event addresses without connecting a wallet", async () => {
    network();
    expect(await verifyTronUsdtDeposit({ txHash, expectedAmount: "10", minTimestamp: 900, maxTimestamp: 1100 })).toEqual({ valid: true, blockNumber: 100 });
  });
  it("rejects a mismatched exact amount", async () => {
    network();
    expect((await verifyTronUsdtDeposit({ txHash, expectedAmount: "10.000001" })).valid).toBe(false);
  });
  it("rejects another token contract or transaction ID", async () => {
    network({ contract_address: sender });
    expect((await verifyTronUsdtDeposit({ txHash, expectedAmount: "10" })).valid).toBe(false);
    network({ transaction_id: "b".repeat(64) });
    expect((await verifyTronUsdtDeposit({ txHash, expectedAmount: "10" })).valid).toBe(false);
  });
  it("rejects transfers outside the request payment window", async () => {
    network();
    expect((await verifyTronUsdtDeposit({ txHash, expectedAmount: "10", minTimestamp: 1001 })).valid).toBe(false);
    network();
    expect((await verifyTronUsdtDeposit({ txHash, expectedAmount: "10", maxTimestamp: 999 })).valid).toBe(false);
  });
  it("requires the configured treasury sender when confirming payouts", async () => {
    network();
    expect((await verifyTronUsdtDeposit({ txHash, expectedAmount: "10", expectedSender: receiver })).valid).toBe(false);
    network();
    expect((await verifyTronUsdtDeposit({ txHash, expectedAmount: "10", expectedSender: sender })).valid).toBe(true);
  });
});
