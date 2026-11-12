import type { Holding } from "./holdings";
import type { Settlement } from "./settlements";
import type { Vote } from "./votes";

type PaktSession = { votes: Vote[]; settlements: Settlement[]; hwm: number; assets: Holding[] };
const key = (id: string) => `pakt:workflow:${id}`;

export function loadPaktSession(id: string): PaktSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(key(id)) ?? "null") as PaktSession | null;
    return value && Array.isArray(value.votes) && Array.isArray(value.settlements) && Array.isArray(value.assets) && Number.isFinite(value.hwm) ? value : null;
  } catch {
    return null;
  }
}

export function savePaktSession(id: string, value: PaktSession) {
  try {
    localStorage.setItem(key(id), JSON.stringify(value));
  } catch {
    return false;
  }
  return true;
}
