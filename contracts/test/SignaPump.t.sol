// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SignaPump, PumpToken, IPumpToken} from "../src/SignaPump.sol";

contract SignaPumpTest is Test {
    SignaPump pump;
    address constant PLATFORM = address(0x5165A); // fee recipient (SIGNA)
    address constant CREATOR = address(0xC12EA);
    address constant BUYER = address(0xB0B);

    function setUp() public {
        pump = new SignaPump(PLATFORM);
        pump.setConfig(0.001 ether, 200, 100, 3 ether); // $5-ish launch fee, 2% (1% creator/1% platform), grad 3 ETH
        vm.deal(CREATOR, 1 ether);
        vm.deal(BUYER, 20 ether);
    }

    function _launch() internal returns (address token) {
        vm.prank(CREATOR);
        token = pump.launch{value: 0.001 ether}("Pepe Signa", "PSIGNA");
    }

    function test_Launch_FeeToPlatform_AndCurveInit() public {
        uint256 platBefore = PLATFORM.balance;
        address token = _launch();
        assertEq(PLATFORM.balance, platBefore + 0.001 ether); // launch fee to platform
        (address creator,,, uint256 realEth, bool grad) = pump.curves(token);
        assertEq(creator, CREATOR);
        assertEq(realEth, 0);
        assertFalse(grad);
        assertEq(PumpToken(token).totalSupply(), 1_000_000_000 ether);
        assertEq(PumpToken(token).balanceOf(address(pump)), 1_000_000_000 ether); // curve holds supply
        assertEq(pump.totalLaunches(), 1);
    }

    function test_Buy_SplitsFee_1pct_each_AndDeliversTokens() public {
        address token = _launch();
        uint256 cBefore = CREATOR.balance;
        uint256 pBefore = PLATFORM.balance;

        vm.prank(BUYER);
        pump.buy{value: 1 ether}(token, 0);

        // 2% fee on 1 ETH = 0.02; 1% creator = 0.01, 1% platform = 0.01
        assertEq(CREATOR.balance, cBefore + 0.01 ether);
        assertEq(PLATFORM.balance, pBefore + 0.01 ether);
        // buyer got tokens; curve realEth = net (0.98)
        assertGt(PumpToken(token).balanceOf(BUYER), 0);
        (,,, uint256 realEth,) = pump.curves(token);
        assertEq(realEth, 0.98 ether);
    }

    function test_Buy_PriceRises_ThenSell() public {
        address token = _launch();
        uint256 p0 = pump.priceOf(token);
        vm.prank(BUYER);
        pump.buy{value: 1 ether}(token, 0);
        uint256 p1 = pump.priceOf(token);
        assertGt(p1, p0); // price up after a buy

        uint256 bal = PumpToken(token).balanceOf(BUYER);
        vm.startPrank(BUYER);
        PumpToken(token).approve(address(pump), bal);
        uint256 ethBefore = BUYER.balance;
        pump.sell(token, bal / 2, 0);
        vm.stopPrank();
        assertGt(BUYER.balance, ethBefore);      // got ETH back
        assertLt(pump.priceOf(token), p1);         // price down after a sell
    }

    function test_Graduates_At_Threshold_AndClosesTrading() public {
        address token = _launch();
        vm.prank(BUYER);
        pump.buy{value: 4 ether}(token, 0); // net 3.92 >= 3 → graduate
        (,,,, bool grad) = pump.curves(token);
        assertTrue(grad);
        (uint256 raised, uint256 threshold, bool graduated) = pump.progress(token);
        assertGe(raised, threshold);
        assertTrue(graduated);
        // trading closed after graduation
        vm.prank(BUYER);
        vm.expectRevert(SignaPump.NotTrading.selector);
        pump.buy{value: 0.1 ether}(token, 0);
    }

    function test_Revert_LaunchFeeTooLow() public {
        vm.prank(CREATOR);
        vm.expectRevert(SignaPump.LaunchFee.selector);
        pump.launch{value: 0.0005 ether}("x", "x");
    }

    function test_Revert_BuySlippage() public {
        address token = _launch();
        vm.prank(BUYER);
        vm.expectRevert(SignaPump.Slippage.selector);
        pump.buy{value: 1 ether}(token, type(uint256).max); // demand impossible amount
    }

    function test_Config_Guards() public {
        vm.expectRevert(SignaPump.BadFee.selector);
        pump.setConfig(0, 1500, 100, 3 ether); // >10% trade fee rejected
        vm.expectRevert(SignaPump.BadFee.selector);
        pump.setConfig(0, 200, 300, 3 ether); // creator share > total rejected
        vm.prank(BUYER);
        vm.expectRevert(SignaPump.NotOwner.selector);
        pump.setFeeRecipient(BUYER);
    }
}
