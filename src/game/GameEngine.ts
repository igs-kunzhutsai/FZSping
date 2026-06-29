import { updateTopStandby, getStandbyRadiusForModel, getStandbyRadius } from './topMovement';
import { updateZombies } from './zombieBehavior';
import { Top, Zombie, Obstacle, Item, Particle, Entity, ConcreteBlock, Afterimage, PlayerStats, Projectile, PhantomClone } from './types';
import { GameRenderer } from './GameRenderer';
import { resolveCollision, checkCollision, resolveCircleBoxCollision, resolveCircleTriangleCollision, checkCircleBoxCollision } from './physics';
import { createTopSprite, createZombieSprite, createBarrelSprite, createCrateSprite, createZombieBossSprite } from './spriteLoader';
import { SoundSystem } from './systems/SoundSystem';
import { ProbabilityManager, TARGET_TYPE } from './systems/ProbabilityManager';





import * as InputSystem from './systems/InputSystem';
import * as EffectSystem from './systems/EffectSystem';
import * as EventSystem from './systems/EventSystem';
import * as CollisionSystem from './systems/CollisionSystem';
import * as GameUtils from './systems/GameUtils';
import * as SpawnSystem from './systems/SpawnSystem';
import { CANVAS_W, CANVAS_H, MAX_SPIN, TOP_RADIUS } from './constants';
const MAX_HP = 150;

const PLAYER_PROFILES = [
    { color: '#3b82f6', pilot: '#93c5fd', label: 'P1', controls: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', spin: 'KeyQ', skill: 'KeyE' } },
    { color: '#ef4444', pilot: '#fca5a5', label: 'P2', controls: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', spin: 'Enter', skill: 'ControlRight' } },
    { color: '#eab308', pilot: '#fdf08a', label: 'P3', controls: { up: 'KeyK', down: 'KeyI', left: 'KeyL', right: 'KeyJ', spin: 'KeyU', skill: 'KeyO' } },
    { color: '#22c55e', pilot: '#86efac', label: 'P4', controls: { up: 'Numpad5', down: 'Numpad8', left: 'Numpad6', right: 'Numpad4', spin: 'Digit7', skill: 'Numpad9' } }
];

export function checkRayCircleCollision(
    originX: number, originY: number,
    dirX: number, dirY: number,
    circleX: number, circleY: number,
    circleRadius: number,
    laserHalfWidth: number
): boolean {
    const wx = circleX - originX;
    const wy = circleY - originY;
    const projection = wx * dirX + wy * dirY;
    if (projection < 0) {
        // behind origin, check if closer than circleRadius + laserHalfWidth
        const dist = Math.hypot(wx, wy);
        return dist < (circleRadius + laserHalfWidth);
    }
    const closestX = originX + projection * dirX;
    const closestY = originY + projection * dirY;
    const dx = circleX - closestX;
    const dy = circleY - closestY;
    const dist = Math.hypot(dx, dy);
    return dist < (circleRadius + laserHalfWidth);
}

export class GameEngine {
    renderer: GameRenderer;
            
    tops: Top[] = [];
    zombies: Zombie[] = [];
    obstacles: Obstacle[] = [];
    items: Item[] = [];
    particles: Particle[] = [];
    concreteBlocks: ConcreteBlock[] = [];
    afterimages: Afterimage[] = [];
    projectiles: Projectile[] = [];
    phantomClones: PhantomClone[] = [];
    shockwaves: { x: number; y: number; radius: number; maxRadius: number; speed: number; color: string; thickness: number; life: number; maxLife: number; isRainbow?: boolean; isDashedRed?: boolean }[] = [];
    slashLines: { x1: number; y1: number; x2: number; y2: number; life: number; maxLife: number; color: string; width: number }[] = [];
    xSlashes: { x: number; y: number; size: number; maxSize: number; speed: number; angle: number; life: number; maxLife: number; color: string; thickness: number }[] = [];
    
    camera = {
        x: 960,
        y: 540,
        zoom: 1.0
    };
    
        
    keys = new Set<string>();
    showFullDebug = false;
    lastTime = 0;
    rafId = 0;
    timeRemaining = 180; // 3 minutes
    screenShakeTimer = 0;
    hitStopTimer = 0;
    screenShakeIntensity = 0;
    screenShakeMaxDuration = 0.9;
    timeElapsed = 0;
    bossSpawned = false;
    zombieSpawningSuspended = false;
    spawnPausedDueToCap = false;
    bossDefeated = false;
    bossDefeatTimer = 1.8;
    participants: PlayerStats[] = [];
    
    spawnTimer = 0;
    obstacleTimer = 0;
    starSpawnTimer = 0;
    activeLaunchPads: { id: string; x: number; y: number; arrowAngle: number }[] = [];
    launchPadSpawnTimer = 0;
    lastSpawnedLaunchPadId = '';
    
    isGameOver = false;
    pausedDrawTime = 0;
    private _isPaused = false;
    get isPaused(): boolean {
        return this._isPaused;
    }
    set isPaused(val: boolean) {
        if (val) {
            this.keys.clear();
            SoundSystem.setOrbiting(false);
        }
        this._isPaused = val;
    }
    handleKeyDownBound: any;
    handleKeyUpBound: any;
    onGameOver: (winner: string, stats?: PlayerStats[]) => void;
    onMusicChange?: (music: 'area1' | 'area2' | 'boss') => void;
    scores: number[] = [0, 0, 0, 0];
    activeSlots: boolean[] = [false, false, false, false];
    modelTypes: number[] = [1, 1, 1, 1];
    gameMode: 'campaign' | 'versus' = 'campaign';
    energyPerCoin: number = 15;

    introActive = true;
    introStage: 'ready_spin' | 'center_dash' | 'falling' | 'message' | 'none' | 'boss_falling' | 'boss_message' = 'ready_spin';
    introTimer = 1.6;
    messageTimer = 1.4;

    areaCycle = 0;
    areaTransitionState: 'none' | 'exploding' | 'fade_in' = 'none';
    transitionBgChanged = false;
    isTimerLocked = false;
    transitionState: 'none' | 'buffer' = 'none';
    oneMinuteTransitionState: 'none' | 'exploding' | 'waiting_to_move' | 'moving_down' = 'none';
    collectiveKeys = 0;
    areaTransitionTimer = 0;
    areaTransitionOverlayAlpha = 0;
    explosionSpawnTimer = 0;
    activeArenaCenterY = 540;

    versusEndActive = false;
    versusEndTimer = 1.6;

    // Zombie Siege Event Properties
    zombieSiegeActive = false;
    zombieSiegeTimer = 30.0;
    siegeTargetPlayerId: string | null = null;
    siegeZombies: any[] = [];
    siegeTimeRemaining = 0;
    siegeMashCount = 0;
    siegeMashRequired = 6;
    siegeStatus: 'approaching' | 'clinging' | 'resolved_success' | 'resolved_fail' | null = null;
    siegeRadius = 350;
    siegeProgress = 0.0;
    siegeTargetStartX = 0;
    siegeTargetStartY = 0;
    siegeAnimateFlingTimer = 0;
    siegeAnimateThrowIndex = 0;
    siegeWarningZone: {
        x: number;
        y: number;
        radius: number;
        timer: number;
        isForced?: boolean;
        targetPlayerId?: string;
    } | null = null;

    constructor(canvas: HTMLCanvasElement, joinedFlags: boolean[], onGameOver: (winner: string, stats?: PlayerStats[]) => void, modelTypes: number[] = [1, 1, 1, 1], gameMode: 'campaign' | 'versus' = 'campaign', onMusicChange?: (music: 'area1' | 'area2' | 'boss') => void, energyPerCoin: number = 15) {
        this.modelTypes = modelTypes;
        this.gameMode = gameMode;
        this.energyPerCoin = energyPerCoin;
        ProbabilityManager.getInstance().setEnergyPerCoin(this.energyPerCoin);
        this.renderer = new GameRenderer(canvas, this.modelTypes);
        this.onGameOver = onGameOver;
        this.onMusicChange = onMusicChange;

        SoundSystem.init();
        
        ((this as any).handleKeyDownBound) = (e) => InputSystem.handleKeyDown(this, e);
        ((this as any).handleKeyUpBound) = (e) => InputSystem.handleKeyUp(this, e);
        window.addEventListener('keydown', (this as any).handleKeyDownBound as any);
        window.addEventListener('keyup', (this as any).handleKeyUpBound as any);
        
        // Define getter/setter to block early boss defeated state triggers
        let realBossDefeated = false;
        Object.defineProperty(this, 'bossDefeated', {
            get() { return realBossDefeated; },
            set(val) {
                const bossExist = this.zombies ? this.zombies.find(z => z.type === 'zombie_boss') : null;
                if (val === true && bossExist && (bossExist as any).isDying && !(bossExist as any).isDyingComplete) {
                    return; // ignore early victory triggers!
                }
                realBossDefeated = val;
            },
            configurable: true,
            enumerable: true
        });

        this.initGame(joinedFlags);
    }
    
    destroy() {
        window.removeEventListener('keydown', (this as any).handleKeyDownBound as any);
        window.removeEventListener('keyup', (this as any).handleKeyUpBound as any);
        cancelAnimationFrame(this.rafId);
    }

    initGame(joinedFlags: boolean[]) {
        if (this.onMusicChange) {
            this.onMusicChange('area1');
        }
        this.scores = [0, 0, 0, 0];
        this.tops = [];
        this.zombies = [];
        this.obstacles = [];
        this.items = [];
        this.particles = [];
        this.afterimages = [];
        this.projectiles = [];
        this.phantomClones = [];
        this.concreteBlocks = [];
        this.shockwaves = [];
        this.slashLines = [];
        this.xSlashes = [];
        this.bossSpawned = false;
        this.zombieSpawningSuspended = false;
        this.spawnPausedDueToCap = false;
        this.bossDefeated = false;
        this.bossDefeatTimer = 1.8;
        this.versusEndActive = false;
        this.versusEndTimer = 1.6;
        this.participants = [];
        this.obstacleTimer = 0;
        this.starSpawnTimer = 0;
        this.activeLaunchPads = [];
        this.launchPadSpawnTimer = 0;

        this.areaCycle = 0;
        this.areaTransitionState = 'none';
        this.areaTransitionTimer = 0;
        this.areaTransitionOverlayAlpha = 0;
        this.explosionSpawnTimer = 0;
        this.activeArenaCenterY = 540;

        // Reset Zombie Siege Event Properties on startup/reset
        this.zombieSiegeActive = false;
        this.zombieSiegeTimer = 30.0;
        this.siegeTargetPlayerId = null;
        this.siegeZombies = [];
        this.siegeTimeRemaining = 0;
        this.siegeMashCount = 0;
        this.siegeMashRequired = 6;
        this.siegeStatus = null;
        this.siegeRadius = 350;
        this.siegeProgress = 0.0;
        this.siegeTargetStartX = 0;
        this.siegeTargetStartY = 0;
        this.siegeAnimateFlingTimer = 0;
        this.siegeAnimateThrowIndex = 0;
        this.siegeWarningZone = null;
        this.camera = {
            x: 960,
            y: 540,
            zoom: 1.0
        };
        this.timeRemaining = this.gameMode === 'versus' ? 90 : 180;

        
        // Spawn Tops
        const startPos = [
            { x: 360, y: CANVAS_H - 360 }, // P1: bottom-left
            { x: CANVAS_W - 360, y: CANVAS_H - 360 }, // P2: bottom-right
            { x: 360, y: 360 }, // P3: top-left
            { x: CANVAS_W - 360, y: 360 } // P4: top-right
        ];

        const padding = 24;
        const barW = 210;
        const cornerXLeft = padding + barW / 2;
        const cornerXRight = CANVAS_W - padding - barW / 2;
        const cornerYTop = padding + 175;
        const cornerYBottom = CANVAS_H - 130 - 65;

        const cornerPos = [
            { x: cornerXLeft, y: cornerYBottom }, // P1
            { x: cornerXRight, y: cornerYBottom }, // P2
            { x: cornerXLeft, y: cornerYTop }, // P3
            { x: cornerXRight, y: cornerYTop } // P4
        ];

        // 1. Generate 3 rectangular concrete blocks (50% smaller size)
        for (let i = 0; i < 3; i++) {
            const w = (150 + Math.random() * 80) * 0.5;
            const h = (150 + Math.random() * 80) * 0.5;
            let bx = 0;
            let by = 0;
            let attempts = 0;
            while (attempts < 100) {
                bx = 400 + Math.random() * (CANVAS_W - 800);
                by = 250 + Math.random() * (CANVAS_H - 500);

                // Ensure far from spawn corners
                let farFromSpawns = true;
                for (const pos of startPos) {
                    if (Math.hypot(bx - pos.x, by - pos.y) < 350) {
                        farFromSpawns = false;
                        break;
                    }
                }

                // Ensure not overlapping previous blocks
                let farFromOthers = true;
                for (const other of this.concreteBlocks) {
                    const minDistX = (w + other.w) / 2 + 100;
                    const minDistY = (h + other.h) / 2 + 100;
                    if (Math.abs(bx - other.x) < minDistX && Math.abs(by - other.y) < minDistY) {
                        farFromOthers = false;
                        break;
                    }
                }

                // Ensure all 4 corners are inside the horizontal capsule with a safe margin
                let insideCapsule = true;
                const corners = [
                    { x: bx - w/2, y: by - h/2 },
                    { x: bx + w/2, y: by - h/2 },
                    { x: bx - w/2, y: by + h/2 },
                    { x: bx + w/2, y: by + h/2 }
                ];
                for (const pt of corners) {
                    if (!GameUtils.isPointInsideCapsule(this, pt.x, pt.y, 40)) {
                        insideCapsule = false;
                        break;
                    }
                }

                // Ensure far from launch pads as well
                let farFromLaunchPads = true;
                const padsToCheck = [
                    { x: 360, y: 840 },
                    { x: 1560, y: 240 },
                    { x: 960, y: 540 }
                ];
                for (const pad of padsToCheck) {
                    if (Math.hypot(bx - pad.x, by - pad.y) < 220) {
                        farFromLaunchPads = false;
                        break;
                    }
                }

                if (farFromSpawns && farFromOthers && insideCapsule && farFromLaunchPads) {
                    break;
                }
                attempts++;
            }

            this.concreteBlocks.push({
                id: `concrete_${i}`,
                type: 'concrete_block',
                x: bx,
                y: by,
                w,
                h,
                durability: 5,
                markForDeletion: false
            });
        }

        this.introActive = false;
        this.introStage = 'none';
        this.introTimer = 0;
        this.messageTimer = 0;

        let finalFlags = [...joinedFlags];
        const joinedCount = finalFlags.filter(f => f).length;
        if (this.gameMode === 'versus' && joinedCount < 2) {
            // Auto fill all other slots as AI if joined count < 2
            for (let i = 0; i < 4; i++) {
                if (!finalFlags[i]) {
                    finalFlags[i] = true;
                }
            }
        }
        // Do not force player 1 to be active in campaign mode.
        this.activeSlots = finalFlags;

        for (let i = 0; i < 4; i++) {
            if (!this.activeSlots[i]) continue;
            const isAI = !joinedFlags[i];
            
            this.participants.push({
                id: `top_${i}`,
                label: PLAYER_PROFILES[i].label,
                color: PLAYER_PROFILES[i].color,
                score: 0,
                kills: 0,
                isAI,
                isActive: true,
                modelType: this.modelTypes[i] || 1
            });

            this.tops.push({
                id: `top_${i}`,
                type: 'top',
                x: cornerPos[i].x,
                y: cornerPos[i].y,
                vx: 0,
                vy: 0,
                radius: TOP_RADIUS,
                mass: 20,
                markForDeletion: false,
                hp: MAX_HP,
                maxHp: MAX_HP,
                coins: 0,
                spin: 100,
                maxSpin: MAX_SPIN,
                color: PLAYER_PROFILES[i].color,
                pilotColor: PLAYER_PROFILES[i].pilot,
                isAI,
                angle: 0,
                score: 0,
                label: PLAYER_PROFILES[i].label,
                controls: isAI ? undefined : PLAYER_PROFILES[i].controls,
                inputAxes: { x: 0, y: 0 },
                dashCooldown: 0,
                maxDashCooldown: 0.5,
                state: 'standby',
                standbyCenterX: startPos[i].x,
                standbyCenterY: startPos[i].y,
                standbyAngle: i * (Math.PI / 2) + Math.random() * 0.2,
                dashTimer: 0,
                dashDirectionX: 0,
                dashDirectionY: 0,
                introZ: 0,
                introOrbitTime: 0,
                spinTutorialTimer: isAI ? 0 : 3.0,
                spinTutorialSpun: false,
                modelType: this.modelTypes[i] || 1
            });
        }
        
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame((t) => this.loop(t));
    }

    insertCoin(coinSlotIdx: number) {
        let top = this.tops.find(t => t.id === `top_${coinSlotIdx}`);
        let newlyJoined = false;
        
        if (!top) {
            newlyJoined = true;
            // Add player
            const cornerXLeft = 190;
            const cornerXRight = CANVAS_W - 190;
            const cornerYTop = 130 + 65;
            const cornerYBottom = CANVAS_H - 130 - 65;

            const cornerPos = [
                { x: cornerXLeft, y: cornerYBottom }, // P1
                { x: cornerXRight, y: cornerYBottom }, // P2
                { x: cornerXLeft, y: cornerYTop }, // P3
                { x: cornerXRight, y: cornerYTop } // P4
            ];
            const startPos = [
                { x: 300, y: CANVAS_H - 300 }, // P1
                { x: CANVAS_W - 300, y: CANVAS_H - 300 }, // P2
                { x: 300, y: 300 }, // P3
                { x: CANVAS_W - 300, y: 300 } // P4
            ];
            
            top = {
                id: `top_${coinSlotIdx}`,
                type: 'top',
                x: cornerPos[coinSlotIdx].x,
                y: cornerPos[coinSlotIdx].y,
                vx: 0,
                vy: 0,
                radius: TOP_RADIUS,
                mass: 20,
                markForDeletion: false,
                hp: 1, // Start with 1, wait for coin update below
                maxHp: 1,
                coins: 0,
                spin: 100,
                maxSpin: MAX_SPIN,
                color: PLAYER_PROFILES[coinSlotIdx].color,
                pilotColor: PLAYER_PROFILES[coinSlotIdx].pilot,
                isAI: false, // We assume inserted coin means human
                angle: 0,
                score: 0,
                label: PLAYER_PROFILES[coinSlotIdx].label,
                controls: PLAYER_PROFILES[coinSlotIdx].controls,
                inputAxes: { x: 0, y: 0 },
                dashCooldown: 0,
                maxDashCooldown: 0.5,
                state: 'standby',
                standbyCenterX: startPos[coinSlotIdx].x,
                standbyCenterY: startPos[coinSlotIdx].y,
                standbyAngle: coinSlotIdx * (Math.PI / 2),
                dashTimer: 0,
                dashDirectionX: 0,
                dashDirectionY: 0,
                introZ: 0,
                introOrbitTime: 0,
                spinTutorialTimer: 0,
                spinTutorialSpun: false,
                launchPadState: 'prep_spinning',
                launchPadTimer: 1.5,
                launchPadSpinCount: 0,
                modelType: this.modelTypes[coinSlotIdx] || 1
            };
            (top as any).launchPadSource = 'corner';
            this.tops.push(top);
            
            EffectSystem.addParticles(this, cornerPos[coinSlotIdx].x, cornerPos[coinSlotIdx].y, PLAYER_PROFILES[coinSlotIdx].color, 40, 300, 10);

            const p = this.participants.find(p => p.id === `top_${coinSlotIdx}`);
            if (p) {
                p.isActive = true;
                p.isAI = false;
            } else {
                this.participants.push({
                    id: `top_${coinSlotIdx}`,
                    label: PLAYER_PROFILES[coinSlotIdx].label,
                    color: PLAYER_PROFILES[coinSlotIdx].color,
                    score: 0,
                    kills: 0,
                    isAI: false,
                    isActive: true,
                    modelType: this.modelTypes[coinSlotIdx] || 1
                });
            }
            this.activeSlots[coinSlotIdx] = true;
        } else {
            top.isAI = false;
            top.controls = PLAYER_PROFILES[coinSlotIdx].controls;
            const p = this.participants.find(p => p.id === `top_${coinSlotIdx}`);
            if (p) {
                p.isAI = false;
                p.isActive = true;
            }
        }

        if (top) {
            top.coins = (top.coins ?? 0) + 1;
            top.maxHp = top.coins * this.energyPerCoin;
            ProbabilityManager.getInstance().recordCoinIn(coinSlotIdx, 1);
            if (top.hp <= 0 || top.isExploding || newlyJoined || (top as any).isDeadState) {
                // Was dead, now revived / joined
                top.hp = this.energyPerCoin;
                top.isExploding = false;
                (top as any).isDeadState = false;
                top.state = 'standby';
                top.spin = 100;
                top.markForDeletion = false;
                if (newlyJoined) {
                    // If it's first coin joined, trigger corner launch
                    top.launchPadState = 'prep_spinning';
                    top.launchPadTimer = 1.5;
                    top.launchPadSpinCount = 0;
                    (top as any).launchPadSource = 'corner';
                } else {
                    // If it's a revive/continue, restore normal controls immediately without special starting charge or corner launch.
                    top.launchPadState = undefined;
                    top.vx = 0;
                    top.vy = 0;
                    top.superTimer = 1.5; // Brief invulnerability window
                }
            } else {
                top.hp = Math.min(top.maxHp, top.hp + this.energyPerCoin);
            }
            top.visualHp = top.visualHp !== undefined ? Math.max(top.hp, top.visualHp) : top.hp;
        }
    }

    spawnDroppedKey(x: number, y: number) {
        this.items.push({
            id: `key_dropped_${Date.now()}_${Math.random()}`,
            type: 'item_key',
            x,
            y,
            vx: (Math.random() - 0.5) * 150,
            vy: (Math.random() - 0.5) * 150,
            z: 0,
            vz: 350,
            radius: 20,
            mass: 1,
            markForDeletion: false,
            targetPlayerId: 'ui_keys',
            hoverTimer: 2.0 // stays for 2 seconds
        });
    }

    spawnTicket(x: number, y: number, zombieType: string, playerIdx: number, zombieId?: string) {
        let amount = 0;
        const pm = ProbabilityManager.getInstance();
        const cm = pm.getChance();
        if (zombieType === 'zombie_small') {
            let targetType = TARGET_TYPE.CartonBoy;
            if (zombieId) {
                let hash = 0;
                for (let i = 0; i < zombieId.length; i++) {
                    hash = zombieId.charCodeAt(i) + ((hash << 5) - hash);
                }
                const idx = Math.abs(hash) % 4;
                if (idx === 0) targetType = TARGET_TYPE.CartonBoy;
                else if (idx === 1) targetType = TARGET_TYPE.ZombieDog;
                else if (idx === 2) targetType = TARGET_TYPE.ZombieGirl;
                else if (idx === 3) targetType = TARGET_TYPE.ZombieMan;
            }
            amount = cm.ulRopeTickets[targetType] || 5;
        } else if (zombieType === 'zombie_big') {
            amount = cm.ulRopeTickets[TARGET_TYPE.GraveRobber] || 9;
        } else if (zombieType === 'zombie_bomb') {
            amount = cm.ulRopeTickets[TARGET_TYPE.BombMan] || 11;
        } else if (zombieType === 'zombie_bouncing') {
            amount = cm.ulRopeTickets[TARGET_TYPE.FootballPlayer] || 14;
        } else if (zombieType === 'zombie_boss') {
            amount = cm.ulRopeTickets[TARGET_TYPE.Mummy] || 100;
        }

        if (amount > 0) {
            ProbabilityManager.getInstance().recordTicketOut(playerIdx, amount);
            this.items.push({
                id: `ticket_${Date.now()}_${Math.random()}`,
                type: 'item_ticket',
                x,
                y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                z: 0,
                vz: 300,
                radius: 15,
                mass: 1,
                markForDeletion: false,
                amount,
                targetPlayerId: `top_${playerIdx}`,
                hoverTimer: 0.5
            });
        }

        // Every time an enemy is killed, drop a key with a chance calculated to target 5 keys per 170 coins.
        // 170 coins total = 170 * energyPerCoin energy points.
        // With 80% small zombies (2 HP) and 20% big/special zombies (4 HP),
        // the average hits to kill a zombie is: 0.8 * 2 + 0.2 * 4 = 2.4 hits.
        // Therefore, 170 coins of play yields roughly (170 * energyPerCoin) / 2.4 kills.
        // To get exactly 5 keys, the average key drop chance per zombie kill is:
        // 5 / ((170 * energyPerCoin) / 2.4) = 12 / (170 * energyPerCoin)
        const chance = 12 / (170 * this.energyPerCoin);
        if (Math.random() < chance) {
            this.spawnDroppedKey(x, y);
        }
    }

    triggerBossTransition() {
        if (this.areaTransitionState !== 'none') return; // Already transitioning
        this.areaTransitionState = 'exploding';
        this.areaTransitionTimer = 4.0; // 4 seconds of explosion and fade out
        this.explosionSpawnTimer = 0;
        this.activeLaunchPads = []; // clear launch pads
        this.launchPadSpawnTimer = 0;
        
        // Immediately destroy all zombies without dropping items
        this.zombies.forEach(z => {
            EffectSystem.addParticles(this, z.x, z.y, '#ff5511', 15, 200, 6);
        });
        this.zombies = [];
        this.zombieSpawningSuspended = true;
        this.items = []; // Clear keys and items too
        this.obstacles = []; // Clear obstacles
        
        // Immediately switch players and AIs to standby state, stop sliding and drifting!
        this.tops.forEach(top => {
            top.vx = 0;
            top.vy = 0;
            top.standbyCenterVx = 0;
            top.standbyCenterVy = 0;
            top.state = 'standby';
        });
    }

    addScore(topIdx: number, val: number) {
        if (topIdx >= 0 && topIdx < 4) {
            this.scores[topIdx] += val;
            const top = this.tops.find(t => t.id === `top_${topIdx}`);
            if (top) {
                top.score = this.scores[topIdx];
            }
            const part = this.participants.find(p => p.id === `top_${topIdx}`);
            if (part) {
                part.score = this.scores[topIdx];
            }
        }
    }

    forceActivateInactiveSlots() {
        const startPos = [
            { x: 300, y: CANVAS_H - 300 }, // P1
            { x: CANVAS_W - 300, y: CANVAS_H - 300 }, // P2
            { x: 300, y: 300 }, // P3
            { x: CANVAS_W - 300, y: 300 } // P4
        ];
        
        for (let i = 0; i < 4; i++) {
            if (!this.activeSlots[i]) {
                this.activeSlots[i] = true;
                
                this.participants.push({
                    id: `top_${i}`,
                    label: PLAYER_PROFILES[i].label,
                    color: PLAYER_PROFILES[i].color,
                    score: 0,
                    kills: 0,
                    isAI: true,
                    isActive: true,
                    modelType: this.modelTypes[i] || 1
                });

                 this.tops.push({
                    id: `top_${i}`,
                    type: 'top',
                    x: startPos[i].x,
                    y: startPos[i].y,
                    vx: 0,
                    vy: 0,
                    radius: TOP_RADIUS,
                    mass: 20,
                    markForDeletion: false,
                    hp: MAX_HP,
                    maxHp: MAX_HP,
                    coins: MAX_HP,
                    spin: 100,
                    maxSpin: MAX_SPIN,
                    color: PLAYER_PROFILES[i].color,
                    pilotColor: PLAYER_PROFILES[i].pilot,
                    isAI: true,
                    angle: 0,
                    score: 0,
                    label: PLAYER_PROFILES[i].label,
                    controls: undefined,
                    inputAxes: { x: 0, y: 0 },
                    dashCooldown: 0,
                    maxDashCooldown: 0.5,
                    state: 'standby',
                    standbyCenterX: startPos[i].x,
                    standbyCenterY: startPos[i].y,
                    standbyAngle: i * (Math.PI / 2) + Math.random() * 0.2,
                    dashTimer: 0,
                    dashDirectionX: 0,
                    dashDirectionY: 0,
                    modelType: this.modelTypes[i] || 1
                });

                EffectSystem.addParticles(this, startPos[i].x, startPos[i].y, PLAYER_PROFILES[i].color, 40, 300, 10);
                this.shockwaves.push({
                    x: startPos[i].x,
                    y: startPos[i].y,
                    radius: 10,
                    maxRadius: 150,
                    speed: 400,
                    color: PLAYER_PROFILES[i].color,
                    thickness: 6,
                    life: 0.4,
                    maxLife: 0.4
                });
            }
        }
    }
    
    // activateHumanPlayerMidGame logic removed.
    

    loop(time: number) {
        let dt = (time - this.lastTime) / 1000;
        this.lastTime = time;
        if (dt > 0.1) dt = 0.1; // clamp lag
        
        if (!this.isGameOver && !this.isPaused) {
            this.update(dt);
        }
        this.renderer.render(this);
        
        if (!this.isGameOver) {
            this.rafId = requestAnimationFrame((t) => this.loop(t));
        }
    }
    
    update(dt: number) {
        // Update spin tutorial timers for player tops
        this.tops.forEach(top => {
            if (top.spinTutorialTimer !== undefined && top.spinTutorialTimer > 0) {
                top.spinTutorialTimer = Math.max(0, top.spinTutorialTimer - dt);
            }
        });

        if (this.hitStopTimer > 0) {
            this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);

            if (this.screenShakeTimer > 0) {
                this.screenShakeTimer = Math.max(0, this.screenShakeTimer - dt);
                if (this.screenShakeTimer <= 0) {
                    this.screenShakeIntensity = 0;
                    this.screenShakeMaxDuration = 0.9;
                }
            }

            this.afterimages.forEach(img => {
                img.life -= dt;
            });
            this.afterimages = this.afterimages.filter(img => img.life > 0);

            this.slashLines.forEach(line => {
                line.life -= dt;
            });
            this.slashLines = this.slashLines.filter(line => line.life > 0);

            this.xSlashes.forEach(slash => {
                slash.life -= dt;
                slash.size = Math.min(slash.maxSize, slash.size + slash.speed * dt);
            });
            this.xSlashes = this.xSlashes.filter(slash => slash.life > 0);

            this.particles.forEach(p => {
                if (p.isSpark) {
                    p.vx *= Math.exp(-2.5 * dt);
                    p.vy *= Math.exp(-2.5 * dt);
                    p.size = Math.max(0.2, p.size - dt * 3.5);
                }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
            });
            this.particles = this.particles.filter(p => p.life > 0);

            this.shockwaves.forEach(sw => {
                sw.radius += sw.speed * dt;
                sw.life -= dt;
            });
            this.shockwaves = this.shockwaves.filter(sw => sw.life > 0);

            return;
        }

        // --- Area Transition State Machine ---
        if (this.gameMode === 'campaign') {
            const nextTargetTime = (this.areaCycle + 1) * 120;
            if (this.timeElapsed >= nextTargetTime && this.areaTransitionState === 'none') {
                this.areaTransitionState = 'exploding';
                this.areaTransitionTimer = 4.0; // 4 seconds of explosion and fade out
                this.explosionSpawnTimer = 0;
                this.activeLaunchPads = []; // clear launch pads
                this.launchPadSpawnTimer = 0;
                
                // Immediately destroy all zombies without dropping items
                this.zombies.forEach(z => {
                    EffectSystem.addParticles(this, z.x, z.y, '#ff5511', 15, 200, 6);
                });
                this.zombies = [];
                this.zombieSpawningSuspended = true;
                
                // Immediately switch players and AIs to standby state, stop sliding and drifting!
                this.tops.forEach(top => {
                    top.vx = 0;
                    top.vy = 0;
                    top.standbyCenterVx = 0;
                    top.standbyCenterVy = 0;
                    top.state = 'standby';
                });
            }

            if (this.areaTransitionState !== 'none') {
                this.areaTransitionTimer -= dt;

                if (this.areaTransitionState === 'exploding') {
                    // Determine overlay white alpha: fade out to white over the 4 seconds buffer
                    this.areaTransitionOverlayAlpha = Math.min(1.0, (4.0 - this.areaTransitionTimer) / 4.0);

                    // Continuous random explosions/shockwaves on the stage field
                    this.explosionSpawnTimer -= dt;
                    if (this.explosionSpawnTimer <= 0) {
                        this.explosionSpawnTimer = 0.15; // random explosion every 0.15 seconds
                        SoundSystem.play('SE-Explo1');
                        const cy = this.activeArenaCenterY ?? 540;
                        const ex = 100 + Math.random() * (CANVAS_W - 200);
                        const ey = cy - 440 + Math.random() * 880;
                        
                        EffectSystem.addParticles(this, ex, ey, '#ff5511', 25, 260, 9);
                        EffectSystem.addParticles(this, ex, ey, '#ffdd33', 15, 200, 6);
                        this.shockwaves.push({
                            x: ex,
                            y: ey,
                            radius: 10,
                            maxRadius: 180 + Math.random() * 120,
                            speed: 500,
                            color: 'rgba(255, 110, 40, 0.85)',
                            thickness: 6,
                            life: 0.45,
                            maxLife: 0.45
                        });
                    }

                    if (this.areaTransitionTimer <= 0) {
                        if (this.bossDefeated) {
                            // Returning from Boss fight back to Area 1
                            this.areaCycle = 0;
                            this.bossDefeated = false;
                            this.bossSpawned = false;
                            this.transitionBgChanged = false;
                            this.collectiveKeys = 0;
                            this.timeElapsed = 0; // Restart minion phases from time 0
                            if (this.onMusicChange) {
                                this.onMusicChange('area1');
                            }
                        } else {
                            this.areaCycle++;
                            if (this.onMusicChange) {
                                this.onMusicChange(this.areaCycle % 2 === 0 ? 'area1' : 'area2');
                            }
                        }
                        
                        // Toggle between North (540) and South (1620)
                        const newCenterY = this.areaCycle % 2 === 0 ? 540 : 1620;
                        const deltaY = newCenterY - this.activeArenaCenterY;
                        this.activeArenaCenterY = newCenterY;

                        // Move items/particles/blocks
                        this.obstacles.forEach(o => o.y += deltaY);
                        this.items.forEach(item => item.y += deltaY);
                        this.concreteBlocks.forEach(block => block.y += deltaY);
                        this.particles.forEach(p => p.y += deltaY);
                        this.shockwaves.forEach(s => s.y += deltaY);
                        this.slashLines.forEach(l => { l.y1 += deltaY; l.y2 += deltaY; });
                        this.xSlashes.forEach(s => s.y += deltaY);

                        // Snap camera instantly to prevent visible panning
                        this.camera.y = newCenterY;

                        const cy = this.activeArenaCenterY;
                        const cornerXLeft = 190;
                        const cornerXRight = CANVAS_W - 190;
                        const cornerYTop = cy - 345;
                        const cornerYBottom = cy + 345;
                        const cornerPos = [
                            { x: cornerXLeft, y: cornerYBottom },
                            { x: cornerXRight, y: cornerYBottom },
                            { x: cornerXLeft, y: cornerYTop },
                            { x: cornerXRight, y: cornerYTop }
                        ];

                        // Reposition tops to corners and set to launchPadState
                        this.tops.forEach(top => {
                            if (top.hp > 0 && !top.isExploding && !top.markForDeletion) {
                                const matchIdx = top.id.match(/\d+/);
                                const pIdx = matchIdx ? parseInt(matchIdx[0], 10) : 0;
                                
                                top.x = cornerPos[pIdx].x;
                                top.y = cornerPos[pIdx].y;
                                top.vx = 0;
                                top.vy = 0;
                                top.launchPadState = 'prep_spinning';
                                top.launchPadTimer = 1.5;
                                top.launchPadSpinCount = 0;
                                (top as any).launchPadSource = 'corner';
                                (top as any).launchPadStartYCenter = cy;
                                top.state = 'standby';
                                
                                EffectSystem.addParticles(this, top.x, top.y, top.color, 40, 300, 10);
                            }
                        });

                        this.areaTransitionState = 'fade_in';
                        this.areaTransitionTimer = 1.0; // 1 second fade in
                        if (this.collectiveKeys >= 5) {
                            this.transitionBgChanged = true; // Switch to desert
                        }
                    }
                } else if (this.areaTransitionState === 'fade_in') {
                    this.areaTransitionOverlayAlpha = Math.max(0.0, this.areaTransitionTimer / 1.0);

                    if (this.areaTransitionTimer <= 0) {
                        this.areaTransitionState = 'none';
                        this.areaTransitionOverlayAlpha = 0;
                        
                        if (this.transitionBgChanged && !this.bossSpawned && this.collectiveKeys >= 5) {
                            this.zombieSpawningSuspended = true;
                            import('./systems/SpawnSystem').then(m => m.spawnBoss(this));
                        } else {
                            this.zombieSpawningSuspended = false;
                        }
                        this.spawnTimer = 0;
                    }
                }

                if (this.areaTransitionState === 'exploding') {
                    this.afterimages = []; // Clear trails
                    this.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
                    this.particles = this.particles.filter(p => p.life > 0);
                    this.shockwaves.forEach(sw => { sw.radius += sw.speed * dt; sw.life -= dt; });
                    this.shockwaves = this.shockwaves.filter(sw => sw.life > 0);

                    this.tops.forEach(top => {
                        top.vx = 0;
                        top.vy = 0;
                        top.standbyCenterVx = 0;
                        top.standbyCenterVy = 0;
                        top.state = 'standby';
                        updateTopStandby(top, this, dt);
                    });
                    
                    return; // PAUSE GAME LOGIC DURING EXPLODING
                }
            }
        }

        if (this.screenShakeTimer > 0) {
            this.screenShakeTimer = Math.max(0, this.screenShakeTimer - dt);
            if (this.screenShakeTimer <= 0) {
                this.screenShakeIntensity = 0;
                this.screenShakeMaxDuration = 0.9;
            }
        }

        if (this.introActive) {
            this.afterimages.forEach(img => {
                img.life -= dt;
            });
            this.afterimages = this.afterimages.filter(img => img.life > 0);

            this.particles.forEach(p => {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
            });
            this.particles = this.particles.filter(p => p.life > 0);

            this.shockwaves.forEach(sw => {
                sw.radius += sw.speed * dt;
                sw.life -= dt;
            });
            this.shockwaves = this.shockwaves.filter(sw => sw.life > 0);

            this.tops.forEach(top => {
                const spinPct = top.spin / MAX_SPIN;
                const visualSpinFactor = top.spin > 0 ? (0.175 + 0.825 * spinPct) : 0;
                top.angle += visualSpinFactor * Math.PI * 18 * dt * 0.7;
            });

            if (this.introStage === 'ready_spin') {
                this.introTimer = Math.max(0, this.introTimer - dt);

                // Tops spin in place next to UI while waiting
                this.tops.forEach(top => {
                    if (top.isAI) {
                        const time = Date.now() / 1000;
                        if (!(top as any).introNextAiSpinTime) {
                            (top as any).introNextAiSpinTime = time + 0.15 + Math.random() * 0.15;
                        }
                        if (time >= (top as any).introNextAiSpinTime) {
                            (top as any).introSpinCount = ((top as any).introSpinCount || 0) + 1;
                            top.spin = Math.min(MAX_SPIN, (top.spin || 0) + 100);
                            (top as any).introShake = 8;
                            (top as any).introNextAiSpinTime = time + 0.15 + Math.random() * 0.15;
                        }
                    }

                    if ((top as any).introShake && (top as any).introShake > 0) {
                        (top as any).introShake -= dt * 25; // rapidly decay shake
                        if ((top as any).introShake < 0) (top as any).introShake = 0;
                    }
                });

                if (this.introTimer <= 0) {
                    this.introStage = 'center_dash';
                    this.introTimer = 0.5; // dash to center takes 0.5 sec
                    // Clear shake
                    const padding = 24;
                    const barW = 210;
                    const cornerXLeft = padding + barW / 2;
                    const cornerXRight = CANVAS_W - padding - barW / 2;
                    const cornerYTop = padding + 175;
                    const cornerYBottom = CANVAS_H - 130 - 65;

                    const localCornerPos = [
                        { x: cornerXLeft, y: cornerYBottom }, // P1
                        { x: cornerXRight, y: cornerYBottom }, // P2
                        { x: cornerXLeft, y: cornerYTop }, // P3
                        { x: cornerXRight, y: cornerYTop } // P4
                    ];

                    this.tops.forEach((top) => {
                        const originalIndex = parseInt(top.id.split('_')[1], 10);
                        const startPos = localCornerPos[originalIndex] || localCornerPos[0];
                        (top as any).introShake = 0;
                        
                        // Strong Launch Effect
                        this.shockwaves.push({
                            x: startPos.x,
                            y: startPos.y,
                            radius: 10,
                            maxRadius: 300,
                            speed: 800,
                            thickness: 20,
                            life: 0.8,
                            maxLife: 0.8,
                            color: top.color || '#ffffff'
                        });

                        for (let k = 0; k < 40; k++) {
                            const angle = Math.random() * Math.PI * 2;
                            const speed = 300 + Math.random() * 500;
                            this.particles.push({
                                x: startPos.x,
                                y: startPos.y,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed,
                                life: 0.4 + Math.random() * 0.4,
                                maxLife: 1.0,
                                color: k % 2 === 0 ? '#ffffff' : (top.color || '#ffaa00'),
                                size: 4 + Math.random() * 6
                            });
                        }
                    });
                }
            } else if (this.introStage === 'center_dash') {
                this.introTimer = Math.max(0, this.introTimer - dt);
                
                // Dash animation from corner pos to standbyCenter pos
                const t = 1.0 - (this.introTimer / 0.5);
                const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                
                const padding = 24;
                const barW = 210;
                const cornerXLeft = padding + barW / 2;
                const cornerXRight = CANVAS_W - padding - barW / 2;
                const cornerYTop = padding + 175;
                const cornerYBottom = CANVAS_H - 130 - 65;

                const cornerPos = [
                    { x: cornerXLeft, y: cornerYBottom }, // P1
                    { x: cornerXRight, y: cornerYBottom }, // P2
                    { x: cornerXLeft, y: cornerYTop }, // P3
                    { x: cornerXRight, y: cornerYTop } // P4
                ];
                
                this.tops.forEach((top) => {
                    const originalIndex = parseInt(top.id.split('_')[1], 10);
                    const startPos = cornerPos[originalIndex] || cornerPos[0];
                    const targetPos = { x: top.standbyCenterX!, y: top.standbyCenterY! };
                    
                    top.x = startPos.x + (targetPos.x - startPos.x) * ease;
                    top.y = startPos.y + (targetPos.y - startPos.y) * ease;
                    
                    // Parabolic arc for visually jumping into the arena
                    top.introZ = Math.sin(t * Math.PI) * 450; // Jump up to 450px high

                    // Add some trail particles
                    if (Math.random() < 0.6) {
                        this.particles.push({
                            x: top.x + (Math.random() - 0.5) * 10,
                            y: top.y + (Math.random() - 0.5) * 10,
                            vx: 0,
                            vy: 0,
                            life: 0.3,
                            maxLife: 0.3,
                            color: top.color,
                            size: 4 + Math.random() * 3
                        });
                    }
                });

                if (this.introTimer <= 0) {
                    this.introStage = 'message';
                    this.messageTimer = 2.4;
                    this.screenShakeTimer = 1.2;
                    SoundSystem.play('jump');

                    this.tops.forEach(top => {
                        top.introZ = 0;
                        this.shockwaves.push({
                            x: top.x,
                            y: top.y,
                            radius: 10,
                            maxRadius: 280,
                            speed: 600,
                            color: top.color,
                            thickness: 8,
                            life: 0.5,
                            maxLife: 0.5
                        });

                        EffectSystem.addParticles(this, top.x, top.y, top.color, 45, 280, 10);
                        EffectSystem.addGreyWallCollisionParticles(this, top.x, top.y, 15, 8);
                    });
                }
            } else if (this.introStage === 'message') {
                this.messageTimer = Math.max(0, this.messageTimer - dt);
                
                const elapsed = 2.4 - this.messageTimer;
                if (elapsed < 1.0) {
                    this.tops.forEach(top => {
                        top.x = top.standbyCenterX!;
                        top.y = top.standbyCenterY!;
                        top.vx = 0;
                        top.vy = 0;
                        top.introOrbitTime = 0;
                    });
                } else {
                    this.tops.forEach(top => {
                        updateTopStandby(top, this,  dt);
                    });
                }

                if (this.messageTimer <= 0) {
                    this.introActive = false;
                    this.introStage = 'none';
                    if (this.transitionBgChanged) {
                        this.zombieSpawningSuspended = false;
                        this.timeElapsed = 0; // reset combat timer for stage 2
                    }
                }
            } else if (this.introStage === 'boss_falling') {
                this.introTimer = Math.max(0, this.introTimer - dt);
                
                // Find Stage 2 Boss zombie in current zombies list
                const boss = this.zombies.find(z => z.type === 'zombie_boss');
                if (boss) {
                    (boss as any).introZ = Math.max(0, 1500 * Math.pow(this.introTimer / 2.0, 2));
                }

                if (this.introTimer <= 0) {
                    this.introStage = 'boss_message';
                    SoundSystem.play('SE-Warning1');
                    this.messageTimer = 1.6;
                    this.screenShakeTimer = 1.5;
                    this.screenShakeIntensity = 18;

                    if (boss) {
                        (boss as any).introZ = 0;

                        // Create huge epicenter slam landing shockwave
                        this.shockwaves.push({
                            x: boss.x,
                            y: boss.y,
                            radius: 10,
                            maxRadius: 480,
                            speed: 850,
                            color: 'rgba(239, 68, 68, 0.95)',
                            thickness: 20,
                            life: 0.7,
                            maxLife: 0.7
                        });

                        // Massive fire and stone dust particle slam
                        EffectSystem.addParticles(this, boss.x, boss.y, '#ea580c', 80, 500, 16);
                        EffectSystem.addParticles(this, boss.x, boss.y, '#dc2626', 45, 350, 10);
                        EffectSystem.addParticles(this, boss.x, boss.y, '#eab308', 30, 250, 7);
                        EffectSystem.addGreyWallCollisionParticles(this, boss.x, boss.y, 40, 15);
                    }
                }
            } else if (this.introStage === 'boss_message') {
                this.messageTimer = Math.max(0, this.messageTimer - dt);
                
                // Update players circling cleanly in standby
                this.tops.forEach(top => {
                    updateTopStandby(top, this,  dt);
                });

                if (this.messageTimer <= 0) {
                    this.introActive = false;
                    this.introStage = 'none';
                    this.zombieSpawningSuspended = false;
                    this.timeElapsed = 0; // Reset combat elapsed timer for stage 2!
                }
            }
            return;
        }

        if (this.versusEndActive) {
            this.versusEndTimer -= dt;
            if (this.versusEndTimer <= 0) {
                this.versusEndTimer = 0;
                this.endGame('results');
                return;
            }
        }

        if (!this.versusEndActive) {
            if (!this.isTimerLocked) {
                this.timeRemaining -= dt;
                this.timeElapsed += dt;
            }
            if (this.timeRemaining <= 0) {
                this.timeRemaining = 0;
            }

            // Launch pad dynamic spawn manager:
            // "彈射區的生成，改成從戰鬥開始後，每隔10秒鐘生成隨機一個彈射區在場上。"
            // "場上同時間只能存在1個彈射區。"
            const isTransitioning = this.areaTransitionState !== 'none';
            if (!this.introActive && !this.isGameOver && !isTransitioning) {
                if (this.activeLaunchPads.length === 0) {
                    this.launchPadSpawnTimer += dt;
                    if (this.launchPadSpawnTimer >= 10) {
                        this.launchPadSpawnTimer = 0;
                        let chosen;
                        let attempts = 0;
                        const cy = this.activeArenaCenterY ?? 540;
                        do {
                            const bId = Math.random() < 0.5 ? 'pad_bounce_tl' : 'pad_bounce_br';
                            const isLeft8 = Math.random() < 0.5;
                            const pool = [
                                { id: 'pad_left_bottom', x: 360, y: cy + 300, arrowAngle: -Math.PI * 0.75 },
                                { id: 'pad_right_top', x: 1560, y: cy - 300, arrowAngle: Math.PI * 0.25 },
                                { id: 'pad_center', x: 960, y: cy, arrowAngle: 0.0 },
                                { id: bId, x: 0, y: 0, arrowAngle: 0.0 },
                                { id: 'pad_eight', x: isLeft8 ? 760 : 1160, y: cy, arrowAngle: isLeft8 ? 0.0 : Math.PI }
                            ];
                            chosen = pool[Math.floor(Math.random() * pool.length)];
                            attempts++;
                        } while (chosen.id === this.lastSpawnedLaunchPadId && attempts < 50);

                        this.lastSpawnedLaunchPadId = chosen.id;

                        if (chosen.id === 'pad_bounce_tl') {
                            chosen.x = 560;
                            chosen.y = cy - 400; // was 140
                            chosen.arrowAngle = -Math.PI * 0.25;
                        } else if (chosen.id === 'pad_bounce_br') {
                            chosen.x = 1360;
                            chosen.y = cy + 400; // was 940
                            chosen.arrowAngle = Math.PI * 0.75;
                        }
                        this.activeLaunchPads = [chosen];

                        // Trigger a beautiful expanding rainbow circular light effect at spawn location!
                        this.shockwaves.push({
                            x: chosen.x,
                            y: chosen.y,
                            radius: 10,
                            maxRadius: 280,
                            speed: 550,
                            color: '#ffffff',
                            thickness: 8,
                            life: 0.65,
                            maxLife: 0.65,
                            isRainbow: true
                        });
                    }
                } else {
                    // Reset or hold at 0 if pad is already on the field
                    this.launchPadSpawnTimer = 0;
                }
            }
        }

        if (this.gameMode === 'campaign') {
            // "1.闖關模式中，每隔30秒，會觸發"殭屍包圍"事件。"
            if (!this.versusEndActive && !this.introActive && !this.isGameOver && !this.zombieSpawningSuspended) {
                this.zombieSiegeTimer -= dt;
                if (this.zombieSiegeTimer <= 0) {
                    this.zombieSiegeTimer = 30.0;
                    EventSystem.spawnSiegeWarningZone(this);
                }
            }

            if (this.siegeWarningZone) {
                if (this.zombieSpawningSuspended || GameUtils.isClashActive(this)) {
                    this.siegeWarningZone = null;
                } else {
                    this.siegeWarningZone.timer += dt;
                    if (this.siegeWarningZone.isForced) {
                        const player = this.tops.find(t => t.id === this.siegeWarningZone?.targetPlayerId);
                        if (player && player.hp > 0 && !player.isExploding) {
                            // Stick warning zone position to the moving player
                            this.siegeWarningZone.x = player.x;
                            this.siegeWarningZone.y = player.y;
                            
                            if (this.siegeWarningZone.timer >= 1.0) {
                                EventSystem.triggerZombieSiege(this, player, { x: player.x, y: player.y });
                                this.siegeWarningZone = null;
                            }
                        } else {
                            this.siegeWarningZone = null;
                        }
                    } else {
                        if (this.siegeWarningZone.timer < 5.0) {
                            const activePlayers = this.tops.filter(t => !t.isAI && !t.isExploding && t.hp > 0 && t.launchPadState === undefined);
                            for (const player of activePlayers) {
                                const dist = Math.hypot(player.x - this.siegeWarningZone.x, player.y - this.siegeWarningZone.y);
                                if (dist <= 150) {
                                    EventSystem.triggerZombieSiege(this, player, { x: this.siegeWarningZone.x, y: this.siegeWarningZone.y });
                                    this.siegeWarningZone = null;
                                    break;
                                }
                            }
                        } else if (this.siegeWarningZone.timer >= 6.0) {
                            this.siegeWarningZone = null;
                        }
                    }
                }
            }

            if (this.zombieSiegeActive) {
                EventSystem.updateZombieSiege(this, dt);
            }



            // Spawn logic: Spawn on schedule if we haven't reached limits (small limit is 20, big is 6)
            // No spawning suspension is locked/triggered when counts are high
            if (!this.zombieSpawningSuspended) {
                this.spawnTimer += dt;
                
                // Scale spawn interval based on participating human players (minimum 1, maximum multiplier of 1.8x)
                const humanPlayers = this.participants ? this.participants.filter(p => !p.isAI).length : 0;
                const playerCount = humanPlayers > 0 ? humanPlayers : 1;
                const scaleMultiplier = Math.min(1.8, 1.0 + (playerCount - 1) * 0.267);
                const spawnInterval = 0.75 / scaleMultiplier;

                if (this.spawnTimer > spawnInterval) {
                    this.spawnTimer = 0;
                    if (!this.bossSpawned) {
                        SpawnSystem.spawnZombie(this);
                        SpawnSystem.spawnZombie(this);
                    }
                }
            }
        }
            this.obstacleTimer += dt;
            if (this.obstacleTimer > 8.0) {
                this.obstacleTimer = 0;
                // Stopped spawning landmine objects (obstacle_barrel) per user request
                // SpawnSystem.spawnItemOrObstacle(this, 'obstacle_barrel');
            }

            this.starSpawnTimer += dt;
            if (this.starSpawnTimer > 30.0) {
                this.starSpawnTimer = 0;
                // Star item spawning is disabled per user request
                // SpawnSystem.spawnItemOrObstacle(this, 'item_crate');
            }

        // Update Phantom Clones (Model 3 Skill)
        this.phantomClones.forEach(pc => {
            pc.life = Math.max(0, pc.life - dt);
            
            // Spin / Rotation of top body
            const visualSpinFactor = 1.0;
            pc.angle += visualSpinFactor * Math.PI * 18 * dt * 0.7;

            // Stands/Orbit revolving around spawn centerX/Y
            const orbitSpeed = 8.0; // max speed
            pc.orbitAngle = pc.orbitAngle - orbitSpeed * dt;

            // Solve revolving spiral coordinates
            const rBase = 157.5;
            const c = 0.25;
            const r = rBase * 0.7 * (0.85 + 0.5 * Math.sin(c * pc.orbitAngle));
            pc.x = pc.centerX + r * Math.cos(pc.orbitAngle);
            pc.y = pc.centerY + r * Math.sin(pc.orbitAngle);

            // Update hit cooldowns
            for (const [targetId, cooldown] of pc.hitCooldowns.entries()) {
                if (cooldown > 0) {
                    pc.hitCooldowns.set(targetId, cooldown - dt);
                } else {
                    pc.hitCooldowns.delete(targetId);
                }
            }

            // Spawn lovely tracking cyber blue particles on orbit
            let cloneAlpha = 1.0;
            if (pc.life > pc.maxLife - 0.6) {
                cloneAlpha = Math.max(0, Math.min(1.0, (pc.maxLife - pc.life) / 0.6));
            } else if (pc.life < 0.6) {
                cloneAlpha = Math.max(0, Math.min(1.0, pc.life / 0.6));
            }

            if (Math.random() < 0.3 * cloneAlpha) {
                const cols = ['#38bdf8', '#0ea5e9', '#7dd3fc', '#ffffff'];
                const col = cols[Math.floor(Math.random() * cols.length)];
                EffectSystem.addParticles(this, pc.x, pc.y, col, 1, 90, 2.5);
            }

            // --- Collisions with Zombies ---
            const cycloneRadius = pc.radius + 80; // 128
            this.zombies.forEach(z => {
                if (z.markForDeletion || z.hp <= 0 || (z as any).isSiegeZombie) return;

                const dist = Math.hypot(z.x - pc.x, z.y - pc.y);
                if (dist <= cycloneRadius + z.radius) {
                    const currentCd = pc.hitCooldowns.get(z.id) ?? 0;
                    if (currentCd <= 0) {
                        const isBoss = z.type === 'zombie_boss';
                        GameUtils.applyDamageToZombie(this, z, 1, pc.ownerId);
                        z.flashTimer = isBoss ? 0.35 : 0.15;
                        pc.hitCooldowns.set(z.id, isBoss ? 1.0 : 0.25);

                        const isBig = z.type === 'zombie_big' || z.type === 'zombie_bomb' || z.type === 'zombie_bouncing';
                        let mainColor = '#22c55e';
                        if (isBoss) {
                            mainColor = '#ea580c';
                        } else if (z.type === 'zombie_big') {
                            mainColor = '#9333ea';
                        } else if (z.type === 'zombie_bomb') {
                            mainColor = '#f97316';
                        } else if (z.type === 'zombie_bouncing') {
                            mainColor = '#be185d';
                        }

                        EffectSystem.addParticles(this, z.x, z.y, mainColor, 6, 120, 3);
                        EffectSystem.addParticles(this, z.x, z.y, '#ffffff', 2, 150, 2);

                        if (z.hp <= 0) {
                            if (!GameUtils.handleZombieDeath(this, z, pc.ownerId)) return;
                            z.markForDeletion = true;
                            EffectSystem.spawnSkillKillExplosion(this, z.x, z.y, z.type === 'zombie_boss');
                            this.spawnTicket(z.x, z.y, z.type, pc.originalIdx, z.id);
                            const owner = this.tops.find(t => t.id === pc.ownerId);
                            if (owner) {
                                owner.kills = (owner.kills ?? 0) + 1;
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
                        }
                    }
                }
            });

            // --- Collisions with Other Player Tops (Versus Mode) ---
            if (this.gameMode === 'versus') {
                this.tops.forEach(otherTop => {
                    if (otherTop.id === pc.ownerId || otherTop.markForDeletion || otherTop.isExploding || otherTop.hp <= 0) return;

                    const dist = Math.hypot(otherTop.x - pc.x, otherTop.y - pc.y);
                    if (dist <= cycloneRadius + otherTop.radius) {
                        const currentCd = pc.hitCooldowns.get(otherTop.id) ?? 0;
                        if (currentCd <= 0 && (otherTop.hitCooldown === undefined || otherTop.hitCooldown <= 0)) {
                            otherTop.hp = Math.max(0, otherTop.hp - 5.0);
                            otherTop.hitCooldown = 1.0;
                            pc.hitCooldowns.set(otherTop.id, 0.25);
                            otherTop.hpLossTimer = 0.5;
                            otherTop.visualHp = otherTop.visualHp !== undefined ? Math.max(otherTop.hp, otherTop.visualHp) : otherTop.hp;

                            EffectSystem.addParticles(this, otherTop.x, otherTop.y, '#ffffff', 4, 180, 4);

                            // repulsion
                            const dx = otherTop.x - pc.x;
                            const dy = otherTop.y - pc.y;
                            const len = Math.hypot(dx, dy);
                            if (len > 0) {
                                otherTop.vx += (dx / len) * 200;
                                otherTop.vy += (dy / len) * 200;
                            }
                        }
                    }
                });
            }
        });

        // Filter and keep live clones
        this.phantomClones = this.phantomClones.filter(pc => pc.life > 0);

        // Update Tops
        this.tops.forEach(top => {
            // Age and filter concentric rings & max spin halos regardless of state
            if (top.spin >= MAX_SPIN) {
                top.contractRings = [];
            } else if (top.contractRings) {
                top.contractRings.forEach((ring: any) => {
                    ring.radius -= dt * 320; // shrinks at a solid, visible rate
                });
                top.contractRings = top.contractRings.filter((ring: any) => ring.radius > top.radius);
            }

            if (top.maxSpinHalos) {
                top.maxSpinHalos.forEach((halo: any) => {
                    halo.life -= dt;
                    const pct = (halo.maxLife - halo.life) / halo.maxLife;
                    halo.radius = top.radius + (halo.maxRadius - top.radius) * pct;
                });
                top.maxSpinHalos = top.maxSpinHalos.filter((halo: any) => halo.life > 0);
            }

            const wasMaxSpin = (top as any).prevSpin !== undefined && (top as any).prevSpin >= MAX_SPIN;
            const isNowMaxSpin = top.spin >= MAX_SPIN;
            (top as any).prevSpin = top.spin;

            if (!wasMaxSpin && isNowMaxSpin && !top.isAI && top.hp > 0 && !top.isExploding) {
                let isDirectionInputActive = false;
                if (top.controls) {
                    if (this.keys.has(top.controls.up) ||
                        this.keys.has(top.controls.down) ||
                        this.keys.has(top.controls.left) ||
                        this.keys.has(top.controls.right)) {
                        isDirectionInputActive = true;
                    }
                }
                if (!isDirectionInputActive) {
                    if (!top.maxSpinHalos) top.maxSpinHalos = [];
                    top.maxSpinHalos.push({
                        radius: top.radius,
                        maxRadius: 360,
                        life: 0.5,
                        maxLife: 0.5
                    });
                }
            }

            // Check Launch Pad entry overlap first (only if top is alive, not in launchPadState, not in ultimate skill, and not during active clash events)
            if (!top.isExploding && top.hp > 0 && top.launchPadState === undefined && !GameUtils.isClashActive(this)) {
                const inModel1Skill = top.skillActiveTimer !== undefined && top.skillActiveTimer > 0;
                if (!inModel1Skill) {
                    const padRadius = 48;
                    for (const pad of this.activeLaunchPads) {
                        const dist = Math.hypot(top.x - pad.x, top.y - pad.y);
                        if (dist < (top.radius + padRadius) * 0.7) {
                            top.launchPadState = 'prep_spinning';
                            if (!top.isAI) {
                                SoundSystem.play('SE-Heal1');
                                SoundSystem.play('Mech_Move_011');
                            }
                            top.launchPadBossDamaged = false;
                            top.launchPadTimer = 1.5;
                            top.launchPadSpinCount = 0;
                            (top as any).launchPadStartYCenter = this.activeArenaCenterY ?? 540;
                            (top as any).launchPadSource = pad.id === 'pad_center' ? 'center' : pad.id === 'pad_eight' ? 'eight' : (pad.id === 'pad_bounce_tl' || pad.id === 'pad_bounce_br') ? 'bounce' : 'corner';
                            (top as any).launchPadSourceId = pad.id;
                            top.x = pad.x;
                            top.y = pad.y;
                            top.vx = 0;
                            top.vy = 0;
                            top.spin = MAX_SPIN;
                            top.flashTimer = undefined; // Clear any active damage flash white indicator upon entering launch pad
                            
                            // Immediately cancel active zombie siege, scattering the zombies and turning them into standard zombies
                            if (this.zombieSiegeActive && this.siegeTargetPlayerId === top.id) {
                                EventSystem.cancelZombieSiege(this);
                            }
                            
                            this.shockwaves.push({
                                x: pad.x,
                                y: pad.y,
                                radius: 5,
                                maxRadius: 120,
                                speed: 600,
                                color: '#06b6d4',
                                thickness: 5,
                                life: 0.25,
                                maxLife: 0.25
                            });

                            // Remove this launch pad immediately upon entry!
                            this.activeLaunchPads = this.activeLaunchPads.filter(p => p.id !== pad.id);
                            break;
                        }
                    }
                }
            }

            // Dynamically calculate and assign scale-dependent radius for collision detection
            const currentScaleFactor = GameUtils.getTopScale(this, top);
            top.radius = TOP_RADIUS * currentScaleFactor;

            // Smoothly interpolate the spin value to avoid sudden radius/size jumps
            if (top.smoothSpin === undefined) {
                top.smoothSpin = top.spin ?? MAX_SPIN;
            }
            top.smoothSpin += ((top.spin ?? MAX_SPIN) - top.smoothSpin) * (1 - Math.exp(-8 * dt));

            // Decrement deadlock cooldown timer
            if (top.deadlockCooldownTimer !== undefined && top.deadlockCooldownTimer > 0) {
                top.deadlockCooldownTimer = Math.max(0, top.deadlockCooldownTimer - dt);
            }

            // Decrement cyclone hit cooldown
            if (top.cycloneHitCooldown !== undefined && top.cycloneHitCooldown > 0) {
                top.cycloneHitCooldown = Math.max(0, top.cycloneHitCooldown - dt);
            }

            // --- LAUNCH PAD STATE TIMER & FLIGHT UPDATES ---
            if (top.launchPadState !== undefined) {
                // visual spin at 10 grids (spinPct = 1.0, spinFactor = 1.0)
                // Using 18 * Math.PI * dt * 0.7 to avoid stroboscopic wagon-wheel aliasing
                top.angle += 1.0 * Math.PI * 18 * dt * 0.7;
                
                top.spin = MAX_SPIN;
                top.smoothSpin = MAX_SPIN;
                top.flashTimer = undefined; // Force flashTimer to undefined to prevent any damage white flash during launch pad actions

                if (!top.axisTrail) {
                    top.axisTrail = [];
                }
                top.axisTrail.forEach(p => {
                    p.life -= dt;
                });
                top.axisTrail = top.axisTrail.filter(p => p.life > 0);

                if (top.launchPadState === 'flying' || top.launchPadState === 'dashing') {
                    top.axisTrail.push({
                        x: top.x,
                        y: top.y,
                        life: 0.525,
                        isDash: true,
                        isSpecialDash: true
                    });
                    if (top.axisTrail.length > 80) {
                        top.axisTrail.shift();
                    }

                    // High-speed electric particles!
                    if (Math.random() < 0.45) {
                        const topSpeed = Math.hypot(top.vx, top.vy);
                        let dirX = (top as any).launchPadDirX ?? 0;
                        let dirY = (top as any).launchPadDirY ?? 0;
                        if (dirX === 0 && dirY === 0) {
                            if (topSpeed > 0.1) {
                                dirX = top.vx / topSpeed;
                                dirY = top.vy / topSpeed;
                            } else {
                                dirX = Math.cos(top.angle);
                                dirY = Math.sin(top.angle);
                            }
                        }
                        const bX = - dirX * 110 * (0.5 + Math.random() * 0.5);
                        const bY = - dirY * 110 * (0.5 + Math.random() * 0.5);
                        
                        const cols = ['#ffffff', '#60a5fa', '#38bdf8', top.color];
                        const col = cols[Math.floor(Math.random() * cols.length)];
                        const size = Math.random() * 6 + 4;
                        
                        this.particles.push({
                            x: top.x,
                            y: top.y,
                            vx: bX + (Math.random() - 0.5) * 80,
                            vy: bY + (Math.random() - 0.5) * 80,
                            life: 0.35, 
                            maxLife: 0.35,
                            color: col,
                            size: size,
                            isElectric: Math.random() < 0.85
                        } as any);
                    }
                }

                if (top.superTimer !== undefined && top.superTimer > 0) {
                    top.superTimer = Math.max(0, top.superTimer - dt);
                }
                if (top.hpLossTimer !== undefined && top.hpLossTimer > 0) {
                    top.hpLossTimer = Math.max(0, top.hpLossTimer - dt);
                }
                if (top.damageShockTimer !== undefined && top.damageShockTimer > 0) {
                    top.damageShockTimer = Math.max(0, top.damageShockTimer - dt);
                }

                const getSpeedFactor = (t: any): number => {
                    const tier = t.launchPadSpeedTier ?? 'medium';
                    if (tier === 'slow') return 0.65;
                    if (tier === 'fast') return 1.4;
                    return 1.0;
                };

                if (top.launchPadState === 'prep_spinning') {
                    top.vx = 0;
                    top.vy = 0;
                    
                    // Handle AI simulated inputs safely & frame-rate independently
                    
                    top.launchPadTimer = (top.launchPadTimer ?? 1.5) - dt;
                    
                    // Add subtle spin preparation particles
                    if (Math.random() < 0.3) {
                        EffectSystem.addParticles(this, top.x, top.y, '#f59e0b', 1, 100, 1.5);
                    }
                    
                    if (top.launchPadTimer <= 0) {
                        // Determine flight speed tier based on spins accomplished!
                        const count = top.launchPadSpinCount ?? 0;
                        if (count >= 6) {
                            (top as any).launchPadSpeedTier = 'fast';
                        } else if (count >= 2) {
                            (top as any).launchPadSpeedTier = 'medium';
                        } else {
                            (top as any).launchPadSpeedTier = 'slow';
                        }
                        
                        // Clear prep states
                        (top as any).launchPadNextAiSpinTime = undefined;
                        
                        // Visual transition shockwave color depending on speed tier (fast=red, medium=yellow/orange, slow=cyan)
                        const runSpeed = (top as any).launchPadSpeedTier;
                        const col = runSpeed === 'fast' ? '#ef4444' : (runSpeed === 'medium' ? '#f59e0b' : '#38bdf8');
                        this.shockwaves.push({
                            x: top.x,
                            y: top.y,
                            radius: 10,
                            maxRadius: 180,
                            speed: 700,
                            color: col,
                            thickness: 6,
                            life: 0.3,
                            maxLife: 0.3
                        });
                        
                        // Progress to standard 0.375s pre-flight 'charging' state (shortened by 25% from 0.5s)
                        top.launchPadState = 'charging';
                        top.launchPadTimer = 0.375;
                    }
                } else if (top.launchPadState === 'charging') {
                    top.vx = 0;
                    top.vy = 0;
                    top.launchPadTimer = (top.launchPadTimer ?? 0.375) - dt;
                    
                    if (Math.random() < 0.45) {
                        EffectSystem.addParticles(this, top.x, top.y, '#06b6d4', 2, 120, 2);
                        EffectSystem.addParticles(this, top.x, top.y, '#ffffff', 1, 150, 3);
                    }

                    if (top.launchPadTimer <= 0) {
                        top.launchPadState = 'flying';
                        if (!top.isAI) {
                            SoundSystem.play('Attack_wave_017');
                            SoundSystem.play('SE-Missle1');
                        }
                        if ((top as any).launchPadSource === 'center') {
                            top.launchPadTimer = 0.8; // shortened by 25% from 1.0667 seconds
                            (top as any).launchPadStartAngle = Math.random() * Math.PI * 2;
                        } else if ((top as any).launchPadSource === 'eight') {
                            top.launchPadTimer = 1.5;
                            (top as any).launchPadStartAngle = top.x < 960 ? Math.PI : 0;
                        } else if ((top as any).launchPadSource === 'bounce') {
                            top.launchPadTimer = 1.5; // shortened by 25% from 2.0s
                            (top as any).lastBounceIndex = -1;
                        } else {
                            top.launchPadTimer = 0.7693; // shortened by 25% from 1.0257 seconds
                            const cy = (top as any).launchPadStartYCenter ?? 540;
                            const theta_start = Math.atan2((top.y - cy) / 440, (top.x - 960) / 865);
                            (top as any).launchPadStartAngle = theta_start;
                        }
                    }
                } else if (top.launchPadState === 'flying') {
                    const f = getSpeedFactor(top);
                    if ((top as any).launchPadSource === 'center') {
                        const duration = 0.8; // shortened by 25% from 1.0667;
                        top.launchPadTimer = (top.launchPadTimer ?? duration) - dt * f;
                        const elapsed = duration - Math.max(0, top.launchPadTimer);
                        const p = elapsed / duration;

                        const theta_start = (top as any).launchPadStartAngle ?? 0;
                        const totalTurns = 3.2; // Number of revolutions (spin-out/spin-in)
                        const angle = theta_start + p * totalTurns * Math.PI * 2;

                        const maxRadius = 450;
                        const radius = maxRadius * Math.sin(p * Math.PI);

                        const prevX = top.x;
                        const prevY = top.y;
                        const cy = (top as any).launchPadStartYCenter ?? 540;

                        top.x = 960 + radius * Math.cos(angle);
                        top.y = cy + radius * Math.sin(angle);

                        if (dt > 0) {
                            top.vx = (top.x - prevX) / dt;
                            top.vy = (top.y - prevY) / dt;
                        }
                    } else if ((top as any).launchPadSource === 'eight') {
                        const duration = 1.5;
                        top.launchPadTimer = (top.launchPadTimer ?? duration) - dt * f;
                        const elapsed = duration - Math.max(0, top.launchPadTimer);
                        const p = elapsed / duration;

                        const theta_start = (top as any).launchPadStartAngle ?? 0;
                        const totalTurns = 2.0; // 2 full figure 8s
                        const angle = theta_start + p * totalTurns * Math.PI * 2;

                        // Start at 200 distance from center, expand to max 600, then go back down to 200.
                        const maxRadiusX = 600;
                        const rX = 200 + (maxRadiusX - 200) * Math.sin(p * Math.PI);
                        
                        const maxRadiusY = 350;
                        const rY = maxRadiusY * Math.sin(p * Math.PI);

                        const prevX = top.x;
                        const prevY = top.y;
                        const cy = (top as any).launchPadStartYCenter ?? 540;

                        top.x = 960 + rX * Math.cos(angle);
                        top.y = cy + rY * Math.sin(angle * 2);

                        if (dt > 0) {
                            top.vx = (top.x - prevX) / dt;
                            top.vy = (top.y - prevY) / dt;
                        }
                    } else if ((top as any).launchPadSource === 'bounce') {
                        const duration = 1.5; // shortened 25% from 2.0
                        top.launchPadTimer = (top.launchPadTimer ?? duration) - dt * f;
                        const elapsed = duration - Math.max(0, top.launchPadTimer);

                        const bounceProgress = (elapsed / duration) * 6;
                        let pY = bounceProgress % 2;
                        if (pY > 1) pY = 2 - pY;

                        const cy = (top as any).launchPadStartYCenter ?? 540;
                        const y_min = cy - 432; // cy - (540 - 108)
                        const y_max = cy + 432; // cy + (972 - 540)

                        const isTL = (top as any).launchPadSourceId === 'pad_bounce_tl';
                        const x_start = isTL ? 560 : 1360;
                        const x_end = isTL ? 1360 : 560;

                        top.x = x_start + (elapsed / duration) * (x_end - x_start);
                        if (isTL) {
                            top.y = y_min + pY * (y_max - y_min);
                        } else {
                            top.y = y_max - pY * (y_max - y_min);
                        }

                        // Calculate velocities correctly
                        const speedX = ((x_end - x_start) / duration) * f;
                        const speedY = (((y_max - y_min) * 6) / duration) * f;
                        top.vx = speedX;

                        const currentBounceIdx = Math.floor(bounceProgress);
                        if (currentBounceIdx % 2 === 0) {
                            top.vy = isTL ? speedY : -speedY;
                        } else {
                            top.vy = isTL ? -speedY : speedY;
                        }

                        // Check if a new wall bounce occurred to trigger premium effects
                        const lastB = (top as any).lastBounceIndex ?? -1;
                        if (currentBounceIdx !== lastB && currentBounceIdx >= 0 && currentBounceIdx < 6) {
                            (top as any).lastBounceIndex = currentBounceIdx;

                            // Trigger beautiful wall-bounce impact visual elements with reduced/weakened screenshake
                            this.screenShakeTimer = 0.9;
                            this.screenShakeMaxDuration = 0.9;
                            this.screenShakeIntensity = 12;
                            EffectSystem.addParticles(this, top.x, top.y, '#ffffff', 28, 480, 7);
                            EffectSystem.addParticles(this, top.x, top.y, '#22d3ee', 24, 380, 6);
                            EffectSystem.addParticles(this, top.x, top.y, top.color, 28, 420, 7);

                            this.shockwaves.push({
                                x: top.x,
                                y: top.y,
                                radius: 10,
                                maxRadius: 220,
                                speed: 900,
                                color: '#ec4899', // bright pink-purple high tech shockwave
                                thickness: 6,
                                life: 0.35,
                                maxLife: 0.35
                            });
                        }
                    } else {
                        const duration = 0.7693; // shortened 25% from 1.0257
                        top.launchPadTimer = (top.launchPadTimer ?? duration) - dt * f;
                        const elapsed = duration - Math.max(0, top.launchPadTimer);
                        const flightProgress = elapsed / duration;

                        const theta_start = (top as any).launchPadStartAngle ?? 0;
                        const angle = theta_start + flightProgress * Math.PI * 2;
                        const cy = (top as any).launchPadStartYCenter ?? 540;

                        top.x = 960 + 865 * Math.cos(angle);
                        top.y = cy + 440 * Math.sin(angle);

                        const angleDot = (Math.PI * 2 / duration) * f;
                        top.vx = -865 * Math.sin(angle) * angleDot;
                        top.vy = 440 * Math.cos(angle) * angleDot;
                    }

                    if (Math.random() < 0.6) {
                        const originalIdx = parseInt(top.id.split('_')[1], 10);
                        if (!isNaN(originalIdx)) {
                            this.afterimages.push({
                                id: 'trail_' + Math.random(),
                                ownerId: top.id,
                                x: top.x,
                                y: top.y,
                                angle: top.angle,
                                color: top.color,
                                spriteIdx: originalIdx,
                                life: 0.3,
                                maxLife: 0.3,
                                scale: GameUtils.getTopScale(this, top)
                            });
                        }
                    }
                    EffectSystem.addParticles(this, top.x, top.y, '#06b6d4', 2, 180, 2);
                    EffectSystem.addParticles(this, top.x, top.y, top.color, 2, 150, 3);

                    GameUtils.dealLaunchPadSweepDamage(this, top, dt);

                    if (top.launchPadTimer <= 0) {
                        if ((top as any).launchPadSource === 'bounce') {
                            (top as any).lastBounceIndex = undefined;
                        }

                        top.launchPadState = 'dashing';
                        top.launchPadTimer = 0.45; // shortened 25% from 0.6

                        const targetDir = GameUtils.findLaunchPadNearestTargetDir(this, top);
                        (top as any).launchPadDirX = targetDir.x;
                        (top as any).launchPadDirY = targetDir.y;

                        this.shockwaves.push({
                            x: top.x,
                            y: top.y,
                            radius: 10,
                            maxRadius: 360,
                            speed: 1200,
                            color: '#06b6d4',
                            thickness: 10,
                            life: 0.4,
                            maxLife: 0.4
                        });
                    }
                } else if (top.launchPadState === 'dashing') {
                    const f = getSpeedFactor(top);
                    top.launchPadTimer = (top.launchPadTimer ?? 0.45) - dt * f;
                    const dirX = (top as any).launchPadDirX ?? 0;
                    const dirY = (top as any).launchPadDirY ?? 0;

                    top.state = 'dash';
                    top.dashDirectionX = dirX;
                    top.dashDirectionY = dirY;

                    top.vx = dirX * 5200 * f; // sped up by 25% (3900 / 0.75)
                    top.vy = dirY * 5200 * f;

                    top.x += top.vx * dt;
                    top.y += top.vy * dt;

                    CollisionSystem.handleWallBounce(this, top);
                    GameUtils.clampTopWithinArena(this, top);

                    if (Math.random() < 0.8) {
                        const originalIdx = parseInt(top.id.split('_')[1], 10);
                        if (!isNaN(originalIdx)) {
                            this.afterimages.push({
                                id: 'trail_' + Math.random(),
                                ownerId: top.id,
                                x: top.x,
                                y: top.y,
                                angle: top.angle,
                                color: top.color,
                                spriteIdx: originalIdx,
                                life: 0.25,
                                maxLife: 0.25,
                                scale: GameUtils.getTopScale(this, top)
                            });
                        }
                    }
                    EffectSystem.addParticles(this, top.x, top.y, '#ffffff', 2, 110, 2);
                    EffectSystem.addParticles(this, top.x, top.y, top.color, 3, 220, 3);

                    GameUtils.dealLaunchPadSweepDamage(this, top, dt);

                    if (top.launchPadTimer <= 0) {
                        top.launchPadState = undefined;
                        top.launchPadBossDamaged = false;
                        top.launchPadTimer = undefined;
                        (top as any).launchPadStartAngle = undefined;
                        (top as any).launchPadDirX = undefined;
                        (top as any).launchPadDirY = undefined;
                        (top as any).launchPadSpeedTier = undefined;
                        top.launchPadSpinCount = undefined;

                        // DO NOT reset to full spin automatically upon entering game
                        // top.spin = top.maxSpin || MAX_SPIN; 
                        
                        top.vx = dirX * 200;
                        top.vy = dirY * 200;
                        top.state = 'standby';
                        
                        top.standbyAngle = Math.random() * Math.PI * 2;
                        top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                        top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                    }
                }

                return;
            }

            // Process Model 1 Ultimate Skill timer & movement
            if (top.skillActiveTimer !== undefined && top.skillActiveTimer > 0) {
                // Keep invulnerable and do not allow standard state updates
                top.vx = 0;
                top.vy = 0;

                if (top.skillStartCenter) {
                    if (top.skillDashCount === undefined) {
                        top.skillDashCount = 0;
                        top.skillDashTimer = 0;
                        top.skillDashState = 'pausing'; // start in pausing state to immediately trigger first dash on next frame
                    }

                    top.skillDashTimer = Math.max(0, top.skillDashTimer - dt);

                    if (top.skillDashTimer <= 0) {
                        if (top.skillDashState === 'dashing') {
                            // Current dash finished! Lock exactly at end coordinates
                            if (top.skillDashEndX !== undefined && top.skillDashEndY !== undefined) {
                                top.x = top.skillDashEndX;
                                top.y = top.skillDashEndY;
                                CollisionSystem.handleWallBounce(this, top);
                            }

                            // Create flash explosion at end of dash segment
                            EffectSystem.addParticles(this, top.x, top.y, '#ffffff', 5, 200, 3);
                            EffectSystem.addParticles(this, top.x, top.y, top.color, 8, 250, 4);

                            // Transition to pause for tactile feel
                            top.skillDashState = 'pausing';
                            top.skillDashTimer = 0.10; // 100ms pause
                        } else {
                            // Pause state complete, assess next step
                            if (top.skillDashCount >= 6) {
                                // Skill is fully complete! Reset and transition state back to standby
                                top.skillActiveTimer = 0;
                                top.skillDashCount = undefined;
                                top.skillDashTimer = undefined;
                                top.skillDashState = undefined;
                                top.skillDashStartX = undefined;
                                top.skillDashStartY = undefined;
                                top.skillDashEndX = undefined;
                                top.skillDashEndY = undefined;
                            } else {
                                // Start next dash segment!
                                top.skillDashCount++;
                                top.skillDashState = 'dashing';
                                top.skillDashTimer = 0.15; // 150ms dash travel duration

                                const angle = Math.random() * Math.PI * 2;
                                const cx = top.skillStartCenter.x;
                                const cy = top.skillStartCenter.y;

                                const x1 = cx - Math.cos(angle) * 420;
                                const y1 = cy - Math.sin(angle) * 420;
                                const x2 = cx + Math.cos(angle) * 420;
                                const y2 = cy + Math.sin(angle) * 420;

                                top.skillDashStartX = x1;
                                top.skillDashStartY = y1;
                                top.skillDashEndX = x2;
                                top.skillDashEndY = y2;

                                // Teleport instantly to start point
                                top.x = x1;
                                top.y = y1;
                                CollisionSystem.handleWallBounce(this, top);

                                // Add main axis slash line passing exactly through the center from x1,y1 to x2,y2
                                this.slashLines.push({
                                    x1: x1,
                                    y1: y1,
                                    x2: x2,
                                    y2: y2,
                                    life: 0.4,
                                    maxLife: 0.4,
                                    color: top.color,
                                    width: 20
                                });

                                // Spark blast on start of this strike segment
                                EffectSystem.addParticles(this, x1, y1, top.color, 5, 100, 2);
                            }
                        }
                    }

                    // Perform smooth linear interpolation while dashing to show exact movement process
                    if (top.skillDashState === 'dashing' && 
                        top.skillDashStartX !== undefined && top.skillDashEndX !== undefined &&
                        top.skillDashStartY !== undefined && top.skillDashEndY !== undefined) {
                        const duration = 0.15;
                        const elapsed = duration - top.skillDashTimer;
                        const tRatio = Math.min(1, Math.max(0, elapsed / duration));

                        top.x = top.skillDashStartX + (top.skillDashEndX - top.skillDashStartX) * tRatio;
                        top.y = top.skillDashStartY + (top.skillDashEndY - top.skillDashStartY) * tRatio;
                        CollisionSystem.handleWallBounce(this, top);

                        // Spawn electric trail sparks continuously as the top slides
                        EffectSystem.addParticles(this, top.x, top.y, top.color, 2, 80, 2);
                        EffectSystem.addParticles(this, top.x, top.y, '#ffffff', 1, 100, 1);

                        // Add beautiful afterimage trails along the movement process
                        const originalIdx = parseInt(top.id.split('_')[1], 10);
                        if (!isNaN(originalIdx) && Math.random() < 0.4) {
                            this.afterimages.push({
                                id: 'trail_' + Math.random(),
                                ownerId: top.id,
                                x: top.x,
                                y: top.y,
                                angle: top.angle,
                                color: top.color,
                                spriteIdx: originalIdx,
                                life: 0.25,
                                maxLife: 0.25,
                                scale: GameUtils.getTopScale(this, top)
                            });
                        }
                    }
                }

                if (top.skillActiveTimer <= 0) {
                    top.skillActiveTimer = 0;
                    top.state = 'standby';
                    // Re-calculate standby center at current position
                    top.standbyAngle = Math.random() * Math.PI * 2;
                    top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                    top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                }

                // Maintain ultra spin visualization
                top.angle += Math.PI * 30 * dt;
                
                // Add afterimages periodically
                if (Math.random() < 0.6) {
                    const originalIdx = parseInt(top.id.split('_')[1], 10);
                    if (!isNaN(originalIdx)) {
                        this.afterimages.push({
                            id: 'trail_' + Math.random(),
                            ownerId: top.id,
                            x: top.x,
                            y: top.y,
                            angle: top.angle,
                            color: '#ec4899',
                            spriteIdx: originalIdx,
                            life: 0.3,
                            maxLife: 0.3,
                            scale: GameUtils.getTopScale(this, top)
                        });
                    }
                }
                
                // Process HP loss timers
                if (top.hpLossTimer !== undefined && top.hpLossTimer > 0) {
                    top.hpLossTimer = Math.max(0, top.hpLossTimer - dt);
                }

                // ALSO tick the superTimer (Star duration countdown) during Model 1's ultimate skill early return!
                if (top.superTimer !== undefined && top.superTimer > 0) {
                    top.superTimer = Math.max(0, top.superTimer - dt);
                }
                return; // Skip normal movement physics and input bindings below
            }

            // Process Model 2 Ultimate Skill (6 orbiting electric balls)
            if (top.model2SkillTimer !== undefined && top.model2SkillTimer > 0) {
                top.model2SkillTimer = Math.max(0, top.model2SkillTimer - dt);
                top.model2OrbAngle = (top.model2OrbAngle ?? 0) + 4.5 * dt;

                // Update hit cooldowns
                if (!top.model2SkillHitCooldowns) {
                    top.model2SkillHitCooldowns = new Map<string, number>();
                }
                for (const [targetId, cooldown] of top.model2SkillHitCooldowns.entries()) {
                    if (cooldown > 0) {
                        top.model2SkillHitCooldowns.set(targetId, cooldown - dt);
                    } else {
                        top.model2SkillHitCooldowns.delete(targetId);
                    }
                }

                // Determine orb positions (6 orbs around the gyro)
                const orbitRadius = 135;
                const orbRadius = 28;
                const angles: number[] = [];
                for (let i = 0; i < 6; i++) {
                    angles.push((top.model2OrbAngle ?? 0) + (i * Math.PI / 3));
                }

                const orbPositions = angles.map(ang => ({
                    x: top.x + Math.cos(ang) * orbitRadius,
                    y: top.y + Math.sin(ang) * orbitRadius
                }));

                // Calculate fade-in and fade-out alpha factor
                let orbAlpha = 1.0;
                if (top.model2SkillTimer > 9.0) {
                    orbAlpha = Math.max(0, Math.min(1.0, (9.6 - top.model2SkillTimer) / 0.6));
                } else if (top.model2SkillTimer < 0.6) {
                    orbAlpha = Math.max(0, Math.min(1.0, top.model2SkillTimer / 0.6));
                }

                // Spawn micro sparks/flares from the orbiting balls in real time
                orbPositions.forEach(pos => {
                    if (Math.random() < 0.25 * orbAlpha) {
                        const cols = ['#38bdf8', '#0ea5e9', '#eab308', '#f97316', '#ffffff'];
                        const col = cols[Math.floor(Math.random() * cols.length)];
                        EffectSystem.addParticles(this, pos.x, pos.y, col, 1, 80, 2);
                    }
                });

                // Collision with Zombies
                this.zombies.forEach(z => {
                    if (z.markForDeletion || z.hp <= 0 || (z as any).isSiegeZombie) return;

                    let collides = false;
                    for (const pos of orbPositions) {
                        const zRadius = z.radius;
                        const dist = Math.hypot(z.x - pos.x, z.y - pos.y);
                        if (dist <= zRadius + orbRadius) {
                            collides = true;
                            break;
                        }
                    }

                    if (collides) {
                        const currentCd = top.model2SkillHitCooldowns!.get(z.id) ?? 0;
                        if (currentCd <= 0) {
                            // Damage: 1.0 per hit
                            GameUtils.applyDamageToZombie(this, z, 1, top.id);
                            top.model2SkillHitCooldowns!.set(z.id, 0.5); // 0.5 seconds hit cooldown

                            z.flashTimer = 0.15;
                            // Add electric visual splash
                            EffectSystem.addParticles(this, z.x, z.y, '#eab308', 3, 110, 3);
                            EffectSystem.addParticles(this, z.x, z.y, '#38bdf8', 2, 130, 2);

                            if (z.hp <= 0) {
                                if (!GameUtils.handleZombieDeath(this, z, top.id)) return;
                                z.markForDeletion = true;
                                EffectSystem.spawnSkillKillExplosion(this, z.x, z.y, z.type === 'zombie_boss');
                                const matchIdx = top.id.match(/\d+/);
                                const playerIdx = matchIdx ? parseInt(matchIdx[0], 10) : 0;
                                this.spawnTicket(z.x, z.y, z.type, playerIdx, z.id);
                                top.kills = (top.kills ?? 0) + 1;

                                // Small flashy energy wave
                                this.shockwaves.push({
                                    x: z.x,
                                    y: z.y,
                                    radius: 0,
                                    maxRadius: z.type === 'zombie_boss' ? 400 : 120,
                                    speed: 450,
                                    color: '#eab308',
                                    thickness: 6,
                                    life: 0.35,
                                    maxLife: 0.35
                                });
                            }
                        }
                    }
                });

                // Collision with other tops (Versus Mode)
                this.tops.forEach(other => {
                    if (other.id === top.id || other.markForDeletion || other.isExploding || other.hp <= 0) return;

                    let collides = false;
                    for (const pos of orbPositions) {
                        const dist = Math.hypot(other.x - pos.x, other.y - pos.y);
                        if (dist <= TOP_RADIUS + orbRadius) {
                            collides = true;
                            break;
                        }
                    }

                    if (collides) {
                        const currentCd = top.model2SkillHitCooldowns!.get(other.id) ?? 0;
                        if (currentCd <= 0 && (other.hitCooldown === undefined || other.hitCooldown <= 0)) {
                            other.hp = Math.max(0, other.hp - 5.0);
                            top.model2SkillHitCooldowns!.set(other.id, 0.5); // 0.5s cooldown

                            other.hitCooldown = 1.0; // 1-second invulnerability protection
                            EffectSystem.addParticles(this, other.x, other.y, '#38bdf8', 3, 120, 3);

                            const dx = other.x - top.x;
                            const dy = other.y - top.y;
                            const len = Math.hypot(dx, dy);
                            if (len > 0) {
                                other.vx += (dx / len) * 150;
                                other.vy += (dy / len) * 150;
                            }
                        }
                    }
                });
            }

            // Process Model 3 Ultimate Skill (Gigantification)
            if (top.model3SkillTimer !== undefined && top.model3SkillTimer > 0) {
                top.model3SkillTimer = Math.max(0, top.model3SkillTimer - dt);
            }

            // Process coop state
            if (top.coopState) {
                EventSystem.updateCoopState(this, top, dt);
                if (top.coopState) {
                    top.vx = 0;
                    top.vy = 0;
                    top.standbyCenterVx = 0;
                    top.standbyCenterVy = 0;
                    // Skip regular movement since coop locks position completely
                }
            } else if (top.deadlockTimer !== undefined && top.deadlockTimer > 0) {
                top.deadlockTimer = Math.max(0, top.deadlockTimer - dt);

                // Vibration: "僵持時兩顆陀螺本身要有震動。"
                const vibeForce = 24.0;
                top.deadlockVibeX = (Math.random() - 0.5) * vibeForce;
                top.deadlockVibeY = (Math.random() - 0.5) * vibeForce;

                // Stop all other movement forces
                top.vx = 0;
                top.vy = 0;
                top.standbyCenterVx = 0;
                top.standbyCenterVy = 0;

                // Lock layout position with high intensity vibration
                top.x = (top.deadlockX ?? top.x) + top.deadlockVibeX;
                top.y = (top.deadlockY ?? top.y) + top.deadlockVibeY;

                // Continuous sparks at standoff touch contacts
                if (top.deadlockPartnerId) {
                    const partner = this.tops.find(t => t.id === top.deadlockPartnerId) || 
                                    this.zombies.find(z => z.id === top.deadlockPartnerId);
                    if (partner && top.id < partner.id) {
                        const midX = (top.x + partner.x) / 2;
                        const midY = (top.y + partner.y) / 2;
                        
                        // Standard warning/impact sparks
                        if (Math.random() < 0.4) {
                            EffectSystem.addParticles(this, midX, midY, '#eab308', 2, 100, 4); // Yellow
                        }
                        if (Math.random() < 0.3) {
                            EffectSystem.addParticles(this, midX, midY, '#f97316', 2, 120, 5); // Orange
                        }

                        // 4.陀螺互撞僵持時，兩顆陀螺的接觸點要有額外的電流擴散粒子噴出。
                        const electricCount = Math.floor(Math.random() * 3) + 2; // Spawns 2 to 4 electric branches per frame
                        for (let k = 0; k < electricCount; k++) {
                            const cols = ['#06b6d4', '#22d3ee', '#38bdf8', '#ffffff'];
                            const selectedCol = cols[Math.floor(Math.random() * cols.length)];
                            const ang = Math.random() * Math.PI * 2;
                            const spd = (0.6 + Math.random() * 0.6) * 400; // Ultra high velocity diffusion
                            this.particles.push({
                                x: midX,
                                y: midY,
                                vx: Math.cos(ang) * spd,
                                vy: Math.sin(ang) * spd,
                                life: 0.35 + Math.random() * 0.2, maxLife: 0.5,
                                color: selectedCol,
                                size: Math.random() * 9 + 4,
                                isElectric: true
                            } as any);
                        }
                    }
                }

                // Check for termination of deadlock
                if (top.deadlockTimer <= 0) {
                    // Trigger separation and screen shake: "僵持結束兩顆陀螺交錯離開時要有畫面震動效果。"
                    this.screenShakeTimer = 0.9;
                    this.screenShakeMaxDuration = 0.9;
                    this.screenShakeIntensity = 12;

                    const dX_self = top.deadlockX ?? top.x;
                    const dY_self = top.deadlockY ?? top.y;

                    if (top.deadlockPartnerId) {
                        const partnerTopsNode = this.tops.find(t => t.id === top.deadlockPartnerId);
                        const partnerZombiesNode = this.zombies.find(z => z.id === top.deadlockPartnerId);

                        if (partnerTopsNode) {
                            const partner = partnerTopsNode;
                            const dX_partner = partner.deadlockX ?? partner.x;
                            const dY_partner = partner.deadlockY ?? partner.y;

                            const dx = dX_self - dX_partner;
                            const dy = dY_self - dY_partner;
                            const dist = Math.hypot(dx, dy) || 1;
                            const nx = dx / dist;
                            const ny = dy / dist;

                            // Perpendicular swerve vector and repelling vector: "然後大幅度偏移交錯而過。注意這個是偏移而不是整顆陀螺反彈往不同方向。"
                            const tx = -ny;
                            const ty = nx;

                            const swervePower = 650;
                            const repelPower = 400;

                            // Swerve past and repel away
                            top.deflectionVx = (nx * repelPower + tx * swervePower) * 2;
                            top.deflectionVy = (ny * repelPower + ty * swervePower) * 2;
                            top.deflectionX = (nx * 30 + tx * 45) * 2;
                            top.deflectionY = (ny * 30 + ty * 45) * 2;
                            top.bounceTimer = 0.4;
                            top.maxBounceTimer = 0.4;

                            partner.deflectionVx = (-nx * repelPower - tx * swervePower) * 2;
                            partner.deflectionVy = (-ny * repelPower - ty * swervePower) * 2;
                            partner.deflectionX = (-nx * 30 - tx * 45) * 2;
                            partner.deflectionY = (-ny * 30 - ty * 45) * 2;
                            partner.bounceTimer = 0.4;
                            partner.maxBounceTimer = 0.4;

                            // Re-align orbit parameters so orbital motion resumes smoothly from the standoff lock location
                            const velAngleSelf = Math.atan2(top.deflectionVy, top.deflectionVx);
                            top.standbyAngle = velAngleSelf;
                            const r_std_self = getStandbyRadiusForModel(top, this,  top.standbyAngle);
                            top.standbyCenterX = dX_self - Math.cos(top.standbyAngle) * r_std_self;
                            top.standbyCenterY = dY_self - Math.sin(top.standbyAngle) * r_std_self;

                            const velAnglePartner = Math.atan2(partner.deflectionVy, partner.deflectionVx);
                            partner.standbyAngle = velAnglePartner;
                            const r_std_partner = getStandbyRadiusForModel(partner, this,  partner.standbyAngle);
                            partner.standbyCenterX = dX_partner - Math.cos(partner.standbyAngle) * r_std_partner;
                            partner.standbyCenterY = dY_partner - Math.sin(partner.standbyAngle) * r_std_partner;

                            // Spawn high density explosion particles at Separation contact midpoint
                            const midX = (dX_self + dX_partner) / 2;
                            const midY = (dY_self + dY_partner) / 2;
                            EffectSystem.addParticles(this, midX, midY, '#fbbf24', 35, 250, 10);
                            EffectSystem.addParticles(this, midX, midY, '#ef4444', 20, 200, 8);

                            // Set 1-second cooldown after a top releases from a deadlock standoff
                            partner.deadlockCooldownTimer = 1.0;

                            // Clean partner deadlock statuses
                            partner.deadlockTimer = 0;
                            partner.deadlockPartnerId = undefined;
                            partner.deadlockX = undefined;
                            partner.deadlockY = undefined;
                            partner.deadlockVibeX = 0;
                            partner.deadlockVibeY = 0;
                        } else if (partnerZombiesNode) {
                            const partner = partnerZombiesNode;
                            const dX_partner = partner.deadlockX ?? partner.x;
                            const dY_partner = partner.deadlockY ?? partner.y;

                            const dx = dX_self - dX_partner;
                            const dy = dY_self - dY_partner;
                            const dist = Math.hypot(dx, dy) || 1;
                            const nx = dx / dist;
                            const ny = dy / dist;

                            // "當玩家陀螺衝撞魔王時，也要觸發同陀螺僵持做法的僵持行為，但僵持結束後，魔王不會有錯身而過的行為。"
                            // Swerve the player top past and repel away
                            const tx = -ny;
                            const ty = nx;

                            const swervePower = 650;
                            const repelPower = 400;

                            top.deflectionVx = (nx * repelPower + tx * swervePower) * 2;
                            top.deflectionVy = (ny * repelPower + ty * swervePower) * 2;
                            top.deflectionX = (nx * 30 + tx * 45) * 2;
                            top.deflectionY = (ny * 30 + ty * 45) * 2;

                            // Re-align orbit parameters so orbital motion resumes smoothly from the standoff lock location
                            const velAngleSelf = Math.atan2(top.deflectionVy, top.deflectionVx);
                            top.standbyAngle = velAngleSelf;
                            const r_std_self = getStandbyRadiusForModel(top, this,  top.standbyAngle);
                            top.standbyCenterX = dX_self - Math.cos(top.standbyAngle) * r_std_self;
                            top.standbyCenterY = dY_self - Math.sin(top.standbyAngle) * r_std_self;

                            // Spawn high density explosion particles at Separation contact midpoint
                            const midX = (dX_self + dX_partner) / 2;
                            const midY = (dY_self + dY_partner) / 2;
                            EffectSystem.addParticles(this, midX, midY, '#fbbf24', 35, 250, 10);
                            EffectSystem.addParticles(this, midX, midY, '#ef4444', 20, 200, 8);

                            // Clean partner (boss) deadlock statuses
                            partner.deadlockTimer = 0;
                            partner.deadlockPartnerId = undefined;
                            partner.deadlockX = undefined;
                            partner.deadlockY = undefined;
                            partner.deadlockVibeX = 0;
                            partner.deadlockVibeY = 0;
                        }
                    }

                    // Set 1-second cooldown for self
                    top.deadlockCooldownTimer = 1.0;

                    // Clean own deadlock statuses
                    top.deadlockTimer = 0;
                    top.deadlockPartnerId = undefined;
                    top.deadlockX = undefined;
                    top.deadlockY = undefined;
                    top.deadlockVibeX = 0;
                    top.deadlockVibeY = 0;
                }

                // Skip all other standard update forces
                return;
            }

            // Calculate and decay physical deflection offset to simulate brushing past obstacles elegantly
            const prevDefX = top.deflectionX ?? 0;
            const prevDefY = top.deflectionY ?? 0;

            top.deflectionVx = top.deflectionVx ?? 0;
            top.deflectionVy = top.deflectionVy ?? 0;
            top.deflectionX = top.deflectionX ?? 0;
            top.deflectionY = top.deflectionY ?? 0;

            // Decay deflection velocity & displacement
            top.deflectionVx *= Math.exp(-7.5 * dt);
            top.deflectionVy *= Math.exp(-7.5 * dt);

            top.deflectionX += top.deflectionVx * dt;
            top.deflectionY += top.deflectionVy * dt;

            top.deflectionX *= Math.exp(-7.5 * dt);
            top.deflectionY *= Math.exp(-7.5 * dt);

            const dDefX = top.deflectionX - prevDefX;
            const dDefY = top.deflectionY - prevDefY;

            // Shift orbital center to new deflected position permanently instead of snapping back to the old orbit
            if (!top.state || top.state === 'standby') {
                if (top.standbyCenterX !== undefined) {
                    top.standbyCenterX -= dDefX;
                }
                if (top.standbyCenterY !== undefined) {
                    top.standbyCenterY -= dDefY;
                }
            }

            if ((top as any).isDeadState) {
                top.vx *= 0.85;
                top.vy *= 0.85;
                top.x += top.vx * dt + dDefX;
                top.y += top.vy * dt + dDefY;
                top.angle += Math.PI * 1.5 * dt; // Keep spinning slowly
                CollisionSystem.handleWallBounce(this, top);
                return; // Bypass standard updates
            }

            if (top.isExploding) {
                top.explosionTimer = (top.explosionTimer ?? 2.0) - dt;
                
                // Slow down the exploding top physically
                top.vx *= 0.85;
                top.vy *= 0.85;
                top.x += top.vx * dt + dDefX;
                top.y += top.vy * dt + dDefY;
                
                // Continuous sparkles during explosion
                if (Math.random() < 0.4) {
                    EffectSystem.addParticles(this, top.x + (Math.random() - 0.5) * 16, top.y + (Math.random() - 0.5) * 16, top.color, 5, 200, 8);
                }
                
                // Wall bounce still applies so it doesn't slide out of bounds
                CollisionSystem.handleWallBounce(this, top);
                
                if (top.explosionTimer <= 0) {
                    top.markForDeletion = true;
                }
                return; // Bypass standard updates
            }

            // Prevent movement and skills if immobilized by zombie siege clinging
            if (this.zombieSiegeActive && this.siegeStatus === 'clinging' && top.id === this.siegeTargetPlayerId) {
                top.vx = 0;
                top.vy = 0;
                top.standbyCenterVx = 0;
                top.standbyCenterVy = 0;
                
                if (top.hitCooldown !== undefined && top.hitCooldown > 0) {
                    top.hitCooldown = Math.max(0, top.hitCooldown - dt);
                }
                if (top.flashTimer !== undefined && top.flashTimer > 0) {
                    top.flashTimer = Math.max(0, top.flashTimer - dt);
                }
                if (top.damageShockTimer !== undefined && top.damageShockTimer > 0) {
                    top.damageShockTimer = Math.max(0, top.damageShockTimer - dt);
                }
                return;
            }

            // Check super state timer and progress
            if (top.superTimer !== undefined && top.superTimer > 0) {
                top.superTimer = Math.max(0, top.superTimer - dt);
            }

            // Check if user is currently pressing/holding spin button
            let isSpinning = false;
            if (this.versusEndActive || (top as any).isDeadState) {
                isSpinning = false;
            } else if (top.launchPadState !== undefined) {
                isSpinning = false; // Disallow manual spin growth/contraction rings during launchPad process!
            } else if (top.state === 'dash') {
                isSpinning = false; // Disallow manual spin charging / concentric rings during dash state!
            } else if (this.zombieSiegeActive && this.siegeStatus === 'resolved_success' && top.id === this.siegeTargetPlayerId) {
                isSpinning = false; // Disallow manual spin during active zombie siege success breakout/fling performance
            } else if (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0) {
                isSpinning = false; // Disallow manual spin during top breakout orbit whip loop
            } else if (!top.isAI && top.controls) {
                // Disabled long-press/holding key behaviour per user request: '加速旋轉鍵不支援長壓'
                // Key hold is ignored in favor of single-trigger discrete taps (keydown)
                isSpinning = false;
                if (top.virtualSpinHoldTimer !== undefined && top.virtualSpinHoldTimer > 0) {
                    isSpinning = true;
                    top.virtualSpinHoldTimer -= dt;
                    if (top.virtualSpinHoldTimer < 0) {
                        top.virtualSpinHoldTimer = 0;
                    }
                }
            } else if (top.isAI) {
                isSpinning = (top as any).isSpinningFromAI ?? false;
            }

                        // Initialize or update spinIdleTime
            if (top.spinIdleTime === undefined) {
                top.spinIdleTime = 0;
            }
            if (isSpinning) {
                top.spinIdleTime = 0;
            } else {
                top.spinIdleTime += dt;
            }

            // Continuous spin increase when holding for players (increases by 300 spin points = 3.0 grids per second)
            if (!top.isAI && isSpinning) {
                // Long-press continuous spin increase is disabled. Players must tap/mash to increase spin.

                let isDirectionInputActive = false;
                if (top.controls) {
                    if (this.keys.has(top.controls.up) ||
                        this.keys.has(top.controls.down) ||
                        this.keys.has(top.controls.left) ||
                        this.keys.has(top.controls.right)) {
                        isDirectionInputActive = true;
                    }
                }

                if (isDirectionInputActive) {
                    top.contractRings = [];
                } else {
                    // Orgy-spin/stationary acceleration concentric ring waves effect
                    if ((top.state === 'standby' || !top.state) && top.spin < MAX_SPIN) {
                        if (top.contractRingTimer === undefined) top.contractRingTimer = 0;
                        top.contractRingTimer -= dt;
                        if (top.contractRingTimer <= 0) {
                            top.contractRingTimer = 0.28; // Spawn a concentric ring wave every 280ms
                            if (!top.contractRings) top.contractRings = [];
                            top.contractRings.push({ radius: 200 }); // starts at radius 200px
                        }
                    }
                }
            }

            // Remove automatic decay over time. Spin now does not decrease automatically.
            // But we still maintain the absolute minimum of 1 grid (100 spin points)
            top.spin = Math.max(100, top.spin);

            // Auto-recovery has been disabled per user request
            const displayedSpinGrids = Math.max(1, Math.min(10, Math.floor(top.spin / top.maxSpin * 10)));
            top.lastDisplayedSpinGrids = displayedSpinGrids;

            // Fixed at maximum spin under Super State
            if (top.superTimer !== undefined && top.superTimer > 0) {
                top.spin = MAX_SPIN;
            }

            // Store isSpinning state for other systems
            top.isSpinning = isSpinning;

            // Initialize and age axisTrail list
            if (!top.axisTrail) {
                top.axisTrail = [];
            }
            top.axisTrail.forEach(p => {
                p.life -= dt;
            });
            top.axisTrail = top.axisTrail.filter(p => p.life > 0);

            // 只有陀螺衝鋒或持續控制移動時，才要生成拖尾電流。同時依舊需要符合轉速大於5 (isHighSpin > 5)。
            const isHighSpin = (top.spin / (top.maxSpin || MAX_SPIN) * 10) > 5;
            const isDashing = top.state === 'dash' || !!top.isActivelyPushing;
            const shouldGetElectricTrail = isHighSpin && isDashing;

            if (shouldGetElectricTrail) {
                // 寫入全新的衝刺軌軌點 (生命週期設為 0.525秒 增強殘影感)
                top.axisTrail.push({
                    x: top.x,
                    y: top.y,
                    life: 0.525,
                    isDash: true // 此旗標用於觸發後續繪圖的閃電渲染
                });

                if (top.axisTrail.length > 80) {
                    top.axisTrail.shift();
                }

                // 向後方（阻力/拖曳方向）高機率噴散高速電光微粒 (生成密度減半: 0.9 -> 0.45)
                if (Math.random() < 0.45) {
                    const topSpeed = Math.hypot(top.vx, top.vy);
                    let dirX = top.dashDirectionX ?? 0;
                    let dirY = top.dashDirectionY ?? 0;
                    if (top.isActivelyPushing) {
                        const len = Math.hypot(top.standbyCenterVx || 0, top.standbyCenterVy || 0);
                        if (len > 0.1) {
                            dirX = (top.standbyCenterVx || 0) / len;
                            dirY = (top.standbyCenterVy || 0) / len;
                        }
                    }
                    if (dirX === 0 && dirY === 0) {
                        if (topSpeed > 0.1) {
                            dirX = top.vx / topSpeed;
                            dirY = top.vy / topSpeed;
                        } else {
                            dirX = Math.cos(top.angle);
                            dirY = Math.sin(top.angle);
                        }
                    }
                    const bX = - dirX * 110 * (0.5 + Math.random() * 0.5);
                    const bY = - dirY * 110 * (0.5 + Math.random() * 0.5);
                    
                    const cols = ['#ffffff', '#60a5fa', '#38bdf8', top.color];
                    const col = cols[Math.floor(Math.random() * cols.length)];
                    const size = Math.random() * 6 + 4;
                    
                    this.particles.push({
                        x: top.x,
                        y: top.y,
                        vx: bX + (Math.random() - 0.5) * 80,
                        vy: bY + (Math.random() - 0.5) * 80,
                        life: 0.35, 
                        maxLife: 0.35,
                        color: col,
                        size: size,
                        isElectric: Math.random() < 0.85 // 85% 機率產生具電弧跳躍行為的粒子
                    } as any);
                }
            } else {
                // 原有一般軌跡
                const shouldAddTrail = (top.state === 'dash') || (top.state === 'standby' && isSpinning) || (top.superTimer !== undefined && top.superTimer > 0 && top.state === 'standby') || !!top.isActivelyPushing;
                if (shouldAddTrail) {
                    top.axisTrail.push({
                        x: top.x,
                        y: top.y,
                        life: 0.35,
                        isDash: false
                    });
                    if (top.axisTrail.length > 50) {
                        top.axisTrail.shift();
                    }
                }
            }

            // Update smooth spin boost factor
            if (top.spinBoostFactor === undefined) top.spinBoostFactor = 0;
            if (isSpinning) {
                top.spinBoostFactor = Math.min(1, top.spinBoostFactor + dt * 4.5);
            } else {
                top.spinBoostFactor = Math.max(0, top.spinBoostFactor - dt * 2.5);
            }
            
            // Visual rotation speed based on spin - ensuring it doesn't look static even at low spin (halved the minimum speed)
            // Reduced maximum and minimum spin speeds by 30% for a smoother visual feel (scaling coefficient with 0.7)
            // Increased the visual speed difference between low and high RPM per user request
            const spinPct = top.spin / MAX_SPIN;
            const visualSpinFactor = top.spin > 0 ? (0.05 + 0.95 * spinPct) : 0;
            // When user is holding standard spinning/accelerating control, spin rotation speed boosts significantly mapping to intensive spin visual mode - Increased by 30% per user request
            const spinningMultiplier = isSpinning ? 3.0 : 1.0;
            
            // Calculate a dramatic spin boost factor when preparing and charging in the launch/catapult area
            let catapultSpinMultiplier = 1.0;
            if (top.launchPadState === 'prep_spinning') {
                const timer = top.launchPadTimer ?? 1.5;
                const progress = Math.min(1.0, Math.max(0.0, 1.0 - timer / 1.5));
                catapultSpinMultiplier = 1.0 + progress * 5.0; // accelerate rotation visually up to 6x
            } else if (top.launchPadState === 'charging') {
                catapultSpinMultiplier = 7.0; // peak spin rate during charge before flight
            }
            
            top.angle += visualSpinFactor * Math.PI * 18 * dt * 0.7 * spinningMultiplier * 1.3 * catapultSpinMultiplier;

            // HP animation logic for fighting game style catch-up bar and shock effects
            if (top.prevHp === undefined) {
                top.prevHp = top.hp;
                top.visualHp = top.hp;
                top.hpLossTimer = 0;
                top.damageShockTimer = 0;
            }

            if (top.hp < top.prevHp) {
                // Top took damage! Trigger effects
                top.damageShockTimer = 0.45; // 450ms flash/shake duration
                top.bounceTimer = 0.35; // knockback height timer
                top.maxBounceTimer = 0.35;
                top.hpLossTimer = 0.5;       // 500ms delay before catch-up bar drains
                top.prevHp = top.hp;
                
                // Add global screen shake if the damaged top is a player (disabled per user request)
                if (!top.isAI) {
                    // this.screenShakeTimer = 0.8;
                    
                    // Spray out a glowing burst of fiery spark particles!
                    const colors = ['#ffffff', '#fde047', '#fde047', '#f97316', '#ef4444'];
                    const sparkCount = 45;
                    for (let i = 0; i < sparkCount; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 180 + Math.random() * 420; // explosive burst speeds
                        const size = Math.random() * 3.5 + 2.0;   // nice streak width
                        const maxLife = 0.35 + Math.random() * 0.45; // brief, bright lifespan
                        
                        this.particles.push({
                            x: top.x,
                            y: top.y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            life: maxLife,
                            maxLife: maxLife,
                            color: colors[Math.floor(Math.random() * colors.length)],
                            size: size,
                            isSpark: true
                        });
                    }
                }
            } else if (top.hp > top.prevHp) {
                // Healed or restored
                top.visualHp = top.hp;
                top.prevHp = top.hp;
            }

            // Universal Spin Reduction Trigger for hit knockback response (受擊擊退反應)
            if (top.damageShockTimer !== undefined && top.damageShockTimer > 0) {
                if (!(top as any).wasInDamageShock) {
                    (top as any).wasInDamageShock = true;
                    top.spin = Math.max(100, top.spin - 100);
                    if (top.smoothSpin !== undefined) {
                        top.smoothSpin = Math.max(100, top.smoothSpin - 100);
                    }
                }
            } else {
                (top as any).wasInDamageShock = false;
            }

            // Decrement timers
            if (top.damageShockTimer !== undefined && top.damageShockTimer > 0) {
                top.damageShockTimer = Math.max(0, top.damageShockTimer - dt);
            }
            if (top.bounceTimer !== undefined && top.bounceTimer > 0) {
                top.bounceTimer = Math.max(0, top.bounceTimer - dt);
            }
            if (top.hpLossTimer !== undefined && top.hpLossTimer > 0) {
                top.hpLossTimer = Math.max(0, top.hpLossTimer - dt);
            } else {
                // Drain visualHp to match actual hp
                if (top.visualHp !== undefined && top.visualHp > top.hp) {
                    const diff = top.visualHp - top.hp;
                    top.visualHp = Math.max(top.hp, top.visualHp - dt * (diff * 4 + top.maxHp * 0.15));
                } else {
                    top.visualHp = top.hp;
                }
            }

            // Update Flash Timer
            if (top.flashTimer !== undefined && top.flashTimer > 0) {
                top.flashTimer = Math.max(0, top.flashTimer - dt);
            }

            // Update Hit Cooldown
            if (top.hitCooldown !== undefined && top.hitCooldown > 0) {
                top.hitCooldown = Math.max(0, top.hitCooldown - dt);
            }

            // Update Small Zombie Hit Cooldown
            if (top.smallZombieHitCooldown !== undefined && top.smallZombieHitCooldown > 0) {
                top.smallZombieHitCooldown = Math.max(0, top.smallZombieHitCooldown - dt);
            }

            // Update Dash Cooldown
            if (top.dashCooldown > 0) {
                top.dashCooldown = Math.max(0, top.dashCooldown - dt);
            }
            
            // Fixed at 0 (instant recharge) under Super State
            if (top.superTimer !== undefined && top.superTimer > 0) {
                top.dashCooldown = 0;
            }

            // Track player's direction keys hold duration for long-press subsequent dash
            if (!top.isAI && top.controls) {
                const isClinging = (this.zombieSiegeActive && (this.siegeStatus === 'clinging' || this.siegeStatus === 'resolved_success') && top.id === this.siegeTargetPlayerId) || top.launchPadState !== undefined || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0) || this.transitionState === 'buffer';
                let dx = 0;
                let dy = 0;
                if (!isClinging) {
                    if (this.keys.has(top.controls.up)) dy -= 1;
                    if (this.keys.has(top.controls.down)) dy += 1;
                    if (this.keys.has(top.controls.left)) dx -= 1;
                    if (this.keys.has(top.controls.right)) dx += 1;
                }

                const isAnyDirPressed = (dx !== 0 || dy !== 0);
                if (isAnyDirPressed) {
                    top.dirKeyPressDuration = (top.dirKeyPressDuration ?? 0) + dt;
                } else {
                    top.dirKeyPressDuration = 0;
                }

                // If in standby, or if already in dash state and has been dashing for at least 0.5s, and held for more than 0.35s (維持長壓), execute subsequent dash
                const currentSpinVal = top.spin ?? 0;
                const canDash = (currentSpinVal >= 0) || (top.superTimer !== undefined && top.superTimer > 0);
                const inStandby = !top.state || top.state === 'standby';
                const isDashingLongEnough = top.state === 'dash' && (((top.maxDashDuration ?? 0) - (top.dashTimer ?? 0)) >= 0.5);
                const allowedState = inStandby || isDashingLongEnough;

                if (false && canDash && allowedState && ((top.dirKeyPressDuration ?? 0) >= 0.35)) {
                    if (isAnyDirPressed && !this.versusEndActive) {
                        const length = Math.hypot(dx, dy);
                        const ndx = dx / length;
                        const ndy = dy / length;

                        // Consume 1 grid of spin if not in super state!
                        if (!(top.superTimer !== undefined && top.superTimer > 0)) {
                            top.spin = Math.max(100, top.spin - 100);
                        }

                        // Transition player to "dash" state
                        top.state = 'dash';
                        top.dashInputHistory = [];
                        top.dashSpinHoldTimer = 0;
                        const currentSpin = top.spin ?? MAX_SPIN;
                        const displayedGrids = Math.max(1, Math.min(10, Math.floor(currentSpin / (top.maxSpin ?? MAX_SPIN) * 10)));
                        let scaledDuration = 0.25 + 2.75 * (currentSpin / MAX_SPIN);
                        if (displayedGrids >= 2) {
                            scaledDuration *= 0.70;
                            (top as any).dashIsGrid2To10 = true;
                        } else {
                            (top as any).dashIsGrid2To10 = false;
                        }
                        top.maxDashDuration = scaledDuration;
                        top.dashTimer = scaledDuration;
                        top.dashDirectionX = ndx;
                        top.dashDirectionY = ndy;
                        const baseLaunchSpeed = ((top as any).dashIsGrid2To10 ? 3200 : 1600) * 1.5;
                        top.vx = ndx * baseLaunchSpeed;
                        top.vy = ndy * baseLaunchSpeed;
                        top.dashCooldown = 0;
                        top.maxDashCooldown = 0;

                        top.dashCount = (top.dashCount ?? 0) + 1;
                        // Emit beautiful deep purple dash burst energy sparks to visualize subsequent consecutive dash activation!
                        EffectSystem.addPurpleDashParticles(this, top.x, top.y, 12, 5);
                        
                        // Initialize dash trails for beautiful afterimages
                        top.dashTrailTimer = Math.max(0.1, scaledDuration - 0.1); 
                        top.nextTrailSpawn = 0;

                        // Reset press duration on triggering a dash, so they must hold for another 0.35s for the next subsequent dash
                        top.dirKeyPressDuration = 0;
                    }
                }
            }

            // Update Dash Pending Timer for responsive 8-direction detection
            if (top.dashPendingTimer !== undefined && top.dashPendingTimer > 0) {
                top.dashPendingTimer -= dt;
                if (top.dashPendingTimer <= 0) {
                    top.dashPendingTimer = 0;
                    const isClinging = (this.zombieSiegeActive && (this.siegeStatus === 'clinging' || this.siegeStatus === 'resolved_success') && top.id === this.siegeTargetPlayerId) || top.launchPadState !== undefined || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0) || this.transitionState === 'buffer';
                    if (false && !this.versusEndActive && !top.isAI && top.controls && !isClinging) {
                        let dx = 0;
                        let dy = 0;
                        if (this.keys.has(top.controls.up)) dy -= 1;
                        if (this.keys.has(top.controls.down)) dy += 1;
                        if (this.keys.has(top.controls.left)) dx -= 1;
                        if (this.keys.has(top.controls.right)) dx += 1;

                        if (dx !== 0 || dy !== 0) {
                            const length = Math.hypot(dx, dy);
                            const ndx = dx / length;
                            const ndy = dy / length;

                            // Determine if this is a subsequent dash inside the dash state
                            const isSubsequentDash = (top.state === 'dash');

                            if (top.spin < 0 && !(top.superTimer !== undefined && top.superTimer > 0)) {
                                return; // Not enough spin to dash!
                            }

                            // Consume 1 grid of spin!
                            if (!(top.superTimer !== undefined && top.superTimer > 0)) {
                                top.spin = Math.max(100, top.spin - 100);
                            }

                            // Transition player to "dash" state
                            top.state = 'dash';
                            top.dashInputHistory = [];
                            top.dashSpinHoldTimer = 0;
                            top.dirKeyPressDuration = 0;
                            const currentSpin = top.spin ?? MAX_SPIN;
                            const displayedGrids = Math.max(1, Math.min(10, Math.floor(currentSpin / (top.maxSpin ?? MAX_SPIN) * 10)));
                            let scaledDuration = 0.25 + 2.75 * (currentSpin / MAX_SPIN);
                            if (displayedGrids >= 2) {
                                scaledDuration *= 0.70;
                                (top as any).dashIsGrid2To10 = true;
                            } else {
                                (top as any).dashIsGrid2To10 = false;
                            }
                            top.maxDashDuration = scaledDuration;
                            top.dashTimer = scaledDuration;
                            top.dashDirectionX = ndx;
                            top.dashDirectionY = ndy;
                            const baseLaunchSpeed = (top as any).dashIsGrid2To10 ? 3200 : 1600;
                            top.vx = ndx * baseLaunchSpeed;
                            top.vy = ndy * baseLaunchSpeed;
                            top.dashCooldown = 0;
                            top.maxDashCooldown = 0;

                            if (isSubsequentDash) {
                                top.dashCount = (top.dashCount ?? 0) + 1;
                                // Emit beautiful deep purple dash burst energy sparks to visualize subsequent consecutive dash activation!
                                EffectSystem.addPurpleDashParticles(this, top.x, top.y, 12, 5);
                            } else {
                                top.dashCount = 1;
                            }
                            
                            // Initialize dash trails for beautiful afterimages
                            top.dashTrailTimer = Math.max(0.1, scaledDuration - 0.1); // Extended to match longer dash duration
                            top.nextTrailSpawn = 0;
                        }
                    }
                }
            }

            // Dash & spin boost trails / afterimages spawner
            if (top.dashTrailTimer !== undefined && top.dashTrailTimer > 0) {
                top.dashTrailTimer = Math.max(0, top.dashTrailTimer - dt);
            }
            
            const isBreakoutOrbit = (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0);
            const shouldSpawnTrail = ((top.dashTrailTimer !== undefined && top.dashTrailTimer > 0) || isSpinning || isBreakoutOrbit) && !(top as any).isDeadState;
            if (shouldSpawnTrail) {
                if (top.nextTrailSpawn === undefined) {
                    top.nextTrailSpawn = 0;
                }
                top.nextTrailSpawn -= dt;
                if (top.nextTrailSpawn <= 0) {
                    top.nextTrailSpawn = 0.04; // Spawn afterimage every 40ms
                    const originalIdx = parseInt(top.id.split('_')[1], 10);
                    if (!isNaN(originalIdx)) {
                        this.afterimages.push({
                            id: 'trail_' + Math.random(),
                            ownerId: top.id,
                            x: top.x,
                            y: top.y,
                            angle: top.angle,
                            color: top.color,
                            spriteIdx: originalIdx,
                            life: 0.3,
                            maxLife: 0.3,
                            scale: GameUtils.getTopScale(this, top)
                        });
                    }
                }
            }

            // AI Cooldown AI Movement - Privilege impulsive dash has been fully disabled under Option A.
            // AI now chases objects gracefully purely via direction pushing inputs (just like human player keys).
            if (top.isAI && top.hp > 0 && top.spin > 0) {
                // Random AI spin boost mashing (halved from 150 to 75 to match player balance)
                if (Math.random() < 0.015) {
                    top.spin = Math.min(MAX_SPIN, top.spin + 75);
                    EffectSystem.addParticles(this, top.x, top.y, top.color, 5, 5);
                }
            }

            // Physics Update (Tops state machine)
            if (top.hp > 0 && top.spin > 0) {
                if (!top.state || top.state === 'standby') {
                    updateTopStandby(top, this,  dt);
                } else if (top.state === 'dash') {
                    top.dashTimer = (top.dashTimer ?? 0) - dt;
                    if (top.dashTimer <= 0) {
                            // End dash, transition back to standby state at current position without any sudden jump/teleport
                            top.state = 'standby';
                            const velocityAngle = Math.atan2(top.vy, top.vx);
                            // Make standby orbital motion tangent perfectly align with the incoming velocity vector
                            top.standbyAngle = velocityAngle + Math.PI / 2;
                            // Calculate orbital center so that next frame's position perfectly matches the end-dash position (no teleport)
                            top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                            top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                        } else {
                            // Speed decays from 1600 down to 400 with a physical quadratic curve - Increased by 30% per user request
                            const maxDur = top.maxDashDuration ?? 1.0;
                            const ratio = Math.max(0, Math.min(1, (top.dashTimer ?? 0) / maxDur));
                            let dashSpeed = (400 + 1200 * Math.pow(ratio, 2.0)) * 1.3 * 1.5;
                            if ((top as any).dashIsGrid2To10) {
                                dashSpeed *= 2.0;
                            }
                            let dx = top.dashDirectionX ?? 0;
                            let dy = top.dashDirectionY ?? 0;

                            // Apply inertia drift: always use the exact drift time (0.39s) and speed profiles corresponding to spin speed 3
                            // This ensures that regardless of initial spin state or total dash duration, the drift amplitude is completely uniform.
                            const driftDuration = 0.39;
                            if ((top.dashTimer ?? 0) <= driftDuration && (top as any).dashIsGrid2To10) {
                                if ((top as any).dashDriftSide === undefined) {
                                    (top as any).dashDriftSide = Math.random() < 0.5 ? 1 : -1;
                                }
                                const driftSide = (top as any).dashDriftSide;
                                const driftProgress = (driftDuration - (top.dashTimer ?? 0)) / driftDuration; // smoothly goes from 0 to 1 over exactly 0.39 seconds
                                
                                // Dynamic spiral/rotational curl. theta reaches up to 1.6 * PI (a perfect drift loop)
                                const driftAngle = driftSide * Math.sin(driftProgress * Math.PI * 0.5) * Math.PI * 1.6;
                                const cosA = Math.cos(driftAngle);
                                const sinA = Math.sin(driftAngle);
                                
                                const rDx = dx * cosA - dy * sinA;
                                const rDy = dx * sinA + dy * cosA;
                                dx = rDx;
                                dy = rDy;

                                // Implement a dynamic acceleration/deceleration speed wave over the drift progress.
                                // It decelerates rapidly as it breaks into the drift turn, reaches a low-speed curve peak,
                                // and then surges/whips forward as it snaps out of the drift loop for a smooth natural finish!
                                let speedMultiplier = 1.0;
                                if (driftProgress < 0.45) {
                                    const t = driftProgress / 0.45;
                                    // Slow down from 1.2x down to 0.52x
                                    speedMultiplier = 1.2 - 0.68 * Math.sin(t * Math.PI * 0.5);
                                } else {
                                    const t = (driftProgress - 0.45) / 0.55;
                                    // Accelerate/whip back out from 0.52x up to 1.35x
                                    speedMultiplier = 0.52 + 0.83 * Math.pow(t, 1.4);
                                }
                                dashSpeed = 820 * speedMultiplier * 1.3 * 1.5;

                                // Spawn gold friction sparks to emphasize ground contact of drifting
                                if (Math.random() < 0.35) {
                                    EffectSystem.addParticles(this, 
                                        top.x - dx * top.radius,
                                        top.y - dy * top.radius,
                                        '#fbbf24', // golden yellow sparks of high traction
                                        2,
                                        120,
                                        3
                                    );
                                }
                            } else {
                                (top as any).dashDriftSide = undefined;
                            }

                            top.vx = dx * dashSpeed;
                            top.vy = dy * dashSpeed;

                            // Apply position increment directly
                            top.x += top.vx * dt + dDefX;
                            top.y += top.vy * dt + dDefY;
                        }
                    }
            } else {
                // If dead or completely run out of spin, slow down rapidly
                top.vx *= 0.90;
                top.vy *= 0.90;
                top.x += top.vx * dt + dDefX;
                top.y += top.vy * dt + dDefY;
            }
            
            // Wall bounce
            CollisionSystem.handleWallBounce(this, top);
            
            // Z-axis physics (Flinging / Parabola)
            if ((top.zPos !== undefined && top.zPos > 0) || (top.zVel !== undefined && top.zVel > 0)) {
                if (top.zPos === undefined) top.zPos = 0;
                top.zPos += (top.zVel || 0) * dt;
                top.zVel = (top.zVel || 0) - 2500 * dt; // Gravity
                
                if (top.zPos <= 0) {
                    top.zPos = 0;
                    top.zVel = 0;
                    // Heavy slam impact
                    this.shockwaves.push({
                        x: top.x,
                        y: top.y,
                        radius: 5,
                        maxRadius: 200,
                        speed: 500,
                        color: top.color,
                        thickness: 15,
                        life: 0.4,
                        maxLife: 0.4
                    });
                    this.screenShakeTimer = 0.5;
                    this.screenShakeIntensity = 10;
                }
            }

            // Death state
            if ((top.hp <= 0 || top.spin <= 0) && !(top as any).isDeadState) {
                (top as any).isDeadState = true;
                top.hp = 0;
                top.spin = 0;
                top.vx = 0;
                top.vy = 0;
                top.state = 'standby';
                top.launchPadState = undefined;
                top.launchPadBossDamaged = false;
                top.launchPadTimer = undefined;
                (top as any).launchPadStartAngle = undefined;
                (top as any).launchPadDirX = undefined;
                (top as any).launchPadDirY = undefined;
                (top as any).launchPadSpeedTier = undefined;
                top.launchPadSpinCount = undefined;
                top.skillActiveTimer = 0;
                top.model2SkillTimer = 0;
                top.model3SkillTimer = 0;
                top.breakoutOrbitTimer = 0;
                top.dashTrailTimer = 0;
                top.isSpinning = false;
                top.virtualSpinHoldTimer = 0;
                top.axisTrail = [];
                this.afterimages = this.afterimages.filter(img => img.ownerId !== top.id);
                this.phantomClones = this.phantomClones.filter(pc => pc.ownerId !== top.id);
                SoundSystem.play('SE-Dizzy1');
                
                EffectSystem.addParticles(this, top.x, top.y, top.color || '#888888', 25, 200, 8);
                
                this.screenShakeTimer = 0.4;
                this.screenShakeIntensity = 5;
            }
        });
        
        // ─── 核心強化氣旋判定範圍（傷害1點） ───
        this.tops.forEach(top => {
            // 轉速 5 格以上（top.spin >= 500）且處於 standby 繞行狀態並正在旋轉
            const isEnhanced = top.state === 'standby' && top.isSpinning && top.spin >= 500;
            if (!isEnhanced) return;

            // 圓形攻擊判定半徑等同強力氣旋特效的半徑大小 (top.radius + 100 像素)
            const cycloneRadius = top.radius + 80;

            // 1. 判定對殭屍的範圍攻擊
            this.zombies.forEach(z => {
                if (z.markForDeletion || z.hp <= 0 || (z as any).isSiegeZombie) return;

                const dist = Math.hypot(z.x - top.x, z.y - top.y);
                // 圓形相交判定
                if (dist <= cycloneRadius + z.radius) {
                    if (z.hitCooldown === undefined || z.hitCooldown <= 0) {
                        const isBoss = z.type === 'zombie_boss';
                        GameUtils.applyDamageToZombie(this, z, 1, top.id);
                        if (isBoss) SoundSystem.play('SE-Explo1');
                        z.flashTimer = isBoss ? 0.35 : 0.15;
                        z.hitCooldown = isBoss ? 1.0 : 0.25;

                        // 產生對應殭屍代表色的衝擊粒子特效
                        const isBig = z.type === 'zombie_big' || z.type === 'zombie_bomb' || z.type === 'zombie_bouncing';
                        let mainColor = '#22c55e';
                        if (isBoss) {
                            mainColor = '#ea580c';
                        } else if (z.type === 'zombie_big') {
                            mainColor = '#9333ea';
                        } else if (z.type === 'zombie_bomb') {
                            mainColor = '#f97316';
                        } else if (z.type === 'zombie_bouncing') {
                            mainColor = '#be185d';
                        }
                        
                        const angle = Math.atan2(z.y - top.y, z.x - top.x);
                        const contactX = top.x + Math.cos(angle) * top.radius;
                        const contactY = top.y + Math.sin(angle) * top.radius;

                        EffectSystem.addParticles(this, contactX, contactY, mainColor, 8, 160, 4);
                        EffectSystem.addParticles(this, contactX, contactY, '#ffffff', 4, 200, 3);

                        if (isBoss && !top.isAI) {
                            // 1. Add central star-shaped burst
                            this.particles.push({
                                x: contactX,
                                y: contactY,
                                vx: 0,
                                vy: 0,
                                life: 0.30, // 0.45 / 1.5 = 0.30 (50% speedup)
                                maxLife: 0.30,
                                color: '#f97316',
                                size: 100, // scaled slightly smaller for skill sweeping
                                isBossStarExplosion: true,
                                angle: Math.random() * Math.PI * 2,
                                rotationSpeed: (Math.random() - 0.5) * 3 * 1.5 // 50% faster rotation
                            });

                            // 2. Add radiating orange-yellow star sparks
                            const sparkCount = 6;
                            for (let i = 0; i < sparkCount; i++) {
                                const baseAng = (i / sparkCount) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
                                const sparkSpeed = (150 + Math.random() * 180) * 1.5; // 50% faster flying speed
                                const colors = ['#f97316', '#facc15', '#ea580c', '#eab308'];
                                const chosenColor = colors[Math.floor(Math.random() * colors.length)];
                                
                                this.particles.push({
                                    x: contactX,
                                    y: contactY,
                                    vx: Math.cos(baseAng) * sparkSpeed,
                                    vy: Math.sin(baseAng) * sparkSpeed,
                                    life: (0.35 + Math.random() * 0.15) / 1.5, // 50% speedup
                                    maxLife: 0.5 / 1.5,
                                    color: chosenColor,
                                    size: 14 + Math.random() * 8,
                                    isStarSpark: true,
                                    angle: Math.random() * Math.PI * 2,
                                    rotationSpeed: (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 6) * 1.5 // 50% faster rotation
                                });
                            }
                        }

                        // 計算並處理殭屍死亡
                        if (z.hp <= 0) {
                            if (!GameUtils.handleZombieDeath(this, z, top.id)) return;
                            z.markForDeletion = true;
                            EffectSystem.spawnSkillKillExplosion(this, z.x, z.y, z.type === 'zombie_boss');
                            const match = top.id.match(/\d+/);
                            if (match) {
                                const idx = parseInt(match[0], 10);
                                this.spawnTicket(z.x, z.y, z.type, idx, z.id);
                            }
                            top.kills = (top.kills ?? 0) + 1;

                            // 觸發殭屍死亡時的擴大膨脹衝擊波
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
                        }
                    }
                }
            });

            // 2. 判定對其他玩家陀螺的攻擊 (如在 Versus 模式下)
            this.tops.forEach(otherTop => {
                if (otherTop.id === top.id || otherTop.markForDeletion || otherTop.isExploding) return;

                const dist = Math.hypot(otherTop.x - top.x, otherTop.y - top.y);
                if (dist <= cycloneRadius + otherTop.radius) {
                    if ((otherTop.hitCooldown === undefined || otherTop.hitCooldown <= 0) &&
                        (otherTop.cycloneHitCooldown === undefined || otherTop.cycloneHitCooldown <= 0)) {
                        otherTop.hp = Math.max(0, otherTop.hp - 1);
                        otherTop.hitCooldown = 1.0; // 1-second invulnerability protection
                        otherTop.cycloneHitCooldown = 0.25; // 限制受擊冷卻（每 0.25 秒只能扣 1 點）
                        otherTop.hpLossTimer = 0.5;
                        otherTop.visualHp = otherTop.visualHp !== undefined ? Math.max(otherTop.hp, otherTop.visualHp) : otherTop.hp;

                        // 產生炫麗的陀螺接觸電光摩擦粒子
                        const angle = Math.atan2(otherTop.y - top.y, otherTop.x - top.x);
                        const contactX = top.x + Math.cos(angle) * top.radius;
                        const contactY = top.y + Math.sin(angle) * top.radius;

                        EffectSystem.addParticles(this, contactX, contactY, top.color, 8, 160, 4);
                        EffectSystem.addParticles(this, contactX, contactY, '#ffffff', 4, 200, 3);
                    }
                }
            });
        });

        // Update Zombies
        const allTopsAlive = this.tops.filter(t => !t.markForDeletion && !t.isExploding && !(t as any).isDeadState);
        const zombieTargets = allTopsAlive.filter(t => {
            const isClinging = this.zombieSiegeActive && t.id === this.siegeTargetPlayerId;
            const isOnLaunchPad = t.launchPadState !== undefined;
            return !isClinging && !isOnLaunchPad;
        });
        updateZombies.call(this, dt, zombieTargets);

        // Check laser beam collisions for any active beams
        this.zombies.forEach(z => {
            if (z.markForDeletion) return;
            if (z.type === 'zombie_boss' && (z as any).bossAttackState === 'dash') {
                const boss = z as any;
                const dirX = boss.bossDashDirectionX ?? 1;
                const dirY = boss.bossDashDirectionY ?? 0;
                this.tops.forEach(top => {
                    if (top.markForDeletion || top.isExploding || (top.skillActiveTimer !== undefined && top.skillActiveTimer > 0)) return;
                    if (checkRayCircleCollision(boss.x, boss.y, dirX, dirY, top.x, top.y, top.radius || TOP_RADIUS, 128)) {
                        // Deal laser beam damage!
                        if (top.hitCooldown === undefined || top.hitCooldown <= 0) {
                            const isInvulnerable = (top.superTimer !== undefined && top.superTimer > 0) || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0);
                            if (!isInvulnerable) {
                                top.hitCooldown = 1.0; // 1 second protection
                                top.flashTimer = 0.25;
                                top.damageShockTimer = 0.45;
                                top.hpLossTimer = 0.5;
                                top.visualHp = top.visualHp !== undefined ? Math.max(top.hp, top.visualHp) : top.hp;
                                EffectSystem.addParticles(this, top.x, top.y, '#ef4444', 35, 450, 10);
                            } else {
                                EffectSystem.addParticles(this, top.x, top.y, '#fbbf24', 25, 300, 10);
                            }
                        }
                        if (top.isAI) {
                            this.screenShakeTimer = 0.8;
                        }
                        
                        // Push back
                        const dx = top.x - boss.x;
                        const dy = top.y - boss.y;
                        const dist = Math.hypot(dx, dy) || 1;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const bounceForce = 1500;
                        
                        top.vx = nx * bounceForce;
                        top.vy = ny * bounceForce;
                        
                        if (top.state === 'dash') {
                            top.state = 'standby';
                            top.dashTimer = 0;
                            const velocityAngle = Math.atan2(ny, nx);
                            top.standbyAngle = velocityAngle + Math.PI / 2;
                            top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                            top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                        }
                        if (top.state === 'standby') {
                            top.standbyCenterVx = nx * bounceForce;
                            top.standbyCenterVy = ny * bounceForce;
                        }
                    }
                });
            } else if (z.type === 'zombie_big' && (z as any).bigAttackState === 'dash') {
                const big = z as any;
                const dirX = big.bigDashDirectionX ?? 1;
                const dirY = big.bigDashDirectionY ?? 0;
                this.tops.forEach(top => {
                    if (top.markForDeletion || top.isExploding || (top.skillActiveTimer !== undefined && top.skillActiveTimer > 0)) return;
                    if (checkRayCircleCollision(big.x, big.y, dirX, dirY, top.x, top.y, top.radius || TOP_RADIUS, 64)) {
                        // Deal laser beam damage!
                        if (top.hitCooldown === undefined || top.hitCooldown <= 0) {
                            const isInvulnerable = (top.superTimer !== undefined && top.superTimer > 0) || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0);
                            if (!isInvulnerable) {
                                top.hitCooldown = 1.0; // 1 second protection
                                top.flashTimer = 0.25;
                                top.damageShockTimer = 0.45;
                                top.hpLossTimer = 0.5;
                                top.visualHp = top.visualHp !== undefined ? Math.max(top.hp, top.visualHp) : top.hp;
                                EffectSystem.addParticles(this, top.x, top.y, '#ef4444', 25, 350, 8);
                            } else {
                                EffectSystem.addParticles(this, top.x, top.y, '#fbbf24', 15, 250, 6);
                            }
                        }
                        if (top.isAI) {
                            this.screenShakeTimer = 0.5;
                        }
                        
                        // Push back
                        const dx = top.x - big.x;
                        const dy = top.y - big.y;
                        const dist = Math.hypot(dx, dy) || 1;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        const bounceForce = 1100;
                        
                        top.vx = nx * bounceForce;
                        top.vy = ny * bounceForce;
                        
                        if (top.state === 'dash') {
                            top.state = 'standby';
                            top.dashTimer = 0;
                            const velocityAngle = Math.atan2(ny, nx);
                            top.standbyAngle = velocityAngle + Math.PI / 2;
                            top.standbyCenterX = top.x - Math.cos(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                            top.standbyCenterY = top.y - Math.sin(top.standbyAngle) * getStandbyRadiusForModel(top, this,  top.standbyAngle);
                        }
                        if (top.state === 'standby') {
                            top.standbyCenterVx = nx * bounceForce;
                            top.standbyCenterVy = ny * bounceForce;
                        }
                    }
                });
            }
        });
        
        // --- PHYSICS & COLLISIONS ---
        const activeEntities = [...this.tops.filter(t => !t.isExploding), ...this.zombies.filter(z => !(z as any).isDying), ...this.obstacles, ...this.items].filter(e => !e.markForDeletion);
        
        for (let i = 0; i < activeEntities.length; i++) {
            for (let j = i + 1; j < activeEntities.length; j++) {
                const a = activeEntities[i];
                const b = activeEntities[j];
                
                if (checkCollision(a, b)) {
                    CollisionSystem.handleCollision(this, a, b);
                }
            }
        }

        // --- SPIKE OBSTACLES COLLISION ---
        const spikes = CollisionSystem.getSpikeTriangles(this);
        const collidableSpikeEntities = [...this.tops.filter(t => !t.isExploding), ...this.zombies.filter(z => !(z as any).isDying)].filter(e => {
            if (e.markForDeletion) return false;
            if (e.type === 'zombie_boss') {
                return false; // Boss is completely immune to spike collisions and spike damage
            }
            return true;
        });
        collidableSpikeEntities.forEach(e => {
            if (e.type === 'top' && (e as Top).launchPadState !== undefined) {
                return;
            }
            spikes.forEach(spike => {
                if (spike.height <= 2) return; // Skip if spike is barely visible
                
                const res = resolveCircleTriangleCollision(
                    e as any,
                    spike.x1, spike.y1,
                    spike.x2, spike.y2,
                    spike.x3, spike.y3,
                    1.4 // highly bouncy spike rebounds!
                );
                
                if (res && res.impactForce > 0) {
                    if (e.type === 'top') {
                        const top = e as Top;
                        
                        // 2.玩家撞到場地尖刺機關時，會受到2點傷害。
                        const isInvulnerable = (top.superTimer !== undefined && top.superTimer > 0) || (top.breakoutOrbitTimer !== undefined && top.breakoutOrbitTimer > 0) || (top as any).isDeadState;
                        if (!isInvulnerable && (top.hitCooldown === undefined || top.hitCooldown <= 0)) {
                            top.hp -= 2;
                            SoundSystem.play('SE-Hurt1');
                            if (top.hp < 0) top.hp = 0;
                            top.hitCooldown = 1.0;
                            
                            // Visual feedback for spike damage
                            this.screenShakeIntensity = 12;
                            this.screenShakeTimer = 0.5;
                        }

                        // Generates custom grey particles at the precise collision edge point
                        const cX = e.x - res.nx * e.radius;
                        const cY = e.y - res.ny * e.radius;
                        EffectSystem.addChainsawSparkParticles(this, cX, cY, res.nx, res.ny, 24, 1.0, top.spin);

                        // Apply exact ±15 deg random rotation modification to spike rebounds
                        const bounceAngle = (Math.random() < 0.5 ? 15 : -15) * Math.PI / 180;
                        const bCos = Math.cos(bounceAngle);
                        const bSin = Math.sin(bounceAngle);
                        
                        const rx = top.vx * bCos - top.vy * bSin;
                        const ry = top.vx * bSin + top.vy * bCos;
                        top.vx = rx;
                        top.vy = ry;

                        if (top.state === 'dash') {
                            const dx = top.dashDirectionX ?? 0;
                            const dy = top.dashDirectionY ?? 0;
                            const dotValue = dx * res.nx + dy * res.ny;
                            if (dotValue < 0) { // moving towards the face
                                top.dashDirectionX = dx - 2 * dotValue * res.nx;
                                top.dashDirectionY = dy - 2 * dotValue * res.ny;
                            }
                            // Sync rotation of the reflected dash vector coordinates
                            const rDx = (top.dashDirectionX ?? 0) * bCos - (top.dashDirectionY ?? 0) * bSin;
                            const rDy = (top.dashDirectionX ?? 0) * bSin + (top.dashDirectionY ?? 0) * bCos;
                            top.dashDirectionX = rDx;
                            top.dashDirectionY = rDy;

                            // Reset velocity directly in the rebounded direction
                            top.vx = top.dashDirectionX * 1400;
                            top.vy = top.dashDirectionY * 1400;
                        }
                    }
                }
            });
        });

        // --- CONCRETE BLOCKS COLLISION ---
        // Decrement hit cooldowns for concrete blocks
        this.concreteBlocks.forEach(block => {
            const extra = block as any;
            if (extra.hitCooldown !== undefined && extra.hitCooldown > 0) {
                extra.hitCooldown -= dt;
            }
            if (block.flashTimer !== undefined && block.flashTimer > 0) {
                block.flashTimer = Math.max(0, block.flashTimer - dt);
            }
        });

        const collidableEntities = [...this.tops.filter(t => !t.isExploding), ...this.zombies].filter(e => !e.markForDeletion);
        collidableEntities.forEach(e => {
            if (e.type === 'top' && (e as Top).launchPadState !== undefined) {
                return;
            }
            if (e.type === 'zombie_boss') {
                const boss = e as Zombie;
                if (boss.bossAttackState === 'dash' || boss.bossAttackState === 'warning' || boss.bossAttackState === 'earthquake_leap' || boss.bossAttackState === 'struggle_charge' || boss.bossAttackState === 'struggle_clash') {
                    this.concreteBlocks.forEach(block => {
                        if (!block.markForDeletion && checkCircleBoxCollision(boss, block)) {
                            if (boss.bossAttackState === 'dash') {
                                block.markForDeletion = true;
                                block.durability = 0;
                                // Crumble explosion particles
                                EffectSystem.addParticles(this, block.x, block.y, '#64748b', 60, 400, 12);
                                EffectSystem.addParticles(this, block.x, block.y, '#334155', 40, 300, 8);
                                EffectSystem.addParticles(this, block.x, block.y, '#fbbf24', 20, 200, 5); // Warning sparks
                                this.screenShakeTimer = 0.8;
                            }
                        }
                    });
                    return; // Skip standard concrete block collison resolution so boss charges through unaffected
                }
            } else if (e.type === 'zombie_big') {
                const big = e as any;
                if (big.bigAttackState === 'dash' || big.bigAttackState === 'warning') {
                    this.concreteBlocks.forEach(block => {
                        if (!block.markForDeletion && checkCircleBoxCollision(big, block)) {
                            if (big.bigAttackState === 'dash') {
                                block.markForDeletion = true;
                                block.durability = 0;
                                // Crumble explosion particles with custom cyber purple styling
                                EffectSystem.addParticles(this, block.x, block.y, '#64748b', 40, 300, 10);
                                EffectSystem.addParticles(this, block.x, block.y, '#9333ea', 20, 200, 6); // purple sparks
                                this.screenShakeTimer = 0.5;
                            }
                        }
                    });
                    return; // Skip standard concrete block collision resolution so Big Zombie charges through unaffected
                }
            }

            this.concreteBlocks.forEach(block => {
                const res = resolveCircleBoxCollision(e as any, block, 1.1); // Bouncy concrete rebounds
                if (res) {
                    if (e.type === 'top') {
                        const top = e as Top;
                        const blockExtra = block as any;

                        // Apply exact ±15 deg random rotation modification to concrete block rebounds
                        const bounceAngle = (Math.random() < 0.5 ? 15 : -15) * Math.PI / 180;
                        const bCos = Math.cos(bounceAngle);
                        const bSin = Math.sin(bounceAngle);

                        const rx = top.vx * bCos - top.vy * bSin;
                        const ry = top.vx * bSin + top.vy * bCos;
                        top.vx = rx;
                        top.vy = ry;
                        
                        // Decrement block durability on top collisions with cooldown protection
                        if (blockExtra.hitCooldown === undefined || blockExtra.hitCooldown <= 0) {
                            block.durability = (block.durability ?? 5) - 1;
                            block.flashTimer = 0.15; // Set flash timer to 150ms
                            blockExtra.hitCooldown = 0.25; // 250ms collision invulnerability window to prevent multi-hit overlapping
                            
                            // Visual impact effects (stone fragments / dust) - generated at the precise edge contact point
                            const cX = e.x - res.nx * e.radius;
                            const cY = e.y - res.ny * e.radius;
                            EffectSystem.addChainsawSparkParticles(this, cX, cY, res.nx, res.ny, 24, 1.0, top.spin);
                            
                            if (block.durability <= 0) {
                                block.markForDeletion = true;
                                // Crumble explosion particles
                                EffectSystem.addParticles(this, block.x, block.y, '#64748b', 60, 400, 12);
                                EffectSystem.addParticles(this, block.x, block.y, '#334155', 40, 300, 8);
                                EffectSystem.addParticles(this, block.x, block.y, '#fbbf24', 20, 200, 5); // Warning sparks
                            }
                        } else {
                            // Gentle spark from sliding contact - generated at the precise edge contact point
                            if (res.impactForce > 40) {
                                const cX = e.x - res.nx * e.radius;
                                const cY = e.y - res.ny * e.radius;
                                EffectSystem.addChainsawSparkParticles(this, cX, cY, res.nx, res.ny, 12, 1.0, top.spin);
                            }
                        }
                        
                        if (top.state === 'dash') {
                            const dx = top.dashDirectionX ?? 0;
                            const dy = top.dashDirectionY ?? 0;
                            const dotValue = dx * res.nx + dy * res.ny;
                            if (dotValue < 0) { // moving towards the block face
                                top.dashDirectionX = dx - 2 * dotValue * res.nx;
                                top.dashDirectionY = dy - 2 * dotValue * res.ny;
                            }

                            // Sync rotation of the reflected dash vector coordinates
                            const rDx = (top.dashDirectionX ?? 0) * bCos - (top.dashDirectionY ?? 0) * bSin;
                            const rDy = (top.dashDirectionX ?? 0) * bSin + (top.dashDirectionY ?? 0) * bCos;
                            top.dashDirectionX = rDx;
                            top.dashDirectionY = rDy;
                            
                            // Reset velocity directly in the rebounded direction
                            top.vx = top.dashDirectionX * 1400;
                            top.vy = top.dashDirectionY * 1400;
                        }
                    }
                }
            });
        });
        
        // Update afterimages
        this.afterimages.forEach(img => {
            img.life -= dt;
        });
        this.afterimages = this.afterimages.filter(img => img.life > 0);

        // Update slash lines
        this.slashLines.forEach(line => {
            line.life -= dt;
        });
        this.slashLines = this.slashLines.filter(line => line.life > 0);

        // Update expanding X-slashes
        this.xSlashes.forEach(slash => {
            slash.life -= dt;
            slash.size = Math.min(slash.maxSize, slash.size + slash.speed * dt);
        });
        this.xSlashes = this.xSlashes.filter(slash => slash.life > 0);

        // Update active projectiles
        EffectSystem.updateProjectiles(this, dt);

        // Update particles
        this.particles.forEach(p => {
            if (p.isSpark) {
                // Apply physics friction so sparks slow down over time
                p.vx *= Math.exp(-2.5 * dt);
                p.vy *= Math.exp(-2.5 * dt);
                // Sparks shrink as they burn out
                p.size = Math.max(0.2, p.size - dt * 3.5);
            } else if (p.isStarSpark === true || p.isBossStarExplosion === true) {
                // Apply slight drag and rotation
                p.vx *= Math.exp(-1.8 * dt);
                p.vy *= Math.exp(-1.8 * dt);
                if (p.angle !== undefined && p.rotationSpeed !== undefined) {
                    p.angle += p.rotationSpeed * dt;
                }
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
        });
        this.particles = this.particles.filter(p => p.life > 0);

        // Update expanding shockwaves
        this.shockwaves.forEach(sw => {
            sw.radius += sw.speed * dt;
            sw.life -= dt;
        });
        this.shockwaves = this.shockwaves.filter(sw => sw.life > 0);
        
        // Update obstacles (e.g. decrement flashTimer)
        this.obstacles.forEach(o => {
            if (o.flashTimer !== undefined && o.flashTimer > 0) {
                o.flashTimer = Math.max(0, o.flashTimer - dt);
            }
        });

        // Update items
        this.items.forEach(item => {
            if (item.type === 'item_ticket' || item.type === 'item_key') {
                if (item.hoverTimer !== undefined && item.hoverTimer > 0) {
                    item.hoverTimer -= dt;
                    item.x += item.vx * dt;
                    item.y += item.vy * dt;
                    item.vx *= 0.95;
                    item.vy *= 0.95;
                    
                    if (item.z !== undefined && item.vz !== undefined) {
                        item.z += item.vz * dt;
                        item.vz -= 1200 * dt; // Gravity
                        if (item.z < 0) {
                            item.z = 0;
                            item.vz *= -0.5; // Bounce
                        }
                    }
                } else if (item.targetPlayerId) {
                    let targetX = CANVAS_W / 2;
                    let targetY = CANVAS_H / 2;
                    const padding = 24;
                    const barW = 210;
                    
                    if (item.targetPlayerId === 'ui_keys') {
                        // Target the key UI area (next to timer at top center)
                        const timerBoxW = 100; // approximate
                        targetX = (CANVAS_W + timerBoxW) / 2 + 50; 
                        targetY = 30; // approx center of top UI bar
                    }
                    else if (item.targetPlayerId === 'top_0') { targetX = padding + barW / 2; targetY = CANVAS_H - 130 + 50; }
                    else if (item.targetPlayerId === 'top_1') { targetX = CANVAS_W - barW - padding + barW / 2; targetY = CANVAS_H - 130 + 50; }
                    else if (item.targetPlayerId === 'top_2') { targetX = padding + barW / 2; targetY = padding + 50; }
                    else if (item.targetPlayerId === 'top_3') { targetX = CANVAS_W - barW - padding + barW / 2; targetY = padding + 50; }

                    // Apply camera transform to UI targets
                    targetX = (targetX - CANVAS_W / 2) / this.camera.zoom + this.camera.x;
                    targetY = (targetY - CANVAS_H / 2) / this.camera.zoom + this.camera.y;

                    const dx = targetX - item.x;
                    const dy = targetY - item.y;
                    const dist = Math.hypot(dx, dy);
                    const speed = 1500;
                    if (dist < speed * dt) {
                        item.x = targetX;
                        item.y = targetY;
                        item.markForDeletion = true;
                        
                        if (item.type === 'item_key') {
                            this.collectiveKeys = (this.collectiveKeys || 0) + 1;
                            SoundSystem.play('pickupCoin_1');
                            if (this.collectiveKeys >= 5) {
                                this.triggerBossTransition();
                            }
                        } else if (item.amount) {
                            const match = item.targetPlayerId?.match(/\d+/);
                            if (match) {
                                this.addScore(parseInt(match[0], 10), item.amount);
                            }
                        }
                    } else {
                        item.x += (dx / dist) * speed * dt;
                        item.y += (dy / dist) * speed * dt;
                    }
                }
            }
        });
        
        // Cleanup dead
        this.tops = this.tops.filter(t => !t.markForDeletion);
        this.zombies = this.zombies.filter(z => !z.markForDeletion);
        this.obstacles = this.obstacles.filter(o => !o.markForDeletion);
        this.items = this.items.filter(i => !i.markForDeletion);
        this.concreteBlocks.forEach(cb => {
            if (cb.markForDeletion) {
                SoundSystem.play('SE-Explo1');
            }
        });
        this.concreteBlocks = this.concreteBlocks.filter(cb => !cb.markForDeletion);
        
        // Dynamically calculate camera zoom/pan coordinates based on active tops
        let targetCenterX = CANVAS_W / 2;
        let targetCenterY = CANVAS_H / 2;
        let targetZoom = 1.0;

        if (!this.introActive && this.tops.length > 0) {
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            this.tops.forEach(top => {
                if (top.state === 'standby' && top.standbyCenterX !== undefined && top.standbyCenterY !== undefined) {
                    const r = getStandbyRadius(top, this);
                    minX = Math.min(minX, top.standbyCenterX - r);
                    maxX = Math.max(maxX, top.standbyCenterX + r);
                    minY = Math.min(minY, top.standbyCenterY - r);
                    maxY = Math.max(maxY, top.standbyCenterY + r);
                } else {
                    minX = Math.min(minX, top.x);
                    maxX = Math.max(maxX, top.x);
                    minY = Math.min(minY, top.y);
                    maxY = Math.max(maxY, top.y);
                }
            });
            
            targetCenterX = (minX + maxX) / 2;
            targetCenterY = (minY + maxY) / 2;
            
            // Padding limits to prevent the field of view from becoming too claustrophobic or fully standard
            const marginX = 450;
            const marginY = 280;
            const boxW = Math.max(maxX - minX + marginX, 1000);
            const boxH = Math.max(maxY - minY + marginY, 650);
            
            const zoomX = CANVAS_W / boxW;
            const zoomY = CANVAS_H / boxH;
            
            // Limit target zoom to keep action focused and clear (Zoom disabled: locked to 1.0)
            targetZoom = 1.0;
        }

        targetCenterX = CANVAS_W / 2;
        targetCenterY = this.activeArenaCenterY;
        targetZoom = 1.0;

        // Smooth linear interpolation for the camera movement (responsive lerping)
        // With smooth, wiggle-free orbital targets, we can use slightly snappier speeds for fast action
        const zoomSpeed = 1.5;
        const panSpeed = 2.8;
        this.camera.zoom += (targetZoom - this.camera.zoom) * (1 - Math.exp(-zoomSpeed * dt));
        this.camera.x += (targetCenterX - this.camera.x) * (1 - Math.exp(-panSpeed * dt));
        this.camera.y += (targetCenterY - this.camera.y) * (1 - Math.exp(-panSpeed * dt));

        const anyPlayerOrbiting = this.tops.some(t => !t.isAI && t.isSpinning);
        SoundSystem.setOrbiting(anyPlayerOrbiting);

        this.checkWinCondition(dt);
    }
    

    checkWinCondition(dt: number) {
        if (this.gameMode === 'campaign') {
            // we remove the fail condition where all human players are dead, just keep the game running.
        } else if (this.gameMode === 'versus') {
            if (!this.introActive && !this.versusEndActive) {
                const aliveTops = this.tops.filter(t => !t.markForDeletion && !t.isExploding);
                
                if (aliveTops.length <= 1 || this.timeRemaining <= 0) {
                    this.versusEndActive = true;
                    this.versusEndTimer = 1.6;
                    
                    if (aliveTops.length === 1) {
                        const survivor = aliveTops[0];
                        const matchIndex = survivor.id.match(/\d+/);
                        if (matchIndex) {
                            const idx = parseInt(matchIndex[0], 10);
                            this.addScore(idx, 300); // 300 pts survivor bonus
                        }
                    }
                }
            }
        }
    }
    
    endGame(msg: string) {
        this.isGameOver = true;
        SoundSystem.setOrbiting(false);
        this.onGameOver(msg, this.participants);
    }

}
