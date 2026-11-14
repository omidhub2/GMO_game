import { WalletTransactionDetailPage } from "@/components/wallet-transaction-detail-page";

export const metadata = { title: "Transaction details | GMO ARENA" };

type RouteProps = { params: Promise<{ id: string }> };

export default async function WalletTransactionRoute({ params }: RouteProps) {
  const { id } = await params;
  return <WalletTransactionDetailPage id={id} />;
}
