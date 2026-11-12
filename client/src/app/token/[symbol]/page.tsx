import { Suspense } from "react";
import { TokenView } from "@/components/token/TokenView";
import Loading from "./loading";

// symbol is matched case-insensitively against config TOKENS inside the client view
async function Token({ params }: Pick<PageProps<"/token/[symbol]">, "params">) {
  const { symbol } = await params;
  return <TokenView key={symbol} symbol={symbol} />;
}

export default function TokenPage({ params }: PageProps<"/token/[symbol]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Token params={params} />
    </Suspense>
  );
}
