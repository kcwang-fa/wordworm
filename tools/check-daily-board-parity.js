const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FIXTURES = {
  '2026-07-11': 'NNSTPGR/BOPEYTA/INERARL/OREEOUY/OBOLLGL/JEAABNM/ELGJSOO',
  '2026-07-12': 'AWBILPS/PEONOHU/OIDWUID/JQuSDESL/EESDTLT/LYEFHEC/XIYGSTN',
  '2026-12-31': 'AERHTCF/DNTGEEA/TEEDFEU/ELAUIVA/RHNITTF/URAKIIS/REYANNO',
  '2027-01-01': 'TUOYVNT/HEWOFLA/ORLLTSG/TIEAANB/UAURNSN/HOLISST/NLHVRKE',
};

function stubElement() {
  return {
    classList: { toggle() {}, contains() { return false; }, add() {}, remove() {} },
    addEventListener() {},
    appendChild() {},
    setAttribute() {},
    style: {},
    dataset: {},
    innerHTML: '',
    textContent: '',
    hidden: false,
    onclick: null,
    value: '',
  };
}

const sandbox = {
  console,
  URLSearchParams,
  Date,
  Math,
  setTimeout() {},
  clearTimeout() {},
  setInterval() { return 1; },
  clearInterval() {},
  confirm() { return false; },
  addEventListener() {},
  location: { search: '' },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  document: {
    body: { classList: { toggle() {}, contains() { return true; }, add() {}, remove() {} } },
    getElementById() { return stubElement(); },
    createElement() { return stubElement(); },
    elementFromPoint() { return null; },
  },
  window: null,
};
sandbox.window = sandbox;

vm.createContext(sandbox);
for (const file of ['js/game-core.js', 'js/game-board.js', 'js/daily.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

let failed = false;
for (const [date, expected] of Object.entries(FIXTURES)) {
  const actual = vm.runInContext(
    `freshBoardDaily('${date}').map(col => col.map(t => t.letter).join('')).join('/')`,
    sandbox
  );
  if (actual !== expected) {
    failed = true;
    console.error(`${date} changed\n  expected ${expected}\n  actual   ${actual}`);
  }
}

if (failed) process.exit(1);
console.log(`Daily board parity OK (${Object.keys(FIXTURES).length} fixtures)`);
