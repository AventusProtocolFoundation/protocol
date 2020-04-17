pragma solidity 0.5.2;

// As defined in ERC777TokensRecipient And The tokensToSend Hook section of https://eips.ethereum.org/EIPS/eip-777
interface IERC777Recipient {
  function tokensReceived(address operator, address from, address to, uint256 amount, bytes calldata data,
      bytes calldata operatorData) external;
}