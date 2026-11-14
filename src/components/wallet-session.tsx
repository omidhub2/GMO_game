"use client";

import { useEffect, useState } from "react";

export function useWalletSession() {
  const [session, setSession] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      try {
        const response = await fetch("/api/wallet", { cache: "no-store" });
        setSession(response.ok);
      } catch {
        setSession(false);
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("gmo:session-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("gmo:session-changed", refresh);
    };
  }, []);

  return session;
}
