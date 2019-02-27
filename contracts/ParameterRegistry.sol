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
  string constant merkleRootsSchema = "MerkleRoots";

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

  // Base value for merkle root deposits
  uint private constant MERKLE_ROOT_BASE_DEPOSIT = 100 * oneAVTInNat;
  // Merkle root cooling off period (length after last event time at which root can be deregistered)
  uint private constant MERKLE_ROOT_COOLING_OFF_PERIOD = 2 weeks;

  // NOTE: It is important that the product of these three values never overflows a uint256
  // Multiplier for merkle root deposits (deposit = multipler * number of levels * time until last event)
  uint private constant MERKLE_ROOT_DEPOSIT_MULTIPLIER = oneAVTInNat / 25000;
  // Maximum allowed merkle tree depth
  uint private constant MAX_MERKLE_TREE_DEPTH = 256;
  // Maximum allowed difference between current and last event time of a merkle tree
  uint private constant MAX_INTERVENING_EVENT_TIME = 3500 days;

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

    s.setUInt(keccak256(abi.encodePacked(merkleRootsSchema, "baseDeposit")), MERKLE_ROOT_BASE_DEPOSIT);
    s.setUInt(keccak256(abi.encodePacked(merkleRootsSchema, "coolingOffPeriod")), MERKLE_ROOT_COOLING_OFF_PERIOD);
    s.setUInt(keccak256(abi.encodePacked(merkleRootsSchema, "depositMultiplier")), MERKLE_ROOT_DEPOSIT_MULTIPLIER);
    s.setUInt(keccak256(abi.encodePacked(merkleRootsSchema, "maxTreeDepth")), MAX_MERKLE_TREE_DEPTH);
    s.setUInt(keccak256(abi.encodePacked(merkleRootsSchema, "maxInterveningEventTime")), MAX_INTERVENING_EVENT_TIME);
  }
}