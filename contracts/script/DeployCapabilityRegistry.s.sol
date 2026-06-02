// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SignaCapabilityRegistry} from "../src/SignaCapabilityRegistry.sol";

/**
 * Deploy script for SignaCapabilityRegistry.
 *
 * Usage (Base mainnet):
 *   PRIVATE_KEY=0x<deployer_key> forge script script/DeployCapabilityRegistry.s.sol \
 *     --rpc-url base --broadcast --verify
 *
 * Usage (Base Sepolia testnet — free):
 *   PRIVATE_KEY=0x<deployer_key> forge script script/DeployCapabilityRegistry.s.sol \
 *     --rpc-url base_sepolia --broadcast
 *
 * Deployer wallet needs a little ETH for gas (~0.0003 ETH on Base mainnet).
 *
 * After deploy:
 *   1. Copy the address printed below.
 *   2. Set SIGNA_CAPABILITY_REGISTRY_ADDRESS in Vercel env (production).
 *   3. /api/capabilities merges the on-chain registry into the directory on
 *      the next deploy. Providers can then publish straight to chain and any
 *      agent reads them trustlessly.
 */
contract DeployCapabilityRegistry is Script {
    function run() external returns (SignaCapabilityRegistry reg) {
        uint256 pk = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        vm.startBroadcast(pk);
        reg = new SignaCapabilityRegistry();
        vm.stopBroadcast();
        console.log("SignaCapabilityRegistry deployed at:", address(reg));
        console.log("Chain id:", block.chainid);
    }
}
