// Demo harness: stands in for the browser extension APIs and for Gmail's Atom feed,
// so the unmodified extension code in /extension can run on a plain web page.
(() => {
  const ACCOUNTS = [
    { email: 'alex.rivera@gmail.com', name: 'Personal', color: '#0b57d0' },
    { email: 'alex.rivera.work@gmail.com', name: 'Work', color: '#188038' },
    { email: 'pixelforge.studio@gmail.com', name: 'Side project', color: '#a142f4' },
    { email: 'alex.newsletters@gmail.com', name: 'Newsletters', color: '#e8710a' },
  ];

  const ago = min => new Date(Date.now() - min * 60000).toISOString();
  const INBOXES = {
    'alex.rivera@gmail.com': [
      ['Maya Chen', 'maya@example.com', 'Dinner on Saturday?', 'Hey! We were thinking of trying the new ramen place around 8. Are you in?', 12],
      ['Airline Bookings', 'no-reply@example.com', 'Your boarding pass for Lisbon', 'Check-in is open. Your seat is 14A, boarding starts at 09:40.', 95],
      ['Sam Ortiz', 'sam@example.com', 'Photos from the hike', 'Finally uploaded them — the one at the summit came out great.', 60 * 26],
    ],
    'alex.rivera.work@gmail.com': [
      ['Priya Natarajan', 'priya@example.com', 'Re: Q4 roadmap review', 'Thanks for the draft. I left a few comments on the timeline section.', 4],
      ['CI Bot', 'ci@example.com', 'Build #1842 passed', 'All 312 checks passed on main. Deploy to staging is ready.', 38],
      ['Jordan Lee', 'jordan@example.com', 'Design sync moved to 3pm', 'Small change: the design sync is now at 3pm in room Atlas.', 140],
      ['HR Team', 'hr@example.com', 'Reminder: submit your timesheet', 'Timesheets for this period are due Friday at 5pm.', 60 * 30],
      ['Lena Fischer', 'lena@example.com', 'Customer interview notes', 'Here are my notes from the three calls this morning.', 60 * 50],
    ],
    'pixelforge.studio@gmail.com': [],
  };

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function atom(email) {
    const mails = INBOXES[email];
    const entries = mails.map(([name, from, subject, snippet, min], i) => `
      <entry><title>${esc(subject)}</title><summary>${esc(snippet)}</summary>
      <link rel="alternate" href="https://mail.google.com/mail?account_id=${email}&amp;message_id=${i}&amp;view=conv&amp;extsrc=atom" type="text/html" />
      <modified>${ago(min)}</modified><issued>${ago(min)}</issued>
      <id>tag:gmail.google.com,2004:${email}-${i}</id>
      <author><name>${esc(name)}</name><email>${from}</email></author></entry>`).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><feed version="0.3" xmlns="http://purl.org/atom/ns#">
      <title>Gmail - Inbox for ${email}</title><fullcount>${mails.length}</fullcount>${entries}</feed>`;
  }

  // Answer feed requests like Gmail would; an account missing from INBOXES is "not signed in".
  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opts) => {
    const u = new URL(url, location.href);
    if (u.hostname !== 'mail.google.com') return realFetch(url, opts);
    await new Promise(r => setTimeout(r, 350));
    // authuser is an address or, when listing signed-in accounts, a session slot number.
    const user = u.searchParams.get('authuser');
    const email = /^\d+$/.test(user) ? Object.keys(INBOXES)[user] : user;
    return email in INBOXES
      ? new Response(atom(email), { status: 200 })
      : new Response('<html>Sign in</html>', { status: 401 });
  };

  const store = { sync: { accounts: ACCOUNTS, interval: 2, notify: true }, local: {} };
  const area = data => ({
    async get(keys) {
      if (keys == null) return { ...data };
      if (typeof keys === 'string') keys = [keys];
      if (Array.isArray(keys)) return Object.fromEntries(keys.filter(k => k in data).map(k => [k, data[k]]));
      return Object.fromEntries(Object.entries(keys).map(([k, d]) => [k, k in data ? structuredClone(data[k]) : d]));
    },
    async set(items) { Object.assign(data, structuredClone(items)); },
  });

  function toast(text) {
    let t = document.getElementById('demo-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'demo-toast';
      t.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;padding:8px 10px;border-radius:8px;' +
        'background:#202124;color:#fff;font:12px system-ui;box-shadow:0 2px 8px #0004;z-index:9;transition:opacity .3s';
      document.body.append(t);
    }
    t.textContent = text;
    t.style.opacity = '1';
    clearTimeout(toast.h);
    toast.h = setTimeout(() => (t.style.opacity = '0'), 2600);
  }

  const describe = url => {
    const u = new URL(url);
    if (u.hostname === 'accounts.google.com') {
      const email = u.searchParams.get('Email');
      return email ? `Demo: would open Google sign-in for ${email}` : 'Demo: would open Google sign-in';
    }
    if (u.searchParams.get('view') === 'cm') return `Demo: would open a new compose window for ${u.searchParams.get('authuser')}`;
    if (u.searchParams.get('message_id')) return `Demo: would open this conversation in ${u.searchParams.get('account_id')}`;
    return `Demo: would open the inbox of ${u.searchParams.get('authuser')}`;
  };

  window.chrome = {
    storage: { sync: area(store.sync), local: area(store.local), onChanged: { addListener() {} } },
    action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} },
    notifications: { create() {} },
    tabs: {
      create: async ({ url }) => (toast(describe(url)), { id: 1 }),
      // Pretend the sign-in tab finished with a new account signed in.
      onUpdated: {
        addListener(fn) {
          setTimeout(() => {
            INBOXES['alex.photos@gmail.com'] ??= [];
            fn(1, { url: 'https://mail.google.com/mail/u/0/' });
          }, 1500);
        },
        removeListener() {},
      },
    },
    runtime: {
      openOptionsPage: () => toast('Demo: would open the settings page'),
      // The extension's pages fetch the feed through the service worker; the demo answers here.
      async sendMessage({ feed }) {
        const res = await window.fetch(`https://mail.google.com/mail/feed/atom?authuser=${encodeURIComponent(feed)}`);
        return { ok: res.ok, xml: await res.text() };
      },
    },
  };
  window.close = () => {};
})();
