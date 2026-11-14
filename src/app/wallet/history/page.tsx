import WalletScreen from "@/components/wallet-screen";

export const metadata = { title: "Wallet history | GMO ARENA" };

export default function WalletHistoryRoute() {
  return <WalletScreen initialTab="history" />;
}
