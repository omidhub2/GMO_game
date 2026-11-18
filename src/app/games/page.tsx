import Link from "next/link";
import { listDemoGames } from "@/modules/games/domain/game";

export const metadata = { title: "Games | GMO ARENA" };

export default function GamesPage() {
  const games = listDemoGames();
  return <main className="main-content">
    <div className="eyebrow">DISCOVER YOUR NEXT GAME</div>
    <h1>Games</h1>
    <p className="subtle">Find your favorite games and follow their competitions.</p>
    <div className="games-grid">{games.map((game) => game.slug === "backgammon" ? (
      <article className="game-card backgammon-feature" key={game.id}>
        <Link href="/games/backgammon" className="backgammon-banner" aria-label="ورود به بازی تخته‌نرد">
          <span className="backgammon-banner-kicker">GMO ARENA / CLASSIC TABLE</span>
          <span className="backgammon-banner-board" aria-hidden="true"><i/><i/><i/><i/><b>G</b><i/><i/><i/><i/></span>
          <span className="backgammon-banner-title">تخته‌نرد</span>
          <span className="backgammon-banner-subtitle">BACKGAMMON · STRATEGY · SKILL</span>
          <span className="backgammon-banner-cta">ورود به بازی <span aria-hidden="true">←</span></span>
        </Link>
        <div className="game-card-body">
          <div className="eyebrow">بازی کلاسیک و رقابتی</div>
          <h2>تخته‌نرد؛ بازی با فکر و شانس</h2>
          <p className="subtle">با هوش مصنوعی تمرین کن، دونفره روی یک گوشی بازی کن یا وارد رقابت آنلاین با بازیکن دیگر شو.</p>
          <div className="backgammon-mode-list">
            <div><span className="backgammon-mode-dot offline"/><span><strong>آفلاین</strong><small>بدون اینترنت؛ تمام حرکت‌ها روی دستگاه انجام می‌شوند.</small></span></div>
            <div><span className="backgammon-mode-dot online"/><span><strong>آنلاین</strong><small>بازی با حریف روی دستگاه دیگر و همگام‌سازی با سرور.</small></span></div>
          </div>
          <Link className="button-primary game-detail-link" href="/games/backgammon">شروع بازی تخته‌نرد <span aria-hidden="true">←</span></Link>
        </div>
      </article>
    ) : <article className="game-card" key={game.id}>
      <div className="game-art"><span className="game-art-mark">{game.name.slice(0, 2)}</span><span className="demo-label">DEMO</span></div>
      <div className="game-card-body"><div className="eyebrow">{game.category}</div><h2>{game.name}</h2><p className="subtle">{game.platforms.join(" · ")}</p><div className="game-card-footer"><span>{game.activeTournamentCount} active tournaments</span><span className="integration-label">Results: manual verification</span></div><Link className="button-primary game-detail-link" href={`/games/${game.slug}`}>Game details <span aria-hidden="true">←</span></Link></div>
    </article>)}</div>
    <p className="demo-note">این فهرست محتوای نمونه است؛ اتصال Games و API رسمی برای هیچ بازی فعال نشده است.</p>
  </main>;
}
