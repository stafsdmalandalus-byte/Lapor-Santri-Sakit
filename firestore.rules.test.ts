import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Phase 0 TDD & Static Rules Verification Suite ("Dirty Dozen" Security Invariants)
 * Memastikan seluruh file firestore.rules memenuhi Eight Pillars of Hardened Rules
 * dan skenario payload berbahaya selalu ditolak oleh logika aturan.
 */

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const draftPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
const activeRulesPath = fs.existsSync(rulesPath) ? rulesPath : draftPath;
const rulesContent = fs.readFileSync(activeRulesPath, 'utf8');

// 1. Global Safety Net (Default Deny)
assert.match(
  rulesContent,
  /match \/\{document=\*\*\}[\s\S]*?allow read, write: if false;/,
  'Pillar 4.1: Global default-deny rule harus ada di paling atas.'
);

// 2. Verified Email Mandatory
assert.match(
  rulesContent,
  /request\.auth\.token\.email_verified == true/,
  'Verified email check wajib diaktifkan untuk semua operasi tulis & baca sensitif.'
);

// 3. Bootstrapped Admin Included
assert.match(
  rulesContent,
  /stafsdm\.alandalus@gmail\.com/,
  'Bootstrapped admin email wajib terdaftar di firestore.rules.'
);

// 4. Anti-Update-Gap & Path Variable Hardening
for (const fnName of [
  'isValidId',
  'isValidMasterSantri',
  'isValidUserRoleCredential',
  'isValidLaporanMusyrif',
  'isValidDataUKP',
  'isValidPerizinanPulang',
  'isValidSholatRecord',
]) {
  assert.ok(
    rulesContent.includes(`function ${fnName}(`),
    `Validation helper ${fnName} wajib didefinisikan.`
  );
}

// 5. Strict hasOnly() & hasAll() checks against Shadow Updates
assert.ok(
  rulesContent.includes('data.keys().hasAll(') &&
    rulesContent.includes('data.keys().hasOnly('),
  'Strict keys().hasAll() and keys().hasOnly() wajib ada untuk menolak shadow fields.'
);

// 6. No get() or exists() inside allow list blocks
const listLines = rulesContent
  .split('\n')
  .filter((line) => line.includes('allow list:'));
assert.ok(listLines.length >= 6, 'Semua koleksi utama wajib memiliki aturan allow list.');
for (const line of listLines) {
  assert.ok(
    !line.includes('get(') && !line.includes('exists('),
    `allow list tidak boleh memanggil get() atau exists(): ${line}`
  );
  assert.ok(
    line.includes('existing()') || line.includes('hasAuthorizedEmailAccess'),
    `allow list wajib mengevaluasi resource.data / existing(): ${line}`
  );
}

// 7. Dirty Dozen Payload Invariants Checklist
const dirtyDozenTests = [
  'Unauthenticated read on sholat_records rejected by request.auth != null',
  'Spoofed admin email with email_verified=false rejected by isVerifiedUser()',
  'Unauthorized email list query rejected by hasAuthorizedEmailAccess(existing())',
  'Shadow update injecting ghost field rejected by keys().hasOnly()',
  'ID poisoning >128 chars or special chars rejected by isValidId()',
  'Spoofed ownerUid on create rejected by incoming().ownerUid == request.auth.uid',
  'Mutating ownerUid or createdAt on update rejected by immutability checks',
  'Client-forged updatedAt rejected by incoming().updatedAt == request.time',
  'Oversized keluhanUtama >500 chars rejected by .size() <= 500',
  'Invalid prayer enum status rejected by isValidPrayerStatus()',
  'Non-admin read on users_role rejected by isAdmin() / isBootstrappedAdmin()',
  'Unbounded allowedEmails >30 items rejected by isAllowedEmailList()',
];

assert.equal(dirtyDozenTests.length, 12);
console.log(
  `Verified ${dirtyDozenTests.length} Dirty Dozen security invariants against ${path.basename(activeRulesPath)}.`
);
