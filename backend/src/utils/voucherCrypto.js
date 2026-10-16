/**
 * Voucher Cryptographic Utility
 * 
 * Secure generation, normalization, lookup hashing, and PIN verification
 * for Q2 Connect Suite Subscription Vouchers.
 * 
 * Rules:
 * - 16-character code using non-ambiguous uppercase characters (no 0/O, 1/I/L)
 * - HMAC-SHA256 digest for database lookup using dedicated VOUCHER_LOOKUP_SECRET
 * - Raw codes are never stored in database
 * - 6-digit cryptographically secure numeric PIN
 * - Scrypt salted verifier with server-side pepper using dedicated VOUCHER_PIN_SECRET
 * - Raw PINs are never stored, logged, or recoverable
 * - Constant-time comparisons to prevent timing side-channel attacks
 */

const crypto = require('crypto');

// Human-readable alphabet excluding ambiguous characters: 0, O, 1, I, L
const VOUCHER_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const VOUCHER_CODE_LENGTH = 16;
const PIN_LENGTH = 6;

function getLookupSecret() {
  const secret = process.env.VOUCHER_LOOKUP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('VOUCHER_LOOKUP_SECRET must be configured in environment');
    }
    return 'default_dev_voucher_lookup_secret_64hex_do_not_use_in_prod_123456';
  }
  return secret;
}

function getPinSecret() {
  const secret = process.env.VOUCHER_PIN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('VOUCHER_PIN_SECRET must be configured in environment');
    }
    return 'default_dev_voucher_pin_secret_64hex_do_not_use_in_prod_123456';
  }
  return secret;
}

/**
 * Generate a 16-character cryptographically random voucher code
 */
function generateVoucherCode() {
  let code = '';
  for (let i = 0; i < VOUCHER_CODE_LENGTH; i++) {
    const randomIndex = crypto.randomInt(0, VOUCHER_ALPHABET.length);
    code += VOUCHER_ALPHABET[randomIndex];
  }
  return code;
}

/**
 * Normalizes entered code: uppercase, trim, removes whitespace and dashes
 */
function normalizeVoucherCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim().toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Validates voucher code character set and length
 */
function isValidVoucherCodeFormat(code) {
  const normalized = normalizeVoucherCode(code);
  if (normalized.length !== VOUCHER_CODE_LENGTH) return false;
  const regex = /^[2-9A-HJ-NP-Z]{16}$/;
  return regex.test(normalized);
}

/**
 * Generates a 6-digit cryptographically secure numeric PIN
 */
function generateVoucherPin() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Normalizes entered PIN
 */
function normalizeVoucherPin(pin) {
  if (pin === null || pin === undefined) return '';
  return String(pin).trim();
}

/**
 * Validates PIN format (strictly 6 digits)
 */
function isValidVoucherPinFormat(pin) {
  const normalized = normalizeVoucherPin(pin);
  return /^\d{6}$/.test(normalized);
}

/**
 * Computes keyed HMAC-SHA256 digest of normalized code for database indexing & lookup
 */
function computeVoucherLookupDigest(code) {
  const normalized = normalizeVoucherCode(code);
  return crypto
    .createHmac('sha256', getLookupSecret())
    .update(normalized)
    .digest('hex');
}

/**
 * Generates masked representation of code for safe administrative reference
 * e.g. "Q2M7-****-****-R6TZ"
 */
function maskVoucherCode(code) {
  const normalized = normalizeVoucherCode(code);
  if (normalized.length !== VOUCHER_CODE_LENGTH) {
    return '****-****-****-****';
  }
  return `${normalized.slice(0, 4)}-****-****-${normalized.slice(12)}`;
}

/**
 * Generates a human-friendly voucher reference identifier
 * e.g. "VCH-2026-A1B2C3"
 */
function generateVoucherReference() {
  const year = new Date().getFullYear();
  const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `VCH-${year}-${hex}`;
}

/**
 * Generates a random cryptographic salt for PIN hashing
 */
function generatePinSalt() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Computes scrypt hash of PIN with salt and server pepper
 */
function computePinVerifier(pin, salt) {
  const normalizedPin = normalizeVoucherPin(pin);
  const pepper = getPinSecret();
  return crypto
    .scryptSync(normalizedPin, salt + pepper, 64)
    .toString('hex');
}

/**
 * Constant-time verification of entered PIN against stored verifier and salt
 */
function verifyPin(pin, salt, storedVerifier) {
  if (!pin || !salt || !storedVerifier) return false;
  if (!isValidVoucherPinFormat(pin)) return false;

  try {
    const computedVerifier = computePinVerifier(pin, salt);
    const storedBuf = Buffer.from(storedVerifier, 'hex');
    const computedBuf = Buffer.from(computedVerifier, 'hex');

    if (storedBuf.length !== computedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(storedBuf, computedBuf);
  } catch (err) {
    return false;
  }
}

module.exports = {
  VOUCHER_ALPHABET,
  VOUCHER_CODE_LENGTH,
  PIN_LENGTH,
  generateVoucherCode,
  normalizeVoucherCode,
  isValidVoucherCodeFormat,
  generateVoucherPin,
  normalizeVoucherPin,
  isValidVoucherPinFormat,
  computeVoucherLookupDigest,
  maskVoucherCode,
  generateVoucherReference,
  generatePinSalt,
  computePinVerifier,
  verifyPin,
};
