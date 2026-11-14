import "server-only";

export const TRON_DEPOSIT_PROVIDER = "TRON_USDT";

export function getDepositConfiguration() {
  return {
    address: process.env.TRON_MASTER_ADDRESS?.trim() ?? "",
    tokenContract: process.env.TRON_USDT_CONTRACT?.trim() ?? "",
    guideVideoUrl: process.env.NEXT_PUBLIC_DEPOSIT_GUIDE_VIDEO_URL?.trim() ?? "",
  };
}

export function isTronTransactionHash(value: string) {
  return /^[a-f\d]{64}$/i.test(value);
}
