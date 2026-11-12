import { ExternalIcon } from "@/components/ui/icons";
import type { TxState } from "@/lib/pakt/tx";
import { nearblocks } from "@/lib/pakt/units";

/** wallet prompt / failure / explorer link under an action button */
export function TxStatus({ pending, error, hash, sponsored, done = "Done" }: TxState & { done?: string }) {
  if (pending) return <p className="mt-2 text-center text-xs text-text-2">Approve in your wallet, then it confirms on chain…</p>;
  if (error) return <p role="alert" className="mt-2 text-center text-xs break-words text-down">{error}</p>;
  if (!hash) return null;
  return (
    <a href={nearblocks(hash)} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-1 text-xs text-up hover:underline">
      {done}{sponsored && " · gas on us"} · view tx <ExternalIcon className="size-3" />
    </a>
  );
}
