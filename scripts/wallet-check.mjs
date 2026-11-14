import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { TronWeb } from "tronweb";

let failures = 0;
function check(name, ready) {
  console.log(`${ready ? "OK" : "MISSING"} ${name}`);
  if (!ready) failures++;
}
check("TELEGRAM_BOT_TOKEN", Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()));
check("TELEGRAM_BOT_USERNAME", Boolean(process.env.TELEGRAM_BOT_USERNAME?.trim()));
check("Public HTTPS APP_URL", /^https:\/\//.test(process.env.APP_URL || ""));
check("TRON_MASTER_ADDRESS", TronWeb.isAddress(process.env.TRON_MASTER_ADDRESS || ""));
check("TRON_USDT_CONTRACT", TronWeb.isAddress(process.env.TRON_USDT_CONTRACT || ""));
check("TRON_HOT_WALLET_ADDRESS for manual payouts", TronWeb.isAddress(process.env.TRON_HOT_WALLET_ADDRESS || ""));
check("USDT_TO_GMO_RATE", Number(process.env.USDT_TO_GMO_RATE) === 10000);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 }) });
try {
  await prisma.$queryRaw`SELECT 1`;
  check("PostgreSQL connection", true);
  const migrations = await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
  check("No failed migrations", migrations.length === 0);
  await prisma.depositIntent.count();
  check("Deposit request schema", true);
  const systemAccounts = await prisma.walletAccount.count({ where: { userId: null, accountType: "SYSTEM", currency: "GMO", isActive: true } });
  check(`Active GMO system ledger account (${systemAccounts})`, systemAccounts > 0);
  const unbalanced = await prisma.$queryRaw`SELECT t.id FROM ledger_transactions t JOIN ledger_entries e ON e.transaction_id = t.id WHERE t.status = 'COMPLETED' GROUP BY t.id HAVING SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE -e.amount END) <> 0`;
  check("Completed ledger transactions balance", unbalanced.length === 0);
  const negative = await prisma.$queryRaw`SELECT a.id FROM wallet_accounts a LEFT JOIN ledger_entries e ON e.account_id = a.id LEFT JOIN ledger_transactions t ON t.id = e.transaction_id WHERE a.user_id IS NOT NULL GROUP BY a.id HAVING SUM(CASE WHEN t.status = 'COMPLETED' THEN CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE -e.amount END ELSE 0 END) < 0`;
  check("User ledger balances are nonnegative", negative.length === 0);
} catch (error) {
  check(`Database readiness (${error.code || "connection or schema error"})`, false);
} finally { await prisma.$disconnect(); }
process.exitCode = failures ? 1 : 0;
