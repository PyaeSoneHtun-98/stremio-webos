'use strict';

// Usage: node scripts/install-dictionary-asset.js <source-file> <target-file> <sha256> <entries>
// Verify the exact desktop-reviewed bytes before compacting JSON into the webOS IPK.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const [source, target, expectedHash, expectedEntries] = process.argv.slice(2);
if (!source || !target || !/^[a-f0-9]{64}$/.test(expectedHash || '') ||
    !/^\d+$/.test(expectedEntries || '')) {
    throw new Error('Usage: install-dictionary-asset <source> <target> <sha256> <count>');
}

const bytes = fs.readFileSync(source);
const actualHash = crypto.createHash('sha256').update(bytes).digest('hex');
if (actualHash !== expectedHash) throw new Error('Pinned corpus SHA-256 mismatch: ' + path.basename(target));

const doc = JSON.parse(bytes.toString('utf8'));
if (doc.version !== 1 || !Array.isArray(doc.entries) || doc.entries.length !== Number(expectedEntries)) {
    throw new Error('Unexpected corpus version or entry count: ' + path.basename(target));
}
if (!doc.entries.every((entry) => entry && typeof entry === 'object')) {
    throw new Error('Corpus contains an invalid entry: ' + path.basename(target));
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(doc), 'utf8');
console.log('Verified ' + path.basename(target) + ': ' + doc.entries.length + ' entries; SHA-256 ' + actualHash);
