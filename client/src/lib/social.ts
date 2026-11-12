import { actionCreators } from "@near-js/transactions";
import { rpcFetch, SOCIAL } from "./config";
import type { Tx } from "./near/contracts";

export async function accountExists(account: string) {
  const res = await rpcFetch({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "pakt", method: "query", params: { request_type: "view_account", finality: "final", account_id: account } }),
  });
  const r = await res.json();
  return !!r.result && !r.error;
}

/** near social post that @mentions each invitee, so it lands in their notifications */
export function inviteTx(me: string, invitees: string[], pakt: string, link: string): Tx {
  const text = `${invitees.map((a) => `@${a}`).join(" ")} join my pakt "${pakt}" on Pakt. We pool funds and vote in a pakter who trades but can never withdraw. ${link}`;
  const item = { type: "social", path: `${me}/post/main` };
  const data = {
    [me]: {
      post: { main: JSON.stringify({ type: "md", text }) },
      index: {
        post: JSON.stringify({ key: "main", value: { type: "md" } }),
        notify: JSON.stringify(invitees.map((key) => ({ key, value: { type: "mention", item } }))),
      },
    },
  };
  // covers social storage for the post; unused deposit stays in the sender's social balance
  return { receiverId: SOCIAL, actions: [actionCreators.functionCall("set", { data }, BigInt(100_000_000_000_000), BigInt("20000000000000000000000"))] };
}
