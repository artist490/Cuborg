# Security Policy

## Supported Use

Personal Secure Vault is intended for offline personal use on a trusted device and browser.

## Threat Model

The app protects vault data at rest by encrypting sensitive fields before they are written into SQLite. The encrypted SQLite database is stored in IndexedDB and can be exported as a raw `.db` file.

The app does not protect against:

- malware on the device
- malicious browser extensions
- compromised browsers
- operating system keyloggers
- physical access to an unlocked session
- screenshots or screen recording
- weak or reused master passwords

## Cryptographic Design

- PBKDF2 with SHA-256 and 100,000 iterations derives the AES key from the master password.
- Each vault has a unique random salt.
- AES-GCM is used for encryption.
- Each encrypted field receives a unique random 12-byte IV.
- Encrypted values are stored as `base64(iv).base64(ciphertext)`.
- Login validation decrypts an encrypted `VAULT_OK` verifier from the `system_auth` table.

## Handling Sensitive Data

- The master password is not stored.
- The derived key is not persisted.
- Clipboard content is cleared after copy and when the vault locks.
- The vault auto-locks after inactivity.
- The vault locks after the tab remains hidden.

## Reporting Issues

If you publish this repository publicly, open a private security advisory on GitHub for security-sensitive reports.
