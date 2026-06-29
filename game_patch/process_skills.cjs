const fs = require('fs');

let engine = fs.readFileSync('src/game/GameEngine.ts', 'utf-8');

const skillBlockStart = '                    if (isSkillPress && top.modelType === 1) {';
const skillBlockEnd = '                    let isSpinPress = e.code === top.controls.spin;'; // Before this

const startIdx = engine.indexOf(skillBlockStart);
const endIdx = engine.indexOf(skillBlockEnd);

if (startIdx !== -1 && endIdx !== -1) {
    let skillCode = engine.substring(startIdx, endIdx);
    
    let skillFn = `import { GameEngine, MAX_SPIN } from './GameEngine';\nimport { Top } from './types';\n\nexport function triggerTopSkill(top: Top, engine: GameEngine): boolean {\n`;
    
    skillCode = skillCode.replace(/this\./g, 'engine.');
    skillCode = skillCode.replace(/return;/g, 'return true;');
    
    skillFn += skillCode;
    skillFn += `\n    return false;\n}\n`;

    const replacement = `                    if (isSkillPress) {\n                        if (triggerTopSkill(top, this)) {\n                            return;\n                        }\n                    }\n\n`;
    engine = engine.substring(0, startIdx) + replacement + engine.substring(endIdx);
    
    fs.writeFileSync('src/game/GameEngine.ts', engine);
    fs.writeFileSync('src/game/skills.ts', skillFn);
    console.log('skills.ts extracted!');
} else {
    console.log('Skill block not found');
}
