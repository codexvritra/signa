// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  SignaMessages
 * @notice Wallet-to-wallet messaging that lives on the explorer.
 *
 * A message is recorded as an on-chain EVENT, not buried in raw calldata. Once
 * this contract is verified on Basescan, every message renders as a decoded,
 * human-readable log — `from`, `to`, the actual message text, and a timestamp —
 * under each transaction's Logs tab, and the contract's own page becomes a
 * public, readable feed of all SIGNA messages. Because `from` and `to` are
 * indexed, anyone can filter "messages to me" straight from the chain.
 *
 * Permissionless and ownerless, exactly like SignaNodeRegistry /
 * SignaRoomRegistry / SignaCapabilityRegistry / SignaLogAnchor. Identity is the
 * wallet: msg.sender is the sender, no signup, no account. The contract custodies
 * nothing and takes no fee — it only records. No admin, no owner, no upgrade path.
 *
 * The transaction's own sender (msg.sender) proves authorship; the chain can't be
 * forged. Each message gets a strictly increasing global id for stable permalinks,
 * and per-wallet sent/received counts make activity readable on-chain too.
 *
 * Designed for Base mainnet (chain id 8453). Identical bytecode redeploys
 * verbatim on any EVM chain.
 */
contract SignaMessages {
    // ---------- limits ----------

    /// @notice Max message length in bytes (matches the off-chain SIGNA DM limit).
    uint256 public constant MAX_BODY_BYTES = 8000;

    // ---------- storage ----------

    /// @notice Total messages ever sent through this contract (also the latest id).
    uint256 public totalMessages;

    /// @notice wallet → how many messages it has sent.
    mapping(address => uint256) public sentCount;

    /// @notice wallet → how many messages it has received.
    mapping(address => uint256) public receivedCount;

    // ---------- events ----------

    /**
     * @notice Emitted for every message. `from`/`to` are indexed so the chain is
     * filterable into per-wallet inboxes/outboxes; `body` is the readable text.
     */
    event Message(
        uint256 indexed id,
        address indexed from,
        address indexed to,
        string body,
        uint64 timestamp
    );

    // ---------- errors ----------

    error ZeroRecipient();
    error EmptyBody();
    error BodyTooLong(uint256 given, uint256 max);

    // ---------- write ----------

    /**
     * @notice Send a message to `to`. Records it on-chain as a `Message` event.
     * @param to    recipient wallet (cannot be the zero address).
     * @param body  the message text (1..MAX_BODY_BYTES bytes).
     * @return id   the new message's global id.
     *
     * Costs only gas — the contract holds no funds and charges no fee.
     */
    function send(address to, string calldata body) external returns (uint256 id) {
        if (to == address(0)) revert ZeroRecipient();
        uint256 len = bytes(body).length;
        if (len == 0) revert EmptyBody();
        if (len > MAX_BODY_BYTES) revert BodyTooLong(len, MAX_BODY_BYTES);

        unchecked {
            id = ++totalMessages;
            sentCount[msg.sender] += 1;
            receivedCount[to] += 1;
        }
        emit Message(id, msg.sender, to, body, uint64(block.timestamp));
    }

    // ---------- read ----------

    /// @notice Convenience read: (sent, received) message counts for a wallet.
    function stats(address wallet) external view returns (uint256 sent, uint256 received) {
        return (sentCount[wallet], receivedCount[wallet]);
    }
}
