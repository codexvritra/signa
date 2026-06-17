// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  SignaLogAnchor
 * @notice On-chain anchor for the SIGNA transparency log.
 *
 * SIGNA's message layer is an append-only RFC 6962 Merkle log: every
 * checkpoint commits a Merkle root over all signed messages and is signed
 * off-chain by the transparency-log signer. Signatures prove WHO wrote each
 * message; the Merkle log proves the SET wasn't tampered. This contract adds
 * the final link: it pins each checkpoint root ON CHAIN, so the log's history
 * is settled on Base and cannot be silently rewound even by SIGNA itself —
 * a later off-chain root that contradicts an anchored one is provably a fork.
 *
 * Permissionless and ownerless, exactly like SignaNodeRegistry /
 * SignaRoomRegistry / SignaCapabilityRegistry. Identity = the wallet:
 * msg.sender is the "logId". Anyone can anchor THEIR OWN log; SIGNA's log is
 * the one anchored by the transparency-log signer address, which readers
 * already know. No admin, no owner, no upgrade path, no fee.
 *
 * Append-only is enforced on chain: each anchor must strictly advance `seq`
 * and never shrink `treeSize`. A non-zero root is required.
 *
 * Designed for Base mainnet (chain id 8453). Identical bytecode redeploys
 * verbatim on any EVM chain.
 */
contract SignaLogAnchor {
    // ---------- types ----------

    struct Checkpoint {
        uint64  seq;         // checkpoint sequence number (strictly increasing)
        uint64  treeSize;    // # of messages covered (monotonic non-decreasing)
        bytes32 root;        // RFC 6962 Merkle root over leaves [0..treeSize)
        uint64  anchoredAt;  // unix seconds of this anchor
        uint64  count;       // how many checkpoints this log has anchored
    }

    // ---------- storage ----------

    /// @notice logId (anchorer wallet) → its latest anchored checkpoint.
    mapping(address => Checkpoint) public latest;

    /// @notice logId → seq → root, so any historical anchor is provable.
    mapping(address => mapping(uint64 => bytes32)) public rootAt;

    // ---------- events ----------

    event Anchored(
        address indexed logId,
        uint64 indexed seq,
        uint64 treeSize,
        bytes32 root,
        uint64 anchoredAt
    );

    // ---------- errors ----------

    error SeqNotAdvancing(uint64 given, uint64 latest);
    error TreeShrank(uint64 given, uint64 latest);
    error ZeroRoot();

    // ---------- write ----------

    /**
     * @notice Anchor a transparency-log checkpoint for msg.sender's log.
     * @param seq       checkpoint sequence; must be > the last anchored seq
     *                  (for the first anchor, any value is accepted).
     * @param treeSize  cumulative message count; must be >= last treeSize.
     * @param root      RFC 6962 Merkle root; must be non-zero.
     *
     * You need not anchor every checkpoint — anchoring the latest periodically
     * is enough, since `seq` only has to advance, not increment by one.
     */
    function anchor(uint64 seq, uint64 treeSize, bytes32 root) external {
        if (root == bytes32(0)) revert ZeroRoot();
        Checkpoint storage cur = latest[msg.sender];
        if (cur.count != 0) {
            if (seq <= cur.seq) revert SeqNotAdvancing(seq, cur.seq);
            if (treeSize < cur.treeSize) revert TreeShrank(treeSize, cur.treeSize);
        }
        cur.seq = seq;
        cur.treeSize = treeSize;
        cur.root = root;
        cur.anchoredAt = uint64(block.timestamp);
        cur.count += 1;
        rootAt[msg.sender][seq] = root;
        emit Anchored(msg.sender, seq, treeSize, root, uint64(block.timestamp));
    }

    // ---------- read ----------

    /// @notice The latest anchored checkpoint for a log. Zero-valued if none.
    function getLatest(address logId) external view returns (Checkpoint memory) {
        return latest[logId];
    }

    /// @notice The root anchored at a specific (logId, seq). Zero if never anchored.
    function getRootAt(address logId, uint64 seq) external view returns (bytes32) {
        return rootAt[logId][seq];
    }
}
