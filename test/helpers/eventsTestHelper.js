let testHelper, timeTestHelper, avtTestHelper, signingTestHelper, eventsManager, aventusStorage;

const roles = {
  validator: 'Validator',
  primary: 'Primary',
  secondary: 'Secondary',
  invalid: 'invalid'
};

async function init(_testHelper, _timeTestHelper, _avtTestHelper, _signingTestHelper) {
  testHelper = _testHelper;
  timeTestHelper = _timeTestHelper;
  avtTestHelper = _avtTestHelper;
  signingTestHelper = _signingTestHelper;
  eventsManager = testHelper.getEventsManager();
  aventusStorage = testHelper.getAventusStorage();
}

async function createEvent(_eventOwner, _sender) {
  const sender = _sender || _eventOwner;
  const eventDesc = 'My event';
  const sixWeeks = timeTestHelper.oneWeek.mul(new web3.utils.BN(6));
  const sevenWeeks = timeTestHelper.oneWeek.mul(new web3.utils.BN(7));
  const offSaleTime = timeTestHelper.now().add(sixWeeks);
  const eventTime = timeTestHelper.now().add(sevenWeeks);
  const eventOwnerProof = await signingTestHelper.getCreateEventEventOwnerProof(_eventOwner, eventDesc, eventTime, offSaleTime,
      sender);
  await eventsManager.createEvent(eventDesc, eventTime, offSaleTime, eventOwnerProof, _eventOwner, {from: sender});
  const eventArgs = await testHelper.getLogArgs(eventsManager, 'LogEventCreated');
  return eventArgs.eventId;
}

async function advanceToEventPeriod(_eventId, _period) {
  const periodKey = testHelper.hash('Event', _eventId, _period);
  const period = await aventusStorage.getUInt(periodKey);
  await timeTestHelper.advanceToTime(period);
}

async function advanceTimeToOffSaleTime(_eventId) {
  await advanceToEventPeriod(_eventId, 'offSaleTime');
}

// Keep exports alphabetical.
module.exports = {
  advanceTimeToOffSaleTime,
  createEvent,
  init,
  roles
};