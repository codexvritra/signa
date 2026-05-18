import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const rpcs = [
  "https://cloudflare-eth.com",
  "https://eth.public-rpc.com",
  "https://rpc.ankr.com/eth",
  "https://ethereum.publicnode.com",
];

const names = ["vitalik.eth", "jesse.base.eth"];

for (const rpc of rpcs) {
  console.log(`\n=== RPC: ${rpc} ===`);
  const client = createPublicClient({ chain: mainnet, transport: http(rpc) });
  for (const name of names) {
    const t0 = Date.now();
    try {
      const norm = normalize(name);
      const addr = await client.getEnsAddress({ name: norm });
      console.log(
        `  ${name} → ${addr ?? "null"}  (${Date.now() - t0}ms)`,
      );
    } catch (e) {
      console.log(
        `  ${name} → ERROR: ${e instanceof Error ? e.message.slice(0, 120) : e}  (${Date.now() - t0}ms)`,
      );
    }
  }
}
