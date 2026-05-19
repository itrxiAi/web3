/**
 * Recompute every user's referralCode + path + depth.
 *
 *  - referralCode: keccak256(address) -> 8-char Crockford Base32 (matches
 *    app backend's deriveShortCode and the new randomReferralCode in web3).
 *  - path: materialized path of referralCodes joined by '.'.
 *  - depth: number of '.' separators (= 0 for roots).
 *
 * Usage:
 *   node scripts/recompute-referral-codes.mjs            # dry-run
 *   node scripts/recompute-referral-codes.mjs --apply    # actually write
 *
 * Production checklist:
 *   1. pg_dump backup first.
 *   2. Dry-run; verify Collisions: 0 and Orphans: 0 (or acceptable count).
 *   3. Run --apply during low traffic. Everything happens in one tx.
 *   4. Old referral links / paths will diverge from the new ones; consider an
 *      `oldReferralCode` grace column if external links must keep working.
 */
import { PrismaClient } from '@prisma/client';
import { keccak256, toBytes } from 'viem';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, no 0/O/1/I/L/U
const LEN = 8;

function deriveShortCode(address) {
  const hash = keccak256(toBytes(address.toLowerCase()));
  const bytes = Buffer.from(hash.slice(2), 'hex');
  let big = 0n;
  for (let i = 0; i < 5; i++) big = (big << 8n) | BigInt(bytes[i]);
  const mask = BigInt(ALPHABET.length - 1);
  let out = '';
  for (let i = 0; i < LEN; i++) {
    out = ALPHABET[Number(big & mask)] + out;
    big >>= 5n;
  }
  return out;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY-RUN'}`);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      walletAddress: true,
      referralCode: true,
      superior: true,
      path: true,
      depth: true,
    },
  });
  console.log(`Loaded ${users.length} users`);

  // ---- Phase A: compute new referralCode for every user ----
  const seen = new Map(); // newCode -> address
  const newCodeByAddr = new Map(); // address(lower) -> newCode
  for (const u of users) {
    const addr = u.walletAddress.toLowerCase();
    const newCode = deriveShortCode(addr);
    const conflict = seen.get(newCode);
    if (conflict && conflict !== addr) {
      console.error(`COLLISION: ${addr} and ${conflict} -> ${newCode}`);
      process.exit(1);
    }
    seen.set(newCode, addr);
    newCodeByAddr.set(addr, newCode);
  }
  console.log(`Collisions: 0`);

  // ---- Phase B: rebuild path/depth via BFS over the superior tree ----
  const byAddr = new Map(); // addr -> user row
  for (const u of users) byAddr.set(u.walletAddress.toLowerCase(), u);

  const newPath = new Map(); // id -> string
  const newDepth = new Map(); // id -> number
  let orphans = 0; // users whose superior is missing in DB

  // Memoised recursion with cycle guard.
  const visiting = new Set();
  function resolve(addr) {
    const u = byAddr.get(addr);
    if (!u) return null;
    if (newPath.has(u.id)) return u.id;
    if (visiting.has(u.id)) {
      console.error(`CYCLE detected at ${addr}, treating as root`);
      newPath.set(u.id, newCodeByAddr.get(addr));
      newDepth.set(u.id, 0);
      return u.id;
    }
    visiting.add(u.id);
    const myCode = newCodeByAddr.get(addr);
    const supAddr = u.superior ? u.superior.toLowerCase() : null;
    if (!supAddr) {
      newPath.set(u.id, myCode);
      newDepth.set(u.id, 0);
    } else {
      const supId = resolve(supAddr);
      if (supId == null) {
        // superior referenced but not present in DB — keep as root and count.
        orphans++;
        newPath.set(u.id, myCode);
        newDepth.set(u.id, 0);
      } else {
        const supPath = newPath.get(supId);
        const supDepth = newDepth.get(supId);
        newPath.set(u.id, `${supPath}.${myCode}`);
        newDepth.set(u.id, supDepth + 1);
      }
    }
    visiting.delete(u.id);
    return u.id;
  }
  for (const u of users) resolve(u.walletAddress.toLowerCase());

  // ---- Phase C: diff ----
  const updates = [];
  let unchanged = 0;
  for (const u of users) {
    const addr = u.walletAddress.toLowerCase();
    const newCode = newCodeByAddr.get(addr);
    const path = newPath.get(u.id);
    const depth = newDepth.get(u.id);
    const codeChanged = u.referralCode !== newCode;
    const pathChanged = u.path !== path;
    const depthChanged = u.depth !== depth;
    if (!codeChanged && !pathChanged && !depthChanged) {
      unchanged++;
      continue;
    }
    updates.push({
      id: u.id,
      address: addr,
      oldCode: u.referralCode,
      newCode,
      oldPath: u.path,
      newPath: path,
      oldDepth: u.depth,
      newDepth: depth,
    });
  }

  console.log(`Unchanged: ${unchanged}`);
  console.log(`To update: ${updates.length}`);
  console.log(`Orphans (missing superior): ${orphans}`);
  for (const u of updates.slice(0, 10)) {
    console.log(
      `  ${u.address}\n` +
      `    code:  ${u.oldCode ?? '(null)'} -> ${u.newCode}\n` +
      `    path:  ${u.oldPath ?? '(null)'} -> ${u.newPath}\n` +
      `    depth: ${u.oldDepth} -> ${u.newDepth}`,
    );
  }
  if (updates.length > 10) console.log(`  ... and ${updates.length - 10} more`);

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with --apply to write.');
    return;
  }

  // Two-phase write to dodge the unique constraint on referralCode.
  console.log('\nApplying (two-phase, single transaction)…');
  await prisma.$transaction(
    async (tx) => {
      for (const u of updates) {
        await tx.user.update({ where: { id: u.id }, data: { referralCode: null } });
      }
      for (const u of updates) {
        await tx.user.update({
          where: { id: u.id },
          data: {
            referralCode: u.newCode,
            path: u.newPath,
            depth: u.newDepth,
          },
        });
      }
    },
    { timeout: 300_000 },
  );
  console.log(`Done. Updated ${updates.length} rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
