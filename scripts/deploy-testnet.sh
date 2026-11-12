#!/usr/bin/env bash
# Testnet demo: oracle, mock tokens at mainnet decimals, ref pools at the Pyth price, pakt factory.
# Dry run by default (prints every near-cli-rs 0.31 command). `--execute` runs them; `--reseed [--execute]` re-centres the pools.
set -euo pipefail
cd "$(dirname "$0")/../contracts"

OWNER=${OWNER:-pakt-0mxhjh.testnet}
REPORTER=${REPORTER:-pakt-83p1jb.testnet}
PLATFORM=${PLATFORM:-pakt-fees.testnet}
REF=ref-finance-101.testnet
SPUTNIK=sputnikv2.testnet
TESTNET_RPC=${TESTNET_RPC:-https://rpc.testnet.fastnear.com}
HERMES_URL=${HERMES_URL:-https://hermes.pyth.network} # used when HERMES_API_KEY is set, else keyless CoinGecko
COINGECKO_URL=${COINGECKO_URL:-https://api.coingecko.com}
SEED_USD=${SEED_USD:-20000} # per pool side; a $100 trade then moves price ~0.5%, inside the vault's 2% floor
STATE=deployments/testnet-demo.env

EXECUTE=0 RESEED=0
for a in "$@"; do
  case $a in --execute) EXECUTE=1 ;; --reseed) RESEED=1 ;; *) echo "usage: $0 [--reseed] [--execute]" >&2; exit 2 ;; esac
done

ORACLE=oracle.$OWNER FACTORY=pakt.$OWNER
TUSDC=tusdc.$OWNER TBTC=tbtc.$OWNER TNEAR=tnear.$OWNER
# pyth feeds (checked on hermes /v2/price_feeds); token decimals match mainnet: 6, 8, 24
F_USDC=eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a
F_BTC=e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
F_NEAR=c415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750
C_USDC=usd-coin C_BTC=bitcoin C_NEAR=near
NET=(network-config testnet sign-with-legacy-keychain send)

run() {
  printf '%q ' near "$@"
  echo
  if [ "$EXECUTE" = 1 ]; then near "$@"; fi
}
create() { run account create-account fund-myself "$1" "$2 NEAR" autogenerate-new-keypair save-to-legacy-keychain sign-as "$OWNER" "${NET[@]}"; }
deploy() { run contract deploy "$1" use-file "$2" with-init-call new json-args "$3" prepaid-gas '100 Tgas' attached-deposit '0 NEAR' "${NET[@]}"; }
call() { run contract call-function as-transaction "$2" "$3" json-args "$4" prepaid-gas "${6:-30 Tgas}" attached-deposit "$5" sign-as "$1" "${NET[@]}"; }

rpc() { curl -sf "$1" -H content-type:application/json -d "$2"; }
view() {
  local args
  args=$(printf %s "$4" | base64 | tr -d '\n')
  rpc "$1" "$(jq -nc --arg a "$2" --arg m "$3" --arg b "$args" \
    '{jsonrpc:"2.0",id:1,method:"query",params:{request_type:"call_function",finality:"final",account_id:$a,method_name:$m,args_base64:$b}}')" |
    jq -r '.result.result | implode'
}
balance() { rpc "$TESTNET_RPC" "$(jq -nc --arg a "$1" '{jsonrpc:"2.0",id:1,method:"query",params:{request_type:"view_account",finality:"final",account_id:$a}}')" | jq -r '.result.amount // "0"'; }

# oracle prices "multiplier decimals" (usd = raw * m / 10^d): Pyth with HERMES_API_KEY, else CoinGecko.
# USDC_USD / BTC_USD / NEAR_USD override either
if [ -n "${HERMES_API_KEY:-}" ]; then
  SRC=pyth
  QUOTES=$(curl -sf -m 15 -H "authorization: Bearer $HERMES_API_KEY" \
    "$HERMES_URL/v2/updates/price/latest?ids%5B%5D=$F_USDC&ids%5B%5D=$F_BTC&ids%5B%5D=$F_NEAR&parsed=true" || echo '{"parsed":[]}')
else
  SRC=coingecko
  QUOTES=$(curl -sf -m 15 "$COINGECKO_URL/api/v3/simple/price?ids=$C_USDC,$C_BTC,$C_NEAR&vs_currencies=usd&include_last_updated_at=true&precision=full" || echo '{}')
fi
price() { # feed coin token_decimals override_usd; empty when missing, stale, wide or zero
  if [ -n "${4:-}" ]; then python3 -c "print(round($4 * 10**8), $3 + 8)"; return; fi
  python3 - "$SRC" "$QUOTES" "$1" "$2" "$3" <<'EOF'
import json, re, sys, time
src, body, feed, coin, dec = sys.argv[1:4] + sys.argv[4:5] + [int(sys.argv[5])]
b = json.loads(body, parse_float=str, parse_int=str)  # strings keep the exact printed digits
if src == "pyth":
    p = next((f["price"] for f in b.get("parsed", []) if f["id"] == feed), None)
    ok = p and time.time() - int(p["publish_time"]) <= 60 and int(p["conf"]) * 50 <= int(p["price"])
    q = (int(p["price"]), int(p["expo"])) if ok else None
else:  # no confidence band, slower refresh: 5 min staleness
    v = b.get(coin) or {}
    m = re.fullmatch(r"(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?", str(v.get("usd", "")))
    q = (int(m[1] + (m[2] or "")), int(m[3] or 0) - len(m[2] or "")) if m and time.time() - int(v.get("last_updated_at", 0)) <= 300 else None
if q and q[0] > 0:
    d = dec - q[1]
    print(q[0], d) if d >= 0 else print(q[0] * 10**-d, 0)
EOF
}
P_USDC=$(price $F_USDC $C_USDC 6 "${USDC_USD:-}")
P_BTC=$(price $F_BTC $C_BTC 8 "${BTC_USD:-}")
P_NEAR=$(price $F_NEAR $C_NEAR 24 "${NEAR_USD:-}")
if [ -z "$P_USDC" ] || [ -z "$P_BTC" ] || [ -z "$P_NEAR" ]; then
  echo "!! no fresh $SRC price for every token; set USDC_USD, BTC_USD, NEAR_USD to override" >&2
  if [ "$EXECUTE" = 1 ]; then exit 1; fi
  P_USDC=${P_USDC:-"0 14"} P_BTC=${P_BTC:-"0 16"} P_NEAR=${P_NEAR:-"0 32"}
fi
echo "# $SRC prices (multiplier decimals): usdc $P_USDC, btc $P_BTC, near $P_NEAR"
# raw amount worth $usd: usd * 10^decimals / multiplier
raw() { python3 -c "m,d=map(int,'$1'.split()); print(int($2) * 10**d // m if m else 0)"; }

# newest pool holding exactly [tusdc, $1] among the last 200
pool_of() {
  local n from
  n=$(view "$TESTNET_RPC" $REF get_number_of_pools '{}')
  from=$((n > 200 ? n - 200 : 0))
  view "$TESTNET_RPC" $REF get_pools "{\"from_index\":$from,\"limit\":200}" |
    jq -r --arg u "$TUSDC" --arg x "$1" --argjson f "$from" \
      '[to_entries[] | select(.value.token_account_ids == [$u, $x]) | .key + $f] | last // empty'
}

if [ "$RESEED" = 1 ]; then
  [ -f "$STATE" ] && . "$STATE"
  for pair in "$TBTC:${POOL_BTC:-}:$P_BTC" "$TNEAR:${POOL_NEAR:-}:$P_NEAR"; do
    IFS=: read -r x id px <<<"$pair"
    id=${id:-$(pool_of "$x")}
    [ -n "$id" ] || { echo "no pool for $x" >&2; exit 1; }
    amounts=$(view "$TESTNET_RPC" $REF get_pool "{\"pool_id\":$id}" | jq -r '.amounts | join(" ")')
    # constant product: target a'/b' = oracle ratio, a' = sqrt(a*b*r); swap the short side in (fee ignored)
    read -r tin amt drift < <(python3 - "$amounts" "$P_USDC" "$px" <<'EOF'
import sys
from fractions import Fraction as F
from math import isqrt
a, b = map(int, sys.argv[1].split()); um, ud = map(int, sys.argv[2].split()); xm, xd = map(int, sys.argv[3].split())
r = F(xm, 10**xd) / F(um, 10**ud)  # raw usdc per raw x
drift = float(F(a, b) / r - 1)
a2 = isqrt(int(a * b * r)); b2 = isqrt(int(F(a * b) / r))
print(*(("u", a2 - a) if a2 > a else ("x", b2 - b)), f"{drift:+.4f}")
EOF
)
    echo "# pool $id ($x): drift $drift"
    if python3 -c "import sys; sys.exit(abs($drift) < 0.005)"; then
      [ "$tin" = u ] && from=$TUSDC to=$x || from=$x to=$TUSDC
      msg="{\"actions\":[{\"pool_id\":$id,\"token_in\":\"$from\",\"token_out\":\"$to\",\"amount_in\":\"$amt\",\"min_amount_out\":\"0\"}]}"
      call "$OWNER" "$from" ft_transfer_call "$(jq -nc --arg r $REF --arg a "$amt" --arg m "$msg" '{receiver_id:$r,amount:$a,msg:$m}')" '1 yoctoNEAR' '100 Tgas'
    fi
  done
  exit 0
fi

# cost: code storage is 1e-5 NEAR/byte; each account gets its code plus 0.3 NEAR headroom
fund() { python3 -c "import os,math; print(math.ceil((os.path.getsize('$1') / 1e5 + 0.3) * 10) / 10)"; }
F_ORACLE=$(fund res/external/price_oracle.wasm) F_FT=$(fund res/pakt_mock_ft.wasm) F_FACTORY=$(fund res/pakt_factory.wasm)
REF_COST=0.65 # ref storage 0.1 + 2 pools 0.1 + 2 add_liquidity 0.1 + 3 ft regs, plus gas
TOTAL=$(python3 -c "print(round($F_ORACLE + 3 * $F_FT + $REF_COST + $F_FACTORY + 0.3, 2))") # +0.3 gas for ~25 txs
HAVE=$(python3 -c "print(round(int('$(balance "$OWNER")') / 1e24, 2))")
cat <<EOF
# cost estimate for $OWNER (NEAR)
#   (a) oracle account          $F_ORACLE
#   (b) 3 token accounts        $(python3 -c "print(round(3 * $F_FT, 2))")
#   (c) ref storage/pools/regs  $REF_COST
#   (d) factory account         $F_FACTORY
#   gas, ~25 txs                0.3
#   total                       $TOTAL   balance $HAVE
EOF
if python3 -c "import sys; sys.exit($HAVE >= $TOTAL)"; then
  echo "!! $OWNER needs $TOTAL NEAR, has $HAVE: top up before --execute" >&2
  if [ "$EXECUTE" = 1 ]; then exit 1; fi
fi

echo "# (a) oracle"
create "$ORACLE" "$F_ORACLE"
# recency 180s: relay reports each minute, 3 missed rounds -> vaults pause instead of using stale prices
deploy "$ORACLE" res/external/price_oracle.wasm "{\"recency_duration_sec\":180,\"owner_id\":\"$OWNER\",\"near_claim_amount\":\"0\"}"
call "$OWNER" "$ORACLE" add_oracle "{\"account_id\":\"$REPORTER\"}" '1 yoctoNEAR'

echo "# (b) tokens, minted to $OWNER"
for t in "$TUSDC tUSDC 6 1000000" "$TBTC tBTC 8 100" "$TNEAR tNEAR 24 1000000"; do
  read -r id sym dec units <<<"$t"
  create "$id" "$F_FT"
  deploy "$id" res/pakt_mock_ft.wasm "{\"owner\":\"$OWNER\",\"name\":\"$sym\",\"symbol\":\"$sym\",\"decimals\":$dec}"
  call "$OWNER" "$id" mint "{\"to\":\"$OWNER\",\"amount\":\"$(python3 -c "print($units * 10**$dec)")\"}" '0 NEAR'
  call "$OWNER" "$ORACLE" add_asset "{\"asset_id\":\"$id\"}" '1 yoctoNEAR'
  call "$OWNER" "$id" storage_deposit "{\"account_id\":\"$REF\"}" '0.00125 NEAR'
done

echo "# (c) ref pools at the Pyth price, \$$SEED_USD a side"
call "$OWNER" $REF storage_deposit '{}' '0.1 NEAR'
call "$OWNER" $REF register_tokens "{\"token_ids\":[\"$TUSDC\",\"$TBTC\",\"$TNEAR\"]}" '1 yoctoNEAR'
for pair in "$TBTC:$P_BTC:BTC" "$TNEAR:$P_NEAR:NEAR"; do
  IFS=: read -r x px name <<<"$pair"
  u=$(raw "$P_USDC" "$SEED_USD") o=$(raw "$px" "$SEED_USD")
  call "$OWNER" $REF add_simple_pool "{\"tokens\":[\"$TUSDC\",\"$x\"],\"fee\":30}" '0.1 NEAR'
  id='<pool id>'
  if [ "$EXECUTE" = 1 ]; then id=$(pool_of "$x"); echo "POOL_$name=$id" >>"$STATE"; fi
  for side in "$TUSDC $u" "$x $o"; do
    read -r tok amt <<<"$side"
    call "$OWNER" "$tok" ft_transfer_call "{\"receiver_id\":\"$REF\",\"amount\":\"$amt\",\"msg\":\"\"}" '1 yoctoNEAR' '100 Tgas'
  done
  call "$OWNER" $REF add_liquidity "{\"pool_id\":$id,\"amounts\":[\"$u\",\"$o\"]}" '0.1 NEAR'
done

echo "# (d) factory at $FACTORY: vaults become <name>.$FACTORY, apart from the oracle and tokens"
create "$FACTORY" "$F_FACTORY"
deploy "$FACTORY" res/pakt_factory.wasm "$(jq -nc --arg o "$OWNER" --arg or "$ORACLE" --arg p "$PLATFORM" --arg s $SPUTNIK --arg d $REF \
  --arg u "$TUSDC" --arg b "$TBTC" --arg n "$TNEAR" \
  '{owner:$o, config:{oracle:$or, platform:$p, sputnik_factory:$s, dao_bond:"100000000000000000000000",
    tokens:[$u,$b,$n], base_tokens:[$u], dex:$d, settle_period_ms:300000, trade_delay_ms:120000}}')"

echo "# (e) wrangler vars"
echo "PAKT_FACTORY=$FACTORY"
echo "PRICE_ORACLE=$ORACLE"
echo "PRICE_MAP=$(jq -nc --arg u "$TUSDC" --arg b "$TBTC" --arg n "$TNEAR" --arg fu $F_USDC --arg fb $F_BTC --arg fn $F_NEAR \
  --arg cu $C_USDC --arg cb $C_BTC --arg cn $C_NEAR '{($u):{pyth:$fu,coingecko:$cu,coinbase:"USDC-USD"},($b):{pyth:$fb,coingecko:$cb,coinbase:"BTC-USD"},($n):{pyth:$fn,coingecko:$cn,coinbase:"NEAR-USD"}}')"
echo "# secrets: HERMES_API_KEY (optional, switches the relay to Pyth), and"
echo "# jq -j '\"$REPORTER:\\(.private_key)\"' ~/.near-credentials/testnet/$REPORTER.json | wrangler secret put ORACLE_REPORTER  # near-cli-rs files have no account_id"
