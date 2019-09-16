pragma solidity ^0.5.2;

interface IMerkleRootsManager {

  /**
   * @notice Event emitted for a registerMerkleRoot transaction.
   */
  event LogMerkleRootRegistered(address indexed rootOwner, bytes32 indexed rootHash, uint treeDepth, uint rootExpiryTime,
      uint rootDeposit, string treeContentURL);

  /**
   * @notice Event emitted upon a successful merkle root challenge
   */
  event LogMerkleRootAutoChallenged(address indexed rootOwner, bytes32 indexed rootHash, address indexed challenger);

  /**
   * @notice Event emitted for a deregisterMerkleRoot transaction.
   */
  event LogMerkleRootDeregistered(address indexed rootOwner, bytes32 indexed rootHash);

  /**
   * @notice Register the given merkleRoot on the Aventus Protocol.
   * @param _rootHash Root hash of the merkle tree
   * @param _treeDepth Number of layers of the merkle tree (including the root)
   * @param _rootExpiryTime root expiry time is the last event time of any ticket on the merkle tree
   * @param _treeContentURL url linking to raw leaf data for all leaves on this tree
   */
  function registerMerkleRoot(bytes32 _rootHash, uint _treeDepth, uint _rootExpiryTime, string calldata _treeContentURL)
      external;

  /**
   * @notice Get the timestamp for when the given root can be deregistered. This is a combination of the root expiry time and
   * the root cooling off period.
   * @param _rootHash Root hash of the tree to get the deregistration time for
   */
  function getMerkleRootDeregistrationTime(bytes32 _rootHash) external view returns (uint deregistrationTime_)
;

  /**
   * @notice Deregister the given merkle root from the Aventus Protocol.
   * @param _rootHash Root hash of the tree to be deregistered
   */
  function deregisterMerkleRoot(bytes32 _rootHash) external;

  /**
   * @notice Get the required deposit for a new merkle root registration at the time of calling
   * @param _treeDepth Number of layers of the merkle tree (including the root)
   * @param _rootExpiryTime root expiry time is the last event time of any ticket on the merkle tree
   */
  function getNewMerkleRootDeposit(uint _treeDepth, uint _rootExpiryTime) external view returns (uint deposit_);

  /**
   * @notice Challenge (with automatic resolution) and claim deposit of existing merkle root based on declared tree depth
   * @param _leafHash hash of leaf at depth greater than declared
   * @param _merklePath merkle path of the given leaf hash
   */
  function autoChallengeTreeDepth(bytes32 _leafHash, bytes32[] calldata _merklePath) external;

  /**
   * @notice Challenge (with automatic resolution) and claim deposit of existing merkle root based on declared expiry time
   * @param _encodedLeaf leaf data for a transaction on an event with eventTime later than the root's specified expiry time
   * @param _merklePath merkle path of the fraudulent leaf
   */
  function autoChallengeRootExpiryTime(bytes calldata _encodedLeaf, bytes32 [] calldata _merklePath)
    external;
}