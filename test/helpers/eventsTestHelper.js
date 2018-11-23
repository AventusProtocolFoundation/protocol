let testHelper, timeTestHelper, avtTestHelper, signingTestHelper, eventsManager, aventusStorage;

async function init(_testHelper, _timeTestHelper, _avtTestHelper, _signingTestHelper) {
  testHelper = _testHelper;
  timeTestHelper = _timeTestHelper;
  avtTestHelper = _avtTestHelper;
  signingTestHelper = _signingTestHelper;
  eventsManager = testHelper.getEventsManager();
  aventusStorage = testHelper.getAventusStorage();
}

async function depositAndCreateEvent(_eventOwner) {
  const ticketPrice = 0;
  const eventDesc = 'My event';
  const deposits = await eventsManager.getNewEventDeposit(ticketPrice);
  const eventDeposit = deposits[1];

  await avtTestHelper.addAVTToFund(eventDeposit, _eventOwner, 'deposit');

  const onSaleTime = timeTestHelper.now().toNumber() + (timeTestHelper.oneWeek * 6);
  const offSaleTime = onSaleTime + (timeTestHelper.oneWeek * 6);
  const eventOwnerProof = await signingTestHelper.getCreateEventEventOwnerProof(_eventOwner, eventDesc,
      testHelper.validEvidenceURL, onSaleTime, offSaleTime, ticketPrice);
  await eventsManager.createEvent(eventDesc, testHelper.validEvidenceURL, onSaleTime, offSaleTime, ticketPrice,
      eventOwnerProof, {from: _eventOwner});
  const eventArgs = await testHelper.getLogArgs(eventsManager.LogEventCreated);
  return eventArgs.eventId;
}

async function advanceTimeEndEventAndWithdrawDeposit(_eventOwner, _eventId) {
  const deposit = await eventsManager.getExistingEventDeposit(_eventId);
  await advanceTimeToOffSaleTime(_eventId);
  await eventsManager.endEvent(_eventId);
  await avtTestHelper.withdrawAVTFromFund(deposit, _eventOwner, 'deposit');
}

async function advanceToEventPeriod(_eventId, _period) {
  const periodKey = testHelper.hash('Event', _eventId, _period);
  const period = await aventusStorage.getUInt(periodKey);
  await timeTestHelper.advanceToTime(parseInt(period));
}

async function advanceTimeToOffSaleTime(_eventId) {
  await advanceToEventPeriod(_eventId, 'offSaleTime');
}

async function advanceTimeToOnSaleTime(_eventId) {
  await advanceToEventPeriod(_eventId, 'onSaleTime');
}

// Keep exports alphabetical.
module.exports = {
  advanceTimeEndEventAndWithdrawDeposit,
  advanceTimeToOffSaleTime,
  advanceTimeToOnSaleTime,
  depositAndCreateEvent,
  init,
};