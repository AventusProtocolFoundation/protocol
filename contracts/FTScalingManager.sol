pragma solidity 0.5.2;

import "./interfaces/IAventusStorage.sol";
import "./interfaces/IFTScalingManager.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IERC777.sol";
import "./interfaces/IERC777Recipient.sol";
import "./thirdParty/interfaces/IERC1820Registry.sol";
import "./libraries/zeppelin/LECRecovery.sol";
import "./libraries/LMerkleRoots.sol";
import "./proxies/PDelegate.sol";

// See IFTScalingManager for event and external method descriptions.
// NOTE: This contract will revert if ERC20 transfer or transferFrom fail. This mimics the mainnet AVT contract. Do NOT assume
// this to be the case for ALL ERC20 contracts if using this as a generic ERC20 scaler.
contract FTScalingManager is IFTScalingManager, PDelegate {
  string private constant ftsmTable = "FTSM";

  bytes32 constant ftsmNonceKey = keccak256(abi.encodePacked(ftsmTable, "Nonce"));

  // Universal address as defined in Registry Contract Address section of https://eips.ethereum.org/EIPS/eip-1820
  IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
  bytes32 constant internal ERC777_TOKEN_INTERFACE_HASH = keccak256("ERC777Token");
  bytes32 constant internal TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");

  event LogLifted(address indexed tokenContract, address indexed lifter, uint amount, uint ftsmNonce);
  event LogLowered(address indexed tokenContract, address indexed lowerer, uint amount, bytes32[] merklePath);

  IAventusStorage public s;

  constructor(IAventusStorage _s)
    public
  {
    s = _s;
  }

  struct LeafData {
    address tokenContract;
    address from;
    address to;
    uint amount;
    uint tier2Nonce;
    bytes proof;
  }

  function init()
    public
  {
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), TOKENS_RECIPIENT_INTERFACE_HASH, address(this));
  }

  function lift(address _erc20Contract, uint _amount)
    external
  {
    IERC20 erc20Contract = IERC20(_erc20Contract);
    require(erc20Contract.balanceOf(msg.sender) >= _amount, 'Insufficient funds');
    require(erc20Contract.allowance(msg.sender, address(this)) >= _amount, 'Funds must be approved');
    // ONLY_IF_ASSERTS_OFF erc20Contract.transferFrom(msg.sender, address(this), _amount);
    assert(erc20Contract.transferFrom(msg.sender, address(this), _amount));

    doLift(_erc20Contract, msg.sender, _amount);
  }

  function lower(bytes calldata _encodedLeafData, bytes32[] calldata _merklePath)
    external
  {
    LeafData memory leafData = decodeLeafData(_encodedLeafData);
    require(address(this) == leafData.to, "Can only lower tier 2 transactions sent to this contract");
    bytes32 leafHash = keccak256(_encodedLeafData);
    checkAndStoreLowerLeafHash(leafHash);

    bytes32 rootHash = LMerkleRoots.generateMerkleRoot(s, _merklePath, leafHash);
    // TODO: Use merkleRootIsActive when deploying with v 0.14 of LMerkleRoots.
    require(LMerkleRoots.merkleRootIsRegistered(s, rootHash), "Tier 2 transaction must be registered on a merkle tree");

    doLower(leafData, _encodedLeafData);

    emit LogLowered(leafData.tokenContract, leafData.from, leafData.amount, _merklePath);
  }

  function tokensReceived(address /* _operator */, address _from, address _to, uint256 _amount, bytes calldata /* _data */,
      bytes calldata /* _operatorData */)
    external
  {
    address implementer = ERC1820_REGISTRY.getInterfaceImplementer(msg.sender, ERC777_TOKEN_INTERFACE_HASH);
    require(implementer == msg.sender, "Must be registered as an ERC777 contract");
    require(_to == address(this), "Tokens must be sent to this contract");
    doLift(msg.sender, _from, _amount);
  }

  function doLift(address _tokenContract, address _lifter, uint _amount)
    private
  {
    uint ftsmNonceValue = s.getUInt(ftsmNonceKey);
    s.setUInt(ftsmNonceKey, ++ftsmNonceValue);
    emit LogLifted(_tokenContract, _lifter, _amount, ftsmNonceValue);
  }

  function doLower(LeafData memory leafData, bytes memory _encodedLeafData)
    private
  {
    if (ERC1820_REGISTRY.getInterfaceImplementer(leafData.tokenContract, ERC777_TOKEN_INTERFACE_HASH) == leafData.tokenContract)
    {
      IERC777 erc777Contract = IERC777(leafData.tokenContract);
      erc777Contract.send(leafData.from, leafData.amount, _encodedLeafData);
    } else {
      IERC20 erc20Contract = IERC20(leafData.tokenContract);
      // ONLY_IF_ASSERTS_OFF erc20Contract.transfer(leafData.from, leafData.amount);
      assert(erc20Contract.transfer(leafData.from, leafData.amount));
    }
  }

  function decodeLeafData(bytes memory _leafData)
    private
    pure
    returns (LeafData memory leafData_)
  {
    (leafData_.tokenContract, leafData_.from, leafData_.to, leafData_.amount, leafData_.tier2Nonce, leafData_.proof) =
        abi.decode(_leafData, (address, address, address, uint, uint, bytes));
  }

  function checkAndStoreLowerLeafHash(bytes32 _lowerHash)
    private
  {
    bool isExistingLowerHash = s.getBoolean(keccak256(abi.encodePacked(ftsmTable, "LowerLeafHash", _lowerHash)));
    require(!isExistingLowerHash, "Lower leaf hash must be unique");
    s.setBoolean(keccak256(abi.encodePacked(ftsmTable, "LowerLeafHash", _lowerHash)), true);
  }

  /**
   * @dev make this contract extensible
   */
  function ()
    external
  {
    address target = s.getAddress(keccak256(abi.encodePacked("FTScalingManagerExtension")));
    require(target != address(0), "Extended functionality FTScalingManager not found");
    delegatedFwd(target, msg.data);
  }
}