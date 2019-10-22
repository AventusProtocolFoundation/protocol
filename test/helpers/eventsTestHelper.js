const signingHelper = require('../../utils/signingHelper');

let testHelper, avtTestHelper, eventsManager, uniqueEventNum;

const roles = {
  validator: 'Validator',
  primary: 'Primary',
  secondary: 'Secondary',
  invalid: 'invalid'
};

async function init(_testHelper, _avtTestHelper) {
  testHelper = _testHelper;
  avtTestHelper = _avtTestHelper;
  eventsManager = testHelper.getEventsManager();
  uniqueEventNum = 0;
}

async function createEvent(_eventOwner, _sender, _rules) {
  const sender = _sender || _eventOwner;
  const eventDesc = 'My event';
  const eventRef = testHelper.hash(uniqueEventNum++);
  const rules = _rules || '0x';
  const eventOwnerProof = await signingHelper.getCreateEventEventOwnerProof(_eventOwner, eventDesc, rules);
  await eventsManager.createEvent(eventDesc, eventRef, eventOwnerProof, _eventOwner, rules, {from: sender});
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