pragma solidity ^0.5.2;

import "./interfaces/IAventusStorage.sol";
import "./Owned.sol";
import "./Versioned.sol";

contract ParameterRegistry is Owned, Versioned {
  string constant aventitiesSchema = "Aventities";
  string constant avtSchema = "AVT";
  string constant eventsSchema = "Events";
  string constant membersSchema = "Members";
  string constant parameterRegistrySchema = "ParameterRegistry";
  string constant proposalsSchema = "Proposals";

  uint private constant oneAVTInNat = 10**18;

  // Proposal default values.
  uint private constant GOVERNANCE_PROPOSAL_LOBBYING_PERIOD_DAYS = 14;
  uint private constant GOVERNANCE_PROPOSAL_VOTING_PERIOD_DAYS = 7;
  uint private constant GOVERNANCE_PROPOSAL_REVEALING_PERIOD_DAYS = 7;
  uint private constant GOVERNANCE_PROPOSAL_DEPOSIT = 100 * oneAVTInNat; // In AVT
  uint private constant AVENTITY_CHALLENGE_LOBBYING_PERIOD_DAYS = 14;
  uint private constant AVENTITY_CHALLENGE_VOTING_PERIOD_DAYS = 7;
  uint private constant AVENTITY_CHALLENGE_REVEALING_PERIOD_DAYS = 7;
  uint private constant AVENTITY_WINNINGS_FOR_CHALLENGE_ENDER_PERCENTAGE = 10;
  uint private constant AVENTITY_WINNINGS_FOR_CHALLENGE_WINNER_PERCENTAGE = 10;

  // Member default values.
  uint private constant TOKEN_BONDING_CURVE_DEPOSIT = 1000 * oneAVTInNat; // In AVT
  uint private constant VALIDATOR_DEPOSIT = 5000 * oneAVTInNat; // In AVT

  // Member deregistration cooling off periods
  uint private constant VALIDATOR_COOLING_OFF_PERIOD_DAYS = 90;

  IAventusStorage public s;

  constructor(IAventusStorage _s) public {
    s = _s;
  }

  // @dev This must be called ONCE and ONCE ONLY, after the permission is given to write to storage as part of migration.
  function init() external onlyOwner {
    if (s.getBoolean(keccak256(abi.encodePacked(parameterRegistrySchema, "init")))) return;
    s.setBoolean(keccak256(abi.encodePacked(parameterRegistrySchema, "init")), true);

    s.setUInt(keccak256(abi.encodePacked(proposalsSchema, "governanceProposalLobbyingPeriodDays")),
        GOVERNANCE_PROPOSAL_LOBBYING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked(proposalsSchema, "governanceProposalVotingPeriodDays")),
        GOVERNANCE_PROPOSAL_VOTING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked(proposalsSchema, "governanceProposalRevealingPeriodDays")),
        GOVERNANCE_PROPOSAL_REVEALING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked(proposalsSchema, "governanceProposalFixedDeposit")),
        GOVERNANCE_PROPOSAL_DEPOSIT);

    s.setUInt(keccak256(abi.encodePacked(aventitiesSchema, "challengeLobbyingPeriodDays")),
        AVENTITY_CHALLENGE_LOBBYING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked(aventitiesSchema, "challengeVotingPeriodDays")),
        AVENTITY_CHALLENGE_VOTING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked(aventitiesSchema, "challengeRevealingPeriodDays")),
        AVENTITY_CHALLENGE_REVEALING_PERIOD_DAYS);
    s.setUInt(keccak256(abi.encodePacked(aventitiesSchema, "winningsForChallengeEnderPercentage")),
        AVENTITY_WINNINGS_FOR_CHALLENGE_ENDER_PERCENTAGE);
    s.setUInt(keccak256(abi.encodePacked(aventitiesSchema, "winningsForChallengeWinnerPercentage")),
        AVENTITY_WINNINGS_FOR_CHALLENGE_WINNER_PERCENTAGE);

    s.setUInt(keccak256(abi.encodePacked(membersSchema, "TokenBondingCurve", "fixedDepositAmount")),
        TOKEN_BONDING_CURVE_DEPOSIT);
    s.setUInt(keccak256(abi.encodePacked(membersSchema, "Validator", "fixedDepositAmount")), VALIDATOR_DEPOSIT);

    s.setUInt(keccak256(abi.encodePacked(membersSchema, "Validator", "coolingOffPeriodDays")),
        VALIDATOR_COOLING_OFF_PERIOD_DAYS);
  }
}