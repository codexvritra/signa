// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SignaPaidMessages} from "../src/SignaPaidMessages.sol";

contract SignaPaidMessagesTest is Test {
    SignaPaidMessages paid;

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    event PaidMessage(
        uint256 indexed id,
        address indexed from,
        address indexed to,
        uint256 value,
        string body,
        uint64 timestamp
    );

    function setUp() public {
        paid = new SignaPaidMessages();
        vm.deal(ALICE, 10 ether);
    }

    function test_FreeInbox_ZeroValue_Works() public {
        vm.prank(ALICE);
        uint256 id = paid.send(BOB, "gm, free to reach");
        assertEq(id, 1);
        assertEq(paid.totalMessages(), 1);
    }

    function test_PaidInbox_ForwardsFullValue_ToRecipient() public {
        vm.prank(BOB);
        paid.setPrice(0.01 ether);
        assertEq(paid.price(BOB), 0.01 ether);

        uint256 bobBefore = BOB.balance;
        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, true, true);
        emit PaidMessage(1, ALICE, BOB, 0.02 ether, "pay to reach me", uint64(1_700_000_000));

        vm.prank(ALICE);
        paid.send{value: 0.02 ether}(BOB, "pay to reach me");

        // the FULL value went to BOB; the contract keeps nothing
        assertEq(BOB.balance, bobBefore + 0.02 ether);
        assertEq(address(paid).balance, 0);
    }

    function test_Revert_Underpaid() public {
        vm.prank(BOB);
        paid.setPrice(0.01 ether);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SignaPaidMessages.Underpaid.selector, 0.005 ether, 0.01 ether));
        paid.send{value: 0.005 ether}(BOB, "too cheap");
    }

    function test_ExactPrice_Works() public {
        vm.prank(BOB);
        paid.setPrice(0.01 ether);
        vm.prank(ALICE);
        uint256 id = paid.send{value: 0.01 ether}(BOB, "exact");
        assertEq(id, 1);
        assertEq(BOB.balance, 0.01 ether);
    }

    function test_Revert_ZeroRecipient() public {
        vm.prank(ALICE);
        vm.expectRevert(SignaPaidMessages.ZeroRecipient.selector);
        paid.send(address(0), "hi");
    }

    function test_Revert_EmptyBody() public {
        vm.prank(ALICE);
        vm.expectRevert(SignaPaidMessages.EmptyBody.selector);
        paid.send(BOB, "");
    }

    function test_Revert_ForwardFails_ToNonPayable() public {
        // a contract with no receive() rejects ETH → ForwardFailed
        NonPayable np = new NonPayable();
        vm.prank(ALICE);
        vm.expectRevert(SignaPaidMessages.ForwardFailed.selector);
        paid.send{value: 1 ether}(address(np), "you can't take this");
    }

    function testFuzz_Paid_ForwardsAndCounts(uint96 amount, string calldata body) public {
        vm.assume(bytes(body).length > 0 && bytes(body).length <= 8000);
        vm.assume(amount <= 10 ether);
        uint256 before = BOB.balance;
        vm.prank(ALICE);
        paid.send{value: amount}(BOB, body);
        assertEq(BOB.balance, before + amount);
        assertEq(address(paid).balance, 0);
    }
}

contract NonPayable {
    // no receive / fallback → cannot accept ETH
}
