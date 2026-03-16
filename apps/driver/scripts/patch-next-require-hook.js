const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..', 'node_modules', 'next');
const serverDir = path.join(base, 'server');
const shimPath = path.join(serverDir, 'require-hook.js');

if (!fs.existsSync(base)) {
  process.exit(0);
}

if (!fs.existsSync(serverDir)) {
  fs.mkdirSync(serverDir, { recursive: true });
}

if (!fs.existsSync(shimPath)) {
  fs.writeFileSync(
    shimPath,
    "module.exports = require('../dist/server/require-hook');\n",
    'utf8'
  );
}
