// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SignaRooms} from "../src/SignaRooms.sol";

/**
 * Deploy script for SignaRooms (token-gated onchain group chat).
 *
 * Usage:
 *   forge script script/DeployRooms.s.sol \
 *     --rpc-url base --private-key 0x<deployer_key> --broadcast --verify
 *
 * Deployer needs ~0.0003 ETH on Base for gas. After deploy, copy the address
 * into Vercel env as SIGNA_ROOMS_ADDRESS (+ NEXT_PUBLIC_…) so the site + SDK
 * route rooms through it (incl. an auto-room per token launch).
 */
contract DeployRooms is Script {
    function run() external returns (SignaRooms rooms) {
        uint256 pk = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        vm.startBroadcast(pk);
        rooms = new SignaRooms();
        vm.stopBroadcast();
        console.log("SignaRooms deployed at:", address(rooms));
        console.log("Chain id:", block.chainid);
    }
}
