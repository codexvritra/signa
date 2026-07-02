// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SignaPump} from "../src/SignaPump.sol";

/**
 * Deploy script for SignaPump (bonding-curve launchpad).
 *
 * ⚠️ TESTNET ONLY until audited — this contract custodies user funds.
 * Robinhood Chain testnet (chainId 46646):
 *   FEE_RECIPIENT=0x<platform_wallet> forge script script/DeploySignaPump.s.sol \
 *     --rpc-url robinhood_testnet --private-key 0x<deployer_key> --broadcast
 *
 * After deploy the owner sets config (launch fee in wei ≈ $5, 2% fee = 1% creator
 * + 1% platform, 3 ETH graduation) and later the DEX router for graduations.
 */
contract DeploySignaPump is Script {
    function run() external returns (SignaPump pump) {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", vm.addr(pk));
        // launch fee ≈ $5; adjust for the chain's ETH price. 0.0015 ETH placeholder.
        uint256 launchFeeWei = vm.envOr("LAUNCH_FEE_WEI", uint256(0.0015 ether));
        vm.startBroadcast(pk);
        pump = new SignaPump(feeRecipient);
        pump.setConfig(launchFeeWei, 200, 100, 3 ether); // 2% total, 1% creator, grad at 3 ETH
        vm.stopBroadcast();
        console.log("SignaPump deployed at:", address(pump));
        console.log("fee recipient:", feeRecipient);
        console.log("Chain id:", block.chainid);
    }
}
