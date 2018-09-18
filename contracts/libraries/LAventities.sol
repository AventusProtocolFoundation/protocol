pragma solidity ^0.4.24;

import '../interfaces/IAventusStorage.sol';
import './LAVTManager.sol';
import './LProposal.sol';
import './LProposalWinnings.sol';

library LAventities {
  bytes32 constant aventityCountKey = keccak256(abi.encodePacked("AventityCount"));

  event LogClaimVoterWinnings(uint indexed proposalId);

  modifier onlyRegistered(IAventusStorage _storage, uint _aventityId) {
    require(
      aventityIsRegistered(_storage, _aventityId),
      "Aventity must be registered with the protocol"
    );
    _;
  }

  modifier onlyNotFraudulent(IAventusStorage _storage, uint _aventityId) {
    require(
      aventityIsNotFraudulent(_storage, _aventityId),
      "Aventity must not be fraudulent"
    );
    _;
  }

  modifier onlyValidAventityId(IAventusStorage _storage, uint _aventityId) {
    require(
      aventityIdIsValid(_storage, _aventityId),
      "Aventity ID must be valid"
    );
    _;
  }

  modifier onlyNotUnderChallenge(IAventusStorage _storage, uint _aventityId) {
    require(
      aventityIsNotUnderChallenge(_storage, _aventityId),
      "Aventity must be clear of challenges"
    );
    _;
  }

  modifier onlyActiveAndNotUnderChallengeAventity(IAventusStorage _storage, uint _aventityId) {
    require(
      aventityIsActiveAndNotUnderChallenge(_storage, _aventityId),
      "Aventity must be valid and not under challenge"
    );
    _;
  }

  function deregisterAventity(IAventusStorage _storage, uint _aventityId)
    external
    onlyValidAventityId(_storage, _aventityId)
    onlyRegistered(_storage, _aventityId)
    onlyNotFraudulent(_storage, _aventityId)
    onlyNotUnderChallenge(_storage, _aventityId)
  {
    unlockAventityDeposit(_storage, _aventityId);
    _storage.setBoolean(keccak256(abi.encodePacked("Aventity", _aventityId, "registered")), false);
  }

  /**
  * @dev Create an aventity challenge for the specified aventity to be voted on.
  * @param _storage Storage contract address
  * @param _aventityId - aventity id for the aventity in context
  */
  function challengeAventity(IAventusStorage _storage, uint _aventityId)
    external
    onlyActiveAndNotUnderChallengeAventity(_storage, _aventityId)
    returns (uint challengeProposalId_)
  {
    uint numDaysInLobbyingPeriod = _storage.getUInt(keccak256(abi.encodePacked("Aventities", "challengeLobbyingPeriodDays")));
    uint numDaysInVotingPeriod = _storage.getUInt(keccak256(abi.encodePacked("Aventities", "challengeVotingPeriodDays")));
    uint numDaysInRevealingPeriod =_storage.getUInt(keccak256(abi.encodePacked("Aventities", "challengeRevealingPeriodDays")));

    uint deposit = getExistingAventityDeposit(_storage, _aventityId);
    challengeProposalId_ = LProposal.createProposal(_storage, deposit, numDaysInLobbyingPeriod, numDaysInVotingPeriod,
        numDaysInRevealingPeriod);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", challengeProposalId_, "aventityId")), _aventityId);
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "challenge")), challengeProposalId_);
  }


  function claimVoterWinnings(IAventusStorage _storage, uint _proposalId) external {
    LProposalWinnings.claimVoterWinnings(_storage, _proposalId);
    emit LogClaimVoterWinnings(_proposalId);
  }

  function setAventityStatusFraudulent(IAventusStorage _storage, uint _aventityId) private {
    _storage.setBoolean(keccak256(abi.encodePacked("Aventity", _aventityId, "fraudulent")), true);
    setAventityAsClearFromChallenge(_storage, _aventityId);

    // Aventity is no longer valid; remove the expected deposit for the aventity.
    // TODO: Add fraudulent counter, will be required for event deposit calculation
    unlockAventityDeposit(_storage, _aventityId);
  }

  function setAventityAsClearFromChallenge(IAventusStorage _storage, uint _aventityId)
    private
  {
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "challenge")), 0);
  }

  // TODO: Decide on proper terminology - aventityOwner or aventityAddress - and use throughout.
  function getAventityOwner(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (address aventityOwner_)
  {
    aventityOwner_ = _storage.getAddress(keccak256(abi.encodePacked("Aventity", _aventityId, "address")));
  }

  function getExistingAventityDeposit(IAventusStorage _storage, uint _aventityId) public view returns (uint aventityDeposit_) {
    aventityDeposit_ = _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "deposit")));
  }

  function aventityIsActive(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (bool aventityIsRegistered_)
  {
    aventityIsRegistered_ = aventityIsRegistered(_storage, _aventityId) && aventityIsNotFraudulent(_storage, _aventityId);
  }

  function aventityIsActiveAndNotUnderChallenge(IAventusStorage _storage, uint _aventityId)
    public
    view
    onlyValidAventityId(_storage, _aventityId)
    returns (bool aventityIsRegisteredAndNotUnderChallenge_)
  {
    aventityIsRegisteredAndNotUnderChallenge_ = aventityIsActive(_storage, _aventityId) &&
        aventityIsNotUnderChallenge(_storage, _aventityId);
  }

  function aventityIsNotFraudulent(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (bool aventityIsNotFraudulent_)
  {
    aventityIsNotFraudulent_ = !_storage.getBoolean(keccak256(abi.encodePacked("Aventity", _aventityId, "fraudulent")));
  }

  function unlockAventityDeposit(IAventusStorage _storage, uint _aventityId) public {
    uint aventityDeposit = getExistingAventityDeposit(_storage, _aventityId);
    address aventityOrOwnerAddress = _storage.getAddress(keccak256(abi.encodePacked("Aventity", _aventityId, "address")));
    require(
      aventityDeposit != 0,
      "Unlocked aventity must have a positive deposit"
    );
    bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", aventityOrOwnerAddress));
    assert(_storage.getUInt(expectedDepositsKey) >= aventityDeposit); // If this asserts, we messed up the deposit code!
    _storage.setUInt(expectedDepositsKey, _storage.getUInt(expectedDepositsKey) - aventityDeposit);

    _storage.setUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "deposit")), 0);
  }

  function registerAventity(
    IAventusStorage _storage,
    address _aventityAddress,
    uint _aventityDeposit)
    public
    returns(uint aventityId_)
  {
    lockAventityDeposit(_storage, _aventityAddress, _aventityDeposit);

    aventityId_ = _storage.getUInt(aventityCountKey) + 1;

    _storage.setUInt(aventityCountKey, aventityId_);
    _storage.setUInt(keccak256(abi.encodePacked("Aventity", aventityId_, "deposit")), _aventityDeposit);
    _storage.setAddress(keccak256(abi.encodePacked("Aventity", aventityId_, "address")), _aventityAddress);
    _storage.setBoolean(keccak256(abi.encodePacked("Aventity", aventityId_, "registered")), true);
  }

  function aventityIsNotUnderChallenge(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (bool aventityIsNotUnderChallenge_)
  {
    aventityIsNotUnderChallenge_ = 0 == _storage.getUInt(keccak256(abi.encodePacked("Aventity", _aventityId, "challenge")));
  }

  function aventityIsRegistered(IAventusStorage _storage, uint _aventityId)
    public
    view
    returns (bool aventityIsRegistered_)
  {
    aventityIsRegistered_ = _storage.getBoolean(keccak256(abi.encodePacked("Aventity", _aventityId, "registered")));
  }

  function finaliseChallenge(IAventusStorage _storage, uint _proposalId) public {
    uint aventityId = getAventityIdFromChallengeProposalId(_storage, _proposalId);

    // If the proposal is not a challenge, ignore this.
    if (aventityId == 0) return;

    uint totalAgreedStake = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(1))));
    uint totalDisagreedStake = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "revealedStake", uint8(2))));

    // Note: a "draw" is taken as not agreeing with the challenge.
    uint8 winningOption = totalAgreedStake > totalDisagreedStake ? 1 : 2;

    // Get deposit now in case it is cleared by marking as fraudulent.
    uint deposit = getExistingAventityDeposit(_storage, aventityId);

    uint totalWinningStake;
    bool challengeWon = winningOption == 1;
    if (challengeWon) {
      setAventityStatusFraudulent(_storage, aventityId);
      totalWinningStake = totalAgreedStake;
    } else {
      setAventityAsClearFromChallenge(_storage, aventityId);
      totalWinningStake = totalDisagreedStake;
    }

    address challenger = _storage.getAddress(keccak256(abi.encodePacked("Proposal", _proposalId, "owner")));
    address challengee = getAventityOwner(_storage, aventityId);
    LProposalWinnings.doWinningsDistribution(_storage, _proposalId, winningOption, challengeWon, deposit, challenger, challengee);

    // Save the information we need to calculate voter winnings when they make their claim.
    _storage.setUInt8(keccak256(abi.encodePacked("Proposal", _proposalId, "winningOption")), winningOption);
    _storage.setUInt(keccak256(abi.encodePacked("Proposal", _proposalId, "totalWinningStake")), totalWinningStake);
  }

  function getAventityIdFromChallengeProposalId(IAventusStorage _storage, uint _challengeProposalId)
    private
    view
    returns (uint aventityId_)
  {
    aventityId_ = _storage.getUInt(keccak256(abi.encodePacked("Proposal", _challengeProposalId, "aventityId")));
  }

  function lockAventityDeposit(IAventusStorage _storage, address _aventityOrOwnerAddress, uint _aventityDeposit)
    private
  {
    bytes32 expectedDepositsKey = keccak256(abi.encodePacked("ExpectedDeposits", _aventityOrOwnerAddress));
    uint expectedDeposits = _storage.getUInt(expectedDepositsKey) + _aventityDeposit;
    uint actualDeposits = LAVTManager.getBalance(_storage, _aventityOrOwnerAddress, "deposit");
    require(
      actualDeposits >= expectedDeposits,
      'Insufficient deposits'
    );
    _storage.setUInt(expectedDepositsKey, expectedDeposits);
  }

  function aventityIdIsValid(IAventusStorage _storage, uint _aventityId)
    private
    view
    returns (bool aventityIdIsValid_)
  {
    aventityIdIsValid_ = _aventityId != 0 && _aventityId <= _storage.getUInt(aventityCountKey);
  }
}