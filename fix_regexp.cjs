const fs = require('fs');
let engineFinal = fs.readFileSync('src/game/GameEngine2.ts', 'utf8');

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
    
    let reMatchCall = new RegExp('this\\\\.' + func + '\\\\s*\\\\(', 'g');
    engineFinal = engineFinal.replace(reMatchCall, target.replace(/, $/, '') + (target.endsWith(', ') ? '' : ', '));
}

engineFinal = engineFinal.replace(/, \\)/g, ')');
fs.writeFileSync('src/game/GameEngine2.ts', engineFinal);
