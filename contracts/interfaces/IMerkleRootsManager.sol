pragma solidity ^0.4.24;

interface IMerkleRootsManager {

  /**
   * @notice Event emitted for a registerMerkleRoot transaction.
   */
  event LogMerkleRootRegistered(address indexed ownerAddress, bytes32 indexed rootHash);

  /**
   * @notice Register the given merkleRoot on the Aventus Protocol.
   */
  function registerMerkleRoot(bytes32 _rootHash) external;
}