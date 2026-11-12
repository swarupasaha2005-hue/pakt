"use client";

import { useState, type ReactNode } from "react";
import { CreatePaktButton } from "@/components/shell/CreatePaktButton";
import { InfoIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { openTour } from "@/components/tour/Tour";
import { DEX, FACTORY, ORACLE, SPUTNIK } from "@/lib/config";
import { LOGOS } from "@/lib/home/data";

const W = 240, H = 60; // node box, px
const X = [0, 310, 620]; // column lefts; diagram is 860 wide
const IN = (x: number) => x, OUT = (x: number) => x + W;

type N = { x: number; y: number; h?: number; icon?: ReactNode; title: string; id: string; hl?: boolean; children?: ReactNode };

function Node({ x, y, h = H, icon, title, id, hl, children }: N) {
  return (
    <div
      style={{ left: x, top: y, width: W, height: h }}
      className={`absolute flex animate-fade-in flex-col justify-center gap-1 rounded-2xl border px-3 ${hl ? "items-center border-text-3 bg-panel-2 text-center" : "bg-panel-2"}`}
    >
      <span className="flex items-center gap-2">
        {icon && <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full">{icon}</span>}
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm leading-5 font-medium">{title}</span>
          <span className="truncate text-[10px] leading-3 text-text-3">{id}</span>
        </span>
      </span>
      {children}
    </div>
  );
}

/** method label on an edge, centered at (x, y) */
const Call = ({ x, y, children }: { x: number; y: number; children: ReactNode }) => (
  <span style={{ left: x, top: y }} className="absolute -translate-1/2 rounded-md border bg-panel px-1.5 py-0.5 text-[10px] leading-3 whitespace-nowrap text-text-2">
    {children}
  </span>
);

const logo = (src: string, alt: string) => (
  // eslint-disable-next-line @next/next/no-img-element -- static logo
  <img src={src} alt={alt} className="size-full object-cover" />
);
// cubic from (x1,y1) to (x2,y2) bending at the horizontal midpoint
const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;


/** (i) button: technical diagram of the contracts and calls behind a pakt */
export function HowItWorks() {
  const [open, setOpen] = useState(false);
  const vault = { y: 96, h: 108 }, vmid = vault.y + vault.h / 2;
  const member = 20 + H / 2, trader = 220 + H / 2, dex = 0 + H / 2, oracle = 120 + H / 2, dao = 240 + H / 2;
  return (
    <>
      <button
        type="button"
        aria-label="How Pakt works"
        onClick={() => setOpen(true)}
        data-tour="help"
        className="flex size-12 items-center justify-center rounded-xl text-text-2 transition hover:bg-panel-2 hover:text-text"
      >
        <InfoIcon className="size-5" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} label="How Pakt works" width="w-[920px]">
        <div className="overflow-hidden rounded-xl border bg-bg py-6">
          <div className="relative mx-auto h-[300px] w-[860px]">
            <svg aria-hidden className="absolute inset-0 size-full text-text-3" fill="none" stroke="currentColor" strokeWidth={1.5}>
              {[
                curve(OUT(X[0]), member, IN(X[1]), vmid - 30),
                curve(OUT(X[0]), trader, IN(X[1]), vmid + 30),
                curve(OUT(X[1]), vmid - 30, IN(X[2]), dex),
                curve(IN(X[2]), oracle, OUT(X[1]), vmid),
                curve(IN(X[2]), dao, OUT(X[1]), vmid + 30),
              ].map((d) => (
                <path key={d} d={d} strokeDasharray="6 6" className="animate-dash motion-reduce:animate-none" />
              ))}
            </svg>
            <Node x={X[0]} y={20} icon={logo(LOGOS.tNEAR, "NEAR")} title="Member" id="NEAR wallet · tUSDC" />
            <Node x={X[0]} y={220} title="Trader" id="hired account" />
            <Node x={X[1]} y={vault.y} h={vault.h} hl title="Vault" id={`<name>.${FACTORY}`}>
              <span className="flex flex-wrap justify-center gap-1 pt-1">
                {["shares", "HWM", "caps", "stop-loss"].map((t) => (
                  <span key={t} className="rounded bg-chip px-1 text-[10px] leading-4 font-medium text-text-2">{t}</span>
                ))}
              </span>
            </Node>
            <Node x={X[2]} y={0} icon={logo("/tokens/ref.svg", "Ref Finance")} title="Ref Finance" id={DEX} />
            <Node x={X[2]} y={120} title="Price oracle" id={ORACLE} />
            <Node x={X[2]} y={240} icon={logo("/tokens/sputnik.svg", "Sputnik DAO")} title="Sputnik DAO" id={`<name>.${SPUTNIK}`} />
            <Call x={275} y={(member + vmid - 30) / 2}>ft_transfer_call</Call>
            <Call x={275} y={(trader + vmid + 30) / 2}>trade()</Call>
            <Call x={585} y={(dex + vmid - 30) / 2}>swap</Call>
            <Call x={585} y={(oracle + vmid) / 2 - 12}>prices</Call>
            <Call x={585} y={(dao + vmid + 30) / 2 + 6}>offer · fire · set_cap</Call>
          </div>
        </div>
        <div className="px-2 pt-5">
          <h2 className="text-lg font-medium">How Pakt works</h2>
          <p className="mt-1 max-w-[640px] text-sm text-text-2">
            Members pool tUSDC into a vault and get shares. Their DAO hires a trader, who can only swap on Ref within the caps the pakt set. A stop-loss
            pauses trading, and the trader earns a fee only on profit above the high-water mark. Anyone can leave anytime with their share.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2 px-2">
          <Button onClick={() => { setOpen(false); openTour(); }} className="text-sm! font-medium!">Site tour</Button>
          <CreatePaktButton label="Create a pakt" />
        </div>
      </Modal>
    </>
  );
}
