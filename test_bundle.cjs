const fs = require('fs');
const path = require('path');

// Mock do Browser DOM
global.window = {
  location: { href: 'http://localhost/', origin: 'http://localhost', reload() {} },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  addEventListener() {},
  removeEventListener() {},
  scrollTo() {},
  navigator: { userAgent: '' }
};
global.document = {
  documentElement: { classList: { add() {}, remove() {} } },
  addEventListener() {},
  removeEventListener() {},
  createElement() { return { style: {} }; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  getElementById() { return null; },
  getElementsByTagName() { return []; }
};
global.navigator = global.window.navigator;
global.localStorage = global.window.localStorage;
global.sessionStorage = global.window.sessionStorage;
global.location = global.window.location;
global.MutationObserver = class { observe() {} disconnect() {} };
global.CustomEvent = class {};
global.fetch = () => Promise.resolve();

const assetsDir = path.join(__dirname, 'dist', 'assets');
const files = fs.readdirSync(assetsDir);
const indexFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));
if (!indexFile) {
  console.error("Index file not found!");
  process.exit(1);
}

console.log("Loading bundle:", indexFile);
try {
  require(path.join(assetsDir, indexFile));
  console.log("Bundle loaded successfully without TDZ crash!");
} catch (err) {
  console.error("CRASH DETECTED:");
  console.error(err);
}
