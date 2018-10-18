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
  uint private constant EVENT_FREE_DEPOSIT_US_CENTS = 1000;
  uint private constant EVENT_PAID_DEPOSIT_US_CENTS = 100000;
  uint private constant EVENT_MINIMUM_REPORTING_PERIOD_DAYS = 30;
  uint private constant EVENT_WINNINGS_FOR_CHALLENGE_ENDER_PERCENTAGE = 10;
  uint private constant EVENT_WINNINGS_FOR_CHALLENGE_WINNER_PERCENTAGE = 10;

  // Aventity default values.
  uint private constant BROKER_DEPOSIT = 100000; // In US cents
  uint private constant PRIMARY_DEPOSIT = 100000; // In US cents
  uint private constant SECONDARY_DEPOSIT = 100000; // In US cents
  uint private constant TOKEN_BONDING_CURVE_DEPOSIT = 100000; // In US cents
  uint private constant SCALING_PROVIDER_DEPOSIT = 100000; // In US cents
  uint private constant MERKLE_ROOT_DEPOSIT = 10000; // In US cents

  uint private constant AVT_IN_US_CENTS = 97;

  IAventusStorage public s;

  constructor(IAventusStorage _s) public {
    s = _s;
  }

  // @dev This must be called ONCE and ONCE ONLY, after the permission is given to write to storage as part of migration.
  function init() external onlyOwner {
    if (s.getBoolean(keccak256(abi.encodePacked("ParameterRegistry", "init")))) return;
    s.setBoolean(keccak256(abi.encodePacked("ParameterRegistry", "init")), true);

    s.setUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalLobbyingPeriodDays")), GOVERNANCE_PROPOSAL_LOBBYING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalVotingPeriodDays")), GOVERNANCE_PROPOSAL_VOTING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalRevealingPeriodDays")), GOVERNANCE_PROPOSAL_REVEALING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Proposal", "governanceProposalFixedDepositInUSCents")), GOVERNANCE_PROPOSAL_DEPOSIT_US_CENTS);

    s.setUInt(keccak256(abi.encodePacked("Aventities", "challengeLobbyingPeriodDays")), AVENTITY_CHALLENGE_LOBBYING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Aventities", "challengeVotingPeriodDays")), AVENTITY_CHALLENGE_VOTING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Aventities", "challengeRevealingPeriodDays")), AVENTITY_CHALLENGE_REVEALING_PERIOD_DAYS);

    s.setUInt(keccak256(abi.encodePacked("Events", "freeEventDepositAmountUSCents")), EVENT_FREE_DEPOSIT_US_CENTS);
    s.setUInt(keccak256(abi.encodePacked("Events", "paidEventDepositAmountUSCents")), EVENT_PAID_DEPOSIT_US_CENTS);
    s.setUInt(keccak256(abi.encodePacked("Events", "minimumEventReportingPeriodDays")), EVENT_MINIMUM_REPORTING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked("Events", "winningsForChallengeEnderPercentage")), EVENT_WINNINGS_FOR_CHALLENGE_ENDER_PERCENTAGE);
    s.setUInt(keccak256(abi.encodePacked("Events", "winningsForChallengeWinnerPercentage")), EVENT_WINNINGS_FOR_CHALLENGE_WINNER_PERCENTAGE);

    s.setUInt(keccak256(abi.encodePacked("Members", "Broker", "fixedDepositAmount")), BROKER_DEPOSIT);
    s.setUInt(keccak256(abi.encodePacked("Members", "Primary", "fixedDepositAmount")), PRIMARY_DEPOSIT);
    s.setUInt(keccak256(abi.encodePacked("Members", "Secondary", "fixedDepositAmount")), SECONDARY_DEPOSIT);
    s.setUInt(keccak256(abi.encodePacked("Members", "TokenBondingCurve", "fixedDepositAmount")), TOKEN_BONDING_CURVE_DEPOSIT);
    s.setUInt(keccak256(abi.encodePacked("Members", "ScalingProvider", "fixedDepositAmount")), SCALING_PROVIDER_DEPOSIT);

    s.setUInt(keccak256(abi.encodePacked("MerkleRoots", "fixedDepositAmount")), MERKLE_ROOT_DEPOSIT);

    s.setUInt(keccak256(abi.encodePacked("OneAVTInUSCents")), AVT_IN_US_CENTS);
  }
}