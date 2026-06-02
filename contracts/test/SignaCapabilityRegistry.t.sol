// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SignaCapabilityRegistry} from "../src/SignaCapabilityRegistry.sol";

contract SignaCapabilityRegistryTest is Test {
    SignaCapabilityRegistry reg;

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant PAYOUT = address(0xBEEF);

    string constant EP = "https://api.alice.dev/summarize";
    string constant EP2 = "https://api.alice.dev/summarize-v2";

    function setUp() public {
        reg = new SignaCapabilityRegistry();
    }

    // -------- happy paths --------

    function test_FirstRegister_StoresSpec_AndCounts() public {
        vm.prank(ALICE);
        reg.register("alice.summarize", EP, "POST", "summarize a url", 0, address(0));

        assertEq(reg.totalRegistered(), 1);
        assertEq(reg.activeCount(), 1);

        SignaCapabilityRegistry.Capability memory c = reg.getCapability("alice.summarize");
        assertEq(c.provider, ALICE);
        assertEq(c.endpoint, EP);
        assertEq(c.method, "POST");
        assertEq(c.description, "summarize a url");
        assertEq(c.priceUsdc, 0);
        assertEq(c.payTo, ALICE); // address(0) defaults to provider
        assertTrue(c.active);
        assertGt(c.registeredAt, 0);
        assertEq(c.registeredAt, c.updatedAt);
    }

    function test_Register_PricedWithExplicitPayout() public {
        vm.prank(ALICE);
        reg.register("alice.priced", EP, "GET", "priced feed", 250_000, PAYOUT);
        SignaCapabilityRegistry.Capability memory c = reg.getCapability("alice.priced");
        assertEq(c.priceUsdc, 250_000);
        assertEq(c.payTo, PAYOUT);
    }

    function test_Update_PreservesRegisteredAt_AndCount() public {
        vm.prank(ALICE);
        reg.register("alice.summarize", EP, "POST", "v1", 0, address(0));
        uint64 first = reg.getCapability("alice.summarize").registeredAt;

        vm.warp(block.timestamp + 100);
        vm.prank(ALICE);
        reg.register("alice.summarize", EP2, "GET", "v2", 1_000, address(0));

        SignaCapabilityRegistry.Capability memory c = reg.getCapability("alice.summarize");
        assertEq(c.endpoint, EP2);
        assertEq(c.method, "GET");
        assertEq(c.priceUsdc, 1_000);
        assertEq(c.registeredAt, first);
        assertGt(c.updatedAt, first);
        assertEq(reg.totalRegistered(), 1);
        assertEq(reg.activeCount(), 1);
    }

    function test_DeregisterAndReRegister_KeepsRegisteredAt() public {
        vm.prank(ALICE);
        reg.register("alice.summarize", EP, "POST", "v1", 0, address(0));
        uint64 first = reg.getCapability("alice.summarize").registeredAt;

        vm.warp(block.timestamp + 50);
        vm.prank(ALICE);
        reg.deregister("alice.summarize");
        assertEq(reg.activeCount(), 0);
        assertFalse(reg.getCapability("alice.summarize").active);

        vm.warp(block.timestamp + 50);
        vm.prank(ALICE);
        reg.register("alice.summarize", EP2, "GET", "back", 0, address(0));
        SignaCapabilityRegistry.Capability memory c = reg.getCapability("alice.summarize");
        assertTrue(c.active);
        assertEq(c.registeredAt, first);
        assertEq(c.endpoint, EP2);
        assertEq(reg.activeCount(), 1);
        assertEq(reg.totalRegistered(), 1); // not double-counted
    }

    function test_RecordCall_BumpsCounter() public {
        vm.prank(ALICE);
        reg.register("alice.summarize", EP, "POST", "v1", 0, address(0));
        vm.prank(ALICE);
        reg.recordCall("alice.summarize");
        vm.prank(ALICE);
        reg.recordCall("alice.summarize");
        assertEq(reg.getCapability("alice.summarize").calls, 2);
    }

    // -------- access control --------

    function test_Register_RevertsForNonProviderUpdate() public {
        vm.prank(ALICE);
        reg.register("alice.summarize", EP, "POST", "v1", 0, address(0));
        vm.prank(BOB);
        vm.expectRevert(SignaCapabilityRegistry.NotProvider.selector);
        reg.register("alice.summarize", EP2, "GET", "hijack", 0, address(0));
    }

    function test_Deregister_RevertsForNonProvider() public {
        vm.prank(ALICE);
        reg.register("alice.summarize", EP, "POST", "v1", 0, address(0));
        vm.prank(BOB);
        vm.expectRevert(SignaCapabilityRegistry.NotProvider.selector);
        reg.deregister("alice.summarize");
    }

    function test_Deregister_RevertsWhenInactive() public {
        vm.expectRevert(SignaCapabilityRegistry.NotActive.selector);
        vm.prank(ALICE);
        reg.deregister("never.registered");
    }

    function test_RecordCall_RevertsForNonProvider() public {
        vm.prank(ALICE);
        reg.register("alice.summarize", EP, "POST", "v1", 0, address(0));
        vm.prank(BOB);
        vm.expectRevert(SignaCapabilityRegistry.NotProvider.selector);
        reg.recordCall("alice.summarize");
    }

    // -------- validation --------

    function test_Register_RevertsOnEmptyName() public {
        vm.expectRevert(SignaCapabilityRegistry.EmptyName.selector);
        vm.prank(ALICE);
        reg.register("", EP, "GET", "x", 0, address(0));
    }

    function test_Register_RevertsOnNameTooLong() public {
        string memory longName = "abcdefghijklmnopqrstuvwxyz1234567890ABCDE"; // 41 chars
        vm.expectRevert(SignaCapabilityRegistry.NameTooLong.selector);
        vm.prank(ALICE);
        reg.register(longName, EP, "GET", "x", 0, address(0));
    }

    function test_Register_RevertsOnNonHttpsEndpoint() public {
        vm.expectRevert(SignaCapabilityRegistry.BadEndpoint.selector);
        vm.prank(ALICE);
        reg.register("alice.x", "http://api.alice.dev/x", "GET", "x", 0, address(0));
    }

    function test_Register_RevertsOnShortEndpoint() public {
        vm.expectRevert(SignaCapabilityRegistry.BadEndpoint.selector);
        vm.prank(ALICE);
        reg.register("alice.x", "https:/", "GET", "x", 0, address(0));
    }

    function test_Register_RevertsOnBadMethod() public {
        vm.expectRevert(SignaCapabilityRegistry.BadMethod.selector);
        vm.prank(ALICE);
        reg.register("alice.x", EP, "DELETE", "x", 0, address(0));
    }

    function test_Register_RevertsOnPriceTooHigh() public {
        vm.expectRevert(SignaCapabilityRegistry.PriceTooHigh.selector);
        vm.prank(ALICE);
        reg.register("alice.x", EP, "GET", "x", 100_000_001, address(0));
    }

    // -------- enumeration --------

    function test_ListCapabilities_Pagination() public {
        vm.prank(ALICE);
        reg.register("alice.a", EP, "GET", "a", 0, address(0));
        vm.prank(BOB);
        reg.register("bob.b", EP2, "POST", "b", 5_000, address(0));

        (string[] memory names, SignaCapabilityRegistry.Capability[] memory page) =
            reg.listCapabilities(0, 10);

        assertEq(names.length, 2);
        assertEq(page.length, 2);
        assertEq(names[0], "alice.a");
        assertEq(names[1], "bob.b");
        assertEq(page[0].provider, ALICE);
        assertEq(page[1].provider, BOB);
        assertEq(page[1].priceUsdc, 5_000);
    }

    function test_ListCapabilities_StartBeyondEnd_ReturnsEmpty() public {
        vm.prank(ALICE);
        reg.register("alice.a", EP, "GET", "a", 0, address(0));
        (string[] memory names, SignaCapabilityRegistry.Capability[] memory page) =
            reg.listCapabilities(10, 5);
        assertEq(names.length, 0);
        assertEq(page.length, 0);
    }
}
