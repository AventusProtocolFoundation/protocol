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

// TODO: Don't keep state in the helper, think of a better way of doing this.
let uniqueEventId = 0;

async function createEvent(_eventOwner) {
  const eventDesc = 'My event' + uniqueEventId++;
  const sixWeeks = timeTestHelper.oneWeek.mul(new web3.utils.BN(6));
  const offSaleTime = timeTestHelper.now().add(sixWeeks);
  const eventOwnerProof = await signingTestHelper.getCreateEventEventOwnerProof(_eventOwner, eventDesc, offSaleTime);
  await eventsManager.createEvent(eventDesc, offSaleTime, eventOwnerProof, {from: _eventOwner});
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
