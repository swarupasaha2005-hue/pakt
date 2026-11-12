import type { Metadata } from "next";
import { Suspense } from "react";
import { TokenView } from "@/components/token/TokenView";
import Loading from "./loading";

// symbol is matched case-insensitively against config TOKENS inside the client view
async function Token({ params }: Pick<PageProps<"/token/[symbol]">, "params">) {
  const { symbol } = await params;
  return <TokenView key={symbol} symbol={symbol} />;
}

export async function generateMetadata({ params }: PageProps<"/token/[symbol]">): Promise<Metadata> {
  const symbol = (await params).symbol.toUpperCase();
  return { title: `${symbol} price`, description: `Live ${symbol} oracle price, chart and the pakts holding it on Pakt.`, alternates: { canonical: `/token/${symbol.toLowerCase()}` } };
}

export default function TokenPage({ params }: PageProps<"/token/[symbol]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Token params={params} />
    </Suspense>
  );
}
