"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { CalendarDays, Check, ChevronRight, Crown, Gamepad2, LogOut, Pencil, Save, Send, ShieldCheck, Target, Trophy, X } from "lucide-react";
import styles from "./account-profile.module.css";

type PlayerProfile = {
  username: string;
  avatarUrl: string | null;
  avatarChoice: "avatar-1" | "avatar-2" | "avatar-3" | "profile-photo";
  displayName: string;
  bio: string;
  level: number;
  experience: number;
  language: string;
  createdAt: string;
  telegram: { username: string; connectedAt: string } | null;
  stats: { tournaments: number; wins: number; referrals: number };
};

export default function AccountProfile() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [form, setForm] = useState({ username: "", displayName: "", bio: "" });
  const [avatarChoice, setAvatarChoice] = useState<PlayerProfile["avatarChoice"]>("avatar-3");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [needsTelegramLogin, setNeedsTelegramLogin] = useState(false);

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const result = await response.json();
      if (response.status === 401) {
        setProfile(null);
        setNeedsTelegramLogin(true);
        setError("");
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "Profile could not be loaded.");
      const player = result.data as PlayerProfile;
      setNeedsTelegramLogin(false);
      setProfile(player);
      setAvatarChoice(player.avatarChoice || (player.avatarUrl ? "profile-photo" : "avatar-3"));
      setForm({ username: player.username, displayName: player.displayName, bio: player.bio });
    } catch (cause) { setNeedsTelegramLogin(false); setError(cause instanceof Error ? cause.message : "Profile could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void loadProfile();
    window.addEventListener("gmo:session-changed", loadProfile);
    return () => window.removeEventListener("gmo:session-changed", loadProfile);
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, avatarChoice }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Profile could not be saved.");
      await loadProfile();
      setEditing(false);
      setMessage("Profile saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Profile could not be saved."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      window.dispatchEvent(new Event("gmo:session-changed"));
      window.location.assign("/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign out."); setBusy(false); }
  }

  if (loading && !profile) return <main className={styles.page}><div className={styles.loading}><span className={styles.spinner} />Loading player profile…</div></main>;
  if (!profile) return <main className={styles.page}>
    <header className={styles.pageHeading}><span>PLAYER PROFILE <i /> OPERATOR ACCESS</span><div className={styles.headingRow}><div><h1>Your account</h1><p>Your player identity, record, and settings live here.</p></div></div></header>
    <section className={styles.emptyCard}>
      <div className={styles.emptyArtwork}><div className={styles.emptyHalo} /><div className={styles.emptyIcon}><ShieldCheck size={27} /></div><span>GMO / OPERATOR FILE</span></div>
      <div className={styles.emptyCopy}><span className={styles.emptyEyebrow}>TELEGRAM SIGN-IN REQUIRED</span><h2>{needsTelegramLogin ? "Your profile is waiting" : "Profile unavailable"}</h2><p>{needsTelegramLogin ? "Open GMO Arena inside Telegram to securely load your player profile, tournament record, and wallet-linked account." : error || "We couldn’t load your player profile right now."}</p>
        {needsTelegramLogin ? <a className={styles.primaryLink} href="https://t.me/gmo_arenobot?startapp=profile" target="_blank" rel="noreferrer"><Send size={15} />Open GMO Arena in Telegram<ChevronRight size={16} /></a> : <button className={styles.primaryLink} type="button" onClick={() => void loadProfile()}><ShieldCheck size={15} />Try again<ChevronRight size={16} /></button>}
        <span className={styles.emptyNote}><span />Your profile data is private and only loads after Telegram verifies your account.</span>
      </div>
    </section>
  </main>;

  const playerName = profile.displayName.trim() || profile.username;
  const initial = [...playerName][0]?.toUpperCase() ?? "G";

  return <main className={styles.page}>
    <header className={styles.pageHeading}><span>PLAYER PROFILE <i /> PERSONNEL FILE</span><div className={styles.headingRow}><div><h1>Your operator</h1><p>Manage your Arena identity and track your competitive record.</p></div><button type="button" className={styles.iconButton} onClick={() => { setEditing(!editing); setError(""); setMessage(""); if (editing) setForm({ username: profile.username, displayName: profile.displayName, bio: profile.bio }); }} aria-label={editing ? "Cancel editing" : "Edit profile"}>{editing ? <X size={18} /> : <Pencil size={17} />}</button></div></header>

    <section className={styles.hero}>
      <div className={styles.coverLines} aria-hidden="true" />
      <div className={styles.playerAvatar}>{profile.avatarChoice === "profile-photo" && profile.avatarUrl ? <Image src={profile.avatarUrl} alt="" width={92} height={92} unoptimized /> : <Image src={`/avatars/gmo-${profile.avatarChoice && profile.avatarChoice !== "profile-photo" ? profile.avatarChoice : "avatar-3"}.webp`} alt="" width={92} height={92} unoptimized />}<span><ShieldCheck size={14} /></span></div>
      <div className={styles.identity}><span className={styles.levelTag}><Crown size={13} /> OPERATOR · LEVEL {profile.level}</span><h2>{playerName}</h2><span className={styles.gamerTag}>@{profile.username}</span>{profile.bio && <p>{profile.bio}</p>}</div>
      <div className={styles.memberDate}><CalendarDays size={14} /><span>IN THE ARENA SINCE</span><strong>{new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</strong></div>
    </section>

    <section className={styles.stats} aria-label="Player statistics">
      {[
        { label: "TOURNAMENTS", value: profile.stats.tournaments, Icon: Trophy },
        { label: "VICTORIES", value: profile.stats.wins, Icon: Crown },
        { label: "REFERRALS", value: profile.stats.referrals, Icon: Target },
        { label: "EXPERIENCE", value: profile.experience.toLocaleString("en-US"), Icon: Gamepad2 },
      ].map(({ label, value, Icon }) => <article className={styles.statCard} key={label}><span className={styles.statIcon}><Icon size={18} /></span><span className={styles.statLabel}>{label}</span><strong>{value}</strong></article>)}
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><span>PLAYER SETTINGS</span><h2>Account details</h2></div>{!editing && <button type="button" className={styles.editLink} onClick={() => { setEditing(true); setMessage(""); }}>Edit profile <Pencil size={14} /></button>}</div>
      {editing ? <form className={styles.form} onSubmit={saveProfile}>
        <fieldset className={styles.avatarPicker}>
          <legend>Choose your Arena avatar</legend>
          <div className={styles.avatarChoices}>
            {profile.avatarUrl && <label className={avatarChoice === "profile-photo" ? styles.avatarChoiceSelected : ""}><input type="radio" name="avatarChoice" value="profile-photo" checked={avatarChoice === "profile-photo"} onChange={() => setAvatarChoice("profile-photo")} /><Image src={profile.avatarUrl} alt="Your profile photo" width={68} height={68} unoptimized /><span>My photo</span></label>}
            {(["avatar-1", "avatar-2", "avatar-3"] as const).map((choice, index) => <label key={choice} className={avatarChoice === choice ? styles.avatarChoiceSelected : ""}>
              <input type="radio" name="avatarChoice" value={choice} checked={avatarChoice === choice} onChange={() => setAvatarChoice(choice)} />
              <Image src={`/avatars/gmo-${choice}.webp`} alt={[`Avatar 1`, `Avatar 2`, `Avatar 3`][index]} width={68} height={68} unoptimized />
              <span>{index === 2 ? "Default" : `Avatar ${index + 1}`}</span>
            </label>)}
          </div>
          {profile.avatarUrl && <small>Choose “My photo” to use your uploaded profile picture, or select an arena avatar.</small>}
        </fieldset>
        <label>Player tag<input autoComplete="username" minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]+" required value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /><small>3–32 letters, numbers, or underscores</small></label>
        <label>Display name<input maxLength={64} placeholder="How players see you" value={form.displayName} onChange={event => setForm({ ...form, displayName: event.target.value })} /></label>
        <label>Player bio<textarea maxLength={500} rows={3} placeholder="Add a short introduction" value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value })} /></label>
        <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => { setEditing(false); setError(""); setForm({ username: profile.username, displayName: profile.displayName, bio: profile.bio }); setAvatarChoice(profile.avatarChoice || "avatar-3"); }}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={busy}>{busy ? "Saving…" : <><Save size={16} />Save profile</>}</button></div>
      </form> : <div className={styles.detailList}><div><span>PLAYER TAG</span><strong>@{profile.username}</strong></div><div><span>DISPLAY NAME</span><strong>{profile.displayName || "Add a display name"}</strong></div><div><span>LANGUAGE</span><strong>English</strong></div></div>}
    </section>

    <section className={styles.telegramCard}><span className={styles.telegramIcon}>✦</span><div><strong>Telegram account</strong><span>{profile.telegram?.username ? `@${profile.telegram.username}` : "Linked and verified"}</span></div><span className={styles.connected}><Check size={13} /> CONNECTED</span></section>

    {(message || error) && <p role={error ? "alert" : "status"} className={error ? styles.error : styles.success}>{error || message}</p>}
    <button type="button" className={styles.signOut} onClick={signOut} disabled={busy}><LogOut size={16} />Sign out of GMO Arena</button>
  </main>;
}
