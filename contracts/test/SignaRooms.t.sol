// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SignaRooms} from "../src/SignaRooms.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
}

contract SignaRoomsTest is Test {
    SignaRooms rooms;
    MockERC20 token;

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant CAROL = address(0xCA401);

    event RoomMessage(uint256 indexed id, bytes32 indexed roomId, address indexed from, string body, uint64 timestamp);

    function setUp() public {
        rooms = new SignaRooms();
        token = new MockERC20();
    }

    function test_OpenRoom_AnyoneCanPost() public {
        vm.prank(ALICE);
        bytes32 id = rooms.createRoom("base-gm", address(0), 0);
        assertTrue(rooms.canPost(id, BOB));
        vm.prank(BOB);
        uint256 mid = rooms.post(id, "gm from anyone");
        assertEq(mid, 1);
        assertEq(rooms.roomMessageCount(id), 1);
        assertEq(rooms.totalRooms(), 1);
    }

    function test_GatedRoom_HolderPosts_NonHolderReverts() public {
        token.mint(BOB, 1000e18);
        vm.prank(ALICE);
        bytes32 id = rooms.createRoom("holders-only", address(token), 100e18);

        assertTrue(rooms.canPost(id, BOB));   // 1000 >= 100
        assertFalse(rooms.canPost(id, CAROL)); // 0 < 100

        vm.prank(BOB);
        rooms.post(id, "holders unite");
        assertEq(rooms.roomMessageCount(id), 1);

        vm.prank(CAROL);
        vm.expectRevert(abi.encodeWithSelector(SignaRooms.NotEligible.selector, 100e18, 0));
        rooms.post(id, "let me in");
    }

    function test_GatedRoom_ExactBalance_Allowed() public {
        token.mint(CAROL, 100e18);
        vm.prank(ALICE);
        bytes32 id = rooms.createRoom("exact", address(token), 100e18);
        vm.prank(CAROL);
        uint256 mid = rooms.post(id, "exactly enough");
        assertEq(mid, 1);
    }

    function test_Revert_DuplicateRoom() public {
        vm.prank(ALICE);
        rooms.createRoom("dup", address(0), 0);
        vm.prank(BOB);
        vm.expectRevert(SignaRooms.RoomExists.selector);
        rooms.createRoom("dup", address(token), 5);
    }

    function test_Revert_PostToMissingRoom() public {
        vm.prank(ALICE);
        vm.expectRevert(SignaRooms.RoomNotFound.selector);
        rooms.post(keccak256("nope"), "hello?");
    }

    function test_Revert_EmptyBody() public {
        vm.prank(ALICE);
        bytes32 id = rooms.createRoom("r", address(0), 0);
        vm.prank(ALICE);
        vm.expectRevert(SignaRooms.EmptyBody.selector);
        rooms.post(id, "");
    }

    function test_RoomId_IsDeterministic() public view {
        assertEq(rooms.roomId("hello"), keccak256(bytes("hello")));
    }

    function test_Event_AndGlobalIds_AcrossRooms() public {
        vm.prank(ALICE);
        bytes32 a = rooms.createRoom("a", address(0), 0);
        vm.prank(ALICE);
        bytes32 b = rooms.createRoom("b", address(0), 0);

        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, true, true);
        emit RoomMessage(1, a, BOB, "first", uint64(1_700_000_000));
        vm.prank(BOB);
        rooms.post(a, "first");

        vm.prank(CAROL);
        rooms.post(b, "second");
        assertEq(rooms.totalMessages(), 2);
        assertEq(rooms.roomMessageCount(a), 1);
        assertEq(rooms.roomMessageCount(b), 1);
    }
}
