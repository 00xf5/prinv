import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, MapPin, MessageSquare, CreditCard, Shield, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auth, db } from "../lib/firebase";
import { doc, runTransaction, collection, getDoc, setDoc } from "firebase/firestore";
import { useExchangeRate } from "../lib/useExchangeRate";

interface Country {
  grizzlyId: string;
  name: string;
  iso: string;
}

interface Service {
  id: string;
  name: string;
  icon: string;
  grizzlyCost: number;
  count: number;
}

interface ServiceMeta {
  [code: string]: { name: string };
}

const serviceDomainMap: Record<string, string> = {
  wa: "whatsapp.com",
  tg: "telegram.org",
  vk: "vk.com",
  vi: "viber.com",
  ig: "instagram.com",
  fb: "facebook.com",
  tw: "twitter.com",
  go: "google.com",
  ya: "yandex.com",
  ok: "ok.ru",
  av: "avito.ru",
  nf: "netflix.com",
  tg_premium: "telegram.org",
  wb: "wildberries.ru",
  mm: "mail.ru",
  ub: "uber.com",
  qi: "qiwi.ru",
  we: "wechat.com",
  ms: "microsoft.com",
  am: "amazon.com",
  ds: "discord.com",
  op: "openai.com",
  sf: "salesforce.com",
  ab: "airbnb.com",
  pt: "pinterest.com",
  li: "linkedin.com",
  ap: "apple.com",
  yt: "youtube.com",
  sp: "spotify.com",
  tn: "tinder.com",
  sc: "snapchat.com",
  rd: "reddit.com",
  zo: "zoom.us",
  st: "steampowered.com",
  nf_premium: "netflix.com",
  bl: "beeline.ru",
  mt: "mts.ru",
  mg: "magnit.ru",
  zk: "zdravcity.ru",
  rt: "rt.ru",
  ts: "tesco.com",
  df: "draftkings.com",
  yl: "yolla.co",
  lh: "lufthansa.com",
  tt: "tiktok.com",
  sh: "shein.com",
  tm: "temu.com",
  dl: "deliveroo.co.uk",
  dz: "deezer.com",
  of: "onlyfans.com",
  ly: "lyft.com",
  dd: "doordash.com",
  ti: "tinder.com",
  bm: "bumble.com",
  hi: "hily.com",
  gr: "grindr.com",
  bd: "badoo.com",
  mz: "muzmatch.com",
  ch: "clubhouse.com",
  oc: "okcupid.com",
  pf: "payoneer.com",
  mc: "match.com",
  eh: "eharmony.com",
  bg: "bigo.tv",
  k: "kakao.com",
  cb: "coinbase.com",
  ba: "binance.com",
  ae: "aliexpress.com",
  nk: "nike.com",
  wc: "wechat.com",
  ro: "roblox.com",
  pr: "patreon.com",
  yh: "yahoo.com",
  eb: "ebay.com",
  rv: "revolut.com"
};

const getServiceLogoUrl = (code: string, name: string): string | null => {
  const normCode = code.toLowerCase().trim();
  const normName = name.toLowerCase().trim();

  const getProxyUrl = (domain: string) => `/api/logo/${domain}`;

  // 1. Direct domain mapping
  if (serviceDomainMap[normCode]) {
    return getProxyUrl(serviceDomainMap[normCode]);
  }

  // 2. Guess domain based on name regex/match with extremely rich coverage
  if (normName.includes("whatsapp")) return getProxyUrl("whatsapp.com");
  if (normName.includes("telegram")) return getProxyUrl("telegram.org");
  if (normName.includes("instagram")) return getProxyUrl("instagram.com");
  if (normName.includes("facebook")) return getProxyUrl("facebook.com");
  if (normName.includes("twitter") || normName.includes(" x ") || normName === "x") return getProxyUrl("twitter.com");
  if (normName.includes("google") || normName.includes("gmail") || normName.includes("youtube") || normName.includes("g-mail") || normName.includes("g mail")) return getProxyUrl("google.com");
  if (normName.includes("yandex")) return getProxyUrl("yandex.com");
  if (normName.includes("netflix")) return getProxyUrl("netflix.com");
  if (normName.includes("amazon") || normName.includes("prime")) return getProxyUrl("amazon.com");
  if (normName.includes("microsoft") || normName.includes("outlook") || normName.includes("hotmail")) return getProxyUrl("microsoft.com");
  if (normName.includes("discord")) return getProxyUrl("discord.com");
  if (normName.includes("openai") || normName.includes("chatgpt")) return getProxyUrl("openai.com");
  if (normName.includes("claude") || normName.includes("anthropic")) return getProxyUrl("anthropic.com");
  if (normName.includes("gemini") || normName.includes("bard")) return getProxyUrl("google.com");
  if (normName.includes("copilot")) return getProxyUrl("microsoft.com");
  if (normName.includes("uber")) return getProxyUrl("uber.com");
  if (normName.includes("glovo") || normName.includes("glove")) return getProxyUrl("glovoapp.com");
  if (normName.includes("imo")) return getProxyUrl("imo.im");
  if (normName.includes("bolt")) return getProxyUrl("bolt.eu");
  if (normName.includes("spotify")) return getProxyUrl("spotify.com");
  if (normName.includes("tind") || normName.includes("tinder")) return getProxyUrl("tinder.com");
  if (normName.includes("steam")) return getProxyUrl("steampowered.com");
  if (normName.includes("zoom")) return getProxyUrl("zoom.us");
  if (normName.includes("viber")) return getProxyUrl("viber.com");
  if (normName.includes("wechat")) return getProxyUrl("wechat.com");
  if (normName.includes("apple") || normName.includes("icloud") || normName.includes("itunes")) return getProxyUrl("apple.com");
  if (normName.includes("tiktok")) return getProxyUrl("tiktok.com");
  if (normName.includes("vkontakte") || normName.includes(" vk")) return getProxyUrl("vk.com");
  if (normName.includes("airbnb")) return getProxyUrl("airbnb.com");
  if (normName.includes("pinterest")) return getProxyUrl("pinterest.com");
  if (normName.includes("linkedin")) return getProxyUrl("linkedin.com");
  if (normName.includes("snapchat")) return getProxyUrl("snapchat.com");
  if (normName.includes("reddit")) return getProxyUrl("reddit.com");
  if (normName.includes("yahoo")) return getProxyUrl("yahoo.com");
  if (normName.includes("ebay")) return getProxyUrl("ebay.com");
  if (normName.includes("roblox")) return getProxyUrl("roblox.com");
  if (normName.includes("twitch")) return getProxyUrl("twitch.tv");
  if (normName.includes("patreon")) return getProxyUrl("patreon.com");
  if (normName.includes("paypal")) return getProxyUrl("paypal.com");
  if (normName.includes("stripe")) return getProxyUrl("stripe.com");
  if (normName.includes("revolut")) return getProxyUrl("revolut.com");
  if (normName.includes("binance")) return getProxyUrl("binance.com");
  if (normName.includes("coinbase")) return getProxyUrl("coinbase.com");
  if (normName.includes("bybit")) return getProxyUrl("bybit.com");
  if (normName.includes("okx")) return getProxyUrl("okx.com");
  if (normName.includes("kucoin")) return getProxyUrl("kucoin.com");
  if (normName.includes("alibaba") || normName.includes("aliexpress")) return getProxyUrl("alibaba.com");
  if (normName.includes("tencent") || normName.includes("qq")) return getProxyUrl("tencent.com");
  if (normName.includes("naver")) return getProxyUrl("naver.com");
  if (normName.includes("line")) return getProxyUrl("line.me");
  if (normName.includes("signal")) return getProxyUrl("signal.org");
  if (normName.includes("grab")) return getProxyUrl("grab.com");
  if (normName.includes("lazada")) return getProxyUrl("lazada.com");
  if (normName.includes("shopee")) return getProxyUrl("shopee.com");
  if (normName.includes("vimeo")) return getProxyUrl("vimeo.com");
  if (normName.includes("dailymotion")) return getProxyUrl("dailymotion.com");
  if (normName.includes("soundcloud")) return getProxyUrl("soundcloud.com");
  if (normName.includes("mixcloud")) return getProxyUrl("mixcloud.com");
  if (normName.includes("shein")) return getProxyUrl("shein.com");
  if (normName.includes("temu")) return getProxyUrl("temu.com");
  if (normName.includes("deliveroo")) return getProxyUrl("deliveroo.co.uk");
  if (normName.includes("deezer")) return getProxyUrl("deezer.com");
  if (normName.includes("onlyfans")) return getProxyUrl("onlyfans.com");
  if (normName.includes("lyft")) return getProxyUrl("lyft.com");
  if (normName.includes("doordash")) return getProxyUrl("doordash.com");
  if (normName.includes("grindr")) return getProxyUrl("grindr.com");
  if (normName.includes("monzo")) return getProxyUrl("monzo.com");
  if (normName.includes("clubhouse")) return getProxyUrl("clubhouse.com");
  if (normName.includes("bigo")) return getProxyUrl("bigo.tv");
  if (normName.includes("kakao")) return getProxyUrl("kakao.com");
  if (normName.includes("draftkings")) return getProxyUrl("draftkings.com");
  if (normName.includes("yolla")) return getProxyUrl("yolla.co");
  if (normName.includes("lufthansa")) return getProxyUrl("lufthansa.com");
  if (normName.includes("deepseek")) return getProxyUrl("deepseek.com");
  if (normName.includes("nike")) return getProxyUrl("nike.com");
  if (normName.includes("adidas")) return getProxyUrl("adidas.com");
  if (normName.includes("puma")) return getProxyUrl("puma.com");
  if (normName.includes("badoo")) return getProxyUrl("badoo.com");
  if (normName.includes("hily")) return getProxyUrl("hily.com");
  if (normName.includes("bumble")) return getProxyUrl("bumble.com");
  if (normName.includes("hinge")) return getProxyUrl("hinge.co");
  if (normName.includes("okcupid")) return getProxyUrl("okcupid.com");
  if (normName.includes("payoneer")) return getProxyUrl("payoneer.com");
  if (normName.includes("eharmony")) return getProxyUrl("eharmony.com");
  
  // Nigeria and popular localized payments & telecom guesser
  if (normName.includes("palmpay")) return getProxyUrl("palmpay.com");
  if (normName.includes("opay")) return getProxyUrl("opayweb.com");
  if (normName.includes("mtn")) return getProxyUrl("mtn.com");
  if (normName.includes("airtel")) return getProxyUrl("airtel.com");
  if (normName.includes("glo") || normName.includes("gloworld")) return getProxyUrl("gloworld.com");
  if (normName.includes("9mobile")) return getProxyUrl("9mobile.com.ng");
  if (normName.includes("skype")) return getProxyUrl("skype.com");
  if (normName.includes("chime")) return getProxyUrl("chime.com");
  if (normName.includes("cash app") || normName.includes("cashapp")) return getProxyUrl("cash.app");
  if (normName.includes("wise") || normName.includes("transferwise")) return getProxyUrl("wise.com");
  if (normName.includes("skrill")) return getProxyUrl("skrill.com");
  if (normName.includes("payeer")) return getProxyUrl("payeer.com");
  if (normName.includes("perfect money") || normName.includes("perfectmoney")) return getProxyUrl("perfectmoney.com");
  if (normName.includes("webmoney")) return getProxyUrl("webmoney.ru");
  if (normName.includes("crunchyroll")) return getProxyUrl("crunchyroll.com");
  if (normName.includes("duolingo")) return getProxyUrl("duolingo.com");
  if (normName.includes("coursera")) return getProxyUrl("coursera.org");
  if (normName.includes("udemy")) return getProxyUrl("udemy.com");
  if (normName.includes("medium")) return getProxyUrl("medium.com");
  if (normName.includes("quora")) return getProxyUrl("quora.com");
  if (normName.includes("canva")) return getProxyUrl("canva.com");
  if (normName.includes("figma")) return getProxyUrl("figma.com");
  if (normName.includes("notion")) return getProxyUrl("notion.so");
  if (normName.includes("slack")) return getProxyUrl("slack.com");
  if (normName.includes("trello")) return getProxyUrl("trello.com");
  if (normName.includes("asana")) return getProxyUrl("asana.com");
  if (normName.includes("monday")) return getProxyUrl("monday.com");
  if (normName.includes("adobe")) return getProxyUrl("adobe.com");
  if (normName.includes("proton")) return getProxyUrl("proton.me");
  if (normName.includes("mailru") || normName.includes("mail.ru")) return getProxyUrl("mail.ru");
  if (normName.includes("rambler")) return getProxyUrl("rambler.ru");
  if (normName.includes("fastmail")) return getProxyUrl("fastmail.com");
  if (normName.includes("zoho")) return getProxyUrl("zoho.com");
  if (normName.includes("gmx")) return getProxyUrl("gmx.com");
  if (normName.includes("aol")) return getProxyUrl("aol.com");
  if (normName.includes("ticketmaster")) return getProxyUrl("ticketmaster.com");
  if (normName.includes("stubhub")) return getProxyUrl("stubhub.com");
  if (normName.includes("seatgeek")) return getProxyUrl("seatgeek.com");
  if (normName.includes("viagogo")) return getProxyUrl("viagogo.com");
  if (normName.includes("bet9ja")) return getProxyUrl("bet9ja.com");
  if (normName.includes("1xbet")) return getProxyUrl("1xbet.com");
  if (normName.includes("betway")) return getProxyUrl("betway.com");
  if (normName.includes("bet365")) return getProxyUrl("bet365.com");
  if (normName.includes("sportybet")) return getProxyUrl("sportybet.com");
  if (normName.includes("nairabet")) return getProxyUrl("nairabet.com");
  if (normName.includes("merrybet")) return getProxyUrl("merrybet.com");
  if (normName.includes("betking")) return getProxyUrl("betking.com");
  if (normName.includes("william hill") || normName.includes("williamhill")) return getProxyUrl("williamhill.com");
  if (normName.includes("ladbrokes")) return getProxyUrl("ladbrokes.com");
  if (normName.includes("bwin")) return getProxyUrl("bwin.com");
  if (normName.includes("paddypower")) return getProxyUrl("paddypower.com");
  if (normName.includes("skybet")) return getProxyUrl("skybet.com");
  if (normName.includes("fanduel")) return getProxyUrl("fanduel.com");

  // Alphanumeric fallback guesser
  const cleanLabel = normName.replace(/\([^)]*\)/g, "").replace(/[^a-z0-9\s]/g, " ").trim();
  const words = cleanLabel.split(/\s+/).filter(w => w.length > 2 && w !== "and" && w !== "the" && w !== "for" && w !== "premium" && w !== "service");
  if (words.length > 0) {
    return getProxyUrl(`${words[0]}.com`);
  }

  return null;
};

interface InlineLogo {
  bgClass: string;
  svg: React.ReactNode;
}

const INLINE_BRAND_LOGOS: Record<string, InlineLogo> = {
  wa: {
    bgClass: "bg-[#25D366] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[60%] h-[60%] fill-current">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.706 1.456h.008c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    )
  },
  tg: {
    bgClass: "bg-[#229ED9] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[62%] h-[62%] fill-current ml-[-1px]">
        <path d="M9.78 18.65l.02-4.13 7.51-6.83c.32-.29-.07-.45-.5-.16L7.3 13.51l-4-1.25c-.87-.27-.89-.87.18-1.29l15.65-6.03c.72-.26 1.36.17 1.11 1.25l-2.66 12.54c-.2.93-.76 1.16-1.54.73l-4.06-2.99-1.96 1.88c-.22.22-.4.4-.82.4z"/>
      </svg>
    )
  },
  tg_premium: {
    bgClass: "bg-gradient-to-r from-[#8a3ab9] to-[#e95950] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[62%] h-[62%] fill-current">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
      </svg>
    )
  },
  ig: {
    bgClass: "bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[58%] h-[58%] fill-current">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    )
  },
  fb: {
    bgClass: "bg-[#1877F2] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current mt-1">
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
      </svg>
    )
  },
  tw: {
    bgClass: "bg-[#0b141a] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[45%] h-[45%] fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  },
  go: {
    bgClass: "bg-white border border-slate-200 text-slate-800",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]">
        <path d="M22.56 12.25c0-.78-.07-1.53-.19-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
      </svg>
    )
  },
  vk: {
    bgClass: "bg-[#0077FF] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current">
        <path d="M15.4 2h-6.8C4.3 2 2 4.3 2 8.6v6.8c0 4.3 2.3 6.6 6.6 6.6h6.8c4.3 0 6.6-2.3 6.6-6.6V8.6c0-4.3-2.3-6.6-6.6-6.6zm3.3 13.9c-.1.3-.2.6-.5.8-.3.2-.7.3-1.1.2h-.9c-.6 0-1.2-.2-1.7-.5-.6-.4-1.2-.9-1.6-1.5-.2-.3-.5-.4-.8-.4-.3 0-.6.1-.8.4-.3.4-.6.8-1 1.2-.3.3-.7.5-1.2.5h-1c-.8 0-1.6-.3-2.2-.8-.7-.6-1.2-1.3-1.5-2.1-.6-1.6-1-3.2-1.3-4.9 0-.3.1-.6.3-.8.2-.2.5-.3.8-.3h1c.4 0 .8.2 1 .5.3 1.2.7 2.4 1.3 3.5.1.2.3.4.5.5.2.1.5 0 .6-.2.4-.6.7-1.3.8-2 0-.4-.1-.8-.4-1.1-.3-.3-.7-.4-1.1-.4h.2c.5 0 .9-.3 1-.7.1-.4 0-.8-.3-1 .4-.5 1-.9 1.6-1.1.7-.2 1.4-.2 2.1 0 .4.1.8.4 1 .8.2.4.2.8.2 1.3v1.8c0 .3.2.5.4.5s.4-.2.5-.4c.4-.7.7-1.4.9-2.2.1-.3.3-.6.6-.7.3-.1.6-.1.9 0h1c.4 0 .7.2.8.5.1.3.1.6 0 .9-.3 1-1 2-1.8 2.8-.2.2-.3.5-.3.8s.2.5.4.7c.6.5 1.1 1.1 1.6 1.8.3.3.4.8.3 1.2z"/>
      </svg>
    )
  },
  vi: {
    bgClass: "bg-[#7360f2] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current">
        <path d="M19.77 15.68c-.62-.17-1.4-.41-2.03-.5-.45-.06-.82.16-1.07.45l-.75 1.08c-2.3-1.12-4.13-2.95-5.25-5.25l1.08-.75c.29-.25.48-.62.45-1.07-.09-.63-.33-1.41-.5-2.03-.13-.49-.55-.83-1.06-.83H7.83c-.63 0-1.17.48-1.22 1.11-.47 6.13 4.4 11 10.53 10.53.63-.05 1.11-.59 1.11-1.22v-2.81c0-.5-.34-.92-.83-1.06z"/>
      </svg>
    )
  },
  ds: {
    bgClass: "bg-[#5865F2] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[58%] h-[58%] fill-current">
        <path d="M19.27 4.73a16.14 16.14 0 0 0-4-.c-.53.93-1.18 2.85-1.59 3.82a14.9 14.9 0 0 0-8 0C5.23 7.55 4.58 5.66 4.1 4.73a16.15 16.15 0 0 0-4 1.2c2.6 3.83 5.07 7.58 5.07 11.08a16.27 16.27 0 0 0 4.8 2.4A11.72 11.72 0 0 1 11 17.65a10.61 10.61 0 0 1-1.63-.78A7.83 7.83 0 0 0 10 16.5a11.53 11.53 0 0 0 11.3 0c.4.3.73.61 1 .84a10.61 10.61 0 0 1-1.63.78 11.72 11.72 0 0 1 1.07 1.76 16.27 16.27 0 0 0 4.8-2.4c0-3.5-2.47-7.25-5.07-11.08zM8.33 13.96c-.95 0-1.74-.88-1.74-1.95s.76-1.96 1.74-1.96 1.74.88 1.74 1.96-.77 1.95-1.74 1.95zm7.34 0c-.95 0-1.74-.88-1.74-1.95s.76-1.96 1.74-1.96 1.74.88 1.74 1.96-.76 1.95-1.74 1.95z"/>
      </svg>
    )
  },
  sp: {
    bgClass: "bg-[#1ED760] text-black",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[58%] h-[58%] fill-current">
        <path d="M12 .007c-6.627 0-12 5.371-12 12s5.373 12 12 12c6.629 0 12-5.371 12-12s-5.371-12-12-12zm5.501 17.31c-.221.36-.615.371-3.235-2.222-7.551-2.222-2.589 0-4.992.83-6.852 2.212-.421.31-.989.212-1.3-.2-.31-.41-.211-.98.2-1.3 2.191-1.64 4.97-2.59 8-2.59 4.811 0 7.822 2.051 8.521 2.5 1.13.7.351 1.341-.02 1.93zm1.464-3.26c-.28.441-1.121-.591-1.56-.31-3.951-2.441-9.972-3.14-14.632-1.731-.57.17-1.17-.16-1.34-.731-.17-.57.16-1.17.73-1.34 5.332-1.61 12-1.162 16.5 1.63.483.291.63 1.04.34 1.482zm.123-3.321c-5.181-3.08-13.731-3.37-18.721-1.85-.79.24-1.63-.22-1.87-1.01-.24-.79.22-1.631 1.01-1.871 5.722-1.73 15.143-1.41 21.092 2.112.72.43.95 1.36.52 2.08-.429.72-1.359.95-2.031.539z"/>
      </svg>
    )
  },
  ya: {
    bgClass: "bg-[#FFCC00] text-black border border-amber-300",
    svg: (
      <span className="font-sans font-black text-red-600 text-[20px] leading-none select-none">Я</span>
    )
  },
  ok: {
    bgClass: "bg-[#ee8208] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[45%] h-[45%] fill-current">
        <path d="M12 9a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm0-7a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm0 10.5c-3.52 0-6.73 1.14-9 3.03l2 2a9.42 9.42 0 017-3.03 9.42 9.42 0 017 3.03l2-2c-2.27-1.89-5.48-3.03-9-3.03zm5.71 5.33l-5.71 5.7-5.71-5.7c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l6.41 6.42a1 1 0 001.42 0l6.41-6.42c.39-.39.39-1.02 0-1.41s-1.02-.39-1.42 0z"/>
      </svg>
    )
  },
  op: {
    bgClass: "bg-[#10a37f] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current">
        <path d="M21.3 11.2c-.1-.7-.4-1.3-.9-1.8.2-.7.2-1.4 0-2.1-.3-.6-.8-1.2-1.4-1.5-.5-.4-1.2-.5-1.8-.4-.4-.5-1-.9-1.6-1.1-.7-.2-1.4-.2-2.1 0-.6-.4-1.3-.5-2-.4-.7.1-1.3.4-1.8.9-.7-.2-1.4-.2-2.1 0-.6.3-1.2.8-1.5 1.4-.4.5-.5 1.2-.4 1.8-.5.4-.9 1-1.1 1.6-.2.7-.2 1.4 0 2.1-.4.6-.5 1.3-.4 2 .1.7.4 1.3.9 1.8-.2.7-.2 1.4 0 2.1.3.6.8 1.2 1.4 1.5.5.4 1.1.5 1.8.4.4.5 1 .9 1.6 1.1.7.2 1.4.2 2.1 0 .6.4 1.3.5 2 .4.7-.1 1.3-.4 1.8-.9.7.2 1.4.2 2.1 0 .6-.3 1.2-.8 1.5-1.4.4-.5.5-1.2.4-1.8.5-.4.9-1 1.1-1.6.2-.7.2-1.4 0-2.1.4-.6.5-1.3.4-2zm-3.5 1c0-.1 0-.1.1-.1.3-.5.7-1 1-1.6.2-.4.4-.8.3-1.2-.1-.5-.4-1-1-1.1-.1 0-.2-.1-.2-.1v-2c0-.5-.3-1-.8-1.2-.4-.2-.9-.2-1.3-.1l.1.1c.4.2.7.6.8 1.1.1.4 0 .9-.2 1.3l-1 1.7-.1.1v-.1c0-.6-.3-1.1-.7-1.4-.4-.3-.9-.4-1.4-.2 0 0-.1 0-.2-.1l-1.3-.7c-.4-.2-.9-.3-1.4-.1-.5.1-.9.5-1.1.9l.1.1c.3-.3.7-.5 1.2-.5.5 0 .9.3 1.1.7l1 1.7.1.1h-.1c-.6 0-1.1-.2-1.5-.6-.4-.3-.7-.8-.7-1.3l-.1-.1-1.8 1c-.4.2-.7.7-.8 1.2a1.5 1.5 0 0 0 .5 1.4l.1.1c0-.4.3-.8.7-1 .4-.2.9-.3 1.4-.1l1.7.6.1.1v.1c0 .5-.1 1.1-.4 1.5-.3.4-.8.7-1.3.8l-.1.1.1 1.8c.1.5.5.9 1 1 .4.1.9 0 1.3-.2l-.1-.1c-.4-.2-.7-.6-.8-1.1 0-.5.1-.9.3-1.3l1-1.7.1-.1.1.1a1.5 1.5 0 0 1 .1 1.5c.3.4.7.7 1.3.8h.2v2c0 .5.3 1 .8 1.2.4.2.9.2 1.3.1l-.1-.1c-.4-.2-.7-.6-.8-1.1-.1-.4 0-.9.2-1.3l1-1.7.1-.1c0 .6.3 1.1.7 1.4.4.3.9.4 1.4.2 0 0 .1 0 .2.1l1.3.7c.4.2.9.3 1.4.1.5-.1.9-.5 1.1-.9l-.1-.1c-.3.3-.7.5-1.2.5s-.9-.3-1.1-.7l-1-1.7-.1-.1h.1c.5 0 1.1.1 1.5.4s.7.8.7 1.3l.1.1z"/>
      </svg>
    )
  },
  nf: {
    bgClass: "bg-black text-[#E50914]",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[48%] h-[48%] fill-current font-black">
        <path d="M4.3 22.1V1.9c0-.4.3-.7.7-.7h3.8c.4 0 .7.3.7.7v15L14.7 1.9c.1-.2.3-.4.5-.5s.4-.1.6-.1h3.8c.4 0 .7.3.7.7v20.2c0 .4-.3.7-.7.7h-3.8c-.4 0-.7-.3-.7-.7v-15l-5.2 15c-.1.2-.3.4-.5.5s-.4.1-.6.1H5c-.4 0-.7-.3-.7-.7z"/>
      </svg>
    )
  },
  wb: {
    bgClass: "bg-gradient-to-r from-[#e100ff] to-[#7f00ff] text-white",
    svg: (
      <span className="font-sans font-black text-white text-[20px] leading-none select-none">W</span>
    )
  },
  mm: {
    bgClass: "bg-[#005eff] text-[#ffdd00]",
    svg: (
      <div className="flex items-center gap-0.5 justify-center">
        <div className="w-2 h-2 border-[1.5px] border-current rounded-full" />
        <div className="w-1 h-1 bg-[#ff5e00] rounded-full" />
      </div>
    )
  },
  atw: {
    bgClass: "bg-[#0050ff] text-white",
    svg: (
      <span className="font-sans font-black text-xs text-white select-none">DS</span>
    )
  },
  ms: {
    bgClass: "bg-[#0078d4] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current">
        <path d="M1 1h10v10H1V1zm12 0h10v10H13V1zM1 13h10v10H1V13zm12 0h10v10H13V13z" />
      </svg>
    )
  },
  am: {
    bgClass: "bg-[#131921] text-white",
    svg: (
      <span className="font-sans font-black text-amber-500 text-[20px] leading-none tracking-tighter select-none">a</span>
    )
  },
  st: {
    bgClass: "bg-[#171a21] text-[#66c0f4]",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[58%] h-[58%] fill-current">
        <path d="M12 .002a11.996 11.996 0 0 0-11.986 11.23L4.93 14.51a3.674 3.674 0 0 1 3.518-2.607c.801 0 1.545.26 2.155.7l5.228-3.08a3.684 3.684 0 1 1 .533.906l-5.176 3.09a3.692 3.692 0 0 1-5.151 3.238l-4.154 1.7a12 12 0 1 0 10.122-21.455z"/>
      </svg>
    )
  },
  rt: {
    bgClass: "bg-gradient-to-r from-[#fe5860] to-[#ff7a55] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[55%] h-[55%] fill-current">
        <path d="M12 21.054c-.216 0-.432-.046-.63-.138-1.558-.724-6.6-3.153-8.196-8.232C1.56 7.64 5.378 2.946 11.134 2.946c5.748 0 9.566 4.694 7.96 9.738-1.595 5.08-6.637 7.509-8.196 8.232a1.472 1.472 0 0 1-.9.138z" />
      </svg>
    )
  },
  ub: {
    bgClass: "bg-black text-white border border-slate-700",
    svg: (
      <span className="font-sans font-black text-white text-[16px] select-none tracking-tight">UBER</span>
    )
  },
  zm: {
    bgClass: "bg-[#2D8CFF] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current">
        <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
      </svg>
    )
  },
  pp: {
    bgClass: "bg-[#003087] text-white",
    svg: (
      <span className="font-sans font-black italic text-[22px] select-none">P</span>
    )
  },
  ln: {
    bgClass: "bg-[#0A66C2] text-white",
    svg: (
      <span className="font-sans font-black text-[20px] select-none">in</span>
    )
  },
  sc: {
    bgClass: "bg-[#FFFC00] text-black",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[58%] h-[58%] fill-current">
        <path d="M12 2.75c-2.5 0-5.5 2-5.5 5.25 0 .5.25 1 .5 1.5-.75.25-1.5.75-1.5 1.75 0 1 1 1.75 2 1.5.25.5.5.75.75 1-.25.25-1 .75-1.5 1.5-.5.75-.25 1.5.5 1.5.75 0 1.25-.5 1.75-1.25.5.75 1.5 1.25 3 1.25s2.5-.5 3-1.25c.5.75 1 1.25 1.75 1.25.75 0 1-.75.5-1.5-.5-.75-1.25-1.25-1.5-1.5.25-.25.5-.5.75-1 1 .25 2-.5 2-1.5 0-1-.75-1.5-1.5-1.75.25-.5.5-1 .5-1.5 0-3.25-3-5.25-5.5-5.25z"/>
      </svg>
    )
  },
  rd: {
    bgClass: "bg-[#FF4500] text-white",
    svg: (
      <span className="font-sans font-black text-[20px] select-none">r/</span>
    )
  },
  tc: {
    bgClass: "bg-[#9146FF] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[55%] h-[55%] fill-current">
        <path d="M11.5 3h8.5l2.5 2.5v11.5l-3.5 3.5h-4.5l-3 3v-3h-4l-4.5-4.5v-10.5l1.5-2.5zm7 5.5h-2v5h2v-5zm-5 0h-2v5h2v-5z"/>
      </svg>
    )
  },
  ba: {
    bgClass: "bg-[#181A20] text-[#F3BA2F]",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[58%] h-[58%] fill-current">
        <path d="M12 9.423L14.577 12 12 14.577 9.423 12 12 9.423zM22.5 12l-2.577 2.577L17.346 12l2.577-2.577L22.5 12zM6.654 12L4.077 9.423l-2.577 2.577L4.077 14.577 6.654 12zM12 1.5l2.577 2.577L12 6.654 9.423 4.077l2.577-2.577zM12 17.346l2.577 2.577L12 22.5l-2.577-2.577 2.577-2.577z"/>
      </svg>
    )
  },
  cb: {
    bgClass: "bg-[#0052FF] text-white",
    svg: (
      <span className="font-sans font-black text-xs text-white select-none">C</span>
    )
  },
  ap: {
    bgClass: "bg-black text-white border border-slate-800",
    svg: (
      <span className="font-sans font-bold text-[14px] select-none tracking-tight">APPLE</span>
    )
  },
  ae: {
    bgClass: "bg-gradient-to-r from-[#FF4E00] to-[#EC0868] text-white",
    svg: (
      <span className="font-sans font-black text-white text-[18px] select-none italic tracking-tight">Ali</span>
    )
  },
  nk: {
    bgClass: "bg-[#111111] text-white",
    svg: (
      <span className="font-sans font-black text-[14px] italic tracking-tight select-none">NIKE</span>
    )
  },
  tt: {
    bgClass: "bg-black text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current text-[#00f2fe] drop-shadow-[1.5px_0px_0px_#fe0979]">
        <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.23-1.13 4.39-2.9 5.8-1.57 1.25-3.64 1.83-5.61 1.6-1.95-.21-3.82-1.19-5.07-2.67-1.39-1.6-2.02-3.72-1.78-5.8.21-1.78 1.13-3.46 2.53-4.6 1.48-1.22 3.49-1.78 5.41-1.54v4.06c-1.12-.11-2.29.17-3.15.89-.8.67-1.25 1.73-1.16 2.77.08 1.01.69 1.95 1.56 2.45.89.51 2.01.55 2.94.13 1.03-.46 1.76-1.43 1.96-2.55.13-.72.07-5.9.07-16.33z"/>
      </svg>
    )
  },
  wc: {
    bgClass: "bg-[#07C160] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[62%] h-[62%] fill-current">
        <path d="M8.5 2.5C3.8 2.5 0 5.8 0 9.8c0 2.2 1.1 4.2 2.9 5.5l-.7 2.2 2.6-1.3c1.1.3 2.4.5 3.7.5 4.7 0 8.5-3.3 8.5-7.3s-3.8-7.3-8.5-7.3zm-2.2 5.5c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm4.4 0c.6 0 1 .4 1 1s-.4 1-1 1-1-.4-1-1 .4-1 1-1zm6.3 3.6c3.9 0 7-2.7 7-6 0-.3 0-.7-.1-1-1 .9-2.3 1.6-3.8 2-1 .3-2.1.4-3.2.4-5.3 0-9.6-3.7-9.6-8.3 0-.1 0-.1 0-.2-.6-.2-1.3-.2-1.9-.2C2.1 2.1 0 4.8 0 8.1c0 1.8.9 3.5 2.4 4.6l-.6 1.8 2.2-1.1c.9.3 1.9.4 3 .4.2 0 .5 0 .7-.1-.2-.5-.3-1.1-.3-1.7 0-3.3 3.1-6 7-6zm-1.8 3.5c.5 0 .8.3.8.8s-.3.8-.8.8-.8-.3-.8-.8.3-.8.8-.8zm3.6 0c.5 0 .8.3.8.8s-.3.8-.8.8-.8-.3-.8-.8.3-.8.8-.8z"/>
      </svg>
    )
  },
  rv: {
    bgClass: "bg-black text-white",
    svg: (
      <span className="font-sans font-black italic tracking-tighter text-[20px] select-none">R</span>
    )
  },
  ro: {
    bgClass: "bg-[#2b2b2b] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current -rotate-12">
        <path d="M5.4 0L0 18.6l18.6 5.4L24 5.4 5.4 0zm9.3 15c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/>
      </svg>
    )
  },
  pr: {
    bgClass: "bg-black text-[#FF424D]",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current">
        <path d="M3.5 24h3.7V0H3.5v24zM16.5 0C12.3 0 9 3.4 9 7.5s3.3 7.5 7.5 7.5S24 11.6 24 7.5 20.7 0 16.5 0z"/>
      </svg>
    )
  },
  ab: {
    bgClass: "bg-[#FF5A5F] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current">
        <path d="M12 24c-1 0-1.9-.3-2.6-.9-2.3-2-6-6.2-8.1-10.4C.5 11 .1 9.4.1 7.8.1 3.5 3.6 0 7.8 0c1.8 0 3.6.7 4.9 2V2c1.3-1.3 3.1-2 4.9-2 4.2 0 7.7 3.5 7.7 7.8 0 1.6-.4 3.2-1.2 4.9-2 4.1-5.8 8.4-8.1 10.4-.6.6-1.6.9-2.6.9zm-4.2-21.6c-3 0-5.5 2.5-5.5 5.5 0 1.3.4 2.6 1 4 1.8 3.8 5.3 7.7 7.3 9.4.3.3.6.4 1 .4h.1c.4 0 .7-.1 1-.4 2-1.7 5.5-5.6 7.3-9.4.6-1.4 1-2.7 1-4 0-3-2.5-5.5-5.5-5.5-1.5 0-3.1.6-4.2 1.8l-1.3 1.4-1.3-1.4C10.9 3 9.3 2.4 7.8 2.4zm4.2 15c-3.1 0-5.6-2.5-5.6-5.6 0-3.1 2.5-5.6 5.6-5.6 3.1 0 5.6 2.5 5.6 5.6 0 3.1-2.5 5.6-5.6 5.6zm0-9.1c-1.9 0-3.5 1.6-3.5 3.5 0 1.9 1.6 3.5 3.5 3.5 1.9 0 3.5-1.6 3.5-3.5 0-1.9-1.6-3.5-3.5-3.5z"/>
      </svg>
    )
  },
  pt: {
    bgClass: "bg-[#E60023] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 5.1 3.2 9.4 7.6 11.2-.1-1-.2-2.4 0-3.4.2-.9 1.4-6 1.4-6s-.4-.7-.4-1.7c0-1.6.9-2.8 2.1-2.8 1 0 1.5.8 1.5 1.7 0 1-.6 2.6-1 4-.3 1.2.6 2.2 1.8 2.2 2.1 0 3.8-2.3 3.8-5.5 0-2.8-2-4.8-4.9-4.8-3.4 0-5.4 2.5-5.4 5.2 0 1 .4 2.1.9 2.7.1.1.1.2.1.3-.1.4-.3 1.3-.3 1.5-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.7 0-3.8 2.8-7.3 8-7.3 4.2 0 7.4 3 7.4 6.9 0 4.1-2.6 7.5-6.1 7.5-1.2 0-2.4-.6-2.8-1.4 0 0-.6 2.3-.8 2.9-.2.8-.8 1.8-1.2 2.4 1 .3 2.1.5 3.2.5 6.6 0 12-5.4 12-12S18.6 0 12 0z"/>
      </svg>
    )
  },
  yh: {
    bgClass: "bg-[#410093] text-white",
    svg: (
      <span className="font-sans font-black italic text-[20px] select-none">Y!</span>
    )
  },
  eb: {
    bgClass: "bg-white border text-black",
    svg: (
      <div className="flex text-[16px] font-black tracking-tighter mix-blend-multiply opacity-90">
        <span className="text-[#E53238]">e</span>
        <span className="text-[#0064D2]">b</span>
        <span className="text-[#F5AF02]">a</span>
        <span className="text-[#86B817]">y</span>
      </div>
    )
  },
  sh: {
    bgClass: "bg-black text-white",
    svg: (
      <span className="font-sans font-black text-[14px] tracking-widest select-none">SHEIN</span>
    )
  },
  tm: {
    bgClass: "bg-[#ff6600] text-white",
    svg: (
      <span className="font-sans font-black text-[16px] tracking-tighter select-none">TEMU</span>
    )
  },
  dl: {
    bgClass: "bg-[#00CCBC] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current text-white">
        <path d="M12 0C5.372 0 0 5.373 0 12c0 6.628 5.372 12 12 12s12-5.372 12-12c0-6.627-5.372-12-12-12zm.23 18s-4.63-.443-4.836-.453c-.352-.016-.625-.197-.82-.544-.225-.403-.024-.963.447-1.25.132-.08.682-.338.682-.338s.078-.04.097-.05c.045-.02.404-.15.82-.28.474-.15 1.572-.45 1.572-.45s-3.08-1.55-3.13-1.58c-.593-.31-1.04-.645-1.34-1.047-.577-.775-.246-1.574-.246-1.574s2.21-3.664 2.222-3.69c.14-.264.444-.45.8-.466.216-.01.428.082.6.262.152.164.225.433.22.69 0 .007-1.1 3.208-1.1 3.208-.008.016 1.765 1.636 1.787 1.656.02.016 2.052 1.488 2.052 1.488l2.946-4.673c.12-.196.287-.295.493-.3a1.008 1.008 0 0 1 .536.19c.197.143.328.384.34.622.014.28-.1.53-.332.74l-4.148 5.222s5.408 1.83 5.437 1.836c.21.033.4.156.544.336.26.335.25.75-.028 1.025-.262.26-.642.336-1.022.25l-4.672-1.35c.01.12.016.2.016.2-.023.23-.11.41-.264.55-.17.155-.42.22-.647.227-.272.008-1.922-.016-1.922-.016z"/>
      </svg>
    )
  },
  dz: {
    bgClass: "bg-[#121216] text-[#EF5466]",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current">
        <path d="M2.57 14.57h3.43v3.43H2.57v-3.43zM8 14.57h3.43v3.43H8v-3.43zm0-5.43h3.43v3.43H8V9.14zM13.43 14.57h3.43v3.43h-3.43v-3.43zm0-5.43h3.43v3.43h-3.43V9.14zm0-5.43h3.43v3.43h-3.43V3.71zm5.43 10.86h3.43v3.43h-3.43v-3.43zm0-5.43h3.43v3.43h-3.43V9.14zm0-5.43h3.43v3.43h-3.43V3.71z"/>
      </svg>
    )
  },
  of: {
    bgClass: "bg-[#00AFF0] text-white",
    svg: (
      <span className="font-sans font-black text-[18px] italic tracking-tight select-none">OF</span>
    )
  },
  ly: {
    bgClass: "bg-[#FF00BF] text-white",
    svg: (
      <span className="font-sans font-black text-[20px] italic select-none">lyft</span>
    )
  },
  dd: {
    bgClass: "bg-[#FF3008] text-white",
    svg: (
      <span className="font-sans font-black text-[14px] select-none text-center leading-none mt-0.5">DOOR<br/>DASH</span>
    )
  },
  ti: {
    bgClass: "bg-gradient-to-tr from-[#FD297B] to-[#FF655B] text-white shadow-[0_0_15px_rgba(253,41,123,0.3)]",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[60%] h-[60%] fill-current text-white">
        <path d="M12.44 2.1c.14.07.28.16.4.27 1.83 1.74 3.73 4.25 4.34 7.21.09.43.14.88.14 1.34 0 4.14-3.32 7.5-7.42 7.5-3.8 0-6.93-2.85-7.37-6.52-.08-.66-.02-1.32.17-1.96.2-.68.51-1.33.91-1.92.51-.76 1.15-1.42 1.88-1.96.22-.16.45-.3.69-.43.17-.09.38-.05.52.1.15.16.16.39.04.56-.63.92-1.02 1.99-1.12 3.1-.06.66.02 1.32.22 1.95.21.65.55 1.25.99 1.77.8.96 2.01 1.55 3.32 1.55 2.37 0 4.29-1.9 4.29-4.25 0-.44-.06-.88-.19-1.31-.56-1.92-1.89-3.57-3.66-4.51-.18-.1-.28-.3-.26-.5.02-.2.16-.36.35-.4.22-.04.45-.07.67-.09.07 0 .14-.01.21-.01.12 0 .23.03.32.08" />
      </svg>
    )
  },
  bm: {
    bgClass: "bg-[#FFC629] text-black shadow-sm",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[55%] h-[55%] fill-current text-black">
        <path d="M18.8 9.9c2.5 1.4 2.5 5 0 6.5l-3.3 1.8c-2.4 1.4-5.5 1.4-8 0L4.2 16.4c-2.5-1.4-2.5-5 0-6.5l3.3-1.8c2.4-1.4 5.5-1.4 8 0l3.3 1.8z" />
        <path fill="#FFC629" d="M13.5 12h-3v4.5h3V12z" />
      </svg>
    )
  },
  hi: {
    bgClass: "bg-black text-white shadow-sm border border-slate-800",
    svg: (
      <span className="font-serif font-black text-[22px] select-none text-white leading-none">H</span>
    )
  },
  gr: {
    bgClass: "bg-[#000000] text-[#FFB000]",
    svg: (
      <span className="font-sans font-black text-[22px] tracking-tight select-none border-[2.5px] border-[#FFB000] rounded-sm px-1 leading-none shadow-[0_0_8px_rgba(255,176,0,0.5)]">G</span>
    )
  },
  bd: {
    bgClass: "bg-[#7A1E94] text-white",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[60%] h-[60%] fill-[#FF6A00]">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        <circle cx="8" cy="8.5" r="1.5" fill="white" />
        <circle cx="16" cy="8.5" r="1.5" fill="white" />
        <path d="M12 14c-1.5 0-3-.5-4-1.5 0 0 0-.5.5-.5s1 .5 3.5 1 3.5-1 3.5-1 .5.5.5.5c-1 1-2.5 1.5-4 1.5z" fill="white" />
      </svg>
    )
  },
  mz: {
    bgClass: "bg-[#183a48] text-[#14C8A3]",
    svg: (
      <span className="font-sans font-black text-[16px] italic tracking-tight select-none">monzo</span>
    )
  },
  ch: {
    bgClass: "bg-[#F3EFE9] text-black border border-slate-200",
    svg: (
      <span className="font-sans font-black text-[22px] select-none text-center">👋</span>
    )
  },
  oc: {
    bgClass: "bg-[#FF0056] text-white shadow-sm",
    svg: (
      <svg viewBox="0 0 24 24" className="w-[50%] h-[50%] fill-current text-white">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    )
  },
  pf: {
    bgClass: "bg-[#0FF2CE] text-[#00609C] shadow-sm",
    svg: (
      <span className="font-sans font-black italic text-[20px] select-none text-center">POF</span>
    )
  },
  mc: {
    bgClass: "bg-[#0070FF] text-white",
    svg: (
      <span className="font-sans font-black text-[18px] select-none">M</span>
    )
  },
  eh: {
    bgClass: "bg-[#7CD1D8] text-white",
    svg: (
      <span className="font-serif font-black italic text-[20px] select-none">e</span>
    )
  },
  bg: {
    bgClass: "bg-[#00D4FC] text-white",
    svg: (
      <span className="font-sans font-black text-[18px] italic tracking-tight select-none">BIGO</span>
    )
  },
  k: {
    bgClass: "bg-[#FFDE00] text-black",
    svg: (
      <span className="font-sans font-black text-[18px] italic tracking-tight select-none">K</span>
    )
  }
};

const getInlineLogo = (code: string, name: string): InlineLogo | null => {
  const normCode = code.toLowerCase().trim();
  const normName = name.toLowerCase().trim();

  if (INLINE_BRAND_LOGOS[normCode]) {
    return INLINE_BRAND_LOGOS[normCode];
  }

  if (normName.includes("whatsapp")) return INLINE_BRAND_LOGOS.wa;
  if (normName.includes("telegram")) return INLINE_BRAND_LOGOS.tg;
  if (normName.includes("instagram")) return INLINE_BRAND_LOGOS.ig;
  if (normName.includes("facebook")) return INLINE_BRAND_LOGOS.fb;
  if (normName.includes("twitter") || normName.includes(" x ")) return INLINE_BRAND_LOGOS.tw;
  if (normName.includes("google") || normName.includes("gmail")) return INLINE_BRAND_LOGOS.go;
  if (normName.includes("vkontakte") || normName.includes(" vk ")) return INLINE_BRAND_LOGOS.vk;
  if (normName.includes("viber")) return INLINE_BRAND_LOGOS.vi;
  if (normName.includes("discord")) return INLINE_BRAND_LOGOS.ds;
  if (normName.includes("spotify")) return INLINE_BRAND_LOGOS.sp;
  if (normName.includes("yandex")) return INLINE_BRAND_LOGOS.ya;
  if (normName.includes("odnoklassniki")) return INLINE_BRAND_LOGOS.ok;
  if (normName.includes("openai") || normName.includes("chatgpt")) return INLINE_BRAND_LOGOS.op;
  if (normName.includes("netflix")) return INLINE_BRAND_LOGOS.nf;
  if (normName.includes("wildberries")) return INLINE_BRAND_LOGOS.wb;
  if (normName.includes("mail.ru")) return INLINE_BRAND_LOGOS.mm;
  if (normName.includes("deepseek")) return INLINE_BRAND_LOGOS.atw;
  if (normName.includes("microsoft") || normName.includes("outlook") || normName.includes("hotmail")) return INLINE_BRAND_LOGOS.ms;
  if (normName.includes("amazon") || normName.includes("prime")) return INLINE_BRAND_LOGOS.am;
  if (normName.includes("steam")) return INLINE_BRAND_LOGOS.st;
  if (normName.includes("tind")) return INLINE_BRAND_LOGOS.ti;
  if (normName.includes("bumble")) return INLINE_BRAND_LOGOS.bm;
  if (normName.includes("hing")) return INLINE_BRAND_LOGOS.hi;
  if (normName.includes("badoo")) return INLINE_BRAND_LOGOS.bd;
  if (normName.includes("okcupid")) return INLINE_BRAND_LOGOS.oc;
  if (normName.includes("pof") || normName.includes("plenty of fish")) return INLINE_BRAND_LOGOS.pf;
  if (normName.includes("match")) return INLINE_BRAND_LOGOS.mc;
  if (normName.includes("eharmony")) return INLINE_BRAND_LOGOS.eh;
  if (normName.includes("uber")) return INLINE_BRAND_LOGOS.ub;
  if (normName.includes("zoom")) return INLINE_BRAND_LOGOS.zm;
  if (normName.includes("paypal")) return INLINE_BRAND_LOGOS.pp;
  if (normName.includes("linkedin")) return INLINE_BRAND_LOGOS.ln;
  if (normName.includes("snapchat")) return INLINE_BRAND_LOGOS.sc;
  if (normName.includes("reddit")) return INLINE_BRAND_LOGOS.rd;
  if (normName.includes("twitch")) return INLINE_BRAND_LOGOS.tc;
  if (normName.includes("binance")) return INLINE_BRAND_LOGOS.ba;
  if (normName.includes("coinbase")) return INLINE_BRAND_LOGOS.cb;
  if (normName.includes("apple")) return INLINE_BRAND_LOGOS.ap;
  if (normName.includes("aliexpress") || normName.includes("alibaba")) return INLINE_BRAND_LOGOS.ae;
  if (normName.includes("nike") || normName.includes("adidas" ) || normName.includes("puma")) return INLINE_BRAND_LOGOS.nk;
  if (normName.includes("tiktok")) return INLINE_BRAND_LOGOS.tt;
  if (normName.includes("wechat")) return INLINE_BRAND_LOGOS.wc;
  if (normName.includes("roblox")) return INLINE_BRAND_LOGOS.ro;
  if (normName.includes("patreon")) return INLINE_BRAND_LOGOS.pr;
  if (normName.includes("airbnb")) return INLINE_BRAND_LOGOS.ab;
  if (normName.includes("pinterest")) return INLINE_BRAND_LOGOS.pt;
  if (normName.includes("yahoo")) return INLINE_BRAND_LOGOS.yh;
  if (normName.includes("ebay")) return INLINE_BRAND_LOGOS.eb;
  if (normName.includes("revolut")) return INLINE_BRAND_LOGOS.rv;
  if (normName.includes("shein")) return INLINE_BRAND_LOGOS.sh;
  if (normName.includes("temu")) return INLINE_BRAND_LOGOS.tm;
  if (normName.includes("deliveroo")) return INLINE_BRAND_LOGOS.dl;
  if (normName.includes("deezer")) return INLINE_BRAND_LOGOS.dz;
  if (normName.includes("onlyfans")) return INLINE_BRAND_LOGOS.of;
  if (normName.includes("lyft")) return INLINE_BRAND_LOGOS.ly;
  if (normName.includes("doordash")) return INLINE_BRAND_LOGOS.dd;
  if (normName.includes("grindr")) return INLINE_BRAND_LOGOS.gr;
  if (normName.includes("monzo")) return INLINE_BRAND_LOGOS.mz;
  if (normName.includes("clubhouse")) return INLINE_BRAND_LOGOS.ch;
  if (normName.includes("bigo")) return INLINE_BRAND_LOGOS.bg;
  if (normName.includes("kakaotalk") || normName.includes("kakao")) return INLINE_BRAND_LOGOS.k;

  return null;
};

export const ServiceLogo = ({ code, name, className = "" }: { code: string, name: string, className?: string }) => {
  const [hasError, setHasError] = useState(false);
  
  // 1. Check if there is an premium high-fidelity inline logo we can use instantly!
  const inlineLogo = getInlineLogo(code, name);
  if (inlineLogo) {
    return (
      <div className={`flex items-center justify-center flex-shrink-0 rounded-lg shadow-xs overflow-hidden select-none font-bold ${inlineLogo.bgClass} ${className}`}>
        {inlineLogo.svg}
      </div>
    );
  }

  // 2. Fallback to API Logo Proxy
  const logoUrl = getServiceLogoUrl(code, name);

  // Generate a distinct fallback color based on service name hash
  const getBackgroundColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      "bg-emerald-500 text-emerald-50",
      "bg-teal-500 text-teal-50",
      "bg-blue-500 text-blue-50",
      "bg-indigo-500 text-indigo-50",
      "bg-violet-500 text-violet-50",
      "bg-purple-500 text-purple-50",
      "bg-pink-500 text-pink-50",
      "bg-rose-500 text-rose-50",
      "bg-amber-500 text-amber-50",
      "bg-orange-500 text-orange-50",
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const firstLetter = name ? name.charAt(0).toUpperCase() : "📱";

  if (logoUrl && !hasError) {
    return (
      <div className={`relative flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-100 rounded-lg p-0.5 shadow-xs overflow-hidden ${className}`}>
        <img
          src={logoUrl}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="h-full w-full object-contain rounded-md"
        />
      </div>
    );
  }

  const bgColor = getBackgroundColor(name || code);

  return (
    <div className={`flex items-center justify-center flex-shrink-0 font-bold select-none text-xs rounded-lg shadow-xs ${bgColor} ${className}`}>
      {firstLetter}
    </div>
  );
};

const countryToIso: Record<string, string> = {
  "ukraine": "UA",
  "vietnam": "VN",
  "kuwait": "KW",
  "iran": "IR",
  "bermuda": "BM",
  "vanuatu": "VU",
  "greenland": "GL",
  "salvador": "SV",
  "martinique": "MQ",
  "french polynesia": "PF",
  "american samoa": "AS",
  "libya": "LY",
  "tonga": "TO",
  "samoa": "WS",
  "jamaica": "JM",
  "liechtenstein": "LI",
  "sint maarten": "SX",
  "south korea": "KR",
  "singapore": "SG",
  "trinidad and tobago": "TT",
  "ecuador": "EC",
  "swaziland": "SZ",
  "andorra": "AD",
  "oman": "OM",
  "bosnia and herzegovina": "BA",
  "dominican republic": "DO",
  "kyrgyzstan": "KG",
  "syria": "SY",
  "qatar": "QA",
  "panama": "PA",
  "cuba": "CU",
  "mauritania": "MR",
  "sierra leone": "SL",
  "jordan": "JO",
  "portugal": "PT",
  "barbados": "BB",
  "burundi": "BI",
  "usa (2)": "US",
  "usa": "US",
  "united states": "US",
  "benin": "BJ",
  "brunei darussalam": "BN",
  "bahamas": "BS",
  "botswana": "BW",
  "belize": "BZ",
  "central african republic": "CF",
  "dominica": "DM",
  "grenada": "GD",
  "georgia": "GE",
  "greece": "GR",
  "israel": "IL",
  "guinea-bissau": "GW",
  "guyana": "GY",
  "iceland": "IS",
  "comoros": "KM",
  "saint kitts and nevis": "KN",
  "liberia": "LR",
  "lesotho": "LS",
  "malawi": "MW",
  "nambia": "NA",
  "namibia": "NA",
  "niger": "NE",
  "rwanda": "RW",
  "slovakia": "SK",
  "suriname": "SR",
  "tajikistan": "TJ",
  "monaco": "MC",
  "bahrain": "BH",
  "reunion": "RE",
  "zambia": "ZM",
  "armenia": "AM",
  "somalia": "SO",
  "poland": "PL",
  "republic of the congo": "CG",
  "congo": "CG",
  "chile": "CL",
  "burkina faso": "BF",
  "lebanon": "LB",
  "gabon": "GA",
  "albania": "AL",
  "uruguay": "UY",
  "mauritius": "MU",
  "bhutan": "BT",
  "maldives": "MV",
  "united kingdom": "GB",
  "england": "GB",
  "uk": "GB",
  "guadeloupe": "GP",
  "turkmenistan": "TM",
  "french guiana": "GF",
  "finland": "FI",
  "saint lucia": "LC",
  "luxembourg": "LU",
  "saint vincent": "VC",
  "equatorial guinea": "GQ",
  "djibouti": "DJ",
  "antigua and barbuda": "AG",
  "madagascar": "MG",
  "cayman islands": "KY",
  "montenegro": "ME",
  "denmark": "DK",
  "switzerland": "CH",
  "norway": "NO",
  "australia": "AU",
  "eritrea": "ER",
  "south sudan": "SS",
  "sao tome and principe": "ST",
  "aruba": "AW",
  "dr congo": "CD",
  "montserrat": "MS",
  "anguilla": "AI",
  "japan": "JP",
  "macedonia": "MK",
  "seychelles": "SC",
  "new caledonia": "NC",
  "cape verde": "CV",
  "palestine": "PS",
  "fiji": "FJ",
  "nigeria": "NG",
  "malta": "MT",
  "kazakhstan": "KZ",
  "macao": "MO",
  "gibraltar": "GI",
  "kosovo": "XK",
  "niue": "NU",
  "egypt": "EG",
  "india": "IN",
  "ireland": "IE",
  "cambodia": "KH",
  "lao": "LA",
  "haiti": "HT",
  "ivory coast": "CI",
  "gambia": "GM",
  "serbia": "RS",
  "china": "CN",
  "yemen": "YE",
  "south africa": "ZA",
  "romania": "RO",
  "colombia": "CO",
  "colombias": "CO",
  "estonia": "EE",
  "azerbaijan": "AZ",
  "canada": "CA",
  "morocco": "MA",
  "ghana": "GH",
  "argentinas": "AR",
  "argentina": "AR",
  "philippines": "PH",
  "uzbekistan": "UZ",
  "cameroon": "CM",
  "chad": "TD",
  "germany": "DE",
  "lithuania": "LT",
  "croatia": "HR",
  "sweden": "SE",
  "iraq": "IQ",
  "netherlands": "NL",
  "latvia": "LV",
  "myanmar": "MM",
  "austria": "AT",
  "belarus": "BY",
  "thailand": "TH",
  "saudi arabia": "SA",
  "mexico": "MX",
  "taiwan": "TW",
  "spain": "ES",
  "algeria": "DZ",
  "slovenia": "SI",
  "indonesia": "ID",
  "bangladesh": "BD",
  "senegal": "SN",
  "turkey": "TR",
  "czech": "CZ",
  "sri lanka": "LK",
  "peru": "PE",
  "pakistan": "PK",
  "new zealand": "NZ",
  "guinea": "GN",
  "mali": "ML",
  "malaysia": "MY",
  "venezuela": "VE",
  "ethiopia": "ET",
  "mongolia": "MN",
  "brazil": "BR",
  "afghanistan": "AF",
  "uganda": "UG",
  "angola": "AO",
  "cyprus": "CY",
  "france": "FR",
  "papua new gvineya": "PG",
  "papua new guinea": "PG",
  "kenya": "KE",
  "mozambique": "MZ",
  "nepal": "NP",
  "belgium": "BE",
  "bulgaria": "BG",
  "hungary": "HU",
  "moldova": "MD",
  "italy": "IT",
  "paraguay": "PY",
  "honduras": "HN",
  "tunisia": "TN",
  "tanzania": "TZ",
  "nicaragua": "NI",
  "timor-leste": "TL",
  "bolivia": "BO",
  "costa rica": "CR",
  "guatemala": "GT",
  "united arab emirates": "AE",
  "uae": "AE",
  "zimbabwe": "ZW",
  "puerto rico": "PR",
  "togo": "TG"
};

const getCountryIso = (countryName: string): string => {
  const norm = countryName.toLowerCase().trim();
  
  // Exact match
  let iso = countryToIso[norm];
  
  // Handled loose substring fallbacks if not direct match
  if (!iso) {
    const matchedKey = Object.keys(countryToIso).find(key => norm.includes(key) || key.includes(norm));
    if (matchedKey) {
      iso = countryToIso[matchedKey];
    }
  }

  return iso ? iso.toLowerCase() : "";
};

const renderFlag = (iso: string, name: string) => {
  if (iso) {
    return (
      <span
        className={`fi fi-${iso} rounded-xs shadow-sm flex-shrink-0 inline-block`}
        style={{ width: "1.25rem", height: "0.94rem" }}
        role="img"
        aria-label={`${name} flag`}
      />
    );
  }
  return <span className="text-sm flex-shrink-0">🌍</span>;
};

export function BuyNumber() {
  const { formatCentsToNGN } = useExchangeRate();
  const [countries, setCountries] = useState<Country[]>([]);
  const [usaCountry, setUsaCountry] = useState<Country | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceMeta, setServiceMeta] = useState<ServiceMeta>({});
  
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showOtherCountries, setShowOtherCountries] = useState(false);
  
  const [searchCountry, setSearchCountry] = useState("");
  const [searchService, setSearchService] = useState("");
  const [favorites, setFavorites] = useState<{country: Country, service: Service}[]>([]);

  useEffect(() => {
    try {
      const favs = localStorage.getItem("grizzly-favorites");
      if (favs) setFavorites(JSON.parse(favs));
    } catch(e) {}
  }, []);
  
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  
  const [visibleCountryCount, setVisibleCountryCount] = useState(30);
  const [visibleServiceCount, setVisibleServiceCount] = useState(30);
  
  const navigate = useNavigate();

  useEffect(() => {
    setVisibleCountryCount(30);
  }, [searchCountry]);

  useEffect(() => {
    setVisibleServiceCount(30);
  }, [searchService]);

  const [profitMargin, setProfitMargin] = useState(2.01);

  useEffect(() => {
    async function loadSettings() {
      try {
        const d = await getDoc(doc(db, 'system', 'settings'));
        if (d.exists() && d.data().profitMargin) {
          setProfitMargin(Number(d.data().profitMargin));
        }
      } catch (err) {
        console.error("Failed to load global profit margin", err);
      }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [smRes, cRes] = await Promise.all([
          fetch("/api/grizzly?action=getServicesList"),
          fetch("/api/grizzly?action=getCountries")
        ]);
        
        const smData = await smRes.json();
        const metaMap: ServiceMeta = {};
        if (smData?.services) {
          smData.services.forEach((s: any) => {
            metaMap[s.code] = { name: s.name };
          });
        }
        setServiceMeta(metaMap);

        const data = await cRes.json();
        
        const cList = Object.keys(data).map(key => {
          const name = data[key].eng || data[key].rus || "Unknown";
          return {
            grizzlyId: key,
            name,
            iso: getCountryIso(name)
          };
        }).sort((a, b) => a.name.localeCompare(b.name));

        setCountries(cList);
        
        let usa = cList.find(c => c.name.toLowerCase() === "usa" || c.name.toLowerCase() === "united states");
        if (!usa) {
           usa = cList.find(c => c.name.toLowerCase().includes("usa") || c.name.toLowerCase().includes("united states"));
        }
        
        const defaultCountry = usa || (cList.length > 0 ? cList[0] : null);
        setUsaCountry(defaultCountry);
        
        if (!showOtherCountries && defaultCountry) {
          setSelectedCountry(defaultCountry);
        }
      } catch (err) {
        console.error("Failed to load initial data", err);
        toast.error("Failed to load countries and services metadata");
      } finally {
        setIsLoadingCountries(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!showOtherCountries && usaCountry) {
      setSelectedCountry(usaCountry);
    }
  }, [showOtherCountries, usaCountry]);

  useEffect(() => {
    if (!selectedCountry) return;
    
    async function loadServices() {
      setIsLoadingServices(true);
      setServices([]);
      setSelectedService(null);
      try {
        const res = await fetch(`/api/grizzly?action=getPrices&country=${selectedCountry!.grizzlyId}`);
        const data = await res.json();
        const countryData = data[selectedCountry!.grizzlyId];
        
        if (countryData) {
          const sList = Object.keys(countryData).map(key => {
            let name = serviceMeta[key]?.name || key.toUpperCase();
            // Cleanup weird names if needed
            if (name.includes("_")) name = name.replace(/_/g, " ");
            
            return {
              id: key,
              name: name,
              icon: key,
              grizzlyCost: countryData[key].cost,
              count: countryData[key].count
            };
          }).filter(s => s.count > 0).sort((a, b) => b.count - a.count);

          setServices(sList);
          if (sList.length > 0) setSelectedService(sList[0]);
        }
      } catch (err) {
        console.error("Failed to load services", err);
      } finally {
        setIsLoadingServices(false);
      }
    }
    loadServices();
  }, [selectedCountry, serviceMeta]);

  // Our price is dynamically calculated based on admin settings (default 101% profit -> 2.01 multiplier), converted to cents
  const calculatePrice = (cost: number) => {
    return Math.max(10, Math.ceil(cost * profitMargin * 100));
  };

  const currentPrice = selectedService ? calculatePrice(selectedService.grizzlyCost) : 0;

  const handleBuy = async () => {
    if (!auth.currentUser) {
      toast.error("Please login first");
      return;
    }
    if (!selectedCountry || !selectedService) return;

    setIsBuying(true);
    const cost = currentPrice;

    try {
      // 1. Transactionally lock balance in frontend
      let hasFunds = false;
      const userRef = doc(db, "users", auth.currentUser.uid);
      
      await runTransaction(db, async (t) => {
        const userDoc = await t.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");
        const currentBal = userDoc.data()?.balance || 0;
        if (currentBal >= cost) {
          hasFunds = true;
          t.update(userRef, { balance: currentBal - cost, updatedAt: new Date().getTime() });
        }
      });

      if (!hasFunds) {
        toast.error("Insufficient balance. Please add funds.");
        setIsBuying(false);
        return;
      }

      // 2. Call backend proxy to get a number
      const res = await fetch("/api/buy-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          grizzlyCountryId: selectedCountry.grizzlyId,
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        
        // 3. Rollback balance
        await runTransaction(db, async (t) => {
           const uDoc = await t.get(userRef);
           if (uDoc.exists()) {
             t.update(userRef, { balance: (uDoc.data()?.balance || 0) + cost, updatedAt: new Date().getTime() });
           }
        });

        if (errText === "NO_NUMBERS") {
          toast.error("No numbers available for this country/service currently.");
        } else if (errText === "NO_BALANCE") {
          toast.error("Platform API Balance exhausted. Please contact admin.");
        } else {
          toast.error("Error: " + errText);
        }
        setIsBuying(false);
        return;
      }

      const { number, grizzlyId } = await res.json();

      // 4. Create Session 
      const sessionRef = doc(collection(db, "sessions"));
      await setDoc(sessionRef, {
        userId: auth.currentUser.uid,
        grizzlyId: grizzlyId,
        number: number,
        service: selectedService.name,
        serviceCode: selectedService.id,
        country: selectedCountry.name,
        cost: cost,
        status: "active",
        createdAt: new Date().getTime(),
        expiresAt: new Date().getTime() + 20 * 60 * 1000 // 20 mins
      });

      toast.success("Number rented successfully!");
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Something went wrong.");
    } finally {
      setIsBuying(false);
    }
  };

  const filteredCountries = React.useMemo(() => countries.filter(c => c.name.toLowerCase().includes(searchCountry.toLowerCase())), [countries, searchCountry]);
  const filteredServices = React.useMemo(() => services.filter(s => s.name.toLowerCase().includes(searchService.toLowerCase())), [services, searchService]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 border-b border-slate-200 pb-4">Rent a Number</h1>
        <div className="flex items-center gap-4 pt-4 mb-2">
          <button 
            className={`pb-2 px-1 font-bold text-sm border-b-2 transition-colors focus:outline-none ${!showOtherCountries ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`} 
            onClick={() => setShowOtherCountries(false)}
          >
            USA
          </button>
          <button 
            className={`pb-2 px-1 font-bold text-sm border-b-2 transition-colors focus:outline-none ${showOtherCountries ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"}`} 
            onClick={() => setShowOtherCountries(true)}
          >
            Other Countries
          </button>
        </div>
        <p className="text-slate-500 mt-2 text-sm">
          {!showOtherCountries 
            ? "Displaying available services for USA. Select one to rent a number instantly."
            : "Select a country and service to instantly rent a number."}
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {favorites.length > 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50/50 rounded-xl shadow-sm border border-indigo-100 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold flex items-center gap-1.5 text-indigo-900 uppercase tracking-wider">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Quick Rent Favorites
                </h2>
                <div className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                  {favorites.length}/6 MAX
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {favorites.map((fav, i) => (
                  <button
                    key={`${fav.country.grizzlyId}-${fav.service.id}-${i}`}
                    onClick={() => {
                      setSelectedCountry(fav.country);
                      setSelectedService(fav.service);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="relative flex items-center justify-center w-12 h-12 rounded-full border border-indigo-100 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white hover:scale-105 hover:shadow hover:border-indigo-200 transition-all group shrink-0"
                    title={`${fav.service.name} in ${fav.country.name}`}
                  >
                    <ServiceLogo code={fav.service.id} name={fav.service.name} className="h-7 w-7 text-[8px]" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-xs border border-slate-100 text-[10px] leading-none overflow-hidden">
                      {renderFlag(fav.country.iso, fav.country.name)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showOtherCountries && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900">
                <MapPin className="h-5 w-5 text-indigo-600" /> 1. Select Country
              </h2>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search countries..."
                  className="pl-9 border-slate-200 rounded-lg text-base bg-slate-50"
                  value={searchCountry}
                  onChange={e => setSearchCountry(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[200px] border border-slate-200 bg-white rounded-lg p-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {isLoadingCountries ? (
                    <div className="col-span-full flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-indigo-600" /></div>
                  ) : (
                    <>
                      {filteredCountries.slice(0, visibleCountryCount).map(country => (
                        <button
                          key={country.grizzlyId}
                          onClick={() => setSelectedCountry(country)}
                          className={`flex items-center gap-2 p-3 rounded-md border text-left transition-colors ${
                            selectedCountry?.grizzlyId === country.grizzlyId
                              ? "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm"
                              : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          {renderFlag(country.iso, country.name)}
                          <span className="text-sm font-bold truncate text-slate-800">{country.name}</span>
                        </button>
                      ))}
                      {filteredCountries.length > visibleCountryCount && (
                        <div className="col-span-full pt-2">
                          <Button
                            variant="outline"
                            className="w-full border-dashed text-slate-500 hover:text-slate-700"
                            onClick={() => setVisibleCountryCount(prev => prev + 30)}
                          >
                            Load more countries
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900">
              <MessageSquare className="h-5 w-5 text-indigo-600" /> {!showOtherCountries ? "1" : "2"}. Select Service {selectedCountry ? <span className="inline-flex items-center gap-1.5 font-bold">({renderFlag(selectedCountry.iso, selectedCountry.name)} {selectedCountry.name})</span> : ""}
            </h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search services..."
                className="pl-9 border-slate-200 rounded-lg text-base bg-slate-50"
                value={searchService}
                onChange={e => setSearchService(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[240px] border border-slate-200 bg-white rounded-lg p-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {isLoadingServices ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-8">
                     <Loader2 className="animate-spin h-6 w-6 text-indigo-600 mb-2" />
                     <span className="text-xs text-slate-500">Fetching prices...</span>
                  </div>
                ) : (
                  <>
                    {filteredServices.slice(0, visibleServiceCount).map(service => (
                      <button
                        key={service.id}
                        onClick={() => setSelectedService(service)}
                        className={`flex flex-col gap-2 p-3 rounded-md border text-left transition-colors ${
                          selectedService?.id === service.id
                            ? "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm"
                            : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 w-full min-w-0">
                          <ServiceLogo code={service.id} name={service.name} className="h-10 w-10 md:h-12 md:w-12 text-lg" />
                          <span className="text-sm font-bold text-slate-800 truncate">{service.name}</span>
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-xs font-semibold ${selectedService?.id === service.id ? "text-indigo-600" : "text-slate-500"}`}>
                            {formatCentsToNGN(calculatePrice(service.grizzlyCost))}
                          </span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5">{service.count}</span>
                        </div>
                      </button>
                    ))}
                    {filteredServices.length > visibleServiceCount && (
                      <div className="col-span-full pt-2">
                        <Button
                          variant="outline"
                          className="w-full border-dashed text-slate-500 hover:text-slate-700"
                          onClick={() => setVisibleServiceCount(prev => prev + 30)}
                        >
                          Load more services
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow-md border border-slate-200 sticky top-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Order Summary</h2>
              {selectedCountry && selectedService && (
                <button 
                  onClick={() => {
                    const exists = favorites.find(f => f.country.grizzlyId === selectedCountry.grizzlyId && f.service.id === selectedService.id);
                    let newFavs = [...favorites];
                    if (exists) {
                      newFavs = newFavs.filter(f => !(f.country.grizzlyId === selectedCountry.grizzlyId && f.service.id === selectedService.id));
                      toast.success("Removed from quick rent.");
                    } else {
                      if (newFavs.length >= 6) {
                        toast.error("You can only have up to 6 Quick Rent favorites.");
                        return;
                      }
                      newFavs.push({ country: selectedCountry, service: selectedService });
                      toast.success("Saved to quick rent.");
                    }
                    setFavorites(newFavs);
                    localStorage.setItem("grizzly-favorites", JSON.stringify(newFavs));
                  }}
                  className={`p-1 rounded-md transition-colors ${favorites.find(f => f.country.grizzlyId === selectedCountry.grizzlyId && f.service.id === selectedService.id) ? 'text-yellow-500 bg-yellow-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                  title="Toggle Favorite"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={favorites.find(f => f.country.grizzlyId === selectedCountry.grizzlyId && f.service.id === selectedService.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
              )}
            </div>
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-200">
                <div className="text-slate-500 text-sm font-bold uppercase">Country</div>
                <div className="font-medium flex items-center gap-2 text-slate-900">
                  {selectedCountry ? <div className="flex items-center gap-1.5">{renderFlag(selectedCountry.iso, selectedCountry.name)} <span>{selectedCountry.name}</span></div> : "..."}
                </div>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-200">
                <div className="text-slate-500 text-sm font-bold uppercase">Service</div>
                <div className="font-medium flex items-center gap-2 text-slate-900">
                  {selectedService ? (
                    <div className="flex items-center gap-2">
                      <ServiceLogo code={selectedService.id} name={selectedService.name} className="h-8 w-8 md:h-10 md:w-10 text-base" />
                      <span>{selectedService.name}</span>
                    </div>
                  ) : "..."}
                </div>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-200">
                <div className="text-slate-500 text-sm font-bold uppercase">Rental Period</div>
                <div className="font-medium text-slate-900">20 mins</div>
              </div>
              
              <div className="flex flex-col pt-2">
                <div className="flex justify-between items-end">
                  <div className="text-sm font-bold uppercase text-slate-500">Total</div>
                  <div className="text-3xl font-bold tracking-tight text-slate-900">{formatCentsToNGN(currentPrice)}</div>
                </div>
                {selectedService && (
                  <div className="flex justify-end mt-1">
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded px-2 py-0.5 border border-slate-200">
                      Raw Grizzly Cost: ${Number(selectedService.grizzlyCost).toFixed(3)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 bg-slate-50/80 p-6 border-t border-slate-100">
              <Button className="w-full h-12 text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={handleBuy} disabled={isBuying || !selectedCountry || !selectedService}>
                {isBuying ? "Processing..." : "Get Number"}
                {!isBuying && <CreditCard className="ml-2 h-4 w-4" />}
              </Button>
              <div className="text-xs text-center text-slate-500 flex items-center justify-center gap-1 font-medium mt-1">
                <Shield className="h-3 w-3 text-emerald-500" /> Secure transaction via balance
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
