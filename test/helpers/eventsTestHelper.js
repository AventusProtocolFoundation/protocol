const signingHelper = require('../../utils/signingHelper');

let testHelper, timeTestHelper, avtTestHelper, eventsManager, uniqueEventNum;

const roles = {
  validator: 'Validator',
  primary: 'Primary',
  secondary: 'Secondary',
  invalid: 'invalid'
};

async function init(_testHelper, _timeTestHelper, _avtTestHelper) {
  testHelper = _testHelper;
  timeTestHelper = _timeTestHelper;
  avtTestHelper = _avtTestHelper;
  eventsManager = testHelper.getEventsManager();
  uniqueEventNum = 0;
}

async function createEvent(_eventOwner, _sender, _rules) {
  const sender = _sender || _eventOwner;
  const eventDesc = 'My event';
  const eventRef = testHelper.hash(uniqueEventNum++);
  const sixWeeks = timeTestHelper.oneWeek.mul(new web3.utils.BN(6));
  const eventTime = timeTestHelper.now().add(sixWeeks);
  const rules = _rules || '0x';
  const eventOwnerProof = await signingHelper.getCreateEventEventOwnerProof(_eventOwner, eventDesc, eventTime, rules, sender);
  await eventsManager.createEvent(eventDesc, eventRef, eventTime, eventOwnerProof, _eventOwner, rules, {from: sender});
  const eventArgs = await testHelper.getLogArgs(eventsManager, 'LogEventCreated');
  return eventArgs.eventId;
}

async function registerRoleOnEvent(_eventId, _roleAddress, _role, _sender) {
  return eventsManager.registerRoleOnEvent(_eventId, _roleAddress, _role, {from: _sender});
}
// Keep exports alphabetical.
module.exports = {
  createEvent,
  init,
  registerRoleOnEvent,
  roles
};