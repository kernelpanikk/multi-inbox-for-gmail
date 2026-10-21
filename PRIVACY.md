# Privacy Policy

*Last updated: October 21, 2026*

Multi Inbox for Gmail ("the extension") is designed to work entirely inside your browser.

## What the extension accesses

- **The Gmail addresses, labels and colors you enter** in its settings.
- **The unread-mail feed of those accounts** (sender name and address, subject, a short preview, date and link of
  unread messages in the inbox), read from `mail.google.com` using the session you are already signed in with.

The extension never sees, asks for or stores your password.

## Where data is stored

- Your account list and preferences are saved with `chrome.storage.sync`. If you have browser sync turned on,
  your browser vendor syncs them between your own devices, as with any extension setting.
- The most recent feed results and the ids of messages already seen are saved with `chrome.storage.local`,
  on your device only, so the popup can open instantly and notify you only about new mail.

## What the extension does not do

- It does not send any data to the developer or to any third party. There is no server, analytics or tracking.
- It does not sell, transfer or use your data for advertising, creditworthiness or any purpose unrelated to
  showing you your unread mail.
- It does not modify your mailbox: nothing is marked as read, moved or deleted.

The only network requests the extension makes are to `https://mail.google.com`, the same service you already use.

## Removing your data

Removing an account in the settings deletes it from storage. Uninstalling the extension deletes all of its data.

## Contact

Questions about this policy: open an issue at https://github.com/kernelpanikk/multi-inbox-for-gmail/issues.
