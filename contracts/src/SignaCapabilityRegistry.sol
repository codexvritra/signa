// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  SignaCapabilityRegistry
 * @notice Permissionless, trustless on-chain registry for SIGNA agent
 *         capabilities. A provider wallet calls `register(...)` to publish
 *         a capability the whole agent network can discover and call — no
 *         account, no API key, no platform in the middle.
 *
 * The full callable spec lives ON CHAIN (endpoint, method, price, payout),
 * not in any single node's database. That is the point: discovery and the
 * data needed to invoke a capability can be read straight from Base by
 * anyone, with no trust in SIGNA's index. A node that serves different
 * capability data than the chain says can be caught and rejected.
 *
 * First-write-wins on the name (keyed by keccak256(name)). Only the original
 * provider can update or deregister. Records are retained after deregister
 * for audit; the name frees up for re-registration.
 *
 * Identity = the wallet. msg.sender is the provider. There is no owner, no
 * admin, no upgrade path, no fee. Same model as SignaRoomRegistry and
 * SignaNodeRegistry, extended to capabilities.
 *
 * Designed for Base mainnet (chain id 8453). Identical bytecode redeploys
 * verbatim on any EVM chain.
 */
contract SignaCapabilityRegistry {
    // ---------- types ----------

    struct Capability {
        address provider;     // wallet that registered the name (msg.sender)
        string  endpoint;     // https URL the capability is served from
        string  method;       // "GET" or "POST"
        string  description;  // short human description (discovery)
        uint256 priceUsdc;    // USDC base units (6dp) per call; 0 = free
        address payTo;        // payout address; provider if address(0)
        uint64  registeredAt; // unix seconds at first register()
        uint64  updatedAt;    // unix seconds at most recent update
        uint64  calls;        // optional provider-reported usage counter
        bool    active;       // false after deregister() — record retained
    }

    // ---------- storage ----------

    /// @notice nameHash → capability. nameHash = keccak256(bytes(name)).
    mapping(bytes32 => Capability) public capByHash;

    /// @notice nameHash → the original string name, for forward lookup.
    mapping(bytes32 => string) public nameByHash;

    /// @notice Enumerable list of every nameHash ever registered.
    bytes32[] public registeredNames;

    /// @notice nameHash → 1-based index into registeredNames[]. Zero means
    ///         "never registered", distinguishing first-register from update.
    mapping(bytes32 => uint256) public indexPlusOne;

    /// @notice Active capability count. Decreases on deregister().
    uint256 public activeCount;

    // ---------- events ----------

    event CapabilityRegistered(
        bytes32 indexed nameHash,
        address indexed provider,
        string  name,
        string  endpoint,
        string  method,
        uint256 priceUsdc,
        address payTo,
        uint64  registeredAt
    );
    event CapabilityUpdated(
        bytes32 indexed nameHash,
        address indexed provider,
        string  endpoint,
        string  method,
        uint256 priceUsdc,
        address payTo,
        uint64  updatedAt
    );
    event CapabilityDeregistered(
        bytes32 indexed nameHash,
        address indexed provider,
        uint64  deregisteredAt
    );
    event CapabilityCalled(
        bytes32 indexed nameHash,
        address indexed provider,
        uint64  calls
    );

    // ---------- errors ----------

    error EmptyName();
    error NameTooLong();
    error EndpointTooLong();
    error DescriptionTooLong();
    error BadEndpoint();   // must begin with "https://"
    error BadMethod();     // must be GET or POST
    error PriceTooHigh();
    error NotProvider();
    error NotActive();

    // ---------- limits ----------

    uint256 public constant MAX_NAME_BYTES = 40;
    uint256 public constant MAX_ENDPOINT_BYTES = 256;
    uint256 public constant MAX_DESCRIPTION_BYTES = 240;
    /// @dev 100 USDC per call ceiling (6dp). Keeps obviously-bogus prices out.
    uint256 public constant MAX_PRICE_USDC = 100_000_000;

    bytes32 private constant GET_HASH = keccak256(bytes("GET"));
    bytes32 private constant POST_HASH = keccak256(bytes("POST"));
    bytes32 private constant HTTPS_PREFIX = keccak256(bytes("https://"));

    // ---------- write API ----------

    /**
     * @notice Register (or, if you are the provider, update) a capability.
     * @param name        Capability name, e.g. "myteam.summarize" (1..40 bytes).
     * @param endpoint    https URL serving the capability (<=256 bytes).
     * @param method      "GET" or "POST".
     * @param description Short human description (<=240 bytes).
     * @param priceUsdc   Per-call price in USDC base units (6dp); 0 for free.
     * @param payTo       Payout address; pass address(0) to default to provider.
     */
    function register(
        string calldata name,
        string calldata endpoint,
        string calldata method,
        string calldata description,
        uint256 priceUsdc,
        address payTo
    ) external {
        bytes memory nameBytes = bytes(name);
        if (nameBytes.length == 0) revert EmptyName();
        if (nameBytes.length > MAX_NAME_BYTES) revert NameTooLong();

        bytes memory epBytes = bytes(endpoint);
        if (epBytes.length > MAX_ENDPOINT_BYTES) revert EndpointTooLong();
        if (epBytes.length < 8 || !_hasHttpsPrefix(epBytes)) revert BadEndpoint();

        if (bytes(description).length > MAX_DESCRIPTION_BYTES) revert DescriptionTooLong();

        bytes32 mHash = keccak256(bytes(method));
        if (mHash != GET_HASH && mHash != POST_HASH) revert BadMethod();

        if (priceUsdc > MAX_PRICE_USDC) revert PriceTooHigh();

        bytes32 nameHash = keccak256(nameBytes);
        Capability storage c = capByHash[nameHash];
        uint64 nowTs = uint64(block.timestamp);
        address resolvedPayTo = payTo == address(0) ? msg.sender : payTo;

        if (indexPlusOne[nameHash] == 0) {
            // first-time registration
            registeredNames.push(nameHash);
            indexPlusOne[nameHash] = registeredNames.length;
            nameByHash[nameHash] = name;
            c.provider = msg.sender;
            c.endpoint = endpoint;
            c.method = method;
            c.description = description;
            c.priceUsdc = priceUsdc;
            c.payTo = resolvedPayTo;
            c.registeredAt = nowTs;
            c.updatedAt = nowTs;
            c.active = true;
            activeCount += 1;
            emit CapabilityRegistered(nameHash, msg.sender, name, endpoint, method, priceUsdc, resolvedPayTo, nowTs);
        } else {
            // update — only the original provider may update
            if (c.provider != msg.sender) revert NotProvider();
            bool wasActive = c.active;
            c.endpoint = endpoint;
            c.method = method;
            c.description = description;
            c.priceUsdc = priceUsdc;
            c.payTo = resolvedPayTo;
            c.updatedAt = nowTs;
            if (!wasActive) {
                c.active = true;
                activeCount += 1;
                emit CapabilityRegistered(nameHash, msg.sender, name, endpoint, method, priceUsdc, resolvedPayTo, nowTs);
            } else {
                emit CapabilityUpdated(nameHash, msg.sender, endpoint, method, priceUsdc, resolvedPayTo, nowTs);
            }
        }
    }

    /**
     * @notice Deregister a capability. Name frees up for re-registration by
     *         any wallet. Only the original provider can deregister. The
     *         historical record stays in storage for audit.
     */
    function deregister(string calldata name) external {
        bytes32 nameHash = keccak256(bytes(name));
        Capability storage c = capByHash[nameHash];
        if (!c.active) revert NotActive();
        if (c.provider != msg.sender) revert NotProvider();
        c.active = false;
        c.updatedAt = uint64(block.timestamp);
        activeCount -= 1;
        emit CapabilityDeregistered(nameHash, msg.sender, uint64(block.timestamp));
    }

    /**
     * @notice Optional: a provider may bump their own usage counter on chain.
     *         Purely informational; off-chain gateways track real usage too.
     */
    function recordCall(string calldata name) external {
        bytes32 nameHash = keccak256(bytes(name));
        Capability storage c = capByHash[nameHash];
        if (!c.active) revert NotActive();
        if (c.provider != msg.sender) revert NotProvider();
        c.calls += 1;
        emit CapabilityCalled(nameHash, msg.sender, c.calls);
    }

    // ---------- read API ----------

    /// @notice Total names ever registered (active + deregistered).
    function totalRegistered() external view returns (uint256) {
        return registeredNames.length;
    }

    /// @notice Look up a capability by name. Zero-valued struct if unknown.
    function getCapability(string calldata name)
        external
        view
        returns (Capability memory)
    {
        return capByHash[keccak256(bytes(name))];
    }

    /**
     * @notice Page through capabilities in registration order. Returns up to
     *         `count` entries starting at `start`. Callers wanting only live
     *         capabilities filter on `active`.
     */
    function listCapabilities(uint256 start, uint256 count)
        external
        view
        returns (string[] memory names, Capability[] memory page)
    {
        uint256 total = registeredNames.length;
        if (start >= total) {
            return (new string[](0), new Capability[](0));
        }
        uint256 end = start + count;
        if (end > total) end = total;
        uint256 len = end - start;
        names = new string[](len);
        page = new Capability[](len);
        for (uint256 i = 0; i < len; i++) {
            bytes32 h = registeredNames[start + i];
            names[i] = nameByHash[h];
            page[i] = capByHash[h];
        }
    }

    // ---------- internal ----------

    /// @dev True iff `b` begins with the ASCII bytes "https://".
    function _hasHttpsPrefix(bytes memory b) private pure returns (bool) {
        // b.length >= 8 guaranteed by caller
        bytes8 want = bytes8("https://");
        for (uint256 i = 0; i < 8; i++) {
            if (b[i] != want[i]) return false;
        }
        return true;
    }
}
