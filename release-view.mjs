const repository = 'https://github.com/eterspire-trainer/eterspire-trainer-releases/releases';
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);

export async function validatePublicRelease(value) {
    if (value === null) return null;
    if (!object(value) || typeof value.version !== 'string' || value.version.length > 64 || !/^\d+\.\d+\.\d+\.\d+$/.test(value.version) ||
        !Number.isSafeInteger(value.sequence) || value.sequence < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(value.date ?? '') ||
        new Date(value.date).toISOString().slice(0, 10) !== value.date || typeof value.notes !== 'string' || !hash(value.notesSha256) ||
        value.url !== repository + '/tag/v' + value.version) throw new Error('Invalid public release view.');
    const bytes = new TextEncoder().encode(value.notes);
    if (bytes.length > 65536) throw new Error('Release notes are too large.');
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
    if (digest !== value.notesSha256) throw new Error('Release notes identity mismatch.');
    if (value.download !== null && (!object(value.download) || value.download.file !== 'EterspireLauncher.exe' ||
        !Number.isSafeInteger(value.download.size) || value.download.size < 1 || !hash(value.download.sha256) ||
        value.download.url !== repository + '/download/v' + value.version + '/EterspireLauncher.exe')) throw new Error('Invalid public download.');
    return {version: value.version, sequence: value.sequence, date: value.date, notes: value.notes,
        notesSha256: value.notesSha256, url: value.url, download: value.download === null ? null : {
            file: value.download.file, size: value.download.size, sha256: value.download.sha256, url: value.download.url}};
}

export async function renderRelease(root, value) {
    const node = selector => root.querySelector(selector);
    node('#release-content').hidden = true;
    node('#release-empty').hidden = false;
    node('#release-empty').textContent = 'No published releases yet.';
    node('#download-status').textContent = 'Download not available yet.';
    node('#download-meta').textContent = 'Windows x64 · Awaiting public release.';
    for (const selector of ['#release-link', '#download-link']) {
        node(selector).hidden = true;
        node(selector).removeAttribute('href');
    }
    const release = await validatePublicRelease(value);
    if (!release) return;
    node('#release-version').textContent = release.version;
    node('#release-date').textContent = release.date;
    node('#release-date').setAttribute('datetime', release.date);
    node('#release-notes').textContent = release.notes;
    node('#release-link').setAttribute('href', release.url);
    node('#release-link').hidden = false;
    node('#release-content').hidden = false;
    node('#release-empty').hidden = true;
    if (release.download) {
        node('#download-status').textContent = 'Windows launcher ' + release.version;
        node('#download-meta').textContent = `${release.download.size.toLocaleString('en-US')} bytes · SHA-256 ${release.download.sha256}`;
        node('#download-link').setAttribute('href', release.download.url);
        node('#download-link').hidden = false;
    }
}
