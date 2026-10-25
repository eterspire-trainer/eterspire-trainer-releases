export class RequestValidationError extends Error {
    constructor(code, field = null) { super(code); this.code = code; this.field = field; }
}

const controls = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const fields = new Set(['email', 'name', 'deviceCode', 'tier']);
const reject = (code, field) => { throw new RequestValidationError(code, field); };

export function validateLicenseRequest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(key => !fields.has(key)) ||
        ['email', 'deviceCode', 'tier'].some(key => !Object.hasOwn(value, key))) reject('invalid_request');
    if (typeof value.deviceCode !== 'string' || !/^ETR1-[A-F0-9]{64}$/.test(value.deviceCode)) reject('invalid_device', 'deviceCode');
    if (![1, 2].includes(value.tier)) reject('invalid_tier', 'tier');
    if (typeof value.email !== 'string' || controls.test(value.email) || value.email.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) reject('invalid_email', 'email');
    if (Object.hasOwn(value, 'name') && (typeof value.name !== 'string' || value.name.length > 80 || controls.test(value.name))) reject('invalid_name', 'name');
    const result = {email: value.email.trim(), deviceCode: value.deviceCode, tier: value.tier};
    if (value.name?.trim()) result.name = value.name.trim();
    return result;
}
