const fs = require('fs');

// 1. Refactor topMovement.ts
let tm = fs.readFileSync('src/game/topMovement.ts', 'utf8');

tm = `import { updatePlayerAI } from './playerAI';\n` + tm;

const aiBlockStart = tm.indexOf('} else if (top.isAI) {');
const aiBlockEndStr = `    top.isActivelyPushing = isActivelyPushing;`;
const aiBlockEnd = tm.indexOf(aiBlockEndStr, aiBlockStart);

if (aiBlockStart !== -1 && aiBlockEnd !== -1) {
    const aiCode = `} else if (top.isAI) {
            const target = engine.getNearestEnemy(top);
            const aiResult = updatePlayerAI(top, engine, dt, target);
            inputX = aiResult.inputX;
            inputY = aiResult.inputY;
            isActivelyPushing = aiResult.isActivelyPushing;
            (top as any).isSpinningFromAI = aiResult.isSpinning;
        }

`;
    tm = tm.substring(0, aiBlockStart) + aiCode + tm.substring(aiBlockEnd);
    fs.writeFileSync('src/game/topMovement.ts', tm);
    console.log("Updated topMovement.ts");
}

// 2. Refactor GameEngine.ts
let ge = fs.readFileSync('src/game/GameEngine.ts', 'utf8');

// Replace spinning logic
const geSpinAIStart = ge.indexOf('} else if (top.isAI) {\n                // AI occasionally spins/accelerates');
const geSpinAIEndStr = `            // Initialize or update spinIdleTime`;
const geSpinAIEnd = ge.indexOf(geSpinAIEndStr, geSpinAIStart);

if (geSpinAIStart !== -1 && geSpinAIEnd !== -1) {
    const aiSpinCode = `} else if (top.isAI) {
                isSpinning = (top as any).isSpinningFromAI ?? false;
            }

            `;
    ge = ge.substring(0, geSpinAIStart) + aiSpinCode + ge.substring(geSpinAIEnd);
}

// Remove rest of AI logic
const geSkillAIStart = ge.indexOf(`} else if (top.isAI && Math.random() < 1.5 * dt) {`);
const geSkillAIEndStr = `// Remove automatic decay over time.`;
const geSkillAIEnd = ge.indexOf(geSkillAIEndStr, geSkillAIStart);

if (geSkillAIStart !== -1 && geSkillAIEnd !== -1) {
    ge = ge.substring(0, geSkillAIStart) + `}\n\n            ` + ge.substring(geSkillAIEnd);
}

// Remove launchPad AI prep spinning logic
const lpStart = ge.indexOf(`if (top.isAI) {\n                        const time = Date.now() / 1000;`);
const lpEndStr = `top.launchPadTimer = (top.launchPadTimer ?? 1.5) - dt;`;
const lpEnd = ge.indexOf(lpEndStr, lpStart);

if (lpStart !== -1 && lpEnd !== -1) {
    ge = ge.substring(0, lpStart) + `\n                    ` + ge.substring(lpEnd);
}

fs.writeFileSync('src/game/GameEngine.ts', ge);
console.log("Updated GameEngine.ts");
