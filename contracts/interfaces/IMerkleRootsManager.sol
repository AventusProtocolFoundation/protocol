pragma solidity ^0.4.24;

interface IMerkleRootsManager {

  /**
   * @notice Event emitted for a registerMerkleRoot transaction.
   */
  event LogMerkleRootRegistered(address indexed ownerAddress, bytes32 indexed rootHash, string evidenceUrl, string desc,
      uint deposit);

  /**
   * @notice Event emitted for a deregisterMerkleRoot transaction.
   */
  event LogMerkleRootDeregistered(bytes32 indexed rootHash);

  /**
   * @notice Event emitted for a challengeMerkleRoot transaction.
   */
  event LogMerkleRootChallenged(bytes32 indexed rootHash, uint indexed proposalId, uint lobbyingStart, uint votingStart,
      uint revealingStart, uint revealingEnd);

  /**
   * Event emitted for a endMerkleRootChallenge transaction.
   */
  event LogMerkleRootChallengeEnded(bytes32 indexed rootHash, uint indexed proposalId, uint votesFor, uint votesAgainst);

  /**
   * @notice Register the given merkleRoot on the Aventus Protocol.
   * NOTE: requires a deposit to be made. See getNewMerkleRootDeposit().
   */
  function registerMerkleRoot(address _ownerAddress, string _evidenceUrl, string _desc, bytes32 _rootHash) external;

  /**
   * @notice Stop the given merkleRoot from using the Aventus Protocol. This will unlock
   * the deposit that was locked when the merkleRoot was registered.
   */
  function deregisterMerkleRoot(bytes32 _rootHash) external;

  /**
   * @notice Create a challenge proposal for the specified Merkle Root
   * @param _rootHash root hash to be challenged
   */
  function challengeMerkleRoot(bytes32 _rootHash) external;

  /**
   * @notice Ends a challenge on the specified merkle root.
   * @param _rootHash hash of the merkle root to be cleared of challenge
   */
  function endMerkleRootChallenge(bytes32 _rootHash) external;

  /**
   * @notice Get the deposit value in AVT - to 18 sig fig - required to register a merkleRoot.
   * See registerMerkleRoot().
   */
  function getNewMerkleRootDeposit() external view returns (uint merkleRootDepositInAVT_);

  /**
   * @notice Gets the deposit paid for the specified merkleRoot.
   */
  function getExistingMerkleRootDeposit(bytes32 _rootHash) external view returns (uint merkleRootDepositInAVT_);
}