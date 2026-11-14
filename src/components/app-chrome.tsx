"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Gamepad2, Home, Trophy, UserRound, Wallet } from "lucide-react";
export default function AppChrome(){ const path=usePathname(); if(["/","/lobby","/en","/fa","/games/backgammon"].includes(path)) return null; return <nav className="bottom-nav" aria-label="Main navigation"><div className="nav-inner">{[{href:"/",label:"Home",Icon:Home},{href:"/games",label:"Games",Icon:Gamepad2},{href:"/tournaments",label:"Tournaments",Icon:Trophy},{href:"/wallet",label:"Wallet",Icon:Wallet},{href:"/account",label:"Profile",Icon:UserRound}].map(({href,label,Icon})=><Link key={href} href={href} className={`nav-item${path===href||href!=="/"&&path.startsWith(href+"/")?" active":""}`} aria-current={path===href?"page":undefined}><Icon size={19}/>{label}</Link>)}</div></nav>; }
