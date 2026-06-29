const fs = require('fs');
let systems = [
    'src/game/topMovement.ts',
    'src/game/zombieBehavior.ts',
    'src/game/zombies/BigZombie.ts',
    'src/game/zombies/BossZombie.ts',
    'src/game/zombies/SmallZombie.ts',
    'src/game/skills.ts',
    'src/game/systems/EventSystem.ts',
    'src/game/systems/InputSystem.ts',
    'src/game/systems/CollisionSystem.ts',
    'src/game/systems/GameUtils.ts'
];

let replacements = [
    'addParticles', 'spawnSkillKillExplosion', 'addChainsawSparkParticles', 'updateProjectiles', 
    'addGreyWallCollisionParticles', 'addPurpleDashParticles', 'handleCollision', 'updateCoopState', 
    'resolveFinalVictory', 'hitZombie', 'getSpikeTriangles', 'handleWallBounce', 'spawnSiegeWarningZone', 
    'triggerZombieSiege', 'updateZombieSiege', 'cancelZombieSiege', 'isPointInsideCapsule', 
    'isClashActive', 'isPlayerFreeOrStandby', 'updateTutorialTimestamps', 'getLatestActiveTutorial', 
    'clampToCapsule', 'clampTopWithinArena', 'findLaunchPadNearestTargetDir', 'dealLaunchPadSweepDamage', 
    'getTopScale', 'getRandomCapsuleBoundaryPoint', 'spawnBoss', 'spawnZombie', 'spawnItemOrObstacle', 'getNearestEnemy'
];

for (let file of systems) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    // Add imports into game logic files
    if (!file.includes('systems/')) {
        let imports = "import * as InputSystem from './systems/InputSystem';\n" +
        "import * as EffectSystem from './systems/EffectSystem';\n" +
        "import * as EventSystem from './systems/EventSystem';\n" +
        "import * as CollisionSystem from './systems/CollisionSystem';\n" +
        "import * as GameUtils from './systems/GameUtils';\n" +
        "import * as SpawnSystem from './systems/SpawnSystem';\n";
        content = imports + content;
    }
    
    // Also include TOP_RADIUS and MAX_SPIN imports where needed manually because it's easier to just replace missing stuff
    if (file.includes('CollisionSystem.ts')) {
        content = content.replace("TOP_RADIUS } from '../constants';", "TOP_RADIUS, MAX_SPIN } from '../constants';");
    }
    if (file.includes('EventSystem.ts')) {
        content = content.replace("CANVAS_H } from '../constants';", "CANVAS_H, MAX_SPIN } from '../constants';");
    }
    if (file.includes('InputSystem.ts')) {
        content = content.replace("import type { GameEngine", "import { triggerTopSkill } from '../skills';\nimport { getStandbyRadiusForModel } from '../topMovement';\nimport { MAX_SPIN } from '../constants';\nimport type { GameEngine");
    }
    if (file.includes('GameUtils.ts')) {
        content = content.replace("CANVAS_H } from '../constants';", "CANVAS_H, TOP_RADIUS } from '../constants';");
    }

    // Now string replacements
    for (let func of replacements) {
        let target = '';
        if (['handleKeyDown', 'handleKeyUp'].includes(func)) target = 'InputSystem.' + func + '(engine, ';
        if (['addParticles', 'spawnSkillKillExplosion', 'addChainsawSparkParticles', 'updateProjectiles', 'addGreyWallCollisionParticles', 'addPurpleDashParticles'].includes(func)) {
            target = 'EffectSystem.' + func + '(engine, ';
        }
        if (['handleCollision', 'hitZombie', 'getSpikeTriangles', 'handleWallBounce'].includes(func)) {
            target = 'CollisionSystem.' + func + '(engine, ';
        }
        if (['updateCoopState', 'resolveFinalVictory', 'spawnSiegeWarningZone', 'triggerZombieSiege', 'updateZombieSiege', 'cancelZombieSiege'].includes(func)) {
            target = 'EventSystem.' + func + '(engine, ';
        }
        if (['isPointInsideCapsule', 'isClashActive', 'isPlayerFreeOrStandby', 'updateTutorialTimestamps', 'getLatestActiveTutorial', 'clampToCapsule', 'clampTopWithinArena', 'findLaunchPadNearestTargetDir', 'dealLaunchPadSweepDamage', 'getTopScale', 'getRandomCapsuleBoundaryPoint', 'getNearestEnemy'].includes(func)) {
            target = 'GameUtils.' + func + '(engine, ';
        }
        if (['spawnBoss', 'spawnZombie', 'spawnItemOrObstacle'].includes(func)) {
            target = 'SpawnSystem.' + func + '(engine, ';
        }
        
        let targetGameEngine = target.replace('(engine, ', '(this, ');
        
        content = content.split('engine.' + func + '(').join(target);
        content = content.split('engine.' + func + ' (').join(target);
        
        // Sometimes inside skills or zombie it's `engine.something()` ? Wait, `this`?
        content = content.split('this.' + func + '(').join(targetGameEngine);
        content = content.split('this.' + func + ' (').join(targetGameEngine);
    }
    
    // There was Duplicate Identifier engine in SpawnSystem.ts.
    if (file.includes('SpawnSystem.ts')) {
        content = content.replace(/export function (\w+)\(engine: GameEngine, engine: GameEngine\)/g, 'export function $1(engine: GameEngine)');
        content = content.split('engine: GameEngine, engine: GameEngine').join('engine: GameEngine');
    }
    
    // Empty commas
    content = content.replace(/,\s*\)/g, ')');
    content = content.replace(/,\)/g, ')');
    fs.writeFileSync(file, content);
}
console.log('Fixed extra files');
