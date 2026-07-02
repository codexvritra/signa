// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  SignaPump — bonding-curve token launchpad (Robinhood Chain / any EVM)
 * @notice pump.fun / ape.store style: launch a token for a flat fee, it trades
 * on a constant-product bonding curve, and once the curve has raised the
 * graduation threshold (default 3 ETH) it's marked graduated and its liquidity
 * migrates to a DEX (Uniswap on Robinhood Chain).
 *
 * FEES: 2% per trade — 1% to the token creator, 1% to the platform. Launch fee
 * is a flat ETH amount (~$5-equivalent, set by the owner).
 *
 * ⚠️ CUSTODIAL: this contract HOLDS every buyer's ETH until graduation. That is
 * the opposite of SIGNA's usual "never custody" design and it MUST be
 * professionally audited before it handles real funds on mainnet. Deploy to
 * TESTNET only until audited.
 *
 * The owner configures fees / launch fee / graduation threshold / DEX router
 * and receives the platform fee. Trading itself is trustless + permissionless.
 */

interface IPumpToken {
    function transfer(address to, uint256 v) external returns (bool);
    function transferFrom(address f, address to, uint256 v) external returns (bool);
    function balanceOf(address a) external view returns (uint256);
    function approve(address s, uint256 v) external returns (bool);
    function totalSupply() external view returns (uint256);
}

contract PumpToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _n, string memory _s, uint256 _supply, address _to) {
        name = _n; symbol = _s; totalSupply = _supply; balanceOf[_to] = _supply;
        emit Transfer(address(0), _to, _supply);
    }
    function transfer(address to, uint256 v) external returns (bool) { _x(msg.sender, to, v); return true; }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s] = v; emit Approval(msg.sender, s, v); return true; }
    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        uint256 a = allowance[f][msg.sender];
        if (a != type(uint256).max) { require(a >= v, "allowance"); allowance[f][msg.sender] = a - v; }
        _x(f, to, v); return true;
    }
    function _x(address f, address to, uint256 v) internal {
        require(to != address(0), "zero");
        uint256 b = balanceOf[f]; require(b >= v, "balance");
        unchecked { balanceOf[f] = b - v; balanceOf[to] += v; }
        emit Transfer(f, to, v);
    }
}

contract SignaPump {
    // ---------- config (owner) ----------
    address public owner;
    address public feeRecipient;             // platform fee sink (SIGNA)
    uint256 public launchFeeWei;             // flat launch fee (~$5 in ETH)
    uint16  public tradeFeeBps = 200;        // 2% total per trade
    uint16  public creatorFeeBps = 100;      // of which 1% to the creator (rest to platform)
    uint256 public gradThreshold = 3 ether;  // real ETH raised to graduate
    address public dexRouter;                // Uniswap router on the chain (set before mainnet graduations)

    // ---------- curve constants ----------
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant CURVE_SUPPLY = 800_000_000 ether; // sold via the curve
    uint256 public constant LP_SUPPLY    = 200_000_000 ether; // reserved for the DEX at graduation
    uint256 public constant VIRTUAL_ETH0 = 1 ether;           // virtual ETH reserve seed

    struct Curve {
        address creator;
        uint112 rEth;        // reserve ETH (virtual + real)
        uint112 rTok;        // reserve tokens (remaining on curve)
        uint256 realEth;     // real ETH collected (net of fees), for graduation
        bool    graduated;
    }
    mapping(address => Curve) public curves; // token => curve
    uint256 public totalLaunches;

    // ---------- events ----------
    event Launched(address indexed token, address indexed creator, string name, string symbol, uint64 timestamp);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 priceE18, uint64 timestamp);
    event Graduated(address indexed token, uint256 ethToDex, uint256 tokensToDex, uint64 timestamp);
    event Fee(address indexed token, address indexed to, uint256 amount, bool creator);

    error NotOwner();
    error BadFee();
    error LaunchFee();
    error NotTrading();
    error Slippage();
    error Reentrancy();

    uint256 private _lock = 1;
    modifier lock() { if (_lock != 1) revert Reentrancy(); _lock = 2; _; _lock = 1; }
    modifier onlyOwner() { if (msg.sender != owner) revert NotOwner(); _; }

    constructor(address _feeRecipient) {
        owner = msg.sender;
        feeRecipient = _feeRecipient == address(0) ? msg.sender : _feeRecipient;
    }

    // ---------- admin ----------
    function setConfig(uint256 _launchFeeWei, uint16 _tradeFeeBps, uint16 _creatorFeeBps, uint256 _gradThreshold) external onlyOwner {
        if (_tradeFeeBps > 1000 || _creatorFeeBps > _tradeFeeBps) revert BadFee();
        launchFeeWei = _launchFeeWei; tradeFeeBps = _tradeFeeBps; creatorFeeBps = _creatorFeeBps; gradThreshold = _gradThreshold;
    }
    function setFeeRecipient(address r) external onlyOwner { feeRecipient = r; }
    function setDexRouter(address r) external onlyOwner { dexRouter = r; }
    function transferOwnership(address n) external onlyOwner { owner = n; }

    // ---------- launch ----------
    function launch(string calldata name_, string calldata symbol_) external payable lock returns (address token) {
        if (msg.value < launchFeeWei) revert LaunchFee();
        PumpToken t = new PumpToken(name_, symbol_, TOTAL_SUPPLY, address(this));
        token = address(t);
        curves[token] = Curve({ creator: msg.sender, rEth: uint112(VIRTUAL_ETH0), rTok: uint112(CURVE_SUPPLY), realEth: 0, graduated: false });
        unchecked { totalLaunches += 1; }
        if (msg.value > 0) _send(feeRecipient, msg.value); // launch fee → platform
        emit Launched(token, msg.sender, name_, symbol_, uint64(block.timestamp));
    }

    // ---------- trade ----------
    function buy(address token, uint256 minTokensOut) external payable lock {
        Curve storage c = curves[token];
        if (c.creator == address(0) || c.graduated) revert NotTrading();
        uint256 fee = (msg.value * tradeFeeBps) / 10_000;
        uint256 net = msg.value - fee;
        // constant product: tokensOut = rTok * net / (rEth + net)
        uint256 tokensOut = (uint256(c.rTok) * net) / (uint256(c.rEth) + net);
        if (tokensOut < minTokensOut || tokensOut == 0) revert Slippage();
        c.rEth = uint112(uint256(c.rEth) + net);
        c.rTok = uint112(uint256(c.rTok) - tokensOut);
        c.realEth += net;
        _splitFee(token, c.creator, fee);
        IPumpToken(token).transfer(msg.sender, tokensOut);
        emit Trade(token, msg.sender, true, msg.value, tokensOut, _price(c), uint64(block.timestamp));
        if (c.realEth >= gradThreshold) _graduate(token, c);
    }

    function sell(address token, uint256 tokensIn, uint256 minEthOut) external lock {
        Curve storage c = curves[token];
        if (c.creator == address(0) || c.graduated) revert NotTrading();
        // ethOut(before fee) = rEth * tokensIn / (rTok + tokensIn)
        uint256 gross = (uint256(c.rEth) * tokensIn) / (uint256(c.rTok) + tokensIn);
        // never pay out virtual seed / more real than collected
        if (gross > c.realEth) gross = c.realEth;
        uint256 fee = (gross * tradeFeeBps) / 10_000;
        uint256 net = gross - fee;
        if (net < minEthOut || net == 0) revert Slippage();
        IPumpToken(token).transferFrom(msg.sender, address(this), tokensIn);
        c.rTok = uint112(uint256(c.rTok) + tokensIn);
        c.rEth = uint112(uint256(c.rEth) - gross);
        c.realEth -= gross;
        _splitFee(token, c.creator, fee);
        _send(msg.sender, net);
        emit Trade(token, msg.sender, false, net, tokensIn, _price(c), uint64(block.timestamp));
    }

    // ---------- internals ----------
    function _splitFee(address token, address creator, uint256 fee) internal {
        if (fee == 0) return;
        uint256 toCreator = (fee * creatorFeeBps) / tradeFeeBps;
        uint256 toPlatform = fee - toCreator;
        if (toCreator > 0) { _send(creator, toCreator); emit Fee(token, creator, toCreator, true); }
        if (toPlatform > 0) { _send(feeRecipient, toPlatform); emit Fee(token, feeRecipient, toPlatform, false); }
    }

    function _graduate(address token, Curve storage c) internal {
        c.graduated = true;
        uint256 ethToDex = c.realEth;
        uint256 tokensToDex = uint256(c.rTok) + LP_SUPPLY; // remaining curve tokens + LP reserve
        // NOTE: actual Uniswap addLiquidity + LP burn happens via `dexRouter` in a
        // follow-up (needs the router address on Robinhood Chain). Until wired, the
        // ETH + tokens are held here and migrated by the owner. Trading is closed.
        emit Graduated(token, ethToDex, tokensToDex, uint64(block.timestamp));
    }

    function _price(Curve storage c) internal view returns (uint256) {
        // ETH per token, 1e18-scaled: rEth / rTok
        return (uint256(c.rEth) * 1e18) / uint256(c.rTok);
    }

    function _send(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "eth send");
    }

    // ---------- reads ----------
    function priceOf(address token) external view returns (uint256) {
        Curve storage c = curves[token];
        if (c.rTok == 0) return 0;
        return _price(c);
    }
    /// @notice quote tokens out for an ETH buy (after fee), for the UI.
    function quoteBuy(address token, uint256 ethIn) external view returns (uint256 tokensOut) {
        Curve storage c = curves[token];
        uint256 net = ethIn - (ethIn * tradeFeeBps) / 10_000;
        return (uint256(c.rTok) * net) / (uint256(c.rEth) + net);
    }
    function progress(address token) external view returns (uint256 raised, uint256 threshold, bool graduated) {
        Curve storage c = curves[token];
        return (c.realEth, gradThreshold, c.graduated);
    }
}
