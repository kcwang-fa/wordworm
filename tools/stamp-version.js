const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'js', 'version.js');

function timestampVersion(date = new Date()) {
  return date.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

const version = process.env.WORDWORM_VERSION || timestampVersion();
const body = `(function (root) {
  root.WORDWORM_VERSION = '${version}';
})(typeof self !== 'undefined' ? self : window);
`;

fs.writeFileSync(OUT, body);
console.log(`Stamped ${path.relative(ROOT, OUT)} with ${version}`);
