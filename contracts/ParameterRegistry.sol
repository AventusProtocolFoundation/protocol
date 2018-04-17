pragma solidity ^0.4.19;

import './interfaces/IAventusStorage.sol';
import './Owned.sol';

contract ParameterRegistry is Owned {

  // System variables
  // Window should be 900 seconds according to:
  // https://github.com/ethereum/wiki/blob/c02254611f218f43cbb07517ca8e5d00fd6d6d75/Block-Protocol-2.0.md
  uint private constant TIME_IS_NOW_WINDOW = 900;

  // Proposal default values.
  uint private constant GOVERNANCE_PROPOSAL_LOBBYING_PERIOD_DAYS = 14;
  uint private constant GOVERNANCE_PROPOSAL_VOTING_PERIOD_DAYS = 7;
  uint private constant GOVERNANCE_PROPOSAL_REVEALING_PERIOD_DAYS = 7;
  uint private constant GOVERNANCE_PROPOSAL_DEPOSIT_US_CENTS = 10000;
  uint private constant EVENT_CHALLENGE_LOBBYING_PERIOD_DAYS = 14;
  uint private constant EVENT_CHALLENGE_VOTING_PERIOD_DAYS = 7;
  uint private constant EVENT_CHALLENGE_REVEALING_PERIOD_DAYS = 7;

  // Lock default values.
  uint private constant LOCK_AMOUNT_MAX_AVT = 1;
  uint private constant LOCK_BALANCE_MAX_AVT = 1000;

  // Events default values.
  uint private constant EVENT_MINIMUM_DEPOSIT_US_CENTS = 1000;
  uint private constant EVENT_FIXED_DEPOSIT_US_CENTS = 100000;
  uint private constant EVENT_MAXIMUM_DEPOSIT_US_CENTS = 1000000;
  uint private constant EVENT_MINIMUM_REPORTING_PERIOD_DAYS = 30;
  uint8 private constant EVENT_WINNINGS_FOR_CHALLENGE_ENDER_PERCENTAGE = 10;
  uint8 private constant EVENT_WINNINGS_FOR_CHALLENGE_WINNER_PERCENTAGE = 10;

  // Apps default values.
  uint private constant APPLICATION_DEPOSIT = 100000; // In US cents

  uint private constant AVT_IN_US_CENTS = 5;

  IAventusStorage public s;

  /**
  * @dev Constructor
  * @param _s Persistent storage contract
  */
  function ParameterRegistry(IAventusStorage _s) public {
    s = _s;
  }

  // TODO: Consider pre-calculating any fixed keccaks - will save gas - here and elsewhere in the code.
  function setupDefaultParameters() public onlyOwner {

    s.setUInt(keccak256("TimeIsNowWindow"), TIME_IS_NOW_WINDOW);

    s.setBoolean(keccak256("LockRestricted"), false);
    s.setUInt(keccak256("LockAmountMax"), to18SigFig(LOCK_AMOUNT_MAX_AVT));
    s.setUInt(keccak256("LockBalanceMax"), to18SigFig(LOCK_BALANCE_MAX_AVT));

    s.setUInt(keccak256("Proposal", "governanceProposalLobbyingPeriodDays"), GOVERNANCE_PROPOSAL_LOBBYING_PERIOD_DAYS);
    s.setUInt(keccak256("Proposal", "governanceProposalVotingPeriodDays"), GOVERNANCE_PROPOSAL_VOTING_PERIOD_DAYS);
    s.setUInt(keccak256("Proposal", "governanceProposalRevealingPeriodDays"), GOVERNANCE_PROPOSAL_REVEALING_PERIOD_DAYS);
    s.setUInt(keccak256("Proposal", "governanceProposalFixedDepositInUsCents"), GOVERNANCE_PROPOSAL_DEPOSIT_US_CENTS);

    s.setUInt(keccak256("Proposal", "eventChallengeLobbyingPeriodDays"), EVENT_CHALLENGE_LOBBYING_PERIOD_DAYS);
    s.setUInt(keccak256("Proposal", "eventChallengeVotingPeriodDays"), EVENT_CHALLENGE_VOTING_PERIOD_DAYS);
    s.setUInt(keccak256("Proposal", "eventChallengeRevealingPeriodDays"), EVENT_CHALLENGE_REVEALING_PERIOD_DAYS);

    s.setUInt(keccak256("Events", "minimumDepositAmountUsCents"), EVENT_MINIMUM_DEPOSIT_US_CENTS);
    s.setUInt(keccak256("Events", "fixedDepositAmountUsCents"), EVENT_FIXED_DEPOSIT_US_CENTS);
    s.setUInt(keccak256("Events", "maximumDepositAmountUsCents"), EVENT_MAXIMUM_DEPOSIT_US_CENTS);
    s.setUInt(keccak256("Events", "minimumEventReportingPeriodDays"), EVENT_MINIMUM_REPORTING_PERIOD_DAYS);
    s.setUInt8(keccak256("Events", "winningsForChallengeEnderPercentage"), EVENT_WINNINGS_FOR_CHALLENGE_ENDER_PERCENTAGE);
    s.setUInt8(keccak256("Events", "winningsForChallengeWinnerPercentage"), EVENT_WINNINGS_FOR_CHALLENGE_WINNER_PERCENTAGE);


    s.setUInt(keccak256("Applications", "fixedDepositAmount"), APPLICATION_DEPOSIT);

    s.setUInt(keccak256("OneAVTInUSCents"), AVT_IN_US_CENTS);
  }

  function to18SigFig(uint _avtValue) internal pure returns (uint) {
    return  _avtValue * 10**18;
  }
}