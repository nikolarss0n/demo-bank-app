import { writeFileSync } from 'node:fs';
const mode = process.argv[2];
if (!['bug', 'restore'].includes(mode)) throw new Error('Use bug or restore');
writeFileSync(new URL('../lib/transfer-demo-mode.ts', import.meta.url), `// Prepared integration demo defect; change through npm run demo:restore or demo:bug.\nexport const omitTransferFee = ${mode === 'bug'};\n`);
console.log(mode === 'bug' ? 'Transfer fee bug enabled. Integration debit assertion should fail.' : 'Correct transfer debit restored. Rerun the unchanged integration tests.');
