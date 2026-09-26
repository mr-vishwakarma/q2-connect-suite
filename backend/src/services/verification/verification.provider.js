/**
 * Twilio Verify API v2 Provider Abstraction
 * Phase 21: VerificationProvider with Twilio Verify v2 and local dev fallback
 */

// Normalize phone numbers to E.164
function normalizeToE164(phone, defaultCountry = '+91') {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s\-\(\)]/g, '').trim();
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0')) return `${defaultCountry}${cleaned.slice(1)}`;
  if (cleaned.length === 10) return `${defaultCountry}${cleaned}`;
  return `+${cleaned}`;
}

class VerificationProvider {
  async startPhoneVerification(phone) {
    throw new Error('startPhoneVerification must be implemented');
  }
  async checkPhoneVerification(phone, code) {
    throw new Error('checkPhoneVerification must be implemented');
  }
  async startEmailVerification(email) {
    throw new Error('startEmailVerification must be implemented');
  }
  async checkEmailVerification(email, code) {
    throw new Error('checkEmailVerification must be implemented');
  }
}

class TwilioVerifyProvider extends VerificationProvider {
  constructor({ accountSid, apiKeySid, apiKeySecret, serviceSid }) {
    super();
    this.accountSid = accountSid;
    this.apiKeySid = apiKeySid;
    this.apiKeySecret = apiKeySecret;
    this.serviceSid = serviceSid;
    this.baseUrl = `https://verify.twilio.com/v2/Services/${serviceSid}`;
  }

  getAuthHeader() {
    const user = this.apiKeySid || this.accountSid;
    const pass = this.apiKeySecret;
    const credentials = Buffer.from(`${user}:${pass}`).toString('base64');
    return `Basic ${credentials}`;
  }

  async startPhoneVerification(rawPhone) {
    const to = normalizeToE164(rawPhone);
    const body = new URLSearchParams({ To: to, Channel: 'sms' });

    const res = await fetch(`${this.baseUrl}/Verifications`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Twilio Verify error: ${res.status}`);
    }

    return {
      status: data.status,
      to: data.to,
      channel: data.channel,
      valid: data.status === 'pending',
    };
  }

  async checkPhoneVerification(rawPhone, code) {
    const to = normalizeToE164(rawPhone);
    const body = new URLSearchParams({ To: to, Code: code.trim() });

    const res = await fetch(`${this.baseUrl}/VerificationCheck`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Twilio VerificationCheck error: ${res.status}`);
    }

    return {
      status: data.status,
      to: data.to,
      valid: data.status === 'approved',
    };
  }

  async startEmailVerification(email) {
    const to = email.toLowerCase().trim();
    const body = new URLSearchParams({ To: to, Channel: 'email' });

    const res = await fetch(`${this.baseUrl}/Verifications`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Twilio Verify error: ${res.status}`);
    }

    return {
      status: data.status,
      to: data.to,
      channel: data.channel,
      valid: data.status === 'pending',
    };
  }

  async checkEmailVerification(email, code) {
    const to = email.toLowerCase().trim();
    const body = new URLSearchParams({ To: to, Code: code.trim() });

    const res = await fetch(`${this.baseUrl}/VerificationCheck`, {
      method: 'POST',
      headers: {
        Authorization: this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Twilio VerificationCheck error: ${res.status}`);
    }

    return {
      status: data.status,
      to: data.to,
      valid: data.status === 'approved',
    };
  }
}

class MockVerifyProvider extends VerificationProvider {
  constructor() {
    super();
    this.memoryCodes = new Map();
  }

  async startPhoneVerification(phone) {
    const to = normalizeToE164(phone);
    const code = '123456';
    this.memoryCodes.set(to, { code, expires: Date.now() + 10 * 60 * 1000 });
    console.log(`[VerificationProvider:Mock] Verification code for phone ${to}: ${code}`);
    return { status: 'pending', to, channel: 'sms', valid: true };
  }

  async checkPhoneVerification(phone, code) {
    const to = normalizeToE164(phone);
    const stored = this.memoryCodes.get(to);
    const isValid = (code === '123456') || (stored && stored.code === code && stored.expires > Date.now());
    if (isValid && stored) {
      this.memoryCodes.delete(to);
    }
    return { status: isValid ? 'approved' : 'rejected', to, valid: Boolean(isValid) };
  }

  async startEmailVerification(email) {
    const to = email.toLowerCase().trim();
    const code = '123456';
    this.memoryCodes.set(to, { code, expires: Date.now() + 15 * 60 * 1000 });
    console.log(`[VerificationProvider:Mock] Verification code for email ${to}: ${code}`);
    return { status: 'pending', to, channel: 'email', valid: true };
  }

  async checkEmailVerification(email, code) {
    const to = email.toLowerCase().trim();
    const stored = this.memoryCodes.get(to);
    const isValid = (code === '123456') || (stored && stored.code === code && stored.expires > Date.now());
    if (isValid && stored) {
      this.memoryCodes.delete(to);
    }
    return { status: isValid ? 'approved' : 'rejected', to, valid: Boolean(isValid) };
  }
}

let providerInstance = null;

function getVerificationProvider() {
  if (providerInstance) return providerInstance;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (accountSid && apiKeySecret && serviceSid) {
    providerInstance = new TwilioVerifyProvider({
      accountSid,
      apiKeySid,
      apiKeySecret,
      serviceSid,
    });
  } else {
    providerInstance = new MockVerifyProvider();
  }

  return providerInstance;
}

module.exports = {
  VerificationProvider,
  TwilioVerifyProvider,
  MockVerifyProvider,
  getVerificationProvider,
  normalizeToE164,
};
