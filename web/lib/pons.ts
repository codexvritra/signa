/**
 * Pons launch client (Robinhood Chain mainnet) — lets Sigda construct a
 * "launch a token" transaction directly against Pons's own factory, so a
 * user's wallet signs and sends it with no redirect to ponsfamily.com.
 *
 * Pons has no creation API; the ABI here is the verified source pulled
 * straight from Blockscout for the exact factory address a real, currently
 * live launch's TokenLaunched event pointed to (docs.ponsfamily.com/v2
 * describes an older/different factory address — don't trust it alone).
 * Nothing here is custodial: the connected wallet signs and pays for its
 * own launch tx; Sigda never holds funds or keys.
 */
import { getAddress, keccak256, encodeFunctionData, decodeEventLog, parseAbi, type Address } from "viem";
import { rhClient } from "./chain";

// PonsV2LaunchFactory — verified source at contracts/src/v2/PonsV2LaunchFactory.sol
// on Blockscout. Confirmed live: this is the factory ponsfamily.com/launchpad
// itself calls today (traced from a real recent launch's on-chain event, not
// from docs alone — an earlier factory address found via docs turned out to
// be Pons's deprecated v1 contract with a completely different ABI).
export const PONS_FACTORY = getAddress("0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e");
export const NATIVE_PAIR = "0x0000000000000000000000000000000000000000" as Address;
export const DEFAULT_LAUNCH_CONFIG_ID = 0n; // the only config today (launchConfigCount() == 1), native-ETH pair, 4.2 ETH graduation

// Read live from launchFee()/maxCreatorTaxBps() at launch time; these are display fallbacks.
export const PONS_LAUNCH_FEE_WEI_FALLBACK = 500000000000000n; // 0.0005 ETH, confirmed live
export const PONS_MAX_CREATOR_TAX_BPS_FALLBACK = 1000; // 10%, confirmed live via maxCreatorTaxBps()

// Sigda's revenue share on every token launched through this page.
export const SIGDA_FEE_RECIPIENT = getAddress("0x793dfea91973128b21dccc4454cf488c3d01be87");
export const DEFAULT_CREATOR_TAX_BPS = 200; // 2% — confirmed accepted live, well under the 10% cap

const PONS_ABI = parseAbi([
  "struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }",
  "struct TokenParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt; }",
  "function launchToken(TokenParams params, uint256 launchConfigId, address pairToken) payable returns (address token, address curve)",
  "function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)",
  "function launchFee() view returns (uint256)",
  "function maxCreatorTaxBps() view returns (uint256)",
  "function launchConfigCount() view returns (uint256)",
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
]);

export type Socials = { twitter?: string; telegram?: string; discord?: string; website?: string; farcaster?: string };
export type LaunchInput = {
  name: string;
  symbol: string;
  logo?: string;
  description?: string;
  socials?: Socials;
  creatorTaxBps?: number;
  buybackEnabled?: boolean;
};

export async function liveLaunchFeeWei(): Promise<bigint> {
  try {
    return (await rhClient().readContract({ address: PONS_FACTORY, abi: PONS_ABI, functionName: "launchFee" })) as bigint;
  } catch {
    return PONS_LAUNCH_FEE_WEI_FALLBACK;
  }
}

/** Anti-frontrun commitment Pons wants fresh at submit time — read right before building the tx. */
export async function previewEconomics(launchConfigId: bigint, pairToken: Address): Promise<`0x${string}`> {
  return (await rhClient().readContract({ address: PONS_FACTORY, abi: PONS_ABI, functionName: "previewLaunchEconomics", args: [launchConfigId, pairToken] })) as `0x${string}`;
}

export function randomSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return keccak256(bytes);
}

/** Builds the full launchToken() calldata — call previewEconomics() fresh right before this. */
export function buildPonsLaunchCalldata(input: LaunchInput, launchConfigId: bigint, pairToken: Address, expectedEconomics: `0x${string}`, salt: `0x${string}`): `0x${string}` {
  const params = {
    name: input.name,
    symbol: input.symbol,
    logo: input.logo ?? "",
    description: input.description ?? "",
    socials: {
      twitter: input.socials?.twitter ?? "",
      telegram: input.socials?.telegram ?? "",
      discord: input.socials?.discord ?? "",
      website: input.socials?.website ?? "",
      farcaster: input.socials?.farcaster ?? "",
    },
    creatorFeeRecipient: SIGDA_FEE_RECIPIENT,
    creatorTaxBps: input.creatorTaxBps ?? DEFAULT_CREATOR_TAX_BPS,
    buybackEnabled: input.buybackEnabled ?? false,
    expectedEconomics,
    salt,
  };
  return encodeFunctionData({ abi: PONS_ABI, functionName: "launchToken", args: [params, launchConfigId, pairToken] });
}

export type PonsLaunchReceipt = { token: string; curve: string; deployer: string; pairToken: string; launchConfigId: string; graduationThreshold: string };

/** Decode the TokenLaunched event out of a launch tx's receipt. */
export async function tokenFromLaunchReceipt(txHash: `0x${string}`): Promise<PonsLaunchReceipt | null> {
  const receipt = await rhClient().getTransactionReceipt({ hash: txHash });
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== PONS_FACTORY.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: PONS_ABI, eventName: "TokenLaunched", topics: log.topics, data: log.data }) as any;
      return {
        token: String(decoded.args.token).toLowerCase(),
        curve: String(decoded.args.curve).toLowerCase(),
        deployer: String(decoded.args.deployer).toLowerCase(),
        pairToken: String(decoded.args.pairToken).toLowerCase(),
        launchConfigId: String(decoded.args.launchConfigId),
        graduationThreshold: String(decoded.args.graduationThreshold),
      };
    } catch { continue; }
  }
  return null;
}
