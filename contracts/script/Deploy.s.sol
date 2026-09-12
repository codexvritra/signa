// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SignaNodeRegistry} from "../src/SignaNodeRegistry.sol";

/**
 * Deploy script for SignaNodeRegistry.
 *
 * Usage:
 *   forge script script/Deploy.s.sol \
 *     --rpc-url robinhood_mainnet \
 *     --private-key 0x<deployer_key> \
 *     --broadcast \
 *     --verify --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
 *
 * Verified bytecode will be on Robinhood Chain's Blockscout explorer automatically
 * when --verify is passed. Otherwise verify manually later with
 * `forge verify-contract <address> SignaNodeRegistry --chain 4663`.
 *
 * Deployer wallet needs ~0.0002 ETH on Robinhood Chain for gas.
 *
 * Address is non-deterministic (depends on deployer + nonce). After
 * deploy the broadcast file in broadcast/ contains the deployed
 * address — copy it into web/public/signa.mjs as SIGNA_NODE_REGISTRY.
 */
contract Deploy is Script {
    function run() external returns (SignaNodeRegistry reg) {
        // The vm.envOr lets us deploy from anvil for local testing
        // (PRIVATE_KEY=0xac0974... defaults to anvil's first key) while
        // still requiring the real key for mainnet.
        uint256 pk = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        vm.startBroadcast(pk);
        reg = new SignaNodeRegistry();
        vm.stopBroadcast();
        console.log("SignaNodeRegistry deployed at:", address(reg));
        console.log("Chain id:", block.chainid);
    }
}
