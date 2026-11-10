// Lista todos os textos traduzíveis do código (as chaves em português).
// Uso: node tools/i18n-keys.mjs            -> imprime as chaves
//      node tools/i18n-keys.mjs --missing  -> imprime as que faltam em en/es
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../js/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function files(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'locales' ? [] : files(p);
    return p.endsWith('.js') ? [p] : [];
  });
}

const unq = s => s.replace(/\\'/g, "'").replace(/\\n/g, '\n');
export function collectKeys() {
  const keys = new Set();
  const lit = "'((?:[^'\\\\]|\\\\.)*)'";
  const reT = new RegExp(`\\b(?:t|tr)\\(${lit}`, 'g');
  const reTn = new RegExp(`\\btn\\([^,]+,\\s*${lit},\\s*${lit}`, 'g');
  for (const f of files(root)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(reT)) keys.add(unq(m[1]));
    for (const m of src.matchAll(reTn)) { keys.add(unq(m[1])); keys.add(unq(m[2])); }
  }
  // textos de dados traduzidos em tempo de execução
  const data = readFileSync(join(root, 'data.js'), 'utf8');
  const groups = data.match(/GROUPS = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
  groups.forEach(g => keys.add(g));
  const tpl = data.slice(data.indexOf('export const TEMPLATES'));
  for (const m of tpl.matchAll(/name: '([^']+)', desc: '([^']+)'/g)) { keys.add(m[1]); keys.add(m[2]); }
  for (const m of tpl.matchAll(/\['([^']+)', \[/g)) keys.add(m[1]);
  // mensagens de erro do armazenamento (traduzidas na hora de mostrar)
  keys.add('Arquivo de backup inválido.');
  keys.add('O arquivo do Google Drive está corrompido.');
  return [...keys];
}

if (process.argv[1]?.endsWith('i18n-keys.mjs')) {
  const keys = collectKeys();
  if (process.argv.includes('--missing')) {
    for (const l of ['en', 'es']) {
      const pack = (await import(`../js/locales/${l}.js`)).default;
      const miss = keys.filter(k => !(k in pack.ui));
      console.log(`--- ${l}: faltam ${miss.length} de ${keys.length}`);
      miss.forEach(k => console.log(JSON.stringify(k)));
    }
  } else {
    keys.forEach(k => console.log(JSON.stringify(k)));
    console.error(`${keys.length} chaves`);
  }
}
