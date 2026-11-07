import { getSettings, fetchInbox, loginUrl, signedInAccounts } from './gmail.js';

const COLORS = ['#0b57d0', '#d93025', '#188038', '#f9ab00', '#a142f4', '#e8710a', '#12b5cb'];
const listEl = document.getElementById('list');
const statusEl = document.getElementById('status');
let accounts = [];

function status(msg) {
  statusEl.textContent = msg;
  clearTimeout(status.t);
  status.t = setTimeout(() => (statusEl.textContent = ''), 4000);
}

async function save() {
  await chrome.storage.sync.set({ accounts });
  render();
}

function render() {
  listEl.replaceChildren();
  if (!accounts.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'No accounts yet.';
    listEl.append(p);
  }
  accounts.forEach((acc, i) => {
    const row = document.createElement('div');
    row.className = 'row';

    const color = document.createElement('input');
    color.type = 'color';
    color.value = acc.color;
    color.onchange = () => { acc.color = color.value; save(); };

    const name = document.createElement('input');
    name.type = 'text';
    name.value = acc.name;
    name.placeholder = 'Label';
    name.onchange = () => { acc.name = name.value.trim(); save(); };

    const email = document.createElement('input');
    email.type = 'email';
    email.value = acc.email;
    email.disabled = true;

    const test = button('Check', async () => {
      test.disabled = true;
      const r = await fetchInbox(acc.email);
      test.disabled = false;
      if (r.error === 'login') chrome.tabs.create({ url: loginUrl(acc.email) });
      status(r.ok
        ? `${acc.email}: connected, ${r.count} unread.`
        : `${acc.email}: not signed in. Sign in in the tab that just opened, then check again.`);
    });
    const up = button('↑', () => move(i, -1));
    up.disabled = i === 0;
    const down = button('↓', () => move(i, 1));
    down.disabled = i === accounts.length - 1;
    const del = button('Remove', () => {
      accounts.splice(i, 1);
      save();
    });

    row.append(color, name, email, test, up, down, del);
    listEl.append(row);
  });
}

function button(label, onclick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.onclick = onclick;
  return b;
}

function move(i, dir) {
  const [a] = accounts.splice(i, 1);
  accounts.splice(i + dir, 0, a);
  save();
}

document.getElementById('add').onclick = async () => {
  // Prefer accounts that appear after this login, so other open sessions aren't added too.
  const before = await signedInAccounts();
  const tab = await chrome.tabs.create({
    url: `https://accounts.google.com/AddSession?continue=${encodeURIComponent('https://mail.google.com/mail/')}`,
  });
  status('Sign in with Google in the new tab.');
  const onUpdated = async (id, info) => {
    if (id !== tab.id || !info.url?.startsWith('https://mail.google.com/')) return;
    chrome.tabs.onUpdated.removeListener(onUpdated);
    const missing = (await signedInAccounts()).filter(e => !accounts.some(a => a.email === e));
    const newSessions = missing.filter(e => !before.includes(e));
    // Signing in to an account that was already open creates no new session: add those instead.
    const fresh = newSessions.length ? newSessions : missing;
    fresh.forEach(email => accounts.push({ email, name: '', color: COLORS[accounts.length % COLORS.length] }));
    await save();
    status(fresh.length ? `Added ${fresh.join(', ')}.` : 'No new account found: it may already be in the list.');
  };
  chrome.tabs.onUpdated.addListener(onUpdated);
};

const settings = await getSettings();
accounts = settings.accounts;

const intervalEl = document.getElementById('interval');
intervalEl.value = String(settings.interval);
intervalEl.onchange = () => {
  chrome.storage.sync.set({ interval: Number(intervalEl.value) });
  status('Saved.');
};

const notifyEl = document.getElementById('notify');
notifyEl.checked = settings.notify;
notifyEl.onchange = () => {
  chrome.storage.sync.set({ notify: notifyEl.checked });
  status('Saved.');
};

render();
