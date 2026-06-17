// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SignaLogAnchor} from "../src/SignaLogAnchor.sol";

/**
 * Deploy script for SignaLogAnchor (the transparency-log on-chain anchor).
 *
 * Usage:
 *   forge script script/DeployLogAnchor.s.sol \
 *     --rpc-url base \
 *     --private-key 0x<deployer_key> \
 *     --broadcast \
 *     --verify
 *
 * Deployer wallet needs ~0.0002 ETH on Base mainnet for gas. After deploy,
 * copy the address into Vercel env as SIGNA_LOG_ANCHOR_ADDRESS, and fund the
 * transparency-log signer wallet (keccak256("signa:transparency-log:v1"),
 * exposed at /api/log → signer) with a little Base ETH so /api/cron/anchor
 * can submit anchor txs.
 */
contract DeployLogAnchor is Script {
    function run() external returns (SignaLogAnchor anchor) {
        uint256 pk = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        vm.startBroadcast(pk);
        anchor = new SignaLogAnchor();
        vm.stopBroadcast();
        console.log("SignaLogAnchor deployed at:", address(anchor));
        console.log("Chain id:", block.chainid);
    }
}
