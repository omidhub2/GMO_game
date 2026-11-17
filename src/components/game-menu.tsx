"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, ChevronRight, Crosshair, Gamepad2, Trophy, UserRound, UsersRound, Wallet, X, Volume2, VolumeX } from "lucide-react";
import LobbyWalletPanel, { type LobbyWalletData } from "./lobby-wallet-panel";
import styles from "./game-menu.module.css";

const modes = [
  { id: "games", label: "PLAY", eyebrow: "YOUR NEXT CHALLENGE", title: "ENTER THE\nARENA.", copy: "Pick your game. Find your edge. Make every match count.", action: "CHOOSE A GAME", href: "/games", Icon: Gamepad2, detail: "Browse the game collection" },
  { id: "tournaments", label: "COMPETE", eyebrow: "MAKE YOUR MARK", title: "CHASE THE\nCROWN.", copy: "Find your competition and follow the road to the final.", action: "FIND A TOURNAMENT", href: "/tournaments", Icon: Trophy, detail: "Explore tournament formats" },
  { id: "predictions", label: "PREDICT", eyebrow: "READ THE GAME", title: "TRUST YOUR\nINSTINCT.", copy: "A new way to follow the action. Sports predictions are coming to the Arena.", action: "VIEW STATUS", href: null, Icon: Crosshair, detail: "Sports predictions · Coming soon" },
  { id: "wallet", label: "WALLET", eyebrow: "YOUR ARENA RESOURCES", title: "FUEL YOUR\nNEXT MOVE.", copy: "Your GMO balance, rewards, and transaction history. All within reach.", action: "OPEN WALLET", href: null, Icon: Wallet, detail: "Balance, rewards & transactions" },
];

type LobbyWallet = LobbyWalletData;
const demoWallet: LobbyWallet = { balances: { BALANCE: "0", REWARDS: "0", PRIZE: "0" }, availableBalance: "0", demo: true };
const gmo = (raw: string) => Number(raw) / 1_000_000;
const formatGmo = (amount: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
const formatUsd = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(amount / 10000);

export default function GameMenu() {
  const [selected, setSelected] = useState(0);
  const [dialog, setDialog] = useState<"invite" | "predictions" | "wallet" | null>(null);
  const [walletData, setWalletData] = useState<LobbyWallet>(demoWallet);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletNotice, setWalletNotice] = useState("");
  const [walletRefresh, setWalletRefresh] = useState(0);
  const [sound, setSound] = useState(false);
  const [playerAvatar, setPlayerAvatar] = useState<string | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [avatarChoice, setAvatarChoice] = useState<"avatar-1" | "avatar-2" | "avatar-3">("avatar-3");
  const [profileData, setProfileData] = useState<{ username: string; displayName: string; bio: string } | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState("");
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (dialog) dialogRef.current?.showModal(); }, [dialog]);
  useEffect(() => {
    const controller = new AbortController();
    async function loadPlayerAvatar() {
      try {
        const response = await fetch("/api/profile", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json();
        const data = result.data;
        if (data) {
          setProfilePhoto(data.avatarUrl || null);
          setPlayerAvatar(data.avatarUrl || `/avatars/gmo-${data.avatarChoice || "avatar-3"}.webp`);
          setAvatarChoice(data.avatarChoice || "avatar-3");
          setProfileData({ username: data.username, displayName: data.displayName || "", bio: data.bio || "" });
        }
      } catch { /* the profile link remains available if profile data cannot load */ }
    }
    void loadPlayerAvatar();
    window.addEventListener("gmo:session-changed", loadPlayerAvatar);
    return () => { controller.abort(); window.removeEventListener("gmo:session-changed", loadPlayerAvatar); };
  }, []);

  useEffect(() => {
    const refresh = () => setWalletRefresh(value => value + 1);
    window.addEventListener("gmo:session-changed", refresh);
    return () => window.removeEventListener("gmo:session-changed", refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setWalletLoading(true);
    async function load() {
      try {
        const response = await fetch("/api/wallet", { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          setWalletData(demoWallet);
          setWalletNotice(response.status === 401 ? "Open the app from Telegram to access your personal wallet." : "Wallet service is unavailable. Please try again.");
          return;
        }
        const result = await response.json() as LobbyWallet;
        if (!result.balances || typeof result.availableBalance !== "string") throw new Error("Invalid wallet response");
        setWalletData(result);
        setWalletNotice(result.demo ? "Demo wallet. These tokens are for preview only." : "");
      } catch {
        if (!controller.signal.aborted) {
          setWalletData(demoWallet);
          setWalletNotice("Wallet service is unavailable. Please try again.");
        }
      } finally { if (!controller.signal.aborted) setWalletLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [walletRefresh]);
  const totalBalance = Object.values(walletData.balances).reduce((sum, raw) => sum + gmo(raw), 0);
  const mode = modes[selected];
  function choose(index: number) {
    setSelected(index);
    if (sound) {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(420 + index * 110, ctx.currentTime);
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      oscillator.start(); oscillator.stop(ctx.currentTime + 0.1);
      oscillator.onended = () => { void ctx.close(); };
    }
  }
  async function share() {
    const url = process.env.NEXT_PUBLIC_TELEGRAM_APP_URL;
    if (!url) { setMessage("Invitations will be available when the Telegram app link is connected."); return; }
    try {
      if (navigator.share) await navigator.share({ title: "GMO Arena", text: "Join me in GMO Arena", url });
      else { await navigator.clipboard.writeText(url); setMessage("App link copied. Send it to your squad."); }
    } catch { setMessage("Sharing was closed. You can try again."); }
  }
  return <main className={styles.scene} data-mode={mode.id}>
    <div className={styles.world} aria-hidden="true" /><div className={styles.grid} aria-hidden="true" />
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="GMO Arena home"><span className={styles.brandMark}>G</span><span>GMO<small>ARENA</small></span></Link>
      <div className={styles.headerCenter}>PLAYER HUB <span>/</span> 01</div>
      <button onClick={() => setDialog("wallet")} className={styles.wallet} aria-label="Open wallet"><Wallet size={17} /><span>{formatGmo(totalBalance)} <b>GMO</b><small>≈ {formatUsd(totalBalance)}{walletData.demo ? " · Demo" : ""}</small></span><ChevronRight size={14} /></button>
      <button type="button" onClick={() => { setAvatarNotice(""); setDialog("avatar"); }} className={styles.profile} aria-label="Change avatar">{playerAvatar ? <Image src={playerAvatar} alt="" width={44} height={44} unoptimized /> : <UserRound size={20} />}</button>
    </header>
    <aside className={styles.side}><span>GMO / OPERATIONS</span><i /><span>PLAY. COMPETE. PREDICT.</span></aside>
    <div className={styles.stage}>
      <div className={styles.kicker}><i />{mode.eyebrow}</div>
      <h1 key={mode.id}>{mode.title.split("\n").map((line, i) => <span key={line} className={i === 1 ? styles.outline : ""}>{line}</span>)}</h1>
      <p className={styles.description}>{mode.copy}</p>
      <div className={styles.primaryRow}>{mode.href ? <Link className={styles.deploy} href={mode.href}><mode.Icon size={21} />{mode.action}<ChevronRight size={21} /></Link> : <button className={styles.deploy} onClick={() => setDialog(mode.id === "wallet" ? "wallet" : "predictions")}><mode.Icon size={21} />{mode.action}<ChevronRight size={21} /></button>}<span className={styles.modeNumber}>0{selected + 1}<small>/ 04</small></span></div>
    </div>
    <div className={styles.operatorLabel} aria-hidden="true"><span>GMO // VANGUARD</span><strong>READY FOR YOUR NEXT MOVE</strong><i /></div>
    <section className={styles.modePicker} aria-label="Choose your game mode"><div className={styles.sectionLabel}><span>SELECT YOUR EXPERIENCE</span><span>01 — 04</span></div><div className={styles.modes}>{modes.map((item, index) => <button key={item.id} aria-pressed={selected === index} onClick={() => choose(index)} className={`${styles.mode} ${selected === index ? styles.selected : ""}`}><span className={styles.modeIndex}>0{index + 1}</span><item.Icon className={styles.modeIcon} size={33} strokeWidth={1.3} /><div><strong>{item.label}</strong><small>{item.detail}</small></div><ArrowUpRight className={styles.modeArrow} size={20} /></button>)}</div></section>
    <footer className={styles.footer}><button onClick={() => { setMessage(""); setDialog("invite"); }}><UsersRound size={18} /><span>INVITE YOUR SQUAD</span><ArrowUpRight size={14} /></button><span className={styles.footerNote}>GMO ARENA <i /> GAME LOBBY</span><button onClick={() => setSound(!sound)} aria-pressed={sound} aria-label={sound ? "Mute menu sounds" : "Enable menu sounds"}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}<span>SOUND {sound ? "ON" : "OFF"}</span></button></footer>
    {dialog && <dialog ref={dialogRef} aria-labelledby="menu-dialog-title" className={styles.modal} onCancel={() => setDialog(null)}><button className={styles.close} onClick={() => setDialog(null)} aria-label="Close"><X size={22}/></button>{dialog === "avatar" ? <><h2 id="menu-dialog-title">YOUR ARENA AVATAR</h2><p>Choose an avatar for your player profile. Your uploaded profile photo will remain visible whenever one is set.</p><div className={styles.avatarPicker}>{(["avatar-1", "avatar-2", "avatar-3"] as const).map((choice, index) => <button type="button" key={choice} className={avatarChoice === choice ? styles.avatarChoiceSelected : ""} aria-pressed={avatarChoice === choice} disabled={avatarSaving} onClick={async () => {
 setAvatarChoice(choice); setAvatarNotice("");
 if (!profileData) { setAvatarNotice("Profile data is unavailable. Open your profile and try again."); return; }
 setAvatarSaving(true);
 try {
  const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...profileData, avatarChoice: choice }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Avatar could not be saved.");
  setPlayerAvatar(profilePhoto || "/avatars/gmo-" + choice + ".webp");
  setAvatarNotice("Avatar saved.");
  window.dispatchEvent(new Event("gmo:avatar-changed"));
 } catch (error) { setAvatarNotice(error instanceof Error ? error.message : "Avatar could not be saved."); }
 finally { setAvatarSaving(false); }
}}><Image src={"/avatars/gmo-" + choice + ".webp"} alt={"Avatar " + (index + 1)} width={72} height={72} unoptimized /><span>{index === 2 ? "DEFAULT" : "AVATAR 0" + (index + 1)}</span></button>)}</div><p role="status" aria-live="polite">{avatarSaving ? "Saving…" : avatarNotice}</p><Link href="/account" className={styles.avatarProfileLink}>PROFILE SETTINGS</Link></> : dialog === "wallet" ? <LobbyWalletPanel data={walletData} loading={walletLoading} notice={walletNotice} refresh={() => setWalletRefresh(value => value + 1)} /> : dialog === "invite" ? <><UsersRound size={32}/><h2 id="menu-dialog-title">BRING YOUR SQUAD.</h2><p>Share GMO Arena with your friends and find your next competition together.</p><button className={styles.deploy} onClick={share}>SHARE APP LINK <ArrowUpRight size={18}/></button><p role="status">{message}</p></> : <><Crosshair size={32}/><h2 id="menu-dialog-title">PREDICTIONS</h2><p>This mode is being prepared. There are no active prediction markets available here yet.</p><button className={styles.deploy} onClick={() => { choose(0); setDialog(null); }}>EXPLORE GAMES</button></>}</dialog>}
  </main>;
}
