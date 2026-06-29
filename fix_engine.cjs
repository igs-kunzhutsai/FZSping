const fs = require('fs');

let engine = fs.readFileSync('src/game/GameEngine.ts', 'utf-8');

// The messed up part is from line 585 onwards.
// Let's replace the broken block from `if (top.launchPadState === 'prep_spinning') {`
// to the start of the `return; } if (top.launchPadState !== undefined)`
// I will just use string replacement on the exact broken text!

let brokenText = `                if (top.launchPadState === 'prep_spinning') {
                    if (isSkillPress) {
                        if (triggerTopSkill(top, this)) {
                            return;
                        }
                    }

                    let isSpinPress = e.code === top.controls.spin;
                        if (top.label === 'P4' && (e.code === 'Numpad7' || e.code === 'Digit7' || e.key === '7')) {
                            isSpinPress = true;
                        }
                        if (isSpinPress) {
                            top.launchPadSpinCount = (top.launchPadSpinCount ?? 0) + 1;
                            this.addParticles(top.x, top.y, '#f59e0b', 8, 160, 2);
                            this.screenShakeTimer = Math.max(this.screenShakeTimer, 0.08);
                            this.screenShakeIntensity = 2;
                        }
                    }
                    return;
                }
                if (top.launchPadState !== undefined) {
                    return; // Ignore controls during other launch pad processes!
                }
                if (!top.isAI && top.controls) {
                    const isClinging = this.zombieSiegeActive && this.siegeStatus === 'clinging' && top.id === this.siegeTargetPlayerId;

                    // check for Model 1 Skill Press
                    let isSkillPress = e.code === top.controls.skill;
                    if (top.controls.skill === 'ControlRight' && (e.code === 'ControlRight' || e.code === 'ControlLeft' || e.key === 'Control')) {
                        isSkillPress = true;
                    } else if (top.controls.skill === 'KeyE' && (e.code === 'KeyE' || e.key === 'e' || e.key === 'E')) {
                        isSkillPress = true;
                    } else if (top.controls.skill === 'KeyO' && (e.code === 'KeyO' || e.key === 'o' || e.key === 'O')) {
                        isSkillPress = true;
                    } else if (top.controls.skill === 'Numpad9' && (e.code === 'Numpad9' || e.code === 'Digit9' || e.key === '9')) {
                        isSkillPress = true;
                    }
                    
                    if (top.struggleMashCount !== undefined) {
                        if (isSkillPress) {
                            top.struggleMashCount++;
                            // Spawn bright tapping energy sparks around player top
                            this.addParticles(top.x, top.y, '#38bdf8', 12, 350, 5);
                            this.addParticles(top.x, top.y, '#ffffff', 6, 250, 3);
                            this.screenShakeTimer = 0.15;
                            this.screenShakeIntensity = 4;
                        }
                        return; // Bypass normal skill triggers during active wrestle clash!
                    }

                    if (isClinging) {
                        isSkillPress = false; // Disable all skill triggers under pinned/surrounded status!
                    }
                    
                    if (top.coopState) {
                        if (isSkillPress) {
                            top.coopState.coopSpinCount++;
                        }
                        return;
                    }`;

let correctText = `                if (top.launchPadState === 'prep_spinning') {
                    if (!top.isAI && top.controls) {
                        let isSpinPress = e.code === top.controls.spin;
                        if (top.label === 'P4' && (e.code === 'Numpad7' || e.code === 'Digit7' || e.key === '7')) {
                            isSpinPress = true;
                        }
                        if (isSpinPress) {
                            top.launchPadSpinCount = (top.launchPadSpinCount ?? 0) + 1;
                            this.addParticles(top.x, top.y, '#f59e0b', 8, 160, 2);
                            this.screenShakeTimer = Math.max(this.screenShakeTimer, 0.08);
                            this.screenShakeIntensity = 2;
                        }
                    }
                    return;
                }
                if (top.launchPadState !== undefined) {
                    return; // Ignore controls during other launch pad processes!
                }
                if (!top.isAI && top.controls) {
                    const isClinging = this.zombieSiegeActive && this.siegeStatus === 'clinging' && top.id === this.siegeTargetPlayerId;

                    // check for Model 1 Skill Press
                    let isSkillPress = e.code === top.controls.skill;
                    if (top.controls.skill === 'ControlRight' && (e.code === 'ControlRight' || e.code === 'ControlLeft' || e.key === 'Control')) {
                        isSkillPress = true;
                    } else if (top.controls.skill === 'KeyE' && (e.code === 'KeyE' || e.key === 'e' || e.key === 'E')) {
                        isSkillPress = true;
                    } else if (top.controls.skill === 'KeyO' && (e.code === 'KeyO' || e.key === 'o' || e.key === 'O')) {
                        isSkillPress = true;
                    } else if (top.controls.skill === 'Numpad9' && (e.code === 'Numpad9' || e.code === 'Digit9' || e.key === '9')) {
                        isSkillPress = true;
                    }
                    
                    if (top.struggleMashCount !== undefined) {
                        if (isSkillPress) {
                            top.struggleMashCount++;
                            this.addParticles(top.x, top.y, '#38bdf8', 12, 350, 5);
                            this.addParticles(top.x, top.y, '#ffffff', 6, 250, 3);
                            this.screenShakeTimer = 0.15;
                            this.screenShakeIntensity = 4;
                        }
                        return; 
                    }

                    if (isClinging) {
                        isSkillPress = false; 
                    }
                    
                    if (top.coopState) {
                        if (isSkillPress) {
                            top.coopState.coopSpinCount++;
                        }
                        return;
                    }
                    
                    // CALL EXTRACTED SKILL MODULE
                    if (isSkillPress) {
                        if (triggerTopSkill(top, this)) {
                            return;
                        }
                    }`;

if (engine.includes(brokenText)) {
    engine = engine.replace(brokenText, correctText);
    console.log("Fixed main block.");
} else {
    // maybe parts differ... fallback to regex
    console.log("Could not find exact block to fix.");
}

// Ensure triggerTopSkill imported
if (!engine.includes("triggerTopSkill")) {
    engine = `import { triggerTopSkill } from './skills';\n` + engine;
}

// Now we need to extract the huge skill block which is still further down!
// The skill block started with `if (isSkillPress && top.modelType === 1) {`
const skillStart = '                    if (isSkillPress && top.modelType === 1) {';
const skillEnd = '\\n                    let isSpinPress = e.code === top.controls.spin;\\n                    // For P4, support both Digit7';

// Because exact strings are hard, I will use regex
const r = new RegExp('([ \\t]*if \\(isSkillPress && top\\.modelType === 1\\) \\{[\\s\\S]*?)(?=\\n\\s*let isSpinPress = e\\.code === top\\.controls\\.spin;\\n\\s*\\/\\/ For P4)');
const m = engine.match(r);
if (m) {
    let skillCode = m[1];
    engine = engine.replace(m[1], '');
    
    let skillFn = `import { GameEngine, MAX_SPIN } from './GameEngine';\nimport { Top } from './types';\n\nexport function triggerTopSkill(top: Top, engine: GameEngine): boolean {\n`;
    skillCode = skillCode.replace(/this\\./g, 'engine.');
    skillCode = skillCode.replace(/return;/g, 'return true;');
    
    skillFn += skillCode;
    skillFn += `\n    return false;\n}\n`;

    fs.writeFileSync('src/game/skills.ts', skillFn);
    console.log("Extracted skills.ts successfully.");
} else {
    console.log("Could not extract skills.ts");
}

fs.writeFileSync('src/game/GameEngine.ts', engine);
