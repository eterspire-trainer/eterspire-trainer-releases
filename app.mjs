import {siteConfig} from './site-config.mjs';
import {consumeDeviceQuery, createRequestController} from './request-form.mjs';
import {renderRelease} from './release-view.mjs';

export function initializeSite(document, browser, config = siteConfig) {
    const form = document.querySelector('#request-form');
    const status = document.querySelector('#request-status');
    const button = document.querySelector('#send-request');
    const fieldNames = ['deviceCode', 'tier', 'name', 'email'];
    const fields = Object.fromEntries(fieldNames.map(name => [name, document.getElementById(name)]));
    const prefill = consumeDeviceQuery(browser.location, browser.history);
    if (prefill.deviceCode) fields.deviceCode.value = prefill.deviceCode;
    if (!prefill.removed) {
        const notice = document.querySelector('#address-status');
        notice.hidden = false;
        notice.textContent = 'The page address could not be cleared. Remove its query before sharing this link.';
    }
    function clearErrors() {
        for (const name of fieldNames) {
            fields[name].removeAttribute('aria-invalid');
            document.getElementById(name + '-error').textContent = '';
        }
    }
    const controller = createRequestController({endpoint: config.requestEndpoint, onState(state) {
        clearErrors();
        const sending = state.status === 'sending';
        for (const field of Object.values(fields)) field.disabled = sending;
        button.disabled = sending || state.status === 'unavailable';
        button.textContent = sending ? 'Sending request…' : 'Send request';
        form.setAttribute('aria-busy', String(sending));
        status.dataset.state = state.status;
        status.textContent = state.message;
        if (state.field && fields[state.field]) {
            fields[state.field].setAttribute('aria-invalid', 'true');
            document.getElementById(state.field + '-error').textContent = state.message;
            fields[state.field].focus();
        }
        if (state.status === 'received') form.reset();
    }});
    form.addEventListener('submit', event => {
        event.preventDefault();
        void controller.submit(Object.fromEntries(fieldNames.map(name => [name, fields[name].value])));
    });
    form.addEventListener('input', clearErrors);
    void renderRelease(document, config.publicRelease).catch(() => {
        document.querySelector('#release-empty').textContent = 'Published release details could not be verified. No download is offered.';
    });
    return controller;
}

if (typeof document !== 'undefined') initializeSite(document, window);
