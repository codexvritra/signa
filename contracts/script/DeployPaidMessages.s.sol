// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SignaPaidMessages} from "../src/SignaPaidMessages.sol";

/**
 * Deploy script for SignaPaidMessages (pay-to-reach inboxes, settled on Base).
 *
 * Usage:
 *   forge script script/DeployPaidMessages.s.sol \
 *     --rpc-url base --private-key 0x<deployer_key> --broadcast --verify
 *
 * Deployer needs ~0.0002 ETH on Base for gas. After deploy, copy the address
 * into Vercel env as SIGNA_PAID_MESSAGES_ADDRESS (+ NEXT_PUBLIC_…) so the site,
 * SDK, and composer route paid messages through it.
 */
contract DeployPaidMessages is Script {
    function run() external returns (SignaPaidMessages paid) {
        uint256 pk = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        vm.startBroadcast(pk);
        paid = new SignaPaidMessages();
        vm.stopBroadcast();
        console.log("SignaPaidMessages deployed at:", address(paid));
        console.log("Chain id:", block.chainid);
    }
}
