// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SignaLaunch, LaunchToken} from "../src/SignaLaunch.sol";

contract SignaLaunchTest is Test {
    SignaLaunch launch;
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    event Launched(address indexed token, address indexed launcher, string name, string symbol, uint256 supply, uint64 timestamp);

    function setUp() public {
        launch = new SignaLaunch();
    }

    function test_Launch_MintsFullSupplyToLauncher_AndCounts() public {
        vm.prank(ALICE);
        address token = launch.launch("Signa Test", "STEST", 1_000_000);

        LaunchToken t = LaunchToken(token);
        assertEq(t.name(), "Signa Test");
        assertEq(t.symbol(), "STEST");
        assertEq(t.decimals(), 18);
        assertEq(t.totalSupply(), 1_000_000 ether);
        assertEq(t.balanceOf(ALICE), 1_000_000 ether); // full supply to launcher
        assertEq(t.launcher(), ALICE);
        assertEq(t.balanceOf(address(launch)), 0);      // factory holds nothing
        assertEq(launch.totalLaunches(), 1);
        assertEq(launch.launchesBy(ALICE), 1);
    }

    function test_Launch_EmitsEvent() public {
        vm.warp(1_700_000_000);
        // token address is computed by CREATE; just assert the non-address fields
        vm.expectEmit(false, true, false, true);
        emit Launched(address(0), ALICE, "GM", "GM", 500 ether, uint64(1_700_000_000));
        vm.prank(ALICE);
        launch.launch("GM", "GM", 500);
    }

    function test_LaunchedToken_Transfers() public {
        vm.prank(ALICE);
        LaunchToken t = LaunchToken(launch.launch("Tok", "TOK", 1000));
        vm.prank(ALICE);
        t.transfer(BOB, 250 ether);
        assertEq(t.balanceOf(BOB), 250 ether);
        assertEq(t.balanceOf(ALICE), 750 ether);
    }

    function test_TransferFrom_WithApproval() public {
        vm.prank(ALICE);
        LaunchToken t = LaunchToken(launch.launch("Tok", "TOK", 1000));
        vm.prank(ALICE);
        t.approve(BOB, 100 ether);
        vm.prank(BOB);
        t.transferFrom(ALICE, BOB, 100 ether);
        assertEq(t.balanceOf(BOB), 100 ether);
        assertEq(t.allowance(ALICE, BOB), 0);
    }

    function test_Revert_EmptyName() public {
        vm.expectRevert(SignaLaunch.EmptyName.selector);
        launch.launch("", "X", 1);
    }

    function test_Revert_ZeroSupply() public {
        vm.expectRevert(SignaLaunch.ZeroSupply.selector);
        launch.launch("X", "X", 0);
    }

    function test_MultipleLaunchers() public {
        vm.prank(ALICE);
        launch.launch("A", "A", 1);
        vm.prank(BOB);
        launch.launch("B", "B", 1);
        vm.prank(ALICE);
        launch.launch("C", "C", 1);
        assertEq(launch.totalLaunches(), 3);
        assertEq(launch.launchesBy(ALICE), 2);
        assertEq(launch.launchesBy(BOB), 1);
    }
}
