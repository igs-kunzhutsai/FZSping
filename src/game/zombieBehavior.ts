import * as InputSystem from './systems/InputSystem';
import * as EffectSystem from './systems/EffectSystem';
import * as EventSystem from './systems/EventSystem';
import * as CollisionSystem from './systems/CollisionSystem';
import * as GameUtils from './systems/GameUtils';
import * as SpawnSystem from './systems/SpawnSystem';
import { SoundSystem } from './systems/SoundSystem';
import { updateBossZombie } from './zombies/BossZombie';
import { updateBigZombie } from './zombies/BigZombie';
import { updateBasicZombie } from './zombies/BasicZombie';
import { updateBombZombie } from './zombies/BombZombie';
import { updateBouncingZombie } from './zombies/BouncingZombie';
import type { GameEngine } from './GameEngine';
import { Top, Zombie, Obstacle } from './types';
import { resolveCollision, checkCollision, resolveCircleBoxCollision, resolveCircleTriangleCollision, checkCircleBoxCollision } from './physics';
import { CANVAS_W, CANVAS_H } from './constants';
import { getStandbyRadiusForModel } from './topMovement';

export function updateZombies(this: GameEngine, dt: number, zombieTargets: Top[]) {
        if ((this as any).purpleBrownSkillCooldown === undefined) {
            (this as any).purpleBrownSkillCooldown = 0;
        }
        if ((this as any).purpleBrownSkillCooldown > 0) {
            (this as any).purpleBrownSkillCooldown -= dt;
        }

        this.zombies.forEach(z => {
            if (z.hitCooldown !== undefined && z.hitCooldown > 0) {
                z.hitCooldown -= dt;
            }

            if (z.type === 'zombie_boss' && (z as any).introZ !== undefined && (z as any).introZ > 0) {
                const oldZ = (z as any).introZ;
                let nextZ = oldZ;
                if (!this.introActive) {
                    nextZ = Math.max(0, oldZ - dt * 750);
                    (z as any).introZ = nextZ;
                }
                if (oldZ > 0 && nextZ === 0) {
                    this.shockwaves.push({
                        x: z.x,
                        y: z.y,
                        radius: 10,
                        maxRadius: 480,
                        speed: 850,
                        color: 'rgba(239, 68, 68, 0.95)',
                        thickness: 20,
                        life: 0.7,
                        maxLife: 0.7
                    });

                    EffectSystem.addParticles(this, z.x, z.y, '#ea580c', 80, 500, 16);
                    EffectSystem.addParticles(this, z.x, z.y, '#dc2626', 45, 350, 10);
                    EffectSystem.addParticles(this, z.x, z.y, '#eab308', 30, 250, 7);
                    EffectSystem.addGreyWallCollisionParticles(this, z.x, z.y, 40, 15);
                    this.screenShakeTimer = 1.5;
                    this.screenShakeIntensity = 18;
                }
            }

            if (z.introState === 'walking_in') {
                const dx = z.introWalkTargetX! - z.x;
                const dy = z.introWalkTargetY! - z.y;
                const dist = Math.hypot(dx, dy);
                const walkSpeed = ((z.type === 'zombie_small' ? 80 : 50) * (z.speedMultiplier || 1)) * 2;
                
                if (dist <= walkSpeed * dt) {
                    z.x = z.introWalkTargetX!;
                    z.y = z.introWalkTargetY!;
                    z.introState = 'jumping';
                    z.introTimer = 0;
                    
                    const jdx = z.introJumpTargetX! - z.x;
                    const jdy = z.introJumpTargetY! - z.y;
                    const jumpDist = Math.hypot(jdx, jdy);
                    const jumpDuration = jumpDist / 350; // Jump speed
                    (z as any).introJumpDuration = jumpDuration;
                    (z as any).jumpStartX = z.x;
                    (z as any).jumpStartY = z.y;
                } else {
                    z.vx = (dx / dist) * walkSpeed;
                    z.vy = (dy / dist) * walkSpeed;
                    z.x += (dx / dist) * walkSpeed * dt;
                    z.y += (dy / dist) * walkSpeed * dt;
                    z.angle = Math.atan2(dy, dx) + Math.PI / 2;
                }
                return;
            } else if (z.introState === 'jumping') {
                z.introTimer! += dt;
                const duration = (z as any).introJumpDuration || 0.5;
                const progress = Math.min(1, z.introTimer! / duration);
                
                const startX = (z as any).jumpStartX;
                const startY = (z as any).jumpStartY;
                z.x = startX + (z.introJumpTargetX! - startX) * progress;
                z.y = startY + (z.introJumpTargetY! - startY) * progress;
                
                const maxZ = 120;
                z.introZ = 4 * maxZ * progress * (1 - progress);
                z.angle += 10 * dt; 
                
                if (progress >= 1) {
                    z.introState = 'done';
                    z.introZ = 0;
                    
                    this.shockwaves.push({
                        x: z.x,
                        y: z.y,
                        radius: 5,
                        maxRadius: 100,
                        speed: 400,
                        color: 'rgba(100, 100, 100, 0.5)',
                        thickness: 10,
                        life: 0.3,
                        maxLife: 0.3
                    });
                    
                    EffectSystem.addGreyWallCollisionParticles(this, z.x, z.y, 8, 5);
                }
                return;
            }
            if (z.flashTimer !== undefined && z.flashTimer > 0) {
                z.flashTimer = Math.max(0, z.flashTimer - dt);
            }

            // Update Boss dying sequence
            if (z.type === 'zombie_boss' && (z as any).isDying) {
                z.vx = 0;
                z.vy = 0;
                (z as any).bossAttackState = 'idle';
                z.flashTimer = 0.05; // intense violent flashing
                
                (z as any).bossDyingTimer = Math.max(0, ((z as any).bossDyingTimer ?? 3.0) - dt);
                (z as any).bossDyingExplosionTimer = ((z as any).bossDyingExplosionTimer ?? 0) + dt;
                
                if ((z as any).bossDyingExplosionTimer >= 0.12) {
                    (z as any).bossDyingExplosionTimer = 0;
                    
                    const offRange = 85; 
                    const offX = (Math.random() - 0.5) * 2 * offRange;
                    const offY = (Math.random() - 0.5) * 2 * offRange;
                    const bX = z.x + offX;
                    const bY = z.y + offY;
                    
                    EffectSystem.addParticles(this, bX, bY, '#ea580c', 22, 220, 6);
                    EffectSystem.addParticles(this, bX, bY, '#dc2626', 15, 180, 5);
                    EffectSystem.addParticles(this, bX, bY, '#eab308', 12, 140, 4);
                    EffectSystem.addParticles(this, bX, bY, '#ffffff', 8, 280, 3);
                    
                    // Rhythmic, short, subtle screen shake for individual popping explosions
                    this.screenShakeTimer = 0.12;
                    this.screenShakeIntensity = 6;
                    this.screenShakeMaxDuration = 0.12;

                    this.shockwaves.push({
                        x: bX,
                        y: bY,
                        radius: 5,
                        maxRadius: 180 + Math.random() * 120,
                        speed: 550,
                        color: 'rgba(239, 68, 68, 0.85)',
                        thickness: 12,
                        life: 0.35,
                        maxLife: 0.35
                    });
                }
                
                if ((z as any).bossDyingTimer <= 0) {
                    (z as any).isDyingComplete = true;
                    z.markForDeletion = true;
                    this.bossDefeated = true; // Setter will now allow it!
                    this.triggerBossTransition(); // Start explosion phase and transition back to Area 1

                    // A punchy dramatic shake on final blow (1.0s instead of dizzying 3.2s)
                    this.screenShakeTimer = 1.0; 
                    this.screenShakeIntensity = 22;
                    this.screenShakeMaxDuration = 1.0;

                    EffectSystem.addParticles(this, z.x, z.y, '#ea580c', 160, 650, 20);
                    EffectSystem.addParticles(this, z.x, z.y, '#dc2626', 120, 500, 16);
                    EffectSystem.addParticles(this, z.x, z.y, '#eab308', 90, 400, 12);
                    EffectSystem.addParticles(this, z.x, z.y, '#ffffff', 60, 550, 10);
                    
                    this.shockwaves.push({
                        x: z.x,
                        y: z.y,
                        radius: 15,
                        maxRadius: 750,
                        speed: 1100,
                        color: 'rgba(239, 68, 68, 0.95)',
                        thickness: 35,
                        life: 0.85,
                        maxLife: 0.85
                    });
                }
                return;
            }

            // 1. Process death check first
            if (z.hp <= 0 && !z.markForDeletion && !(z as any).isDying) {
                SoundSystem.play('Attack_Slash_020');
                z.markForDeletion = true;
                const isBoss = (z.type as string) === 'zombie_boss';
                const isBig = z.type === 'zombie_big' || z.type === 'zombie_bomb' || z.type === 'zombie_bouncing';
                let mainColor = '#22c55e';
                let secondColor = '#15803d';
                if (isBoss) {
                    mainColor = '#ea580c'; secondColor = '#dc2626';
                } else if (z.type === 'zombie_big') {
                    mainColor = '#9333ea'; secondColor = '#6b21a8';
                } else if (z.type === 'zombie_bomb') {
                    mainColor = '#f97316'; secondColor = '#78350f';
                } else if (z.type === 'zombie_bouncing') {
                    mainColor = '#be185d'; secondColor = '#831843';
                }
                
                if (isBoss) {
                    this.bossDefeated = true;
                    EffectSystem.addParticles(this, z.x, z.y, mainColor, 80, 500, 16);
                    EffectSystem.addParticles(this, z.x, z.y, secondColor, 40, 350, 12);
                    this.screenShakeTimer = 1.6;
                    this.triggerBossTransition(); // Trigger explosion sequence back to map 1
                } else if (isBig) {
                    EffectSystem.addParticles(this, z.x, z.y, mainColor, 35, 300, 10);
                    EffectSystem.addParticles(this, z.x, z.y, secondColor, 15, 200, 6);
                } else {
                    // Small zombie: size halved, spread/speed halved
                    for (let i = 0; i < 35; i++) {
                        const ang = Math.random() * Math.PI * 2;
                        const spd = Math.random() * 150; // halved from 300
                        this.particles.push({
                            x: z.x, y: z.y,
                            vx: Math.cos(ang) * spd,
                            vy: Math.sin(ang) * spd,
                            life: 1.0, maxLife: 0.5 + Math.random(),
                            color: mainColor,
                            size: Math.random() * 5 + 2 // halved size range (average 4.5 vs 9)
                        });
                    }
                    for (let i = 0; i < 15; i++) {
                        const ang = Math.random() * Math.PI * 2;
                        const spd = Math.random() * 100; // halved from 200
                        this.particles.push({
                            x: z.x, y: z.y,
                            vx: Math.cos(ang) * spd,
                            vy: Math.sin(ang) * spd,
                            life: 1.0, maxLife: 0.5 + Math.random(),
                            color: secondColor,
                            size: Math.random() * 3 + 2 // halved size range (average 3.5 vs 7)
                        });
                    }
                }

                this.shockwaves.push({
                    x: z.x,
                    y: z.y,
                    radius: 0,
                    maxRadius: isBoss ? 450 : (isBig ? 250 : 150),
                    speed: isBoss ? 800 : (isBig ? 600 : 500),
                    color: mainColor,
                    thickness: isBoss ? 20 : (isBig ? 12 : 8),
                    life: isBoss ? 0.6 : 0.4,
                    maxLife: isBoss ? 0.6 : 0.4
                });
                return;
            }

            if (z.markForDeletion) return;


            // 2. Process custom boss updates
            if (z.type === 'zombie_boss') { // Handled in BossZombie.ts
                updateBossZombie(this, z, dt, zombieTargets);
                return;
            }
            
            // 3. Process custom Big Zombie updates
            if (z.type === 'zombie_big') { // Handled in BigZombie.ts
                updateBigZombie(this, z, dt, zombieTargets);
                return;
            }

            if (z.type === 'zombie_bomb') { // Handled in BombZombie.ts
                updateBombZombie(this, z, dt, zombieTargets);
                return;
            }
            
            if (z.type === 'zombie_bouncing') { // Handled in BouncingZombie.ts
                updateBouncingZombie(this, z, dt, zombieTargets);
                return;
            }
            
            if ((z as any).isSiegeZombie) {
                return; // Handled entirely inside updateZombieSiege! Do not apply standard movement vector changes.
            }


            // Handled in BasicZombie.ts
            updateBasicZombie(this, z, dt, zombieTargets);
            z.x += z.vx * dt;
            z.y += z.vy * dt;
            CollisionSystem.handleWallBounce(this, z);
        });
}
