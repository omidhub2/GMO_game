import { notFound } from "next/navigation";
import { getDemoGame } from "@/modules/games/domain/game";
import BackgammonGame from "@/components/backgammon-game";

export default async function GameDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getDemoGame(slug);
  if (!game) notFound();
  if (slug === "backgammon") return <BackgammonGame />;
  return <main className="main-content">
    <div className="eyebrow">GAME PROFILE · DEMO CONTENT</div>
    <h1>{game.name}</h1>
    <p className="subtle">{game.category} · {game.platforms.join(" · ")}</p>
    <div className="panel game-detail-panel"><h2>رقابت در {game.name}</h2><p className="subtle">این بازی در کاتالوگ نمایشی GMO ARENA قرار دارد. اتصال خودکار، دریافت آمار و تأیید خودکار نتیجه برای آن پیاده‌سازی نشده است.</p><div className="game-detail-stats"><div><span>Tournaments فعال نمایشی</span><strong>{game.activeTournamentCount}</strong></div><div><span>Status یکپارچه‌سازی</span><strong>تأیید دستی</strong></div><div><span>پلتفرم‌ها</span><strong>{game.platforms.join("، ")}</strong></div></div></div>
  </main>;
}
