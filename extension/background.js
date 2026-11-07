import { getSettings, refreshAll, fetchFeed } from './gmail.js';

const ALARM = 'refresh';

async function schedule() {
  const { interval } = await getSettings();
  await chrome.alarms.clear(ALARM);
  chrome.alarms.create(ALARM, { delayInMinutes: 0.5, periodInMinutes: Math.max(1, Number(interval) || 2) });
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await schedule();
  refreshAll();
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(async () => {
  await schedule();
  refreshAll();
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM) refreshAll({ notify: true });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.interval) schedule();
  if (changes.accounts) refreshAll();
});

chrome.notifications.onClicked.addListener(id => {
  chrome.tabs.create({ url: id });
  chrome.notifications.clear(id);
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!('feed' in msg)) return;
  fetchFeed(msg.feed).then(reply, () => reply(null));
  return true;
});
