// Specifically request an abstraction for ProposalsManager
const testHelper = require("./helpers/testHelper");
const votingTestHelper = require("./helpers/votingTestHelper");

contract('ProposalsManager - Voting:', async () => {
    testHelper.profilingHelper.addTimeReports('ProposalsManager - Voting:');

    let proposalsManager;
    let deposit;
    const BIGZERO = new web3.BigNumber(0);
    let expectedStake = [BIGZERO, BIGZERO, BIGZERO]; // Keep a balance for three stake funds.
    let expectedDeposit = [BIGZERO, BIGZERO, BIGZERO]; // Keep a balance for three deposit funds.

    before(async function () {
      await testHelper.before();
      await votingTestHelper.before(testHelper);

      proposalsManager = testHelper.getProposalsManager();
      deposit = await proposalsManager.getGovernanceProposalDeposit();
    });

    afterEach(async () => {
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
      await proposalsManager.createGovernanceProposal(desc);

      const eventArgs = await testHelper.getEventArgs(proposalsManager.LogGovernanceProposalCreated);
      proposalId = eventArgs.proposalId;

      return proposalId.toNumber();
    }

    async function depositStake(amount, accountNum) {
      let _accountNum = accountNum || 0;
      let account = testHelper.getAccount(_accountNum);

      await testHelper.addAVTToFund(amount, account, "stake");

      let balance = expectedStake[_accountNum];
      expectedStake[_accountNum] = balance.plus(amount);
    }

    async function depositDeposit(amount, accountNum) {
      let _accountNum = accountNum || 0;
      let account = testHelper.getAccount(_accountNum);

      await testHelper.addAVTToFund(amount, account, "deposit");

      let balance = expectedDeposit[_accountNum];
      expectedDeposit[_accountNum] = balance.plus(amount);
    }

    async function withdrawStake(amount, accountNum) {
        let _accountNum = accountNum || 0;
        let account = testHelper.getAccount(_accountNum);

        await testHelper.withdrawAVTFromFund(amount, account, 'stake');

        let balance = expectedStake[_accountNum];
        expectedStake[_accountNum] = balance.minus(amount);
    }

    async function withdrawDeposit(amount, accountNum) {
        let _accountNum = accountNum || 0;
        let account = testHelper.getAccount(_accountNum);

        await testHelper.withdrawAVTFromFund(amount, account, 'deposit');

        let balance = expectedDeposit[_accountNum];
        expectedDeposit[_accountNum] = balance.minus(amount);
    }

    context("Tests for voting on governance proposals", async () => {
      context("For an existing governance proposal", async () => {
        let proposalId;
        let optionId = 1;
        let wrongOptionId = 2;
        let invalidOptionId = 3;
        let signedMessage;

        beforeEach(async () => {
          proposalId = await createGovernanceProposal("A governance proposal");
        });

        afterEach(async () => {
          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await proposalsManager.endGovernanceProposal(proposalId);
        });

        context("can vote", async () => {
          beforeEach(async () => {
            await testHelper.advanceTimeToVotingStart(proposalId);
          });

          afterEach(async () => {
            await testHelper.advanceTimeToRevealingStart(proposalId);
            await votingTestHelper.revealVote(signedMessage, proposalId, optionId);
          });

          it("on a governance proposal which is in the voting period", async () => {
            signedMessage = await votingTestHelper.castVote(proposalId, optionId);
          });

          it("but not twice", async () => {
            signedMessage = await votingTestHelper.castVote(proposalId, optionId);
            await testHelper.expectRevert(() => votingTestHelper.castVote(proposalId, optionId));
          });
        });

        context("cannot vote", async () => {
          it("on a governance proposal which is not in the voting period", async () => {
            await testHelper.expectRevert(() => votingTestHelper.castVote(proposalId, 2));
          });

          it("on a governance proposal at the revealing stage", async () => {
            await testHelper.advanceTimeToRevealingStart(proposalId);
            await testHelper.expectRevert(() => votingTestHelper.castVote(proposalId, 2));
          });
        });

        context("having voted", async () => {
          beforeEach(async () => {
            await testHelper.advanceTimeToVotingStart(proposalId);
            signedMessage = await votingTestHelper.castVote(proposalId, optionId);
          });

          it("can reveal vote in the revealing period.", async () => {
            await testHelper.advanceTimeToRevealingStart(proposalId);
            await votingTestHelper.revealVote(signedMessage, proposalId, optionId);
          });

          context("cannot reveal vote", async () => {
            afterEach(async () => {
              await votingTestHelper.revealVote(signedMessage, proposalId, optionId);
            });

            it("before the revealing period.", async () => {
              await testHelper.expectRevert(() => votingTestHelper.revealVote(signedMessage, proposalId, optionId));
              await testHelper.advanceTimeToRevealingStart(proposalId);
            });

            context("in the revealing period", async () => {
              beforeEach(async () => {
                await testHelper.advanceTimeToRevealingStart(proposalId);
              });

              it("with an invalid option id.", async () => {
                await testHelper.expectRevert(() => votingTestHelper.revealVote(signedMessage, proposalId, invalidOptionId));
              });

              it("with the wrong optionId", async () => {
                await testHelper.expectRevert(() => votingTestHelper.revealVote(signedMessage, proposalId, wrongOptionId));
              });

              it("with the wrong signature", async () => {
                const wrongSignedMessage = await votingTestHelper.getSignedMessage(proposalId, wrongOptionId);
                await testHelper.expectRevert(() => votingTestHelper.revealVote(wrongSignedMessage, proposalId, optionId));
              });

              it("from wrong voter", async () => {
                let wrongAddress = testHelper.getAccount(1);
                await testHelper.expectRevert(() => votingTestHelper.revealVote(signedMessage, proposalId, optionId, wrongAddress));
              });
            });
          });
        });

        it("can deposit and withdraw tokens within any period, without any votes.", async () => {
            await depositStake(10);
            await withdrawStake(5);

            await testHelper.advanceTimeToVotingStart(proposalId);
            await depositStake(10);
            await withdrawStake(5);

            await testHelper.advanceTimeToRevealingStart(proposalId);
            await depositStake(10);
            await withdrawStake(5);
        });

        it("can deposit and withdraw tokens in the voting period.", async () => {
            await testHelper.advanceTimeToVotingStart(proposalId);
            let optionId = 1;
            const signedMessage = await votingTestHelper.castVote(proposalId, optionId);

            await depositStake(10);
            await withdrawStake(5);

            await testHelper.advanceTimeToRevealingStart(proposalId);
            await votingTestHelper.revealVote(signedMessage, proposalId, optionId);
        });

        it("cannot deposit or withdraw stake until your vote is revealed.", async () => {
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
        });
      });

      it("can deposit or withdraw tokens after a proposal is ended, if not within a revealing period of another proposal.", async () => {
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
          await proposalsManager.endGovernanceProposal(firstProposal);
          await proposalsManager.endGovernanceProposal(secondProposal);
          await proposalsManager.endGovernanceProposal(thirdProposal);
      });

      it("can vote on, deposit stake to and withdraw from, a few proposals with overlapping periods.", async () => {
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
            await proposalsManager.endGovernanceProposal(proposalIds[i]);
          }
      });

      it("cannot withdraw more than what is deposited.", async () => {
          await depositStake(5);
          await depositDeposit(5);
          await testHelper.expectRevert(() => withdrawStake(10));
          await testHelper.expectRevert(() => withdrawDeposit(10));
      });

      it("cannot get prevTime for proposal that does not exist", async () => {
        await testHelper.expectRevert(() => proposalsManager.getPrevTimeParamForCastVote(99));
      });

      it("can only vote with the correct proposalId and prevTime", async () => {
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
        const prevTime1 = await proposalsManager.getPrevTimeParamForCastVote(proposalId1);
        await proposalsManager.castVote(proposalId1, votingTestHelper.getSignatureSecret(signedMessage1), prevTime1);
        const prevTime2 = await proposalsManager.getPrevTimeParamForCastVote(proposalId2);
        await proposalsManager.castVote(proposalId2, votingTestHelper.getSignatureSecret(signedMessage2), prevTime2);

        // Wrong prevTime.
        await testHelper.expectRevert(() => proposalsManager.castVote(proposalId3, votingTestHelper.getSignatureSecret(signedMessage3), 0));
        await testHelper.expectRevert(() => proposalsManager.castVote(proposalId3, votingTestHelper.getSignatureSecret(signedMessage3), prevTime1));
        await testHelper.expectRevert(() => proposalsManager.castVote(proposalId3, votingTestHelper.getSignatureSecret(signedMessage3), 12345));

        // Invalid proposal.
        await testHelper.expectRevert(() => proposalsManager.castVote(99, votingTestHelper.getSignatureSecret(signedMessage2), prevTime2));
        // Correct values work.
        const prevTime3 = await proposalsManager.getPrevTimeParamForCastVote(proposalId3);
        await proposalsManager.castVote(proposalId3, votingTestHelper.getSignatureSecret(signedMessage3), prevTime3);

        await testHelper.advanceTimeToRevealingStart(proposalId3);
        await votingTestHelper.revealVote(signedMessage1, proposalId1, 1);
        await votingTestHelper.revealVote(signedMessage2, proposalId2, 1);
        await votingTestHelper.revealVote(signedMessage3, proposalId3, 1);

        await testHelper.advanceTimeToEndOfProposal(proposalId3);
        await proposalsManager.endGovernanceProposal(proposalId1);
        await proposalsManager.endGovernanceProposal(proposalId2);
        await proposalsManager.endGovernanceProposal(proposalId3);
      });

      it("cannot end governance proposal more than once for the same proposal", async () => {
        const proposalId = await createGovernanceProposal("A proposal");
        await testHelper.advanceTimeToEndOfProposal(proposalId);
        await proposalsManager.endGovernanceProposal(proposalId);
        await testHelper.expectRevert(() => proposalsManager.endGovernanceProposal(proposalId));
      });

      it("can get the blockchain time", async () => {
        const oldBlockchainTime = (await votingTestHelper.getAventusTime()).toNumber();
        await testHelper.advanceByDays(1);
        const newBlockchainTime = (await votingTestHelper.getAventusTime()).toNumber();
        assert.equal(oldBlockchainTime + testHelper.oneDay, newBlockchainTime);
      });

      // TODO: Put tests into sub-contexts based on time periods.
      context("Cancelling votes", async () => {
        const optionId = 1;
        const otherOptionId = 2;

        let proposalId;

        beforeEach(async () => {
          proposalId = await createGovernanceProposal("A governance proposal");
          await testHelper.advanceTimeToVotingStart(proposalId);
        });

        afterEach(async () => {
          await testHelper.advanceTimeToEndOfProposal(proposalId);
          await proposalsManager.endGovernanceProposal(proposalId)
        });

        async function cancelVoteSucceeds(_proposalId) {
          await votingTestHelper.cancelVote(_proposalId);
        }

        async function cancelVoteFails(_proposalId) {
          await testHelper.expectRevert(() => votingTestHelper.cancelVote(_proposalId));
        }

        it("cannot cancel vote without voting first", async () => {
          await cancelVoteFails(proposalId);
        });

        context("having voted", async () => {
          let signedMessage;
          beforeEach(async () => {
            signedMessage = await votingTestHelper.castVote(proposalId, optionId);
          });

          afterEach(async () => {
            await testHelper.advanceTimeToEndOfProposal(proposalId);
          });

          context("before reveal period starts", async () => {
            it("can cancel vote", async () => {
              await cancelVoteSucceeds(proposalId);
              const eventArgs = await testHelper.getEventArgs(proposalsManager.LogCancelVote);
              assert.equal(proposalId, eventArgs.proposalId,
                "Emitted proposal id should be the same as that which was cancelled");
            });

            it("can cancel vote and vote again with the same option", async () => {
              await cancelVoteSucceeds(proposalId);
              await votingTestHelper.castVote(proposalId, optionId);
            });

            it("can cancel vote and vote again with a different option", async () => {
              await cancelVoteSucceeds(proposalId);
              await votingTestHelper.castVote(proposalId, otherOptionId);
            });

            it("cannot cancel vote for a proposal that doesn't exist", async () => {
              await cancelVoteFails(999);
            });

            it("cannot cancel vote after it has been cancelled already", async () => {
              await cancelVoteSucceeds(proposalId);
              await cancelVoteFails(proposalId);
            });
          });

          context("after reveal period starts", async () => {
            beforeEach(async () => {
              await testHelper.advanceTimeToRevealingStart(proposalId);
            });

            it("cannot cancel vote if the user has already revealed", async () => {
              await votingTestHelper.revealVote(signedMessage, proposalId, optionId);
              await cancelVoteFails(proposalId);
            });

            it("cannot cancel vote if the user has not yet revealed", async () => {
              await cancelVoteFails(proposalId);
            });
          });

          context("after revealing period ends", async () => {
            beforeEach(async () => {
              await testHelper.advanceTimeToEndOfProposal(proposalId);
            });

            it("can cancel vote", async () => {
              await cancelVoteSucceeds(proposalId);
            });

            it("cannot cancel if the user has already revealed", async () => {
              await votingTestHelper.revealVote(signedMessage, proposalId, optionId);
              await await cancelVoteFails(proposalId);
            });
          });
        });
      });
    });
});
