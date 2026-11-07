// Shared logic for the service worker, popup and options page.
// Reads Gmail's Atom feed using the sessions already signed in to the browser,
// so no passwords, OAuth client or Google Cloud project are needed.

export const DEFAULTS = { accounts: [], interval: 2, notify: true };

export async function getSettings() {
  return chrome.storage.sync.get(DEFAULTS);
}

export function inboxUrl(email) {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}`;
}

export function composeUrl(email) {
  return `${inboxUrl(email)}&view=cm&fs=1`;
}

export function loginUrl(email) {
  return `https://accounts.google.com/AccountChooser?Email=${encodeURIComponent(email)}` +
    `&continue=${encodeURIComponent(inboxUrl(email))}`;
}

function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1].trim()) : '';
}

// Service workers have no DOMParser, so the feed is parsed with regular expressions.
// A signed-out account makes Gmail answer 401, which a page turns into the browser's own
// password dialog; the service worker has no window to show it in, so pages fetch through it.
export async function fetchFeed(authuser) {
  if (typeof window !== 'undefined') {
    const r = await chrome.runtime.sendMessage({ feed: authuser });
    if (!r) throw new Error('network');
    return r;
  }
  const res = await fetch(
    `https://mail.google.com/mail/feed/atom?authuser=${encodeURIComponent(authuser)}`,
    { credentials: 'include', cache: 'no-store' }
  );
  return { ok: res.ok, xml: await res.text() };
}

export async function fetchInbox(email) {
  try {
    const { ok, xml } = await fetchFeed(email);
    if (!ok || !xml.includes('<fullcount>')) return { email, ok: false, error: 'login' };

    // When the account is not signed in, Google may answer for a different one: discard it.
    const head = xml.split('<entry>')[0];
    if (!tag(head, 'title').toLowerCase().includes(email.toLowerCase())) {
      return { email, ok: false, error: 'login' };
    }

    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
      const author = (e.match(/<author>([\s\S]*?)<\/author>/) || [, ''])[1];
      const link = (e.match(/<link[^>]*href="([^"]*)"/) || [, ''])[1];
      return {
        id: tag(e, 'id'),
        subject: tag(e, 'title') || '(no subject)',
        snippet: tag(e, 'summary'),
        from: tag(author, 'name') || tag(author, 'email'),
        fromEmail: tag(author, 'email'),
        date: tag(e, 'issued') || tag(e, 'modified'),
        link: decode(link) || inboxUrl(email),
      };
    });

    return { email, ok: true, count: parseInt(tag(head, 'fullcount'), 10) || 0, entries };
  } catch {
    return { email, ok: false, error: 'network' };
  }
}

// Emails of the Google accounts signed in to the browser, read from each session slot's feed.
// shortcut: checks the first 10 slots, raise it if someone signs in to more accounts.
export async function signedInAccounts() {
  const emails = await Promise.all([...Array(10).keys()].map(async i => {
    try {
      const { ok, xml } = await fetchFeed(i);
      if (!ok) return null;
      const title = tag(xml.split('<entry>')[0], 'title');
      return (title.match(/\S+@\S+/) || [])[0]?.toLowerCase() || null;
    } catch {
      return null;
    }
  }));
  return [...new Set(emails.filter(Boolean))];
}

async function updateBadge(results) {
  const total = results.reduce((n, r) => n + (r.ok ? r.count : 0), 0);
  const failed = results.some(r => !r.ok);
  if (total > 0) {
    await chrome.action.setBadgeText({ text: total > 999 ? '999+' : String(total) });
    await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  } else if (failed) {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#80868b' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

function notifyNew(account, fresh) {
  const label = account.name || account.email;
  if (fresh.length === 1) {
    const m = fresh[0];
    // The notification id is the URL to open when it is clicked.
    chrome.notifications.create(m.link, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${m.from} — ${label}`,
      message: m.subject,
      contextMessage: m.snippet,
    });
  } else {
    chrome.notifications.create(inboxUrl(account.email), {
      type: 'list',
      iconUrl: 'icons/icon128.png',
      title: `${fresh.length} new emails — ${label}`,
      message: '',
      items: fresh.slice(0, 5).map(m => ({ title: m.from, message: m.subject })),
    });
  }
}

export async function refreshAll({ notify = false } = {}) {
  const settings = await getSettings();
  const results = await Promise.all(settings.accounts.map(a => fetchInbox(a.email)));
  const { seen = {} } = await chrome.storage.local.get('seen');
  const nextSeen = {};

  results.forEach((r, i) => {
    if (!r.ok) {
      nextSeen[r.email] = seen[r.email] || [];
      return;
    }
    const known = seen[r.email];
    // No notifications on an account's first check, so adding one doesn't trigger a burst.
    if (notify && settings.notify && known) {
      const fresh = r.entries.filter(e => !known.includes(e.id));
      if (fresh.length) notifyNew(settings.accounts[i], fresh);
    }
    nextSeen[r.email] = r.entries.map(e => e.id);
  });

  await chrome.storage.local.set({ seen: nextSeen, cache: { results, at: Date.now() } });
  await updateBadge(results);
  return results;
}
