"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "next/navigation";
import { me } from "@/lib/mock/me";
import { hasFinishedOnboarding } from "@/lib/profile";

type Session = {
  connected: boolean;
  requestConnect: () => void;
  disconnect: () => void;
};

const SessionContext = createContext<Session | null>(null);
const SESSION_KEY = "pakt:session";
const SESSION_EVENT = "pakt:session-change";

function subscribeSession(onChange: () => void) {
  window.addEventListener(SESSION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SESSION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isConnected() {
  return localStorage.getItem(SESSION_KEY) === "connected";
}

function saveSession(connected: boolean) {
  localStorage.setItem(SESSION_KEY, connected ? "connected" : "guest");
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function MockSessionProvider({ children }: { children: ReactNode }) {
  const connected = useSyncExternalStore(subscribeSession, isConnected, () => false);
  const [promptOpen, setPromptOpen] = useState(false);
  const router = useRouter();

  const requestConnect = useCallback(() => setPromptOpen(true), []);
  const disconnect = useCallback(() => saveSession(false), []);
  const value = useMemo<Session>(() => ({
    connected,
    requestConnect,
    disconnect,
  }), [connected, disconnect, requestConnect]);

  function connectDemo() {
    saveSession(true);
    setPromptOpen(false);
    if (!hasFinishedOnboarding(me.account)) router.push(`/u/${me.account}?onboard=1`);
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
      <Modal open={promptOpen && !connected} onClose={() => setPromptOpen(false)} label="Connect wallet">
        <h2 className="text-xl font-bold">Connect wallet</h2>
        <p className="mt-2 text-xs text-text-2">Continue as nova.near in the local demo. Wallet signing is not connected yet.</p>
        <Button variant="primary" size="lg" className="mt-4 w-full" onClick={connectDemo}>
          Continue as nova.near
        </Button>
      </Modal>
    </SessionContext.Provider>
  );
}

export function useMockSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useMockSession needs MockSessionProvider");
  return session;
}
