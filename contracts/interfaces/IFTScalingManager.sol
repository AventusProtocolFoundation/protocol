pragma solidity ^0.5.2;

interface IFTScalingManager {

  /**
   * @notice Event emitted for a lift transaction.
   */
  event LogLifted(address indexed tokenContract, address indexed lifter, uint amount, uint _ftsmNonce);

  /**
   * @notice Event emitted for a lower transaction.
   */
  event LogLowered(address indexed tokenContract, address indexed lowerer, uint amount, bytes32[] merklePath);

  /**
   * @notice Lift ERC20 tokens from tier 1 to tier 2.
   * @param _erc20Contract ERC20 contract to use for lift
   * @param _amount Amount to lift.
   */
  function lift(address _erc20Contract, uint _amount) external;

  /**
   * @notice Lower ERC20 or ERC777 tokens from tier 2 to tier 1 based on a tier2 transaction to this contract.
   * @param _encodedLeafData Encoded leaf data from tier 2
   * @param _merklePath Merkle path of leaf in tier 2 Merkle tree
   */
   function lower(bytes calldata _encodedLeafData, bytes32[] calldata _merklePath) external;
}