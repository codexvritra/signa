// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SignaMessages} from "../src/SignaMessages.sol";

/**
 * Deploy script for SignaMessages (wallet-to-wallet messages, readable on Blockscout).
 *
 * Usage:
 *   forge script script/DeployMessages.s.sol \
 *     --rpc-url robinhood_mainnet \
 *     --private-key 0x<deployer_key> \
 *     --broadcast \
 *     --verify --verifier blockscout --verifier-url https://robinhoodchain.blockscout.com/api/
 *
 * Deployer wallet needs ~0.0002 ETH on Robinhood Chain for gas. After deploy,
 * copy the address into Vercel env as SIGNA_MESSAGES_ADDRESS (and
 * NEXT_PUBLIC_SIGNA_MESSAGES_ADDRESS) so the site, SDK, and /onchain.html
 * route messages through it and render them as readable events on Blockscout.
 *
 * `--verify` uploads the source so Blockscout decodes the `Message` event
 * string; no API key is required (see foundry.toml [etherscan]).
 */
contract DeployMessages is Script {
    function run() external returns (SignaMessages messages) {
        uint256 pk = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        vm.startBroadcast(pk);
        messages = new SignaMessages();
        vm.stopBroadcast();
        console.log("SignaMessages deployed at:", address(messages));
        console.log("Chain id:", block.chainid);
    }
}
