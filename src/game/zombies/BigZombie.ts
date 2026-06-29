import * as InputSystem from '../systems/InputSystem';
import * as EffectSystem from '../systems/EffectSystem';
import * as EventSystem from '../systems/EventSystem';
import * as CollisionSystem from '../systems/CollisionSystem';
import * as GameUtils from '../systems/GameUtils';
import * as SpawnSystem from '../systems/SpawnSystem';
import type { GameEngine } from '../GameEngine';
import { Top, Zombie } from '../types';
import { SoundSystem } from '../systems/SoundSystem';
import { updateBasicZombie } from './BasicZombie';

export function updateBigZombie(engine: GameEngine, z: Zombie, dt: number, zombieTargets: Top[]) {
    if (z.type === 'zombie_big') {
        const big = z as any;
        
        if (big.isDying) {
            if (big.bigAttackState !== 'idle' && big.bigAttackState !== undefined) {
                big.bigAttackState = 'idle';
                (engine as any).purpleBrownSkillCooldown = 3.0 + Math.random() * 3.0;
            }
            if (big.deathBeamAngle === undefined) {
                const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
                big.deathBeamAngle = angles[Math.floor(Math.random() * angles.length)];
            }
            big.dyingTimer -= dt;
            big.vx = 0;
            big.vy = 0;
            
            // Spin only during the first 1 second (dyingTimer > 0.25)
            if (big.dyingTimer > 0.25) {
                big.angle += 15 * dt; // spin fast
            }
            
            // Fire laser at exactly 0.25s remaining (only once)
            if (big.dyingTimer <= 0.25 && !big.deathBeamFired) {
                big.deathBeamFired = true;
                const match = big.lastKillerId ? big.lastKillerId.match(/\d+/) : null;
                const idx = match ? parseInt(match[0], 10) : 0;
                
                const vx = Math.round(Math.cos(big.deathBeamAngle));
                const vy = Math.round(Math.sin(big.deathBeamAngle));
                
                engine.projectiles.push({
                    id: `purplebeam_${Date.now()}_${Math.random()}`,
                    x: big.x,
                    y: big.y,
                    vx: vx, // using vx/vy as direction vectors
                    vy: vy,
                    radius: 64, // half width of the beam
                    color: '#ef4444', // Red beam matching the original dash attack
                    ownerId: `top_${idx}`, // the original killer
                    life: 0.25, // match original laser duration
                    maxLife: 0.25,
                    damage: 200, 
                    trail: [{ x: big.x, y: big.y }],
                    isBombBeam: true
                });
                SoundSystem.play('Shot_Beam_08');
                engine.screenShakeTimer = 0.4;
                engine.shockwaves.push({
                    x: big.x, y: big.y, radius: 10, maxRadius: 100,
                    speed: 400, color: '#f97316', thickness: 4,
                    life: 0.25, maxLife: 0.25
                });
            }
            
            if (big.dyingTimer <= 0) {
                big.markForDeletion = true;
                const match = big.lastKillerId ? big.lastKillerId.match(/\d+/) : null;
                const idx = match ? parseInt(match[0], 10) : 0;
                engine.spawnTicket(big.x, big.y, big.type, idx, big.id);
                
                EffectSystem.addParticles(engine, big.x, big.y, '#9333ea', 35, 300, 10);
                EffectSystem.addParticles(engine, big.x, big.y, '#6b21a8', 15, 200, 6);
                
                engine.shockwaves.push({
                    x: big.x, y: big.y, radius: 0, maxRadius: 250,
                    speed: 600, color: '#9333ea', thickness: 12,
                    life: 0.4, maxLife: 0.4
                });
            }
            return;
        }

        if (big.bigAttackState === undefined) big.bigAttackState = 'idle';
        if (big.bigAttackTimer === undefined) big.bigAttackTimer = 0;
        if (big.bigNextAttackTime === undefined) big.bigNextAttackTime = 3.0 + Math.random() * 2;

        if (big.bigAttackState === 'idle') {
            big.bigNextAttackTime -= dt;
            
            let minDist = Infinity;
            let targetTop: Top | null = null;
            zombieTargets.forEach(t => {
                const d = Math.hypot(t.x - big.x, t.y - big.y);
                if (d < minDist) { minDist = d; targetTop = t; }
            });

            if (big.bigNextAttackTime <= 0 && targetTop) {
                const globalCooldownActive = (engine as any).purpleBrownSkillCooldown !== undefined && (engine as any).purpleBrownSkillCooldown > 0;
                const anotherIsAttacking = engine.zombies.some(other => {
                    if (other.id === big.id) return false;
                    const isBigAttacking = (other.type === 'zombie_big' || other.type === 'zombie_bomb') && (other as any).bigAttackState !== undefined && (other as any).bigAttackState !== 'idle';
                    const isBouncingAttacking = other.type === 'zombie_bouncing' && (other as any).bouncingAttackState !== undefined && (other as any).bouncingAttackState !== 'idle';
                    return isBigAttacking || isBouncingAttacking;
                });

                if (!anotherIsAttacking && !globalCooldownActive) {
                    big.bigAttackState = 'warning';
                    big.bigAttackTimer = 1.5;
                    SoundSystem.play('SRW_Lock_01');
                    big.vx = 0;
                    big.vy = 0;

                    const dx = targetTop.x - big.x;
                    const dy = targetTop.y - big.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    big.bigDashDirectionX = dx / dist;
                    big.bigDashDirectionY = dy / dist;
                    big.bigWarningTargetX = targetTop.x;
                    big.bigWarningTargetY = targetTop.y;
                } else {
                    // Delay the check slightly and run normal basic behavior
                    big.bigNextAttackTime = 0.5 + Math.random() * 0.5;
                    updateBasicZombie(engine, z, dt, zombieTargets);
                }
            } else {
                updateBasicZombie(engine, z, dt, zombieTargets);
            }
        } else if (big.bigAttackState === 'warning') {
            big.bigAttackTimer -= dt;
            big.vx = 0;
            big.vy = 0;

            if (Math.random() < 0.2) {
                const ang = Math.random() * Math.PI * 2;
                engine.particles.push({
                    x: big.x + Math.cos(ang) * big.radius * (0.5 + Math.random() * 0.5),
                    y: big.y + Math.sin(ang) * big.radius * (0.5 + Math.random() * 0.5),
                    vx: -Math.cos(ang) * 100,
                    vy: -Math.sin(ang) * 100,
                    life: 0.4,
                    maxLife: 0.4,
                    color: '#9333ea',
                    size: Math.random() * 4 + 2
                });
            }

            if (big.bigAttackTimer <= 0) {
                big.bigAttackState = 'dash';
                big.bigAttackTimer = 0.25;
                SoundSystem.play('Shot_Beam_08');
                engine.screenShakeTimer = 0.4;
            }
        } else if (big.bigAttackState === 'dash') {
            big.bigAttackTimer -= dt;
            big.vx = 0;
            big.vy = 0;

            if (big.bigAttackTimer <= 0) {
                big.bigAttackState = 'idle';
                big.bigNextAttackTime = 4.0 + Math.random() * 3;
                // Set global cooldown for purple/brown zombie skill attacks
                (engine as any).purpleBrownSkillCooldown = 3.0 + Math.random() * 3.0;
            }
        }

        z.x += z.vx * dt;
        z.y += z.vy * dt;
        CollisionSystem.handleWallBounce(engine, z);
    }
}
