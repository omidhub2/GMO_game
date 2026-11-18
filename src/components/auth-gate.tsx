"use client";

import { useCallback, useEffect, useState } from "react";

type GateState = "checking" | "authenticated" | "unauthenticated" | "unavailable";
const BOT_LOGIN_URL = "https://t.me/gmo_arenobot?start=login";

export default function AuthGate() {
  const [state, setState] = useState<GateState>("checking");
  const [retrying, setRetrying] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        setState(response.status === 503 ? "unavailable" : "unauthenticated");
        return;
      }
      const result = await response.json() as { authenticated?: boolean };
      setState(result.authenticated ? "authenticated" : "unauthenticated");
    } catch {
      setState("unavailable");
    }
  }, []);

  useEffect(() => {
    void checkSession();
    const onSessionChanged = () => { void checkSession(); };
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkSession();
    };
    window.addEventListener("gmo:session-changed", onSessionChanged);
    window.addEventListener("pageshow", onSessionChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("gmo:session-changed", onSessionChanged);
      window.removeEventListener("pageshow", onSessionChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkSession]);

  async function retry() {
    setRetrying(true);
    await checkSession();
    setRetrying(false);
  }

  if (state === "authenticated") return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmo-auth-title"
      aria-describedby="gmo-auth-description"
      className="gmo-auth-gate"
      dir="rtl"
    >
      <style>{`
        .gmo-auth-gate{position:fixed;z-index:99999;inset:0;display:grid;place-items:center;overflow:auto;padding:24px 18px;padding-top:max(24px,env(safe-area-inset-top));padding-bottom:max(24px,env(safe-area-inset-bottom));background:radial-gradient(ellipse at 50% 35%,rgba(174,139,65,.18),transparent 48%),rgba(4,7,8,.96);backdrop-filter:blur(18px);color:#f5f1e7}
        .gmo-auth-card{width:min(100%,420px);padding:30px 24px;border:1px solid rgba(208,174,105,.38);border-radius:28px;background:linear-gradient(155deg,rgba(26,32,29,.98),rgba(10,14,14,.99));box-shadow:0 25px 90px #000b;text-align:center}
        .gmo-auth-emblem{position:relative;width:112px;height:112px;margin:0 auto 22px;display:grid;place-items:center}
        .gmo-auth-emblem:before,.gmo-auth-emblem:after{content:"";position:absolute;inset:0;border:1px solid rgba(196,241,92,.48);border-radius:50%;animation:gmo-auth-pulse 2.8s ease-out infinite}
        .gmo-auth-emblem:after{animation-delay:1.4s}
        .gmo-auth-emblem img{position:relative;z-index:1;width:76px;height:76px;filter:drop-shadow(0 0 22px rgba(203,170,94,.32))}
        .gmo-auth-orbit{position:absolute;inset:9px;border:1px dashed rgba(218,190,126,.55);border-radius:50%;animation:gmo-auth-spin 12s linear infinite}
        .gmo-auth-dot{position:absolute;top:7px;left:50%;width:7px;height:7px;border-radius:50%;background:#c4f15c;box-shadow:0 0 14px #c4f15c}
        .gmo-auth-kicker{color:#d6b978;font-size:10px;font-weight:900;letter-spacing:4px}
        .gmo-auth-title{margin:12px 0 8px;font-size:25px;font-weight:950}
        .gmo-auth-description{margin:0 auto;color:#aebbb3;font-size:13px;line-height:2}
        .gmo-auth-connection{display:flex;align-items:center;justify-content:center;gap:9px;margin:23px 0 18px;color:#c7d4c8;font-size:11px}
        .gmo-auth-pulse-dot{width:7px;height:7px;border-radius:50%;background:#c4f15c;box-shadow:0 0 0 0 rgba(196,241,92,.6);animation:gmo-auth-beat 1.6s infinite}
        .gmo-auth-primary{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:50px;border:0;border-radius:14px;background:linear-gradient(110deg,#b7e94c,#e1d08a);color:#18220c;font-size:14px;font-weight:950;text-decoration:none;box-shadow:0 9px 28px rgba(183,243,74,.16)}
        .gmo-auth-secondary{width:100%;min-height:44px;margin-top:10px;border:1px solid #46534a;border-radius:13px;background:#1b2420;color:#dce6dd;font-weight:750}
        .gmo-auth-foot{margin:16px 4px 0;color:#75837b;font-size:10px;line-height:1.9}
        @keyframes gmo-auth-spin{to{transform:rotate(360deg)}}
        @keyframes gmo-auth-pulse{0%{transform:scale(.82);opacity:.8}100%{transform:scale(1.45);opacity:0}}
        @keyframes gmo-auth-beat{0%,100%{box-shadow:0 0 0 0 rgba(196,241,92,.45)}50%{box-shadow:0 0 0 7px rgba(196,241,92,0)}}
        @media(prefers-reduced-motion:reduce){.gmo-auth-emblem:before,.gmo-auth-emblem:after,.gmo-auth-orbit,.gmo-auth-pulse-dot{animation:none}}
      `}</style>
      <section className="gmo-auth-card">
        <div className="gmo-auth-emblem" aria-hidden="true">
          <div className="gmo-auth-orbit"><span className="gmo-auth-dot" /></div>
          <img src="/icons/gmo-arena-192.svg" alt="" />
        </div>
        <div className="gmo-auth-kicker">GMO ARENA · PLAYER ACCESS</div>
        <h1 id="gmo-auth-title" className="gmo-auth-title">
          {state === "checking" ? "در حال بررسی حساب..." : state === "unavailable" ? "اتصال برقرار نشد" : "ورود به میدان"}
        </h1>
        <p id="gmo-auth-description" className="gmo-auth-description">
          {state === "checking"
            ? "در حال بررسی نشست امن شما هستیم. لحظه‌ای صبر کنید."
            : state === "unavailable"
              ? "ارتباط با سرویس ورود موقتاً در دسترس نیست. اتصال را بررسی و دوباره تلاش کنید."
              : "برای حفظ امنیت حساب، ورود از طریق ربات رسمی تلگرام انجام می‌شود. پس از تأیید، مستقیماً به همین اپلیکیشن برمی‌گردید."}
        </p>
        <div className="gmo-auth-connection">
          <span className="gmo-auth-pulse-dot" />
          {state === "checking" ? "در حال اتصال امن" : state === "unavailable" ? "منتظر برقراری اتصال" : "منتظر احراز هویت شما"}
        </div>
        {state !== "checking" && (
          <>
            <a className="gmo-auth-primary" href={BOT_LOGIN_URL}>
              <span aria-hidden="true">✦</span>
              ورود از طریق تلگرام
            </a>
            {state === "unavailable" && (
              <button className="gmo-auth-secondary" type="button" onClick={() => void retry()} disabled={retrying}>
                {retrying ? "در حال بررسی..." : "تلاش مجدد"}
              </button>
            )}
          </>
        )}
        <p className="gmo-auth-foot">این صفحه تا زمان تأیید نشست فعال باقی می‌ماند و امکان بستن یا ردکردن آن وجود ندارد.</p>
      </section>
    </div>
  );
}
