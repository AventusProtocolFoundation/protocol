pragma solidity ^0.4.19;

import './interfaces/IAventusStorage.sol';
import './Owned.sol';

contract ParameterRegistry is Owned {

  // Proposal default values.
  uint private constant GOVERNANCE_PROPOSAL_LOBBYING_PERIOD_DAYS = 14;
  uint private constant GOVERNANCE_PROPOSAL_VOTING_PERIOD_DAYS = 7;
  uint private constant GOVERNANCE_PROPOSAL_REVEALING_PERIOD_DAYS = 7;
  uint private constant GOVERNANCE_PROPOSAL_DEPOSIT_US_CENTS = 10000;
  uint private constant EVENT_CHALLENGE_LOBBYING_PERIOD_DAYS = 14;
  uint private constant EVENT_CHALLENGE_VOTING_PERIOD_DAYS = 7;
  uint private constant EVENT_CHALLENGE_REVEALING_PERIOD_DAYS = 7;

  // Events default values.
  uint private constant EVENT_MINIMUM_DEPOSIT_US_CENTS = 1000;
  uint private constant EVENT_FIXED_DEPOSIT_US_CENTS = 100000;
  uint private constant EVENT_MAXIMUM_DEPOSIT_US_CENTS = 1000000;
  uint private constant EVENT_MINIMUM_REPORTING_PERIOD_DAYS = 30;
  uint8 private constant EVENT_WINNINGS_FOR_CHALLENGE_ENDER_PERCENTAGE = 10;
  uint8 private constant EVENT_WINNINGS_FOR_CHALLENGE_WINNER_PERCENTAGE = 10;

  // Apps default values.
  uint private constant APPLICATION_DEPOSIT = 100000; // In US cents

  uint private constant AVT_IN_US_CENTS = 100;

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