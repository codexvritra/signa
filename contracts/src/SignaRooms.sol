// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title  SignaRooms
 * @notice Token-gated group chat on Base — your bag is your key.
 *
 * Anyone can create a room with an optional **token gate** (an ERC-20 + a
 * minimum balance). Posting to a gated room requires holding at least that much
 * of the token, enforced **on-chain**; an open room (gate = address(0)) lets
 * anyone post. Every message is a readable `RoomMessage` event, so once this
 * contract is verified the room's history is a decoded feed on the explorer.
 *
 * An un-ruggable, serverless community: no Discord, no admin keys, no platform.
 * A token launch can spin up its holders' room in one transaction.
 *
 * Permissionless and ownerless, like the rest of the SIGNA contracts. The room
 * gate is fixed at creation (first-come per name); identity is the wallet.
 * No admin, no owner, no upgrade, no fee.
 *
 * Designed for Base mainnet (chain id 8453); identical bytecode redeploys on any
 * EVM chain.
 */
contract SignaRooms {
    uint256 public constant MAX_BODY_BYTES = 8000;

    struct Room {
        address creator;
        address gateToken;   // address(0) = open (no gate)
        uint256 minBalance;  // min token units to post (gated rooms)
        uint64  createdAt;
        bool    exists;
        string  name;
    }

    /// @notice roomId (keccak256 of the name) → room config.
    mapping(bytes32 => Room) public rooms;
    /// @notice roomId → number of messages posted.
    mapping(bytes32 => uint256) public roomMessageCount;
    /// @notice Total messages across all rooms (also the latest global id).
    uint256 public totalMessages;
    /// @notice Total rooms created.
    uint256 public totalRooms;

    event RoomCreated(bytes32 indexed roomId, address indexed creator, address gateToken, uint256 minBalance, string name);
    event RoomMessage(uint256 indexed id, bytes32 indexed roomId, address indexed from, string body, uint64 timestamp);

    error RoomExists();
    error RoomNotFound();
    error NotEligible(uint256 required, uint256 has);
    error EmptyBody();
    error BodyTooLong(uint256 given, uint256 max);

    /// @notice Deterministic room id for a name.
    function roomId(string calldata name) public pure returns (bytes32) {
        return keccak256(bytes(name));
    }

    /**
     * @notice Create a room. `gateToken == address(0)` → open room (anyone posts);
     * otherwise posting requires `balanceOf(sender) >= minBalance` of the token.
     * First-come per name; reverts if the name is taken.
     */
    function createRoom(string calldata name, address gateToken, uint256 minBalance) external returns (bytes32 id) {
        id = keccak256(bytes(name));
        if (rooms[id].exists) revert RoomExists();
        rooms[id] = Room({
            creator: msg.sender,
            gateToken: gateToken,
            minBalance: minBalance,
            createdAt: uint64(block.timestamp),
            exists: true,
            name: name
        });
        unchecked { totalRooms += 1; }
        emit RoomCreated(id, msg.sender, gateToken, minBalance, name);
    }

    /// @notice Whether `who` is allowed to post in a room right now.
    function canPost(bytes32 id, address who) public view returns (bool) {
        Room storage r = rooms[id];
        if (!r.exists) return false;
        if (r.gateToken == address(0)) return true;
        return IERC20Balance(r.gateToken).balanceOf(who) >= r.minBalance;
    }

    /**
     * @notice Post a message to a room. Enforces the token gate on-chain.
     * Emits a readable `RoomMessage` event.
     */
    function post(bytes32 id, string calldata body) external returns (uint256 msgId) {
        Room storage r = rooms[id];
        if (!r.exists) revert RoomNotFound();
        uint256 len = bytes(body).length;
        if (len == 0) revert EmptyBody();
        if (len > MAX_BODY_BYTES) revert BodyTooLong(len, MAX_BODY_BYTES);
        if (r.gateToken != address(0)) {
            uint256 bal = IERC20Balance(r.gateToken).balanceOf(msg.sender);
            if (bal < r.minBalance) revert NotEligible(r.minBalance, bal);
        }
        unchecked {
            msgId = ++totalMessages;
            roomMessageCount[id] += 1;
        }
        emit RoomMessage(msgId, id, msg.sender, body, uint64(block.timestamp));
    }
}
