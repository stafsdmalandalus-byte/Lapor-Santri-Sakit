# Security Specification (TDD) — Portal Pesantren Al-Andalus Firestore

## 1. Data Invariants
1. **Verified Authentication**: Every read/write requires `request.auth != null && request.auth.token.email_verified == true`.
2. **Ownership & Team Scoping**: Operational documents (`master_santri`, `laporan_musyrif`, `data_ukp`, `perizinan_pulang`, `sholat_records`) require `ownerUid == request.auth.uid` on creation, preserve `ownerUid` and `createdAt` immutably on updates, and restrict reads/lists to `isBootstrappedAdmin()` (`stafsdm.alandalus@gmail.com`), `ownerUid`, or emails present in bounded `allowedEmails` (`<= 30`).
3. **Credential / PII Isolation**: `users_role` (which stores login passwords) is strictly isolated to `isBootstrappedAdmin()` / `isAdmin()` / `ownerUid` and never exposed to general users.
4. **No Cost-Explosion List Queries**: `allow list` rules strictly avoid `get()` and `exists()` calls and evaluate `resource.data` directly.
5. **Terminal / Lock Integrity**: `sholat_records` enforces strict enum validation (`TEPAT | TELAT | ALFA | IZIN`) on all 5 prayer fields and prevents non-admin unauthorized tampering with immutable timestamps or IDs.
6. **Strict Schema & Size Guards**: Every string field enforces `.size() <= MAX`, every ID matches `^[a-zA-Z0-9_\-]+$`, and `keys().hasOnly(...)` rejects shadow fields.

## 2. The "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)
1. Unauthenticated read/list on `sholat_records`.
2. Verified user with unverified email (`email_verified: false`) attempting `create` on `sholat_records` even with admin email spoofing.
3. Unauthorized verified user attempting `list` on `sholat_records` without being in `allowedEmails` or `ownerUid`.
4. Shadow update on `sholat_records` injecting a ghost field `isAdminBypass: true`.
5. Oversized ID poisoning (`docId` > 128 chars or containing `/` / `$`) on `sholat_records/{sholatId}`.
6. Spoofing `ownerUid` on `create` to another user's UID (`ownerUid: "victim-uid"`).
7. Mutating immutable `ownerUid` or `createdAt` during `update` on `laporan_musyrif`.
8. Client-supplied forged `updatedAt` timestamp not equal to `request.time`.
9. Oversized `keluhanUtama` string (> 500 chars) on `laporan_musyrif` (Denial of Wallet payload).
10. Invalid prayer enum (`subuh: "HACKED"`) on `sholat_records`.
11. Non-admin reading or listing `users_role` password records.
12. Unbounded `allowedEmails` array (> 30 items) or invalid first element type on `perizinan_pulang`.
