import { RightPanel } from "@/components/shell/RightPanel";

// shortcut: placeholder home, full §18 table lands in its own issue
export default function Home() {
  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
        <div className="flex h-[62px] w-fit items-center rounded-2xl border px-3 text-[15px] text-text-3">
          Star assets to pin them here
        </div>
        <section className="flex-1 rounded-2xl border bg-panel p-4">
          <h1 className="text-xl font-semibold">Discover</h1>
        </section>
      </main>
      <RightPanel>
        <h2 className="p-4 text-xl">Your positions</h2>
        <p className="pt-6 text-center text-[15px] text-text-2">No open positions</p>
      </RightPanel>
    </>
  );
}
