import {readdir, readFile} from 'node:fs/promises';
import {reviewWithRules} from '../server/review.mjs';

const directory = 'ai/fixtures';
const fixtures = (await readdir(directory)).filter(name => name.endsWith('.json'));
let failed = false;

for (const name of fixtures) {
    const fixture = JSON.parse(await readFile(`${directory}/${name}`, 'utf8'));
    const actual = reviewWithRules(fixture.passport).map(item => item.id).sort();
    const expected = [...fixture.expectedIssueIds].sort();
    const passed = actual.join('|') === expected.join('|');
    console.log(`${passed ? '✓' : '✗'} ${fixture.name}`);
    if (!passed) {
        failed = true;
        console.error(`  Ожидалось: ${expected.join(', ') || 'нет замечаний'}`);
        console.error(`  Получено: ${actual.join(', ') || 'нет замечаний'}`);
    }
}

if (failed) process.exitCode = 1;
