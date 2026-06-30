// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SignaMessages} from "../src/SignaMessages.sol";

contract SignaMessagesTest is Test {
    SignaMessages msgs;

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    event Message(
        uint256 indexed id,
        address indexed from,
        address indexed to,
        string body,
        uint64 timestamp
    );

    function setUp() public {
        msgs = new SignaMessages();
    }

    // -------- happy paths --------

    function test_Send_EmitsReadableEvent_AndCounts() public {
        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, true, true);
        emit Message(1, ALICE, BOB, "gm, this lives on Base", uint64(1_700_000_000));

        vm.prank(ALICE);
        uint256 id = msgs.send(BOB, "gm, this lives on Base");

        assertEq(id, 1);
        assertEq(msgs.totalMessages(), 1);
        assertEq(msgs.sentCount(ALICE), 1);
        assertEq(msgs.receivedCount(BOB), 1);
        (uint256 aSent, uint256 aRecv) = msgs.stats(ALICE);
        assertEq(aSent, 1);
        assertEq(aRecv, 0);
        (uint256 bSent, uint256 bRecv) = msgs.stats(BOB);
        assertEq(bSent, 0);
        assertEq(bRecv, 1);
    }

    function test_Ids_StrictlyIncrease_AcrossSenders() public {
        vm.prank(ALICE);
        assertEq(msgs.send(BOB, "one"), 1);
        vm.prank(BOB);
        assertEq(msgs.send(ALICE, "two"), 2);
        vm.prank(ALICE);
        assertEq(msgs.send(BOB, "three"), 3);

        assertEq(msgs.totalMessages(), 3);
        assertEq(msgs.sentCount(ALICE), 2);
        assertEq(msgs.receivedCount(BOB), 2);
        assertEq(msgs.sentCount(BOB), 1);
        assertEq(msgs.receivedCount(ALICE), 1);
    }

    function test_Send_UnicodeBody_Preserved() public {
        string memory body = unicode"gm — emoji 🚀 and unicode ✅, multi\nline";
        vm.expectEmit(true, true, true, true);
        emit Message(1, ALICE, BOB, body, uint64(block.timestamp));
        vm.prank(ALICE);
        msgs.send(BOB, body);
    }

    function test_MaxBody_Allowed() public {
        bytes memory b = new bytes(8000);
        for (uint256 i; i < b.length; i++) b[i] = "a";
        vm.prank(ALICE);
        uint256 id = msgs.send(BOB, string(b));
        assertEq(id, 1);
    }

    // -------- reverts --------

    function test_Revert_ZeroRecipient() public {
        vm.prank(ALICE);
        vm.expectRevert(SignaMessages.ZeroRecipient.selector);
        msgs.send(address(0), "hi");
    }

    function test_Revert_EmptyBody() public {
        vm.prank(ALICE);
        vm.expectRevert(SignaMessages.EmptyBody.selector);
        msgs.send(BOB, "");
    }

    function test_Revert_BodyTooLong() public {
        bytes memory b = new bytes(8001);
        for (uint256 i; i < b.length; i++) b[i] = "a";
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(SignaMessages.BodyTooLong.selector, 8001, 8000));
        msgs.send(BOB, string(b));
    }

    // -------- fuzz --------

    function testFuzz_Send_CountsTrack(address from, address to, string calldata body) public {
        vm.assume(to != address(0));
        vm.assume(bytes(body).length > 0 && bytes(body).length <= 8000);
        uint256 beforeSent = msgs.sentCount(from);
        uint256 beforeRecv = msgs.receivedCount(to);
        vm.prank(from);
        msgs.send(to, body);
        // sentCount and receivedCount are separate mappings, so each increments
        // by exactly one — even when from == to.
        assertEq(msgs.sentCount(from), beforeSent + 1);
        assertEq(msgs.receivedCount(to), beforeRecv + 1);
    }
}
