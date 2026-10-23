// Lädt die DOM-freien Spielmodule in einen isolierten Node-Kontext.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CORE_FILES = ['config.js', 'format.js', 'state.js', 'economy.js', 'unlocks.js', 'actions.js', 'core.js', 'save.js'];

function load() {
  const ctx = { console, Buffer, Math, JSON, Date };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of CORE_FILES) {
    const file = path.join(__dirname, '..', 'js', f);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  return ctx.AB;
}

module.exports = { load, CORE_FILES };
