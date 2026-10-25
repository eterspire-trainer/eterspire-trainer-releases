import {validateLicenseRequest, RequestValidationError} from './shared/request-validation.mjs';

const messages = {
    invalid_device: 'Copy the complete ETR1- device code from the launcher.',
    invalid_tier: 'Choose Lite or Full.',
    invalid_email: 'Enter a valid reply email address.',
    invalid_name: 'Use a name of at most 80 characters on one line.',
    invalid_request: 'Check the request fields and try again.'
};
const errorFields = {invalid_device: 'deviceCode', invalid_tier: 'tier', invalid_email: 'email', invalid_name: 'name'};
const unconfirmed = 'Receipt could not be confirmed. Wait before trying again to avoid a duplicate request.';

export function prepareFormRequest(fields) {
    return validateLicenseRequest({
        deviceCode: typeof fields.deviceCode === 'string' ? fields.deviceCode.trim().toUpperCase() : fields.deviceCode,
        tier: fields.tier === '1' ? 1 : fields.tier === '2' ? 2 : fields.tier,
        email: typeof fields.email === 'string' ? fields.email.trim() : fields.email,
        ...(fields.name !== undefined ? {name: fields.name} : {})
    });
}

export function consumeDeviceQuery(location, history) {
    const query = new URLSearchParams(location.search);
    const values = query.getAll('device');
    const normalized = values.length === 1 ? values[0].trim().toUpperCase() : '';
    const deviceCode = /^ETR1-[A-F0-9]{64}$/.test(normalized) ? normalized : null;
    if (!location.search) return {deviceCode, removed: true};
    try {
        history.replaceState(null, '', location.pathname + location.hash);
        return {deviceCode, removed: true};
    } catch { return {deviceCode, removed: false}; }
}

async function responseJson(response, signal) {
    if (signal.aborted) { void response.body?.cancel().catch(() => {}); throw Error('Unconfirmed'); }
    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || !response.body) throw Error('Unconfirmed');
    const reader = response.body.getReader();
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', cancel, {once: true});
    try {
        const chunks = []; let total = 0;
        while (true) {
            const {done, value} = await reader.read();
            if (value?.length) {
                total += value.length;
                if (total > 2048) throw Error('Unconfirmed');
                chunks.push(value);
            }
            if (done) break;
        }
        const bytes = new Uint8Array(total); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    } finally { signal.removeEventListener('abort', cancel); cancel(); }
}

export function createRequestController({endpoint, fetcher = fetch, onState, timeoutMs = 20000}) {
    if (endpoint !== null) {
        const url = new URL(endpoint);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/license-request')
            throw Error('Invalid request endpoint configuration.');
    }
    let pending = false;
    onState(endpoint === null ? {status: 'unavailable', message: 'License requests are not available yet.'} :
        {status: 'idle', message: 'Complete the form, then send your request for review.'});
    return {async submit(fields) {
        if (endpoint === null || pending) return;
        let payload;
        try { payload = prepareFormRequest(fields); }
        catch (error) {
            if (!(error instanceof RequestValidationError)) throw error;
            onState({status: 'invalid', field: error.field, message: messages[error.code] ?? messages.invalid_request});
            return;
        }
        const controller = new AbortController(); let timer;
        pending = true;
        onState({status: 'sending', message: 'Sending your request…'});
        try {
            const expired = new Promise((_, reject) => {
                timer = setTimeout(() => {controller.abort();reject(Error('Unconfirmed'));}, timeoutMs);
            });
            const operation = (async () => {
                const response = await fetcher(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'},
                    credentials: 'omit', referrerPolicy: 'no-referrer', body: JSON.stringify(payload), signal: controller.signal});
                const body = await responseJson(response, controller.signal);
                return {response, body};
            })();
            const {response, body} = await Promise.race([operation, expired]);
            if (response.status === 201 && body?.ok === true && typeof body.requestId === 'string' &&
                /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.requestId) &&
                Object.keys(body).length === 2) {
                onState({status: 'received', requestId: body.requestId, message: 'Request received for review. This does not activate a license.'});
            } else if (response.status === 400 && Object.hasOwn(messages, body?.error)) {
                onState({status: 'invalid', field: errorFields[body.error], message: messages[body.error]});
            } else if (response.status === 429) {
                onState({status: 'error', message: 'Too many requests. Wait before trying again.'});
            } else if (response.status === 403) {
                onState({status: 'error', message: 'Requests cannot be sent from this page. Open the project downloads page and try again.'});
            } else if (response.status >= 400) {
                onState({status: 'error', message: 'The request service is unavailable. Try again later.'});
            } else onState({status: 'unconfirmed', message: unconfirmed});
        } catch { onState({status: 'unconfirmed', message: unconfirmed}); }
        finally { clearTimeout(timer); pending = false; }
    }};
}
