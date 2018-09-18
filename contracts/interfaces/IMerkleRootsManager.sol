pragma solidity ^0.4.24;

interface IMerkleRootsManager {

  /**
   * Event emitted for a registerMerkleRoot transaction.
   */
  event LogMerkleRootRegistered(address indexed ownerAddress, bytes32 indexed rootHash, string evidenceUrl, string desc, uint deposit);

  /**
   * Event emitted for a deregisterMerkleRoot transaction.
   */
  event LogMerkleRootDeregistered(bytes32 indexed rootHash);

  /**
   * Event emitted for a challengeMerkleRoot transaction.
   */
  event LogMerkleRootChallenged(bytes32 indexed rootHash, uint indexed proposalId, uint lobbyingStart, uint votingStart, uint revealingStart, uint revealingEnd);

  /**
   * Register the given address and role as a merkleRoot of the Aventus Protocol.
   * NOTE: requires a deposit to be made. See getNewMerkleRootDeposit().
   */
  function registerMerkleRoot(address _ownerAddress, string _evidenceUrl, string _desc, bytes32 _rootHash) external;

  /**
   * Stop the given merkleRoot from using the Aventus Protocol. This will unlock
   * the deposit that was locked when the merkleRoot was registered.
   */
  function deregisterMerkleRoot(bytes32 _rootHash) external;

  /**
   * @dev Create a challenge proposal for the specified Merkle Root
   * @param _rootHash root hash to be challenged
   * @return proposalId_ id for proposal representing the challenge
   */
  function challengeMerkleRoot(bytes32 _rootHash) external returns (uint proposalId_);

  /**
   * @return true if the given merkleRoot is allowed to use the Aventus Protocol.
   * ie registered AND not fraudulent.
   */
  function merkleRootIsActive(bytes32 _rootHash) external view returns (bool isActive_);

  /**
   * Get the deposit value in AVT - to 18 sig fig - required to register a merkleRoot.
   * See registerMerkleRoot().
   */
  function getNewMerkleRootDeposit() external view returns (uint merkleRootDepositInAVT_);

  /**
   * Gets the deposit paid for the specified merkleRoot.
   */
  function getExistingMerkleRootDeposit(bytes32 _rootHash) external view returns (uint merkleRootDepositInAVT_);

  /**
   * @dev Generates a merkle root hash from a given leaf hash and merkle path
   * Assumes the children hashes of a hash were sorted and concatenated with a colon before hashing
   * @param _merklePath - Path containing sibling hashes on the branch from the leaf to the root of the Merkle tree
   * @param _leaf - Leaf of Merkle tree
   * @return rootHash_ - Root hash of merkle tree
   */
  function generateMerkleRoot(bytes32[] _merklePath, bytes32 _leaf) external view returns (bytes32 rootHash_);
}