# Changelog

## 1.1.0 — 2026-11-07

### Changed
- **Add account opens Google sign-in.** The settings page no longer asks for an address: click
  **Add account**, sign in in the tab that opens, and the new account is added automatically.
  Label and color can be edited afterwards from the account's row.

### Fixed
- **No more system password dialog.** Checking an account that isn't signed in made the browser
  show its own "Sign in" username/password prompt. Gmail feed requests now go through the
  service worker, which has no window to show that prompt in, so the account is simply marked
  as not signed in.
- **Check opens sign-in.** When **Check** finds an account signed out, the Google sign-in page
  for that address opens in a new tab.

## 1.0.0

- First release: unread counts and previews for several Gmail accounts from one toolbar button,
  notifications, settings page and project page with live demo.
