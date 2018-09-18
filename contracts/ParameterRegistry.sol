pragma solidity ^0.4.24;

import './interfaces/IAventusStorage.sol';
import './Owned.sol';
import './Versioned.sol';

contract ParameterRegistry is Owned, Versioned {

  // Proposal default values.
  uint private constant GOVERNANCE_PROPOSAL_LOBBYING_PERIOD_DAYS = 14;
  uint private constant GOVERNANCE_PROPOSAL_VOTING_PERIOD_DAYS = 7;
  uint private constant GOVERNANCE_PROPOSAL_REVEALING_PERIOD_DAYS = 7;
  uint private constant GOVERNANCE_PROPOSAL_DEPOSIT_US_CENTS = 10000;
  uint private constant AVENTITY_CHALLENGE_LOBBYING_PERIOD_DAYS = 14;
  uint private constant AVENTITY_CHALLENGE_VOTING_PERIOD_DAYS = 7;
  uint private constant AVENTITY_CHALLENGE_REVEALING_PERIOD_DAYS = 7;

  // Events default values.
  uint private constant EVENT_MINIMUM_DEPOSIT_US_CENTS = 1000;
  uint private constant EVENT_FIXED_DEPOSIT_US_CENTS = 100000;
  uint private constant EVENT_MAXIMUM_DEPOSIT_US_CENTS = 1000000;
  uint private constant EVENT_MINIMUM_REPORTING_PERIOD_DAYS = 30;
  uint8 private constant EVENT_WINNINGS_FOR_CHALLENGE_ENDER_PERCENTAGE = 10;
  uint8 private constant EVENT_WINNINGS_FOR_CHALLENGE_WINNER_PERCENTAGE = 10;

  // Aventity default values.
  uint private constant BROKER_DEPOSIT = 100000; // In US cents
  uint private constant PRIMARY_DELEGATE_DEPOSIT = 100000; // In US cents
  uint private constant SECONDARY_DELEGATE_DEPOSIT = 100000; // In US cents
  uint private constant TOKEN_BONDING_CURVE_DEPOSIT = 100000; // In US cents
  uint private constant SCALING_PROVIDER_DEPOSIT = 100000; // In US cents
  uint private constant MERKLE_ROOT_DEPOSIT = 100000; // In US cents

  uint private constant AVT_IN_US_CENTS = 97;

  IAventusStorage public s;

  /**
  * @dev Constructor
  * @param _s Persistent storage contract
  */
  constructor(IAventusStorage _s) public {
    s = _s;
  }

  // TODO: Consider pre-calculating any fixed keccaks - will save gas - here and elsewhere in the code.
  function setupDefaultParameters() external onlyOwner {
    s.setUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalLobbyingPeriodDays")), GOVERNANCE_PROPOSAL_LOBBYING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalVotingPeriodDays")), GOVERNANCE_PROPOSAL_VOTING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalRevealingPeriodDays")), GOVERNANCE_PROPOSAL_REVEALING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalFixedDepositInUSCents")), GOVERNANCE_PROPOSAL_DEPOSIT_US_CENTS);

    s.setUInt(keccak256(abi.encodePacked("Aventities", "challengeLobbyingPeriodDays")), AVENTITY_CHALLENGE_LOBBYING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Aventities", "challengeVotingPeriodDays")), AVENTITY_CHALLENGE_VOTING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Aventities", "challengeRevealingPeriodDays")), AVENTITY_CHALLENGE_REVEALING_PERIOD_DAYS);

    s.setUInt(keccak256(abi.encodePacked("Events", "minimumDepositAmountUSCents")), EVENT_MINIMUM_DEPOSIT_US_CENTS);
    s.setUInt(keccak256(abi.encodePacked("Events", "fixedDepositAmountUSCents")), EVENT_FIXED_DEPOSIT_US_CENTS);
    s.setUInt(keccak256(abi.encodePacked("Events", "maximumDepositAmountUSCents")), EVENT_MAXIMUM_DEPOSIT_US_CENTS);
    s.setUInt(keccak256(abi.encodePacked("Events", "minimumEventReportingPeriodDays")), EVENT_MINIMUM_REPORTING_PERIOD_DAYS);
    s.setUInt8(keccak256(abi.encodePacked("Events", "winningsForChallengeEnderPercentage")), EVENT_WINNINGS_FOR_CHALLENGE_ENDER_PERCENTAGE);
    s.setUInt8(keccak256(abi.encodePacked("Events", "winningsForChallengeWinnerPercentage")), EVENT_WINNINGS_FOR_CHALLENGE_WINNER_PERCENTAGE);

    s.setUInt(keccak256(abi.encodePacked("Members", "Broker", "fixedDepositAmount")), BROKER_DEPOSIT);
    s.setUInt(keccak256(abi.encodePacked("Members", "PrimaryDelegate", "fixedDepositAmount")), PRIMARY_DELEGATE_DEPOSIT);
    s.setUInt(keccak256(abi.encodePacked("Members", "SecondaryDelegate", "fixedDepositAmount")), SECONDARY_DELEGATE_DEPOSIT);
    s.setUInt(keccak256(abi.encodePacked("Members", "TokenBondingCurve", "fixedDepositAmount")), TOKEN_BONDING_CURVE_DEPOSIT);
    s.setUInt(keccak256(abi.encodePacked("Members", "ScalingProvider", "fixedDepositAmount")), SCALING_PROVIDER_DEPOSIT);

    s.setUInt(keccak256(abi.encodePacked("MerkleRoots", "fixedDepositAmount")), MERKLE_ROOT_DEPOSIT);

    s.setUInt(keccak256(abi.encodePacked("OneAVTInUSCents")), AVT_IN_US_CENTS);
  }
}