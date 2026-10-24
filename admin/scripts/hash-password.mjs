// Usage: npm run hash-password -- "your password"
// Prints a value for ADMIN_PASSWORD_HASH in .env.local.
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('Give a password of at least 10 characters: npm run hash-password -- "your password"');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
console.log(`scrypt:${salt.toString('hex')}:${hash.toString('hex')}`);
