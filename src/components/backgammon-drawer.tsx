"use client";
import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import styles from "./backgammon/styles/drawer.module.css";

export default function BackgammonDrawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el=dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal(); close.current?.focus();
    return () => { el.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className={styles.drawer} aria-label="منوی بازی" onClick={event => { if (event.target === event.currentTarget) onClose(); }} onCancel={e => { e.preventDefault(); onClose(); }}>
    <header><span>منوی بازی <small dir="ltr">GMO / TABLE SERIES</small></span><button ref={close} onClick={onClose} aria-label="بستن منو"><X size={21}/></button></header>
    {children}
    <button className={styles.drawerResume} onClick={onClose}>برگشت به تخته</button>
  </dialog>;
}
