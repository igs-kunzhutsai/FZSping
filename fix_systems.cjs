const fs = require('fs');

let replacements = [
    'addParticles', 'spawnSkillKillExplosion', 'addChainsawSparkParticles', 'updateProjectiles', 
    'addGreyWallCollisionParticles', 'addPurpleDashParticles', 'handleCollision', 'updateCoopState', 
    'resolveFinalVictory', 'hitZombie', 'getSpikeTriangles', 'handleWallBounce', 'spawnSiegeWarningZone', 
    'triggerZombieSiege', 'updateZombieSiege', 'cancelZombieSiege', 'isPointInsideCapsule', 
    'isClashActive', 'isPlayerFreeOrStandby', 'updateTutorialTimestamps', 'getLatestActiveTutorial', 
    'clampToCapsule', 'clampTopWithinArena', 'findLaunchPadNearestTargetDir', 'dealLaunchPadSweepDamage', 
    'getTopScale', 'getRandomCapsuleBoundaryPoint', 'spawnBoss', 'spawnZombie', 'spawnItemOrObstacle', 'getNearestEnemy'
];

let systems = ['InputSystem.ts', 'EffectSystem.ts', 'CollisionSystem.ts', 'EventSystem.ts', 'GameUtils.ts', 'SpawnSystem.ts'];

for (let sys of systems) {
    let content = fs.readFileSync('src/game/systems/' + sys, 'utf8');
    
    // Add all imports to every system file just to be safe
    let imports = "import * as InputSystem from './InputSystem';\n" +
    "import * as EffectSystem from './EffectSystem';\n" +
    "import * as EventSystem from './EventSystem';\n" +
    "import * as CollisionSystem from './CollisionSystem';\n" +
    "import * as GameUtils from './GameUtils';\n" +
    "import * as SpawnSystem from './SpawnSystem';\n";
    content = imports + content;

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
        
        // replace `engine.func(` with `TargetSystem.func(engine, `
        content = content.split('engine.' + func + '(').join(target);
        content = content.split('engine.' + func + ' (').join(target);
    }
    
    content = content.replace(/,\s*\)/g, ')');
    content = content.replace(/,\)/g, ')');
    
    fs.writeFileSync('src/game/systems/' + sys, content);
}
console.log('Fixed systems!');
