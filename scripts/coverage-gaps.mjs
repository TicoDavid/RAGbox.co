import { readFileSync } from 'fs';
const cov = JSON.parse(readFileSync('./coverage/coverage-summary.json', 'utf8'));
const entries = Object.entries(cov).filter(([k]) => k !== 'total').map(([path, data]) => ({
  path: path.replace(/.*RAGbox.co[/\\]/, ''),
  uncovered: data.statements.total - data.statements.covered,
  pct: data.statements.pct
})).filter(e => e.uncovered > 20).sort((a,b) => b.uncovered - a.uncovered);
console.log('REMAINING GAPS (>20 uncovered):');
entries.slice(0, 20).forEach(e => console.log(String(e.uncovered).padStart(5), String(e.pct).padStart(6) + '%', e.path));
const t = cov.total;
console.log('\nTotal:', t.statements.pct + '% | Need:', Math.ceil(0.60 * t.statements.total) - t.statements.covered, 'more stmts');
