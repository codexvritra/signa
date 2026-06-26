// Recon: are there real B20 launches on Base yet? Scan recent B20Created events.
import { createPublicClient, http, parseAbiItem } from "viem";
import { base } from "viem/chains";

const FACTORY = "0xB20f000000000000000000000000000000000000";
const EVENT = parseAbiItem("event B20Created(address indexed token, uint8 indexed variant, string name, string symbol, uint8 decimals, bytes variantEventParams)");
const RPCS = [process.env.BASE_RPC_URL, "https://mainnet.base.org", "https://base.llamarpc.com"].filter(Boolean);

for (const url of RPCS) {
  try {
    const c = createPublicClient({ chain: base, transport: http(url) });
    const latest = await c.getBlockNumber();
    console.log(`RPC ${url} — latest block ${latest}`);
    let found = [];
    // scan back in 9000-block chunks (public RPC range cap), up to ~63k blocks (~1.5 days)
    for (let i = 0; i < 7 && found.length < 12; i++) {
      const toB = latest - BigInt(i * 9000);
      const fromB = toB - 8999n;
      try {
        const logs = await c.getLogs({ address: FACTORY, event: EVENT, fromBlock: fromB, toBlock: toB });
        if (logs.length) {
          for (const l of logs) found.push({ token: l.args.token, name: l.args.name, symbol: l.args.symbol, variant: Number(l.args.variant), block: Number(l.blockNumber) });
        }
        process.stdout.write(`  scanned ${fromB}-${toB}: ${logs.length}\n`);
      } catch (e) { process.stdout.write(`  range ${fromB}-${toB} err: ${String(e).slice(0, 60)}\n`); }
    }
    console.log(`\nTOTAL B20 launches found (recent window): ${found.length}`);
    console.log(JSON.stringify(found.slice(0, 12), null, 2));
    process.exit(0);
  } catch (e) { console.log(`RPC ${url} failed: ${String(e).slice(0, 80)}`); }
}
console.log("no RPC worked");
