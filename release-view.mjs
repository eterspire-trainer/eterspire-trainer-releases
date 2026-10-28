const repository = 'https://github.com/eterspire-trainer/eterspire-trainer-releases/releases';
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);

export async function validatePublicRelease(value) {
    if (value === null) return null;
    if (!object(value) || Object.keys(value).some(key => !['version', 'sequence', 'download'].includes(key)) ||
        typeof value.version !== 'string' || value.version.length > 64 || value.version !== value.version.trim() ||
        !/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){2,3}$/.test(value.version) ||
        !Number.isSafeInteger(value.sequence) || value.sequence < 1) throw new Error('Invalid public download metadata.');
    if (value.download !== null && (!object(value.download) ||
        Object.keys(value.download).some(key => !['file', 'size', 'sha256', 'url'].includes(key)) || value.download.file !== 'EterspireLauncher.exe' ||
        !Number.isSafeInteger(value.download.size) || value.download.size < 1 || !hash(value.download.sha256) ||
        value.download.url !== repository + '/download/v' + value.version + '/EterspireLauncher.exe')) throw new Error('Invalid public download.');
    return {version: value.version, sequence: value.sequence, download: value.download === null ? null : {
            file: value.download.file, size: value.download.size, sha256: value.download.sha256, url: value.download.url}};
}

export async function renderRelease(root, value) {
    const node = selector => root.querySelector(selector);
    node('#download-status').textContent = 'Download not available yet.';
    node('#download-meta').textContent = 'Windows x64 · Awaiting public release.';
    node('#download-link').hidden = true;
    node('#download-link').removeAttribute('href');
    node('#download-details').hidden = true;
    node('#download-details').open = false;
    const release = await validatePublicRelease(value);
    if (!release) return;
    if (release.download) {
        node('#download-status').textContent = 'Windows launcher ' + release.version;
        node('#download-meta').textContent = `${release.download.size.toLocaleString('en-US')} bytes · SHA-256 ${release.download.sha256}`;
        node('#download-link').setAttribute('href', release.download.url);
        node('#download-link').hidden = false;
        node('#download-details').hidden = false;
    }
}
