// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  SignaPaidMessages
 * @notice Pay to reach an inbox — settled on Base in the same transaction.
 *
 * Set a price for your own inbox; a sender attaches at least that value and it
 * is forwarded to you **in the same transaction** that records the message as a
 * readable `PaidMessage` event on the explorer. "Superchat for Base": a KOL or
 * an agent can charge to be reached, and every paid message is permanent and
 * verifiable.
 *
 * SIGNA custodies nothing and takes no fee — the **full** value goes straight to
 * the recipient. Permissionless and ownerless, like the rest of the SIGNA
 * contracts. Identity is the wallet (msg.sender). No admin, no owner, no upgrade.
 *
 * Value is native ETH on Base (one tx, no token approval). Designed for Base
 * mainnet (chain id 8453); identical bytecode redeploys on any EVM chain.
 */
contract SignaPaidMessages {
    uint256 public constant MAX_BODY_BYTES = 8000;

    /// @notice Total paid messages ever sent (also the latest id).
    uint256 public totalMessages;

    /// @notice wallet → wei required to message it (0 = free inbox).
    mapping(address => uint256) public price;

    event PriceSet(address indexed wallet, uint256 price);
    event PaidMessage(
        uint256 indexed id,
        address indexed from,
        address indexed to,
        uint256 value,
        string body,
        uint64 timestamp
    );

    error ZeroRecipient();
    error EmptyBody();
    error BodyTooLong(uint256 given, uint256 max);
    error Underpaid(uint256 sent, uint256 required);
    error ForwardFailed();

    /// @notice Set the price (in wei) to message your inbox. 0 = free.
    function setPrice(uint256 weiPrice) external {
        price[msg.sender] = weiPrice;
        emit PriceSet(msg.sender, weiPrice);
    }

    /**
     * @notice Send a message to `to`, paying at least their price. The **entire**
     * `msg.value` is forwarded to `to` in this same transaction — the contract
     * keeps nothing. Records a readable `PaidMessage` event.
     */
    function send(address to, string calldata body) external payable returns (uint256 id) {
        if (to == address(0)) revert ZeroRecipient();
        uint256 len = bytes(body).length;
        if (len == 0) revert EmptyBody();
        if (len > MAX_BODY_BYTES) revert BodyTooLong(len, MAX_BODY_BYTES);
        uint256 required = price[to];
        if (msg.value < required) revert Underpaid(msg.value, required);

        // effects before interaction
        unchecked { id = ++totalMessages; }
        emit PaidMessage(id, msg.sender, to, msg.value, body, uint64(block.timestamp));

        if (msg.value > 0) {
            (bool ok, ) = payable(to).call{value: msg.value}("");
            if (!ok) revert ForwardFailed();
        }
    }
}
