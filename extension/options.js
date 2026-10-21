import { getSettings, fetchInbox } from './gmail.js';

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
      status(r.ok
        ? `${acc.email}: connected, ${r.count} unread.`
        : `${acc.email}: not signed in. Sign in to this account in the browser and try again.`);
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

document.getElementById('add').onsubmit = async e => {
  e.preventDefault();
  const emailInput = document.getElementById('email');
  const nameInput = document.getElementById('name');
  const colorInput = document.getElementById('color');
  const email = emailInput.value.trim().toLowerCase();
  if (!email) return;
  if (accounts.some(a => a.email === email)) {
    status('This account is already in the list.');
    return;
  }
  accounts.push({ email, name: nameInput.value.trim(), color: colorInput.value });
  emailInput.value = '';
  nameInput.value = '';
  colorInput.value = COLORS[accounts.length % COLORS.length];
  await save();
  const r = await fetchInbox(email);
  status(r.ok
    ? `Added ${email}: connected, ${r.count} unread.`
    : `Added ${email}, but it is not signed in to the browser: sign in to it at mail.google.com.`);
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

document.getElementById('color').value = COLORS[accounts.length % COLORS.length];
render();
