const fs = require('fs');

const content = fs.readFileSync('src/game/GameEngine.ts', 'utf8');

const getNextIdx = (startIdx, funcName) => {
    let nameOnly = funcName.split('(')[0].trim();
    let search = `\n    ${nameOnly}`;
    let idx = content.indexOf(search + '(', startIdx);
    if(idx === -1) idx = content.indexOf(search + ' (', startIdx);
    if(idx === -1) idx = content.indexOf(search + '{', startIdx);
    if(idx === -1) idx = content.indexOf(search + ' {', startIdx);
    
    // Fallbacks if trailing space
    if (idx === -1) {
        throw new Error("Could not find func: " + funcName);
    }
    return idx;
};

const extractFunc = (funcName, nextFuncName) => {
    let nameOnly = funcName.split('(')[0].trim();
    let search = `\n    ${nameOnly}`;
    let startIdx = content.indexOf(search + '(');
    if(startIdx === -1) startIdx = content.indexOf(search + ' (');
    if(startIdx === -1) startIdx = content.indexOf(search + '{');
    if(startIdx === -1) startIdx = content.indexOf(search + ' {');
    
    if (startIdx === -1) throw new Error("Not found: " + funcName);
    
    let endIdx = nextFuncName ? getNextIdx(startIdx + 1, nextFuncName) : content.lastIndexOf('\n}');
    
    let text = content.substring(startIdx + 1, endIdx);
    
    text = text.replace(/^    /gm, '');
    let lines = text.split('\n');
    let sigLine = lines[0];
    
    if (sigLine.includes('()')) {
        sigLine = `export function ${nameOnly}(engine: GameEngine) {`;
    } else {
        sigLine = sigLine.replace(/\(/, '(engine: GameEngine, ');
        sigLine = `export function ${sigLine}`;
    }
    lines[0] = sigLine;
    let newText = lines.join('\n');
    
    newText = newText.replace(/this\./g, 'engine.');
    return newText;
};

fs.mkdirSync('src/game/systems', { recursive: true });

// Input System
const inputContent = `import type { GameEngine } from '../GameEngine';

${extractFunc('handleKeyDown', 'handleKeyUp')}
${extractFunc('handleKeyUp', 'addParticles')}
`;
fs.writeFileSync('src/game/systems/InputSystem.ts', inputContent);

// Effect System
const effectContent = `import type { GameEngine } from '../GameEngine';

${extractFunc('addParticles', 'spawnSkillKillExplosion')}
${extractFunc('spawnSkillKillExplosion', 'addChainsawSparkParticles')}
${extractFunc('addChainsawSparkParticles', 'updateProjectiles')}
${extractFunc('updateProjectiles', 'addGreyWallCollisionParticles')}
${extractFunc('addGreyWallCollisionParticles', 'addPurpleDashParticles')}
${extractFunc('addPurpleDashParticles', 'loop')}
`;
fs.writeFileSync('src/game/systems/EffectSystem.ts', effectContent);

// Event System
const eventContent = `import type { GameEngine } from '../GameEngine';
import { Top, Zombie } from '../types';
import { CANVAS_W, CANVAS_H } from '../constants';
import { getStandbyRadiusForModel, updateTopStandby } from '../topMovement';

${extractFunc('updateCoopState', 'resolveFinalVictory')}
${extractFunc('resolveFinalVictory', 'hitZombie')}
${extractFunc('spawnSiegeWarningZone', 'triggerZombieSiege')}
${extractFunc('triggerZombieSiege', 'updateZombieSiege')}
${extractFunc('updateZombieSiege', 'cancelZombieSiege')}
${extractFunc('cancelZombieSiege', 'getNearestEnemy')}
`;
fs.writeFileSync('src/game/systems/EventSystem.ts', eventContent);


// Collision System
const collisionContent = `import type { GameEngine } from '../GameEngine';
import { Entity, Top, Zombie, Item, Obstacle } from '../types';
import { getStandbyRadiusForModel } from '../topMovement';
import { resolveCollision, resolveCircleBoxCollision, resolveCircleTriangleCollision } from '../physics';
import { CANVAS_W, CANVAS_H, TOP_RADIUS } from '../constants';

${extractFunc('handleCollision', 'updateCoopState')}
${extractFunc('hitZombie', 'getSpikeTriangles')}
${extractFunc('getSpikeTriangles', 'handleWallBounce')}
${extractFunc('handleWallBounce', 'isPointInsideCapsule')}
`;
fs.writeFileSync('src/game/systems/CollisionSystem.ts', collisionContent);


// GameUtils
const utilsContent = `import type { GameEngine } from '../GameEngine';
import { Top, Entity } from '../types';
import { CANVAS_W, CANVAS_H } from '../constants';

${extractFunc('isPointInsideCapsule', 'isClashActive')}
${extractFunc('isClashActive', 'isPlayerFreeOrStandby')}
${extractFunc('isPlayerFreeOrStandby', 'updateTutorialTimestamps')}
${extractFunc('updateTutorialTimestamps', 'getLatestActiveTutorial')}
${extractFunc('getLatestActiveTutorial', 'clampToCapsule')}
${extractFunc('clampToCapsule', 'clampTopWithinArena')}
${extractFunc('clampTopWithinArena', 'findLaunchPadNearestTargetDir')}
${extractFunc('findLaunchPadNearestTargetDir', 'dealLaunchPadSweepDamage')}
${extractFunc('dealLaunchPadSweepDamage', 'getTopScale')}
${extractFunc('getTopScale', 'getRandomCapsuleBoundaryPoint')}
${extractFunc('getRandomCapsuleBoundaryPoint', 'spawnSiegeWarningZone')}
${extractFunc('getNearestEnemy', 'spawnBoss')}
`;
fs.writeFileSync('src/game/systems/GameUtils.ts', utilsContent);


// Spawn System
const spawnContent = `import type { GameEngine } from '../GameEngine';
import { Zombie, Item, Obstacle } from '../types';
import { CANVAS_W, CANVAS_H, MAX_SPIN } from '../constants';

${extractFunc('spawnBoss', 'spawnZombie')}
${extractFunc('spawnZombie', 'spawnItemOrObstacle')}
${extractFunc('spawnItemOrObstacle', 'checkWinCondition')}
`;
fs.writeFileSync('src/game/systems/SpawnSystem.ts', spawnContent);


let engineFinal = content.replace(
    content.substring(content.indexOf('\n    handleKeyDown('), content.indexOf('\n    loop(')),
    '\n'
);
engineFinal = engineFinal.replace(
    content.substring(content.indexOf('\n    handleCollision('), content.indexOf('\n    checkWinCondition(')),
    '\n'
);

let imports = "import * as InputSystem from './systems/InputSystem';\\n" +
"import * as EffectSystem from './systems/EffectSystem';\\n" +
"import * as EventSystem from './systems/EventSystem';\\n" +
"import * as CollisionSystem from './systems/CollisionSystem';\\n" +
"import * as GameUtils from './systems/GameUtils';\\n" +
"import * as SpawnSystem from './systems/SpawnSystem';\\n";

engineFinal = engineFinal.replace("import { CANVAS_W, CANVAS_H", imports + "import { CANVAS_W, CANVAS_H");

engineFinal = engineFinal.replace(/this\.handleKeyDown = this\.handleKeyDown\.bind\(this\);/g, 'this.handleKeyDownBound = (e) => InputSystem.handleKeyDown(this, e);');
engineFinal = engineFinal.replace(/this\.handleKeyUp = this\.handleKeyUp\.bind\(this\);/g, 'this.handleKeyUpBound = (e) => InputSystem.handleKeyUp(this, e);');
engineFinal = engineFinal.replace(/window\.addEventListener\('keydown', this\.handleKeyDown\);/g, "window.addEventListener('keydown', this.handleKeyDownBound as any);");
engineFinal = engineFinal.replace(/window\.addEventListener\('keyup', this\.handleKeyUp\);/g, "window.addEventListener('keyup', this.handleKeyUpBound as any);");
engineFinal = engineFinal.replace(/window\.removeEventListener\('keydown', this\.handleKeyDown\);/g, "window.removeEventListener('keydown', this.handleKeyDownBound as any);");
engineFinal = engineFinal.replace(/window\.removeEventListener\('keyup', this\.handleKeyUp\);/g, "window.removeEventListener('keyup', this.handleKeyUpBound as any);");

let replacements = [
    'addParticles', 'spawnSkillKillExplosion', 'addChainsawSparkParticles', 'updateProjectiles', 
    'addGreyWallCollisionParticles', 'addPurpleDashParticles', 'handleCollision', 'updateCoopState', 
    'resolveFinalVictory', 'hitZombie', 'getSpikeTriangles', 'handleWallBounce', 'spawnSiegeWarningZone', 
    'triggerZombieSiege', 'updateZombieSiege', 'cancelZombieSiege', 'isPointInsideCapsule', 
    'isClashActive', 'isPlayerFreeOrStandby', 'updateTutorialTimestamps', 'getLatestActiveTutorial', 
    'clampToCapsule', 'clampTopWithinArena', 'findLaunchPadNearestTargetDir', 'dealLaunchPadSweepDamage', 
    'getTopScale', 'getRandomCapsuleBoundaryPoint', 'spawnBoss', 'spawnZombie', 'spawnItemOrObstacle', 'getNearestEnemy'
];

for (let func of replacements) {
    let target = '';
    if (['handleKeyDown', 'handleKeyUp'].includes(func)) target = 'InputSystem.' + func + '(this, ';
    if (['addParticles', 'spawnSkillKillExplosion', 'addChainsawSparkParticles', 'updateProjectiles', 'addGreyWallCollisionParticles', 'addPurpleDashParticles'].includes(func)) {
        target = 'EffectSystem.' + func + '(this, ';
    }
    if (['handleCollision', 'hitZombie', 'getSpikeTriangles', 'handleWallBounce'].includes(func)) {
        target = 'CollisionSystem.' + func + '(this, ';
    }
    if (['updateCoopState', 'resolveFinalVictory', 'spawnSiegeWarningZone', 'triggerZombieSiege', 'updateZombieSiege', 'cancelZombieSiege'].includes(func)) {
        target = 'EventSystem.' + func + '(this, ';
    }
    if (['isPointInsideCapsule', 'isClashActive', 'isPlayerFreeOrStandby', 'updateTutorialTimestamps', 'getLatestActiveTutorial', 'clampToCapsule', 'clampTopWithinArena', 'findLaunchPadNearestTargetDir', 'dealLaunchPadSweepDamage', 'getTopScale', 'getRandomCapsuleBoundaryPoint', 'getNearestEnemy'].includes(func)) {
        target = 'GameUtils.' + func + '(this, ';
    }
    if (['spawnBoss', 'spawnZombie', 'spawnItemOrObstacle'].includes(func)) {
        target = 'SpawnSystem.' + func + '(this, ';
    }
    
    engineFinal = engineFinal.split('this.' + func + '(').join(target);
    engineFinal = engineFinal.split('this.' + func + ' (').join(target);
}

// engineFinal = engineFinal.replace(/, \)/g, ')');
engineFinal = engineFinal.replace(/,\s*\)/g, ')');

fs.writeFileSync('src/game/GameEngine2.ts', engineFinal);
console.log('Extraction script executed successfully!');
