"use client";

import { useEffect, useState } from "react";

export default function StartupSplash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let hideTimer: number | undefined;
    const finish = () => {
      setLeaving(true);
      hideTimer = window.setTimeout(() => setVisible(false), 360);
    };
    const ready = () => finish();
    window.addEventListener("gmo:startup-ready", ready);
    window.addEventListener("gmo:startup-error", ready);
    // Safety net: an unavailable optional service must never trap the user.
    const fallback = window.setTimeout(finish, 8000);
    return () => {
      window.removeEventListener("gmo:startup-ready", ready);
      window.removeEventListener("gmo:startup-error", ready);
      window.clearTimeout(fallback);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      className={`gmo-startup-splash${leaving ? " is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="در حال آماده‌سازی GMO Arena"
    >
      <div className="gmo-startup-brand">
        <img src="/icons/gmo-arena-512.svg" width="104" height="104" alt="GMO Arena" />
        <div className="gmo-startup-title">GMO ARENA</div>
        <div className="gmo-startup-tagline">PLAY · COMPETE · WIN</div>
        <div className="gmo-startup-progress"><span /></div>
        <div className="gmo-startup-caption">در حال آماده‌سازی میدان بازی...</div>
      </div>
    </div>
  );
}
