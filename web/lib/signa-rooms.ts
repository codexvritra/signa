/**
 * SignaRooms — token-gated onchain group chat on Robinhood Chain. Your bag is your key.
 *
 * Anyone creates a room with an optional ERC-20 gate; posting to a gated room
 * requires holding the token, enforced on-chain. Every message is a readable
 * `RoomMessage` event — the chain is the index.
 *
 * Set SIGNA_ROOMS_ADDRESS (+ NEXT_PUBLIC_…) once redeployed to Robinhood Chain —
 * see contracts/script/DeployRooms.s.sol.
 */
import { createPublicClient, http, parseAbiItem, encodeFunctionData, keccak256, toBytes, type Address } from "viem";
import { rhChain, RH_RPC } from "./chain";

export const SIGNA_ROOMS_ADDRESS = (
  process.env.NEXT_PUBLIC_SIGNA_ROOMS_ADDRESS ||
  process.env.SIGNA_ROOMS_ADDRESS ||
  ""
).toLowerCase();

export const SIGNA_ROOMS_DEPLOY_BLOCK = BigInt(process.env.SIGNA_ROOMS_DEPLOY_BLOCK || 0);
export const SIGNA_ROOMS_LIVE = /^0x[0-9a-f]{40}$/.test(SIGNA_ROOMS_ADDRESS);

const ROOM_CREATED = parseAbiItem("event RoomCreated(bytes32 indexed roomId, address indexed creator, address gateToken, uint256 minBalance, string name)");
const ROOM_MESSAGE = parseAbiItem("event RoomMessage(uint256 indexed id, bytes32 indexed roomId, address indexed from, string body, uint64 timestamp)");
const ROOMS_ABI = [
  parseAbiItem("function createRoom(string name, address gateToken, uint256 minBalance) returns (bytes32)"),
  parseAbiItem("function post(bytes32 id, string body) returns (uint256)"),
  parseAbiItem("function canPost(bytes32 id, address who) view returns (bool)"),
] as const;

let _client: any = null;
function client(): any {
  if (!_client) _client = createPublicClient({ chain: rhChain, transport: http(RH_RPC) });
  return _client;
}

export type Room = { roomId: string; creator: string; gateToken: string; minBalance: string; name: string; block: string; gated: boolean };
export type RoomMsg = { id: string; roomId: string; from: string; body: string; timestamp: number; tx: string };

const ZERO = "0x0000000000000000000000000000000000000000";

/** Deterministic room id for a name (matches the contract's keccak256(bytes(name))). */
export function roomIdOf(name: string): `0x${string}` {
  return keccak256(toBytes(name));
}

/** Calldata to create a room. */
export function buildCreateRoomCalldata(name: string, gateToken: string, minBalance: bigint): `0x${string}` {
  return encodeFunctionData({ abi: ROOMS_ABI, functionName: "createRoom", args: [name, (gateToken || ZERO) as Address, minBalance] });
}

/** Calldata to post to a room. */
export function buildPostCalldata(roomId: string, body: string): `0x${string}` {
  return encodeFunctionData({ abi: ROOMS_ABI, functionName: "post", args: [roomId as `0x${string}`, body] });
}

/** All rooms, newest first — read from RoomCreated logs. */
export async function listRooms(limit = 100): Promise<Room[]> {
  if (!SIGNA_ROOMS_LIVE) return [];
  const logs = await client().getLogs({ address: SIGNA_ROOMS_ADDRESS as Address, event: ROOM_CREATED, fromBlock: SIGNA_ROOMS_DEPLOY_BLOCK, toBlock: "latest" });
  const out: Room[] = (logs as any[]).map((l) => ({
    roomId: String(l.args.roomId),
    creator: String(l.args.creator).toLowerCase(),
    gateToken: String(l.args.gateToken).toLowerCase(),
    minBalance: String(l.args.minBalance ?? 0),
    name: String(l.args.name ?? ""),
    block: String(l.blockNumber),
    gated: String(l.args.gateToken).toLowerCase() !== ZERO,
  }));
  out.reverse();
  return out.slice(0, Math.min(Math.max(limit, 1), 200));
}

/** A single room by id (or null). */
export async function getRoom(roomId: string): Promise<Room | null> {
  if (!SIGNA_ROOMS_LIVE) return null;
  const logs = await client().getLogs({ address: SIGNA_ROOMS_ADDRESS as Address, event: ROOM_CREATED, args: { roomId: roomId as `0x${string}` }, fromBlock: SIGNA_ROOMS_DEPLOY_BLOCK, toBlock: "latest" });
  const l = (logs as any[])[0];
  if (!l) return null;
  return {
    roomId: String(l.args.roomId),
    creator: String(l.args.creator).toLowerCase(),
    gateToken: String(l.args.gateToken).toLowerCase(),
    minBalance: String(l.args.minBalance ?? 0),
    name: String(l.args.name ?? ""),
    block: String(l.blockNumber),
    gated: String(l.args.gateToken).toLowerCase() !== ZERO,
  };
}

/** Messages in a room, oldest first — read from RoomMessage logs. */
export async function roomMessages(roomId: string, limit = 100): Promise<RoomMsg[]> {
  if (!SIGNA_ROOMS_LIVE) return [];
  const logs = await client().getLogs({ address: SIGNA_ROOMS_ADDRESS as Address, event: ROOM_MESSAGE, args: { roomId: roomId as `0x${string}` }, fromBlock: SIGNA_ROOMS_DEPLOY_BLOCK, toBlock: "latest" });
  const out: RoomMsg[] = (logs as any[]).map((l) => ({
    id: String(l.args.id),
    roomId: String(l.args.roomId),
    from: String(l.args.from).toLowerCase(),
    body: String(l.args.body ?? ""),
    timestamp: Number(l.args.timestamp ?? 0),
    tx: l.transactionHash as string,
  }));
  out.sort((a, b) => Number(a.id) - Number(b.id));
  return out.slice(-Math.min(Math.max(limit, 1), 200));
}

/** Whether `who` can post in a room right now (on-chain gate check). */
export async function canPost(roomId: string, who: string): Promise<boolean> {
  if (!/^0x[0-9a-f]{40}$/.test((who || "").toLowerCase())) return false;
  try {
    return await client().readContract({ address: SIGNA_ROOMS_ADDRESS as Address, abi: ROOMS_ABI, functionName: "canPost", args: [roomId as `0x${string}`, who.toLowerCase() as Address] });
  } catch {
    return false;
  }
}
