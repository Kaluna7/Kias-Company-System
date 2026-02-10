const fs = require('fs');
const parser = require('@babel/parser');
const code = fs.readFileSync('src/app/Page/worksheet/whs/page.js', 'utf8');
try {
  parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  console.log('OK');
} catch (e) {
  console.error(e.message);
  console.error('loc', e.loc);
  process.exit(1);
}
