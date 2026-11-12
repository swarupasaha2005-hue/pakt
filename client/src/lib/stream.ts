"use client";

// One shared /stream socket per tab: the backend caps sockets per ip at 5.
import { useEffect, useRef } from "react";
import type { PaktEvent } from "./api";
import { WS_URL } from "./config";

type Sub = (e: PaktEvent) => void;
const subs = new Set<Sub>();
let ws: WebSocket | null = null;
let ping: ReturnType<typeof setInterval> | undefined;
let retry = 0;

function connect() {
  if (ws || !subs.size) return;
  const s = (ws = new WebSocket(WS_URL));
  s.onopen = () => {
    retry = 0;
    ping = setInterval(() => s.send("ping"), 60_000); // server drops sockets idle 120s
  };
  s.onmessage = (m) => {
    if (m.data === "pong") return;
    try {
      const e = JSON.parse(m.data) as PaktEvent;
      subs.forEach((f) => f(e));
    } catch {
      // not json: ignore
    }
  };
  s.onclose = () => {
    clearInterval(ping);
    ws = null;
    if (subs.size) setTimeout(connect, Math.min(30_000, 1_000 * 2 ** retry++));
  };
}

/** calls onEvent for every new indexed event; filter by e.vault / e.kind in the callback */
export function useStream(onEvent: Sub) {
  const ref = useRef(onEvent);
  useEffect(() => {
    ref.current = onEvent;
  });
  useEffect(() => {
    const f: Sub = (e) => ref.current(e);
    subs.add(f);
    connect();
    return () => {
      subs.delete(f);
      if (!subs.size) ws?.close();
    };
  }, []);
}
