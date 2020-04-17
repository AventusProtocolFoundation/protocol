pragma solidity 0.5.2;

import "../interfaces/IERC777Recipient.sol";
import "../thirdParty/interfaces/IERC1820Registry.sol";

contract MockERC777Token {
  event MockERC777Sent(address indexed from, address indexed to, uint256 amount, bytes data);

  IERC1820Registry constant internal ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
  bytes32 constant internal TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");

  constructor()
    public
  {
    ERC1820_REGISTRY.setInterfaceImplementer(address(this), keccak256("ERC777Token"), address(this));
  }

  function send(address _to, uint256 _amount, bytes calldata _data)
    external
  {
    address implementer = ERC1820_REGISTRY.getInterfaceImplementer(_to, TOKENS_RECIPIENT_INTERFACE_HASH);
    if (implementer != address(0))
      IERC777Recipient(implementer).tokensReceived(msg.sender, msg.sender, _to, _amount, _data, "");

    emit MockERC777Sent(msg.sender, _to, _amount, _data);
  }
}