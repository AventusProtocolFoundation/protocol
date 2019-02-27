pragma solidity ^0.5.2;

interface IMerkleRootsManager {

  /**
   * @notice Event emitted for a registerMerkleRoot transaction.
   */
  event LogMerkleRootRegistered(address indexed ownerAddress, bytes32 indexed rootHash, uint treeDepth, uint lastEventTime);

  /**
   * @notice Event emitted upon a successful merkle root challenge
   */
  event LogMerkleRootAutoChallenged(address indexed challenger, bytes32 indexed rootHash);

  /**
   * @notice Event emitted for a deregisterMerkleRoot transaction.
   */
  event LogMerkleRootDeregistered(bytes32 indexed rootHash);

  /**
   * @notice Register the given merkleRoot on the Aventus Protocol.
   * @param _rootHash Root hash of the merkle tree
   * @param _treeDepth Number of layers of the merkle tree (including the root)
   * @param _lastEventTime last even time of any ticket on the merkle tree
   */
  function registerMerkleRoot(bytes32 _rootHash, uint _treeDepth, uint _lastEventTime) external;

  /**
   * @notice Deregister the given merkle root from the Aventus Protocol.
   * @param _rootHash Root hash of the tree to be deregistered
   */
  function deregisterMerkleRoot(bytes32 _rootHash) external;

  /**
   * @notice Get the required deposit for a new merkle root registration at the time of calling
   * @param _treeDepth Number of layers of the merkle tree (including the root)
   * @param _lastEventTime last even time of any ticket on the merkle tree
   */
  function getNewMerkleRootDeposit(uint _treeDepth, uint _lastEventTime) external view returns (uint deposit_);

  /**
   * @notice Challenge (with automatic resolution) and claim deposit of existing merkle root based on declared tree depth
   * @param _leafHash hash of leaf at depth greater than declared
   * @param _merklePath merkle path of the given leaf hash
   */
  function autoChallengeTreeDepth(bytes32 _leafHash, bytes32[] calldata _merklePath) external;

  /**
   * @notice Challenge (with automatic resolution) and claim deposit of existing merkle root based on declared last event time
   * @param _eventId event with later event time than declared last event time
   * @param _remainingLeafContent all remaining leaf content (ie. excluding event id) packed as bytes
   * @param _merklePath merkle path of the fraudulent leaf
   */
  function autoChallengeLastEventTime(uint _eventId, bytes calldata _remainingLeafContent, bytes32 [] calldata _merklePath)
    external;
}