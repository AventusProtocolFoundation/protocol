// Specifically request an abstraction for AventusVote
const testHelper = require("./helpers/testHelper");
const votingTestHelper = require("./helpers/votingTestHelper");

contract('AventusVote - Voting:', function () {
    // Freeze time so we can use the mock time library in solidity. Make sure we
    // keep time on the solidity side and the java side in sync.
    const oneDay = new web3.BigNumber(86400);  // seconds in one day. Solidity uses uint256.
    const oneWeek = oneDay.times(7);
    const minimumVotingPeriod = oneWeek;
    let aventusVote, avt;
    let deposit;
    const BIGZERO = new web3.BigNumber(0);
    let expectedStake = [BIGZERO, BIGZERO, BIGZERO]; // Keep a balance for three stake funds.
    let expectedDeposit = [BIGZERO, BIGZERO, BIGZERO]; // Keep a balance for three deposit funds.

    before(async function () {
      await votingTestHelper.before();

      aventusVote = testHelper.getAventusVote();
      avt = testHelper.getAVTContract();
      deposit = await aventusVote.getGovernanceProposalDeposit();
    });

    afterEach(async function() {
      // Withdraw the rest of the deposits and stakes so we know that all
      // proposal have been closed, all votes have been revealed and that all
      // AVT has been cleared out before the next test.
      for (let i = 0; i < expectedStake.length; ++i) {
        let balance = expectedStake[i];
        if (balance > 0) {
          await withdrawStake(balance, i);
          assert.equal(expectedStake[i], 0);
        }
        balance = expectedDeposit[i];
        if (balance > 0) {
          await withdrawDeposit(balance, i);
          assert.equal(expectedDeposit[i], 0);
        }
      }
      await testHelper.checkFundsEmpty(true);
    })

    async function createGovernanceProposal(desc) {
      await depositDeposit(deposit);
      await aventusVote.createGovernanceProposal(desc);

      const eventArgs = await testHelper.getEventArgs(aventusVote.LogCreateProposal);
      proposalId = eventArgs.proposalId;

      return proposalId.toNumber();
    }

    async function depositStake(amount, accountNum) {
      let _accountNum = accountNum || 0;
      await depositAmount("stake", amount, _accountNum);
      let balance = expectedStake[_accountNum];
      expectedStake[_accountNum] = balance.plus(amount);
    }

    async function depositDeposit(amount, accountNum) {
      let _accountNum = accountNum || 0;
      await depositAmount("deposit", amount, _accountNum);
      let balance = expectedDeposit[_accountNum];
      expectedDeposit[_accountNum] = balance.plus(amount);
    }

    async function depositAmount(fund, amount, accountNum) {
        let account = testHelper.getAccount(accountNum);
        if (accountNum != 0) {
            // Any other account will not have any AVT: give them what they need.
            await avt.transfer(account, amount);
        }
        await avt.approve(aventusVote.address, amount, {from: account});
        await aventusVote.deposit(fund, amount, {from: account});
    }

    async function withdrawStake(amount, accountNum) {
        let _accountNum = accountNum || 0;
        await withdrawAmount("stake", amount, _accountNum);
        let balance = expectedStake[_accountNum];
        expectedStake[_accountNum] = balance.minus(amount);
    }

    async function withdrawDeposit(amount, accountNum) {
        let _accountNum = accountNum || 0;
        await withdrawAmount("deposit", amount, _accountNum);
        let balance = expectedDeposit[_accountNum];
        expectedDeposit[_accountNum] = balance.minus(amount);
    }

    async function withdrawAmount(fund, amount, accountNum) {
        let _accountNum = accountNum || 0;
        let account = testHelper.getAccount(_accountNum);
        await aventusVote.withdraw(fund, amount, {from: account});
    }

    context("Tests for voting on governance proposals", function() {
      it("cannot vote on a governance proposal which is not in the voting period.", async function() {
          let proposalId = await createGovernanceProposal("A governance proposal");
          await testHelper.expectRevert(() => votingTestHelper.castVote(proposalId, 2));

          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await aventusVote.endProposal(proposalId);
      });

      it("can vote on a governance proposal which is in the voting period", async function() {
          let proposalId = await createGovernanceProposal("A governance proposal");

          await testHelper.advanceTimeToVotingStart(proposalId);
          const signedMessage = await votingTestHelper.castVote(proposalId, 2);

          // Clear up before the next test.
          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await aventusVote.endProposal(proposalId)
          // Must reveal any cast votes so that the stake can be withdran before the next test.
          await votingTestHelper.revealVote(signedMessage, proposalId, 2);
      });

      it("cannot vote on a governance proposal at the revealing stage", async function() {
          let proposalId = await createGovernanceProposal("A governance proposal");

          await testHelper.advanceTimeToRevealingStart(proposalId);
          await testHelper.expectRevert(() => votingTestHelper.castVote(proposalId, 2));

          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await aventusVote.endProposal(proposalId);
      });

      it("cannot reveal vote before the revealing period.", async function() {
          let proposalId = await createGovernanceProposal("A governance proposal");

          await testHelper.advanceTimeToVotingStart(proposalId);
          let optionId = 2;
          const signedMessage = await votingTestHelper.castVote(proposalId, optionId);

          await testHelper.expectRevert(() => votingTestHelper.revealVote(signedMessage, proposalId, optionId));

          await testHelper.advanceTimeToRevealingStart(proposalId);
          await votingTestHelper.revealVote(signedMessage, proposalId, optionId);

          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await aventusVote.endProposal(proposalId);
      });

      it("can reveal vote in the revealing period.", async function() {
          let proposalId = await createGovernanceProposal("A governance proposal");

          await testHelper.advanceTimeToVotingStart(proposalId);
          let optionId = 2;
          const signedMessage = await votingTestHelper.castVote(proposalId, optionId);

          await testHelper.advanceTimeToRevealingStart(proposalId);
          await votingTestHelper.revealVote(signedMessage, proposalId, optionId);
          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await aventusVote.endProposal(proposalId);
      });

      it("cannot reveal vote with the wrong optionId or signature.", async function() {
          let proposalId = await createGovernanceProposal("A governance proposal");

          await testHelper.advanceTimeToVotingStart(proposalId);
          const signedMessage = await votingTestHelper.castVote(proposalId, 1);

          await testHelper.advanceTimeToRevealingStart(proposalId);
          // Wrong optionId, right signedMessage.
          await testHelper.expectRevert(() => votingTestHelper.revealVote(signedMessage, proposalId, 2));
          // Wrong signedMessage, right optionId.
          const wrongSignedMessage = await votingTestHelper.getSignedMessage(proposalId, 2);
          await testHelper.expectRevert(() => votingTestHelper.revealVote(wrongSignedMessage, proposalId, 1));

          await votingTestHelper.revealVote(signedMessage, proposalId, 1);

          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await aventusVote.endProposal(proposalId);
      });

      it("can reveal vote after the revealing period.", async function() {
          let proposalId = await createGovernanceProposal("A governance proposal");

          await testHelper.advanceTimeToVotingStart(proposalId);
          let optionId = 2;
          const signedMessage = await votingTestHelper.castVote(proposalId, optionId);

          await testHelper.advanceTimeToRevealingStart(proposalId);
          await votingTestHelper.revealVote(signedMessage, proposalId, optionId);

          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await aventusVote.endProposal(proposalId);
      });

      it("can deposit and withdraw tokens within any period, without any votes.", async function() {
          let proposalId = await createGovernanceProposal("A governance proposal");

          await depositStake(10);
          await withdrawStake(5);

          await testHelper.advanceTimeToVotingStart(proposalId);
          await depositStake(10);
          await withdrawStake(5);

          await testHelper.advanceTimeToRevealingStart(proposalId);
          await depositStake(10);
          await withdrawStake(5);

          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await aventusVote.endProposal(proposalId);
      });

      it("can deposit and withdraw tokens in the voting period.", async function() {
          let proposalId = await createGovernanceProposal("A governance proposal");

          await testHelper.advanceTimeToVotingStart(proposalId);
          let optionId = 1;
          const signedMessage = await votingTestHelper.castVote(proposalId, optionId);

          await depositStake(10);
          await withdrawStake(5);

          await testHelper.advanceTimeToRevealingStart(proposalId);
          await votingTestHelper.revealVote(signedMessage, proposalId, optionId);

          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await aventusVote.endProposal(proposalId);
      });

      it("cannot deposit or withdraw stake until your vote is revealed.", async function() {
          let proposalId = await createGovernanceProposal("A governance proposal");

          await depositStake(10);

          let optionId = 2;
          await testHelper.advanceTimeToVotingStart(proposalId);
          const signedMessage = await votingTestHelper.castVote(proposalId, optionId);

          await depositStake(10);
          await testHelper.advanceTimeToRevealingStart(proposalId);

          await testHelper.expectRevert(() => depositStake(2));
          await testHelper.expectRevert(() => withdrawStake(1));

          await votingTestHelper.revealVote(signedMessage, proposalId, optionId);
          await depositStake(2);
          await withdrawStake(1);

          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await aventusVote.endProposal(proposalId);
      });

      it("can deposit or withdraw tokens after a proposal is ended, if not within a revealing period of another proposal.", async function() {
          let firstProposal = await createGovernanceProposal("First proposal to be voted on");
          let secondProposal = await createGovernanceProposal("Second proposal to be voted on at the same time");
          await testHelper.advanceByDays(1);
          let thirdProposal = await createGovernanceProposal("Third proposal to be voted, one day later");

          // Fast forward to the voting period of all three proposals.
          await testHelper.advanceTimeToVotingStart(thirdProposal);
          const signedMessage1 = await votingTestHelper.castVote(firstProposal, 1);
          const signedMessage2 = await votingTestHelper.castVote(secondProposal, 2);
          const signedMessage3 = await votingTestHelper.castVote(thirdProposal, 2);

          // Fast forward to the reveal period of the first two proposals.
          await testHelper.advanceTimeToRevealingStart(firstProposal);
          await votingTestHelper.revealVote(signedMessage1, firstProposal, 1);
          await votingTestHelper.revealVote(signedMessage2, secondProposal, 2);

          // Can deposit/withdraw with another vote not in its reveal period.
          await depositStake(10);
          await withdrawStake(10);

          await testHelper.advanceTimeToRevealingStart(thirdProposal);
          // Cannot deposit/withdraw with the third vote in its reveal period.
          await testHelper.expectRevert(() => depositStake(2));
          await testHelper.expectRevert(() => withdrawStake(1));
          await votingTestHelper.revealVote(signedMessage3, thirdProposal, 2);

          // Can now deposit/withdraw.
          await depositStake(10);
          await withdrawStake(10);

          await testHelper.advanceTimeToEndOfProposal(thirdProposal);
          await aventusVote.endProposal(firstProposal);
          await aventusVote.endProposal(secondProposal);
          await aventusVote.endProposal(thirdProposal);
      });

      it("can vote on, deposit stake to and withdraw from, a few proposals with overlapping periods.", async function() {
          let proposalIds = [];
          let signedMessages = [];

          // Create a proposal.
          proposalIds.push(await createGovernanceProposal("Proposal 0"));

          // Nothing is in the reveal period, so we can deposit and withdraw.
          await depositStake(10);
          await withdrawStake(5);

          // Create another a week later.
          await testHelper.advanceByDays(7);
          proposalIds.push(await createGovernanceProposal("Proposal 1"));

          // Can't vote on either of these two proposals yet as neither are in their voting periods.
          await testHelper.expectRevert(() => votingTestHelper.castVote(proposalIds[0], 2));
          await testHelper.expectRevert(() => votingTestHelper.castVote(proposalIds[1], 1));

          // Create another a week later.
          await testHelper.advanceByDays(7);
          proposalIds.push(await createGovernanceProposal("Proposal 2"));

          // We are now in the voting period of the first proposal so we can vote on it...
          signedMessages.push(await votingTestHelper.castVote(proposalIds[0], 2));
          // ...but not yet reveal the vote...
          await testHelper.expectRevert(() => votingTestHelper.revealVote(signedMessages[0], proposalIds[0], 2));
          // ...nor vote on the others yet.
          await testHelper.expectRevert(() => votingTestHelper.castVote(proposalIds[1], 1));
          await testHelper.expectRevert(() => votingTestHelper.castVote(proposalIds[2], 2));

          // Nothing is in the reveal period, so we can deposit and withdraw.
          await depositStake(10);
          await withdrawStake(5);

          // Create another a week later.
          await testHelper.advanceByDays(7);
          proposalIds.push(await createGovernanceProposal("Proposal 3"));

          // We are now in a reveal period, with a non-revealed vote, so we can NOT change stake.
          await testHelper.expectRevert(() => depositStake(10));
          await testHelper.expectRevert(() => withdrawStake(5));

          // Now,reveal the first proposal, and vote on the second...
          await votingTestHelper.revealVote(signedMessages[0], proposalIds[0], 2);
          signedMessages.push(await votingTestHelper.castVote(proposalIds[1], 1));
          // ...but we can't yet vote on the others!
          await testHelper.expectRevert(() => votingTestHelper.castVote(proposalIds[2], 2));
          await testHelper.expectRevert(() => votingTestHelper.castVote(proposalIds[3], 1));

          // We are in a reveal period, but we have revealed our vote, so we CAN now change stake.
          await depositStake(10);
          await withdrawStake(5);

          // Advance another week.
          await testHelper.advanceByDays(7);
          // In another reveal period with a non-revealed vote: no AVT movement allowed!
          await testHelper.expectRevert(() => depositStake(10));
          await testHelper.expectRevert(() => withdrawStake(5));

          await votingTestHelper.revealVote(signedMessages[1], proposalIds[1], 1);
          signedMessages.push(await votingTestHelper.castVote(proposalIds[2], 2));
          await testHelper.expectRevert(() => votingTestHelper.castVote(proposalIds[3], 1));

          // We are in a reveal period, but we have revealed our vote, so we CAN now change stake.
          await depositStake(10);
          await withdrawStake(5);

           // Advance another week.
          await testHelper.advanceByDays(7);
          // In another reveal period with a non-revealed vote: no AVT movement allowed!
          await testHelper.expectRevert(() => depositStake(10));
          await testHelper.expectRevert(() => withdrawStake(5));

          await votingTestHelper.revealVote(signedMessages[2], proposalIds[2], 2);
          signedMessages.push(await votingTestHelper.castVote(proposalIds[3], 1));
          // We are in a reveal period, but we have revealed our vote, so we CAN now change stake.
          await depositStake(10);
          await withdrawStake(5);

          // Advance another *6* weeks. All votes are well past their reveal periods now...
          await testHelper.advanceByDays(42);
          // ... but we STILL can't change stakes...
          await testHelper.expectRevert(() => depositStake(10));
          await testHelper.expectRevert(() => withdrawStake(5));
          // ... until we reveal our last outstanding vote.
          await votingTestHelper.revealVote(signedMessages[3], proposalIds[3], 1);
          await depositStake(10);
          await withdrawStake(5);

          // Finally done! Close 'em all down.
          for (i = 0; i < 4; ++i) {
            await aventusVote.endProposal(proposalIds[i]);
          }
      });

      it("cannot withdraw more than what is deposited.", async function() {
          await depositStake(5);
          await depositDeposit(5);
          await testHelper.expectRevert(() => withdrawStake(10));
          await testHelper.expectRevert(() => withdrawDeposit(10));
      });

      it("cannot get prevTime for proposal that does not exist", async function() {
        await testHelper.expectRevert(() => aventusVote.getPrevTimeParamForCastVote(99));
      });

      it("can only vote with the correct proposalId and prevTime", async function() {
        const proposalId1 = await createGovernanceProposal("A proposal");
        await testHelper.advanceByDays(1);
        const proposalId2 = await createGovernanceProposal("Another proposal");
        await testHelper.advanceByDays(1);
        const proposalId3 = await createGovernanceProposal("A third proposal");
        const signedMessage1 = await votingTestHelper.getSignedMessage(proposalId1, 1);
        const signedMessage2 = await votingTestHelper.getSignedMessage(proposalId2, 1);
        const signedMessage3 = await votingTestHelper.getSignedMessage(proposalId3, 1);
        // Skip to the voting period of all three proposals.
        await testHelper.advanceTimeToVotingStart(proposalId3);
        // Vote on the first two.
        const prevTime1 = await aventusVote.getPrevTimeParamForCastVote(proposalId1);
        await aventusVote.castVote(proposalId1, votingTestHelper.getSignatureSecret(signedMessage1), prevTime1);
        const prevTime2 = await aventusVote.getPrevTimeParamForCastVote(proposalId2);
        await aventusVote.castVote(proposalId2, votingTestHelper.getSignatureSecret(signedMessage2), prevTime2);

        // Wrong prevTime.
        await testHelper.expectRevert(() => aventusVote.castVote(proposalId3, votingTestHelper.getSignatureSecret(signedMessage3), 0));
        await testHelper.expectRevert(() => aventusVote.castVote(proposalId3, votingTestHelper.getSignatureSecret(signedMessage3), prevTime1));
        await testHelper.expectRevert(() => aventusVote.castVote(proposalId3, votingTestHelper.getSignatureSecret(signedMessage3), 12345));

        // Invalid proposal.
        await testHelper.expectRevert(() => aventusVote.castVote(99, votingTestHelper.getSignatureSecret(signedMessage2), prevTime2));
        // Correct values work.
        const prevTime3 = await aventusVote.getPrevTimeParamForCastVote(proposalId3);
        await aventusVote.castVote(proposalId3, votingTestHelper.getSignatureSecret(signedMessage3), prevTime3);

        await testHelper.advanceTimeToRevealingStart(proposalId3);
        await votingTestHelper.revealVote(signedMessage1, proposalId1, 1);
        await votingTestHelper.revealVote(signedMessage2, proposalId2, 1);
        await votingTestHelper.revealVote(signedMessage3, proposalId3, 1);

        await testHelper.advanceTimeToEndOfProposal(proposalId3);
        await aventusVote.endProposal(proposalId1);
        await aventusVote.endProposal(proposalId2);
        await aventusVote.endProposal(proposalId3);
      });

      it("cannot vote if we have already voted", async function() {
        const proposalId = await createGovernanceProposal("A proposal");
        await testHelper.advanceTimeToVotingStart(proposalId);
        let signedMessage = await votingTestHelper.castVote(proposalId, 1);
        await testHelper.expectRevert(() => votingTestHelper.castVote(proposalId, 1));
        await testHelper.expectRevert(() => votingTestHelper.castVote(proposalId, 2));
        await testHelper.advanceTimeToRevealingStart(proposalId);
        await votingTestHelper.revealVote(signedMessage, proposalId, 1);

        await testHelper.advanceTimeToEndOfProposal(proposalId);
        await aventusVote.endProposal(proposalId);
      });

      it("cannot endProposal more than once for the same proposal", async function() {
        const proposalId = await createGovernanceProposal("A proposal");
        await testHelper.advanceTimeToEndOfProposal(proposalId);
        await aventusVote.endProposal(proposalId);
        await testHelper.expectRevert(() => aventusVote.endProposal(proposalId));
      });
    });
});
