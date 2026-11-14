export const metadata = { title: "Tournaments | GMO ARENA" };

export default function TournamentsPage() {
  return <main className="main-content"><div className="eyebrow">COMPETE WITH THE ARENA</div><h1>Tournaments</h1><p className="subtle">Find your next competition. Demo tournaments do not accept real registrations.</p><section className="panel empty-state"><div className="empty-icon" aria-hidden="true">🏆</div><h2>No tournaments are open for registration</h2><p className="subtle">Tournaments نمونه فقط برای پیش‌نمایش رابط هستند. تا زمان اتصال زیرساخت ثبت‌نام و کیف پول، پرداخت و ثبت‌نام غیرفعال است.</p><span className="status-pill"><span className="status-dot" /> Preview mode</span></section></main>;
}
