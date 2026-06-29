export type EntityType = 'top' | 'zombie_small' | 'zombie_big' | 'zombie_boss' | 'zombie_bomb' | 'zombie_bouncing' | 'obstacle_barrel' | 'item_crate' | 'item_ticket' | 'item_key';

export interface Entity {
    id: string;
    type: EntityType;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    mass: number;
    markForDeletion: boolean;
    deflectionX?: number;
    deflectionY?: number;
    deflectionVx?: number;
    deflectionVy?: number;
    deadlockTimer?: number;
    deadlockPartnerId?: string;
    deadlockX?: number;
    deadlockY?: number;
    deadlockVibeX?: number;
    deadlockVibeY?: number;
    deadlockCooldownTimer?: number;
    struggleJitterX?: number;
    struggleJitterY?: number;
}

export interface Top extends Entity {
    type: 'top';
    hp: number;
    maxHp: number;
    coins?: number;
    keys?: number;
    spin: number;
    maxSpin: number;
    color: string;
    pilotColor: string;
    isAI: boolean;
    angle: number;
    score: number;
    label: string; // P1, P2..
    controls?: { up: string, down: string, left: string, right: string, spin: string, skill: string };
    inputAxes: { x: number, y: number };
    dashCooldown: number;
    maxDashCooldown?: number;
    dashTrailTimer?: number;
    nextTrailSpawn?: number;
    state?: 'standby' | 'dash';
    standbyCenterX?: number;
    standbyCenterY?: number;
    standbyAngle?: number;
    standbyCenterVx?: number;
    standbyCenterVy?: number;
    spinBoostFactor?: number;
    dashPendingTimer?: number;
    dashTimer?: number;
    maxDashDuration?: number;
    dashDirectionX?: number;
    dashDirectionY?: number;
    dashCount?: number;
    dashInputHistory?: number[];
    dashSpinHoldTimer?: number;
    dirKeyPressDuration?: number;
    breakoutOrbitTimer?: number;
    flashTimer?: number;
    isSpinning?: boolean;
    spinInputFactor?: number;
    isActivelyPushing?: boolean;
    joystickReboundTimer?: number;
    axisTrail?: { x: number; y: number; life: number; isDash?: boolean; isSpecialDash?: boolean }[];
    visualHp?: number;
    hpLossTimer?: number;
    damageShockTimer?: number;
    prevHp?: number;
    superTimer?: number; // remaining duration of "Super State" in seconds
    spinIdleTime?: number;
    lastDisplayedSpinGrids?: number;
    introZ?: number;
    introOrbitTime?: number;
    zPos?: number;
    zVel?: number;
    isExploding?: boolean;
    explosionTimer?: number;
    hitCooldown?: number;
    bounceTimer?: number;
    maxBounceTimer?: number;
    kills?: number;
    smoothSpin?: number;
    virtualSpinHoldTimer?: number;
    modelType?: number;
    smallZombieHitCooldown?: number;
    cycloneHitCooldown?: number;
    skillActiveTimer?: number;
    skillStartCenter?: { x: number; y: number };
    skillStrikeTimer?: number;
    skillDashCount?: number;
    skillDashTimer?: number;
    skillDashState?: 'dashing' | 'pausing';
    skillDashStartX?: number;
    skillDashStartY?: number;
    skillDashEndX?: number;
    skillDashEndY?: number;
    model2SkillTimer?: number;
    model2OrbAngle?: number;
    model2SkillHitCooldowns?: Map<string, number>;
    model3SkillTimer?: number;
    coopState?: {
        partnerId: string;
        centerX: number;
        centerY: number;
        cycle: number;
        phase: 'standoff' | 'retreat_rotate' | 'charge';
        timer: number;
        startAngle: number;
        isLeader: boolean;
        coopSpinCount: number;
        uiFillRatio?: number;
    };
    launchPadState?: 'prep_spinning' | 'charging' | 'flying' | 'dashing';
    launchPadBossDamaged?: boolean;
    launchPadSpinCount?: number;
    launchPadTimer?: number;
    contractRings?: { radius: number }[];
    contractRingTimer?: number;
    maxSpinHalos?: { radius: number; maxRadius: number; life: number; maxLife: number }[];
    customKnockbackTimer?: number;
    struggleMashCount?: number;
    struggleMashRequired?: number;
    aiMashTimer?: number;
    aiSpinTimer?: number;
    lowSpinSiegeTriggered?: boolean;
    lowSpinSiegeTimer?: number;
    spinTutorialTimer?: number;
    spinTutorialSpun?: boolean;
    isDeadState?: boolean;
}

export interface Zombie extends Entity {
    type: 'zombie_small' | 'zombie_big' | 'zombie_boss' | 'zombie_bomb' | 'zombie_bouncing';
    hp: number;
    maxHp: number;
    angle: number;
    speedMultiplier?: number;
    hitCooldown?: number;
    bounceTimer?: number;
    maxBounceTimer?: number;
    hitByDash?: boolean;
    chainedBounce?: boolean;
    knockbackSpeedStart?: number;
    flashTimer?: number;
    bossAttackState?: 'idle' | 'warning' | 'dash' | 'earthquake_leap' | 'struggle_charge' | 'struggle_clash';
    bossAttackTimer?: number;
    bossWarningTargetX?: number;
    bossWarningTargetY?: number;
    bossDashDirectionX?: number;
    bossDashDirectionY?: number;
    bossNextAttackTime?: number;
    bossSelectedAttack?: 'dash' | 'bomb' | 'earthquake' | 'struggle';
    bossWarningTargetId?: string;
    bossBombTargets?: { x: number; y: number }[];
    bigAttackState?: 'idle' | 'warning' | 'dash' | 'earthquake_leap';
    bigAttackTimer?: number;
    bigWarningTargetX?: number;
    bigWarningTargetY?: number;
    bigDashDirectionX?: number;
    bigDashDirectionY?: number;
    bigNextAttackTime?: number;
    bouncingAttackState?: 'idle' | 'warning' | 'bouncing';
    bouncingAttackTimer?: number;
    bouncingTargets?: { x: number; y: number }[];
    bouncingCurrentTargetIndex?: number;
    bouncingStartX?: number;
    bouncingStartY?: number;
    bouncingNextAttackTime?: number;
    wanderTimer?: number;
    wanderAngle?: number;
    introState?: 'walking_in' | 'jumping' | 'done';
    introWalkTargetX?: number;
    introWalkTargetY?: number;
    introJumpTargetX?: number;
    introJumpTargetY?: number;
    introTimer?: number;
    introZ?: number;
    hitCounts?: Map<string, number>;
}

export interface Obstacle extends Entity {
    type: 'obstacle_barrel';
    durability?: number;
    flashTimer?: number;
}

export interface Item extends Entity {
    type: 'item_crate' | 'item_ticket' | 'item_key';
    amount?: number;
    targetPlayerId?: string;
    hoverTimer?: number;
    z?: number;
    vz?: number;
}

export interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    color: string;
    size: number;
    isSpark?: boolean;
    isElectric?: boolean;
    isBossStarExplosion?: boolean;
    isStarSpark?: boolean;
    angle?: number;
    rotationSpeed?: number;
}

export interface ConcreteBlock {
    id: string;
    type: 'concrete_block';
    x: number;
    y: number;
    w: number;
    h: number;
    durability?: number;
    markForDeletion?: boolean;
    flashTimer?: number;
}

export interface Afterimage {
    id: string;
    ownerId?: string;
    x: number;
    y: number;
    angle: number;
    color: string;
    spriteIdx: number;
    life: number;
    maxLife: number;
    scale?: number;
}

export interface Projectile {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    ownerId: string;
    life: number;
    maxLife: number;
    damage: number;
    trail?: { x: number; y: number }[];
    hitIds?: string[];
    isBombBeam?: boolean;
}

export interface PhantomClone {
    id: string;
    centerX: number;
    centerY: number;
    x: number;
    y: number;
    radius: number;
    maxLife: number;
    life: number;
    color: string;
    ownerId: string;
    originalIdx: number;
    angle: number;
    orbitAngle: number;
    spin: number;
    hitCooldowns: Map<string, number>;
}

export interface PlayerStats {
    id: string;
    label: string;
    color: string;
    score: number;
    kills: number;
    isAI: boolean;
    isActive: boolean;
    modelType: number;
}
