import { getSettings, refreshAll, inboxUrl, composeUrl, loginUrl } from './gmail.js';

const list = document.getElementById('accounts');
const openState = new Set();

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function open(url) {
  chrome.tabs.create({ url });
  window.close();
}

function shortDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function renderAccount(account, result) {
  const box = el('section', 'account');
  if (openState.has(account.email)) box.classList.add('open');

  const head = el('div', 'account-head');
  const dot = el('span', 'dot');
  dot.style.background = account.color || '#0b57d0';
  const name = el('div', 'account-name');
  name.append(el('strong', '', account.name || account.email), el('span', '', account.email));

  const count = result?.ok ? result.count : null;
  const badge = el('span', 'count' + (count ? '' : ' zero'), count == null ? '–' : String(count));

  const actions = el('div', 'actions');
  const openBtn = el('button', '', 'Open');
  openBtn.title = 'Open this inbox';
  openBtn.onclick = e => { e.stopPropagation(); open(inboxUrl(account.email)); };
  const composeBtn = el('button', '', '✎');
  composeBtn.title = 'Compose a new email';
  composeBtn.onclick = e => { e.stopPropagation(); open(composeUrl(account.email)); };
  actions.append(openBtn, composeBtn);

  head.append(dot, name, badge, actions);
  head.onclick = () => {
    box.classList.toggle('open');
    box.classList.contains('open') ? openState.add(account.email) : openState.delete(account.email);
  };

  const mails = el('div', 'mails');
  if (!result) {
    mails.append(el('div', 'note', 'Loading…'));
  } else if (!result.ok) {
    const note = el('div', 'note');
    if (result.error === 'login') {
      note.append('This account is not signed in to the browser. ');
      const a = el('a', '', 'Sign in');
      a.href = '#';
      a.onclick = e => { e.preventDefault(); open(loginUrl(account.email)); };
      note.append(a);
    } else {
      note.textContent = 'Network error, try again.';
    }
    mails.append(note);
    badge.textContent = '!';
  } else if (!result.entries.length) {
    mails.append(el('div', 'note', 'No unread email.'));
  } else {
    for (const m of result.entries) {
      const a = el('a', 'mail');
      a.href = m.link;
      a.onclick = e => { e.preventDefault(); open(m.link); };
      const top = el('div', 'mail-top');
      top.append(el('span', 'mail-from', m.from), el('span', 'mail-date', shortDate(m.date)));
      a.append(top, el('div', 'mail-subject', m.subject), el('div', 'mail-snippet', m.snippet));
      a.title = m.fromEmail;
      mails.append(a);
    }
  }

  box.append(head, mails);
  return box;
}

function render(accounts, cache) {
  list.replaceChildren();
  if (!accounts.length) {
    const empty = el('div', 'empty');
    empty.append(el('p', '', 'No accounts configured yet.'));
    const btn = el('button', 'primary', 'Add your accounts');
    btn.onclick = () => chrome.runtime.openOptionsPage();
    empty.append(btn);
    list.append(empty);
    return;
  }
  const byEmail = new Map((cache?.results || []).map(r => [r.email, r]));
  let total = 0;
  for (const acc of accounts) {
    const r = byEmail.get(acc.email);
    if (r?.ok) total += r.count;
    list.append(renderAccount(acc, r));
  }
  document.getElementById('total').textContent = `${total} unread`;
  document.getElementById('updated').textContent = cache?.at
    ? `Updated ${new Date(cache.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    : '';
}

async function refresh() {
  const { accounts } = await getSettings();
  document.getElementById('updated').textContent = 'Refreshing…';
  const results = await refreshAll();
  render(accounts, { results, at: Date.now() });
}

document.getElementById('refresh').onclick = refresh;
document.getElementById('settings').onclick = () => chrome.runtime.openOptionsPage();

const { accounts } = await getSettings();
const { cache } = await chrome.storage.local.get('cache');
render(accounts, cache);
refresh();
