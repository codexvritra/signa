// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SignaLaunch} from "../src/SignaLaunch.sol";

/**
 * Deploy script for SignaLaunch (verifiable token launchpad).
 *
 * Robinhood Chain TESTNET first (chainId 46646, ETH gas — gas is subsidized):
 *   forge script script/DeployLaunch.s.sol \
 *     --rpc-url robinhood_testnet --private-key 0x<deployer_key> --broadcast
 *
 * (Mainnet: confirm the mainnet RPC/chainId from docs.robinhood.com/chain,
 * add it to foundry.toml, then use --rpc-url robinhood_mainnet.)
 *
 * After deploy, copy the address into Vercel env as SIGNA_LAUNCH_ADDRESS
 * (+ NEXT_PUBLIC_…) so /launch routes token launches through it.
 */
contract DeployLaunch is Script {
    function run() external returns (SignaLaunch launch) {
        uint256 pk = vm.envOr(
            "PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        vm.startBroadcast(pk);
        launch = new SignaLaunch();
        vm.stopBroadcast();
        console.log("SignaLaunch deployed at:", address(launch));
        console.log("Chain id:", block.chainid);
    }
}
