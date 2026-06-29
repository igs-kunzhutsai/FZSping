const fs = require('fs');

const enginePath = 'src/game/GameEngine.ts';
let code = fs.readFileSync(enginePath, 'utf8');
const lines = code.split('\n');

const startIndex = lines.findIndex((l, i) => l === '        this.zombies.forEach(z => {');
const endIndex = lines.findIndex((l, i) => i > startIndex && l === '        });' && lines[i-1] === '            this.handleWallBounce(z);');

if (startIndex === -1 || endIndex === -1) {
    console.log('Could not find start or end', startIndex, endIndex);
    // Print out context if failed
    console.log(lines.slice(3680, 3685).join('\n'));
    process.exit(1);
}

const extractedLines = lines.slice(startIndex, endIndex + 1);

const imports = `import type { GameEngine } from './GameEngine';
import { Top, Zombie } from './types';
import { resolveCollision, checkCollision, resolveCircleBoxCollision, resolveCircleTriangleCollision, checkCircleBoxCollision } from './physics';

export function updateZombies(this: GameEngine, dt: number, zombieTargets: Top[]) {
`;

const extractedCode = imports + extractedLines.join('\n') + '\n}\n';

fs.writeFileSync('src/game/zombieBehavior.ts', extractedCode);

const newLines = [
    ...lines.slice(0, startIndex),
    '        updateZombies.call(this, dt, zombieTargets);',
    ...lines.slice(endIndex + 1)
];

let EngineCode = newLines.join('\n');
EngineCode = EngineCode.replace(
    "import { triggerTopSkill } from './skills';",
    "import { triggerTopSkill } from './skills';\nimport { updateZombies } from './zombieBehavior';"
);

fs.writeFileSync(enginePath, EngineCode);
console.log('Refactoring complete');
