// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  SignaLaunch — verifiable token launches (Robinhood Chain / any EVM)
 * @notice A permissionless, ownerless, NON-CUSTODIAL token launchpad.
 *
 * `launch(name, symbol, supply)` deploys a fixed-supply ERC-20 and mints the
 * ENTIRE supply to the launcher — the factory holds no funds and takes no fee.
 * Each launch emits a `Launched` event with the launcher indexed, so "who
 * launched what" is provable on-chain forever; SIGNA adds a re-verifiable
 * launch receipt on top (its verifiability edge — not a custodial bonding
 * curve). The launcher provides liquidity on the chain's DEX (e.g. Uniswap,
 * live on Robinhood Chain) themselves.
 *
 * Fixed supply, minted once at deploy → no owner, no post-mint, no rug vector
 * from the token itself. Designed for Robinhood Chain (Arbitrum Orbit L2, ETH
 * gas); identical bytecode redeploys on any EVM chain.
 */
contract LaunchToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public immutable launcher;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _supply, address _to) {
        name = _name;
        symbol = _symbol;
        launcher = _to;
        totalSupply = _supply;
        balanceOf[_to] = _supply;
        emit Transfer(address(0), _to, _supply);
    }

    function transfer(address to, uint256 v) external returns (bool) {
        _xfer(msg.sender, to, v);
        return true;
    }

    function approve(address s, uint256 v) external returns (bool) {
        allowance[msg.sender][s] = v;
        emit Approval(msg.sender, s, v);
        return true;
    }

    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        uint256 a = allowance[f][msg.sender];
        if (a != type(uint256).max) {
            require(a >= v, "allowance");
            allowance[f][msg.sender] = a - v;
        }
        _xfer(f, to, v);
        return true;
    }

    function _xfer(address f, address to, uint256 v) internal {
        require(to != address(0), "zero recipient");
        uint256 b = balanceOf[f];
        require(b >= v, "balance");
        unchecked {
            balanceOf[f] = b - v;
            balanceOf[to] += v;
        }
        emit Transfer(f, to, v);
    }
}

contract SignaLaunch {
    /// @notice Total tokens launched through this factory.
    uint256 public totalLaunches;
    /// @notice launcher → how many they've launched.
    mapping(address => uint256) public launchesBy;

    event Launched(
        address indexed token,
        address indexed launcher,
        string name,
        string symbol,
        uint256 supply,
        uint64 timestamp
    );

    error EmptyName();
    error ZeroSupply();

    /**
     * @notice Launch a fixed-supply token; the full supply mints to you.
     * @param name_       token name
     * @param symbol_     token ticker
     * @param supplyWhole whole-token supply (minted as supplyWhole * 1e18)
     * @return token      the new token's address
     */
    function launch(string calldata name_, string calldata symbol_, uint256 supplyWhole) external returns (address token) {
        if (bytes(name_).length == 0 || bytes(symbol_).length == 0) revert EmptyName();
        if (supplyWhole == 0) revert ZeroSupply();
        uint256 supply = supplyWhole * 1e18; // reverts on overflow (checked math)
        token = address(new LaunchToken(name_, symbol_, supply, msg.sender));
        unchecked {
            totalLaunches += 1;
            launchesBy[msg.sender] += 1;
        }
        emit Launched(token, msg.sender, name_, symbol_, supply, uint64(block.timestamp));
    }
}
