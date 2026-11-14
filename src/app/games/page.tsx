import Link from "next/link";
import { listDemoGames } from "@/modules/games/domain/game";

export const metadata = { title: "Games | GMO ARENA" };

export default function GamesPage() {
  const games = listDemoGames();
  return <main className="main-content">
    <div className="eyebrow">DISCOVER YOUR NEXT GAME</div>
    <h1>Games</h1>
    <p className="subtle">Find your favorite games and follow their competitions.</p>
    <div className="games-grid">{games.map((game) => <article className="game-card" key={game.id}>
      <div className="game-art"><span className="game-art-mark">{game.name.slice(0, 2)}</span><span className="demo-label">DEMO</span></div>
      <div className="game-card-body"><div className="eyebrow">{game.category}</div><h2>{game.name}</h2><p className="subtle">{game.platforms.join(" · ")}</p><div className="game-card-footer"><span>{game.activeTournamentCount} active tournaments</span><span className="integration-label">Results: manual verification</span></div><Link className="button-primary game-detail-link" href={`/games/${game.slug}`}>Game details <span aria-hidden="true">←</span></Link></div>
    </article>)}</div>
    <p className="demo-note">این فهرست محتوای نمونه است؛ اتصال Games و API رسمی برای هیچ بازی فعال نشده است.</p>
  </main>;
}
