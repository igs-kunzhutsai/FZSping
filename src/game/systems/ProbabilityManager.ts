/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Zombie } from '../types';

/**
 * ============================================================================
 * C++ PROBABILITY & WATER LEVEL BUFFER TRANSLATION (C++ 機率與水位控制轉換)
 * ============================================================================
 */

export enum TARGET_TYPE {
    AirdropBox = 0,
    BombMan = 1,
    CartonBoy = 2,
    ChampionChef = 3,
    FootballPlayer = 4,
    Frankenstein = 5,
    GargoyleGreen = 6,
    GraveRobber = 7,
    MexicoPerformer = 8,
    MobBoss = 9,
    Mummy = 10,
    Necromancer = 11,
    ZombieDog = 12,
    ZombieGirl = 13,
    ZombieMan = 14,
    ShootMiss = 15,
    GargoyleBlue = 16,
    GargoyleGold = 17,
    Weakness = 18,
    AirDropEnergy = 19,
    FrankensteinTime = 20,
    AirDropFrozer = 21,
    Frankenstein_LV2 = 22,
    MummyWeakness = 23,
    MummyStoneWeakness = 24,
    ROPE_MAX = 25,
    TARGET_TYPE_JP = 25,
    TARGET_MAX = 26
}

export enum BUF_TYPE {
    BUF_MEDAL = 0,
    BUF_MAIN = 1,
    BUF_PROPS = 2,
    BUF_MISSION = 3,
    BUF_SP = 4,
    BUF_BONUS = 5,
    BUF_ROCKET = 6,
    BUF_DOUBLE = 7,
    BUF_DOUBLE_BOX = 8,
    BUF_JP = 9,
    BUF_JP_SHARE = 10,
    BUF_JP_BOSS = 11,
    BUF_MAX = 12
}

export enum BUF_LV {
    BUF_LV_00 = 0,
    BUF_LV_01 = 1,
    BUF_LV_02 = 2,
    BUF_LV_03 = 3,
    BUF_LV_04 = 4,
    BUF_LV_05 = 5, // Default
    BUF_LV_06 = 6,
    BUF_LV_07 = 7,
    BUF_LV_08 = 8,
    BUF_LV_09 = 9,
    BUF_LV_10 = 10,
    BUF_LV_MAX = 11
}

export enum GAME_MODE {
    GAME_MODE_MAIN = 0,
    GAME_MODE_DOUBLE = 1,
    GAME_MODE_JP = 2,
    GAME_MISS_SHOOT = 3,
    GAME_MODE_MAX = 4
}

export enum BULLET_TYPE {
    BULLET_NORMAL = 0,
    BULLET_RANGE = 1,
    BULLET_ROCKET = 2,
    BULLET_AWAKE = 3,
    BULLET_LOCKON = 4,
    BULLET_CATCH = 5,
    BULLET_FLASH = 6,
    BULLET_MAX = 7
}

export enum RESULT_INFO {
    RESULT_INFO_BREAK = 0,
    RESULT_INFO_AWAKE = 1,
    RESULT_INFO_CREDIT = 2,
    RESULT_INFO_DIAMOND = 3,
    RESULT_INFO_HIT_TK = 4,
    RESULT_INFO_ADD_TIME = 5,
    RESULT_INFO_BOX = 6,
    RESULT_INFO_MAX = 7
}

export enum MUMMY_JP_BUF_TYPE {
    MUMMY_WEAKNESS_BUF = 0,
    MUMMY_JP_BUF = 1,
    MUMMY_LV1_JP_BUF = 2
}

// C++ cRopeHitInit
export const cRopeHitInit: number[] = [
    0,     // AirdropBox = 0
    2800,  // BombMan = 1 (黃色，中等體型，11票)
    200,   // CartonBoy = 2
    4000,  // ChampionChef = 3
    5200,  // FootballPlayer = 4 (粉紅色，最大體型，14票)
    300,   // Frankenstein = 5
    200,   // GargoyleGreen = 6
    1800,  // GraveRobber = 7 (紫色，最小體型，9票)
    5200,  // MexicoPerformer = 8
    2300,  // MobBoss = 9
    27300, // Mummy = 10
    0,     // Necromancer = 11
    200,   // ZombieDog = 12
    300,   // ZombieGirl = 13
    300,   // ZombieMan = 14
    0,     // ShootMiss = 15
    200,   // GargoyleBlue = 16
    200,   // GargoyleGold = 17
    400,   // Weakness = 18
    0,     // AirDropEnergy = 19
    0,     // FrankensteinTime = 20
    0,     // AirDropFrozer = 21
    500,   // Frankenstein_LV2 = 22
    20000, // MummyWeakness = 23
    300    // MummyStoneWeakness = 24
];

export class BufferManager {
    public energyPerCoin: number = 15;

    public setEnergyPerCoin(val: number) {
        this.energyPerCoin = val;
    }

    public pBuffer = {
        iBuffer: Array.from({ length: 4 }, () => Array(12).fill(0)), // [PLAYER_MAX][BUF_MAX]
        iBufferPlusCommon: Array(4).fill(0),
        ulEarlyShoot: Array(4).fill(0),
        ulBufferFloat: Array.from({ length: 4 }, () => Array(12).fill(0))
    };

    public pTicketBuffer = {
        iTicketBuf: Array(4).fill(0),
        iTicketBufLv: Array(4).fill(5) // BUF_LV_05
    };

    public ticketBufferRate_10 = 10;
    public ticketBufActivePlayers = 4;

    private static instance: BufferManager | null = null;

    public static getInstance(): BufferManager {
        if (!BufferManager.instance) {
            BufferManager.instance = new BufferManager();
        }
        return BufferManager.instance;
    }

    private constructor() {
        this.loadState();
    }

    public vBuffer_Reset() {
        this.ulBuffer_CalTicketBufferRate();

        for (let p = 0; p < 4; p++) {
            for (let i = 0; i < 12; i++) {
                this.pBuffer.iBuffer[p][i] = 0;
                this.pBuffer.ulBufferFloat[p][i] = 0;
            }
            this.pBuffer.iBufferPlusCommon[p] = 0;
            this.pBuffer.ulEarlyShoot[p] = 0;
        }
        this.vTicketBuf_Reset();
        this.saveState();
    }

    public ulBuffer_CalTicketBufferRate() {
        const DEF_TICKET_BASE = 25;
        const DEF_BULLET_BASE = 20;
        const ticketRate = 25;
        const creditSet = 20;
        
        this.ticketBufferRate_10 = Math.floor(((DEF_TICKET_BASE * 100) / DEF_BULLET_BASE) * 10 / ((ticketRate * 100) / creditSet));
        if (this.ticketBufferRate_10 <= 0) this.ticketBufferRate_10 = 10;
    }

    public vTicketBuf_Reset() {
        for (let p = 0; p < 4; p++) {
            this.pTicketBuffer.iTicketBuf[p] = 0;
            this.pTicketBuffer.iTicketBufLv[p] = 5;
        }
    }

    public ulBuffer_ReadBufferRate(type: number): number {
        const cBufRate = [
            [0, 5600, 2040, 2060, 900, 0, 200, 0, 400, 0, 0, 300], // MAIN mode rates
            [0, 0, 0, 0, 0, 0, 0, 11800, 700, 0, 0, 0],            // DOUBLE mode rates
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 9500, 0, 3000],            // JP mode rates
            [10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]                // MISS SHOOT
        ];
        return cBufRate[0][type] || 0;
    }

    public ulBuffer_ReadJPBufferRate(type: number): number {
        const cJPFixBufRate = [9500, 0, 0, 0, 3000];
        return cJPFixBufRate[type] || 0;
    }

    public ulBuffer_ReadMummyJPBufferRate(type: number): number {
        const cMummyJPBufRate = [5000, 11500, 5000, 6500, 3650];
        return cMummyJPBufRate[type] || 0;
    }

    public iBuffer_ReadBuf(plyr: number, type: number): number {
        if (plyr >= 4 || type >= 12) return -666;
        return this.pBuffer.iBuffer[plyr][type];
    }

    public iBuffer_GetLv(plyr: number, type: number): number {
        const cLvBase = [100, 200, 200, 100, 200, 200, 200, 400, 500, 100, 300, 1000];
        const ticketRate = 25;
        const SCALE_FACTOR = 2;
        
        if (plyr >= 4 || type >= 12) return 5;
        
        let iRtn = Math.floor(this.pBuffer.iBuffer[plyr][type] / (ticketRate * (cLvBase[type] * SCALE_FACTOR) * 10 / this.ticketBufferRate_10));
        iRtn += 5; // BUF_LV_05
        
        if (iRtn < 0) iRtn = 0;
        if (iRtn > 10) iRtn = 10;
        return iRtn;
    }

    public vBuffer_AddValue(plyr: number, type: number, value: number) {
        if (plyr < 4 && type < 12) {
            this.pBuffer.iBuffer[plyr][type] += value;
        }
        this.saveState();
    }

    public vBuffer_SubValue(plyr: number, type: number, value: number) {
        if (plyr < 4 && type < 12) {
            this.pBuffer.iBuffer[plyr][type] -= value;
        }
        this.saveState();
    }

    public vBuffer_AddTK(plyr: number, type: number, tk: number) {
        const DEF_BUF_BASE = 100;
        if (plyr < 4 && type < 12) {
            this.pBuffer.iBuffer[plyr][type] += (tk * DEF_BUF_BASE);
        }
        this.saveState();
    }

    public vBuffer_SubTK(plyr: number, type: number, tk: number) {
        if (plyr < 4 && type < 12) {
            let actualType = type;
            if (this.iBuffer_GetLv(plyr, actualType) < 5) { // BUF_LV_05
                if (this.iBuffer_GetLv(plyr, BUF_TYPE.BUF_JP) > 8 && actualType !== BUF_TYPE.BUF_JP) {
                    actualType = BUF_TYPE.BUF_JP;
                }

                if (actualType === BUF_TYPE.BUF_MISSION) {
                    if (this.iBuffer_GetLv(plyr, actualType) < 3) {
                        actualType = BUF_TYPE.BUF_MAIN;
                    }
                }

                if (actualType === BUF_TYPE.BUF_PROPS) {
                    if (this.iBuffer_GetLv(plyr, actualType) < 5) {
                        actualType = BUF_TYPE.BUF_MAIN;
                        if (this.iBuffer_GetLv(plyr, actualType) >= 8) {
                            actualType = BUF_TYPE.BUF_MISSION;
                        }
                    }
                }

                if (actualType === BUF_TYPE.BUF_SP) {
                    if (this.iBuffer_GetLv(plyr, actualType) < 3) {
                        actualType = BUF_TYPE.BUF_MAIN;
                    }
                }

                if (actualType === BUF_TYPE.BUF_JP_SHARE) {
                    if (this.iBuffer_GetLv(plyr, actualType) < 3) {
                        actualType = BUF_TYPE.BUF_JP_BOSS;
                    }
                }

                if (actualType === BUF_TYPE.BUF_DOUBLE_BOX) {
                    if (this.iBuffer_GetLv(plyr, actualType) < 3 && this.iBuffer_GetLv(plyr, BUF_TYPE.BUF_DOUBLE) > 5) {
                        actualType = BUF_TYPE.BUF_DOUBLE;
                    }
                }
            }

            const DEF_BUF_BASE = 100;
            this.pBuffer.iBuffer[plyr][actualType] -= (tk * DEF_BUF_BASE);
        }
        this.saveState();
    }

    public vBuffer_AddGame(plyr: number, mode: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const DEF_BUF_FLOAT = 100;
        const coinRate = 1;
        const creditSet = this.energyPerCoin;

        const cBufRate = [
            [0, 5600, 2040, 2060, 900, 0, 200, 0, 400, 0, 0, 300], // MAIN
            [0, 0, 0, 0, 0, 0, 0, 11800, 700, 0, 0, 0],            // DOUBLE
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 9500, 0, 3000],            // JP
            [10000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]                // MISS
        ];

        for (let i = 0; i < 12; i++) {
            let bufferRate = cBufRate[mode][i];
            if (mode === GAME_MODE.GAME_MODE_JP) {
                if (i === BUF_TYPE.BUF_JP) {
                    bufferRate = this.ulBuffer_ReadJPBufferRate(0); // JP_BUF_BOSS_1
                } else if (i === BUF_TYPE.BUF_JP_BOSS) {
                    bufferRate = this.ulBuffer_ReadJPBufferRate(4); // JP_BUF_KILL
                }
            }

            const addTemp = Math.floor(DEF_BUF_FLOAT * coinRate * ticketRate * bufferRate / (creditSet * DEF_BUF_BASE));
            this.pBuffer.ulBufferFloat[plyr][i] += (addTemp % DEF_BUF_FLOAT);
            this.vBuffer_AddValue(plyr, i, Math.floor(addTemp / DEF_BUF_FLOAT));

            if (this.pBuffer.ulBufferFloat[plyr][i] >= DEF_BUF_FLOAT) {
                this.vBuffer_AddValue(plyr, i, Math.floor(this.pBuffer.ulBufferFloat[plyr][i] / DEF_BUF_FLOAT));
                this.pBuffer.ulBufferFloat[plyr][i] %= DEF_BUF_FLOAT;
            }
        }

        if (mode === GAME_MODE.GAME_MISS_SHOOT) {
            this.saveState();
            return;
        }

        // Early shoot logic
        const DEF_EARLY_ODDS_MAIN = 300;
        const DEF_EARLY_RATE_MAIN = 1000;

        if (this.pBuffer.ulEarlyShoot[plyr] < (DEF_EARLY_ODDS_MAIN * creditSet)) {
            this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_MAIN, Math.floor(coinRate * ticketRate * DEF_EARLY_RATE_MAIN / (creditSet * DEF_BUF_BASE)));
            this.pBuffer.ulEarlyShoot[plyr]++;
        }

        // Buffer limit transfers
        const SCALE_FACTOR = 2;
        const iRocketToSP = Math.floor(10 * SCALE_FACTOR * ticketRate * DEF_BUF_BASE);
        if (this.iBuffer_ReadBuf(plyr, BUF_TYPE.BUF_ROCKET) >= iRocketToSP) {
            const transfer = Math.floor(iRocketToSP / 3);
            this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_ROCKET, transfer);
            this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_SP, transfer);
        }

        const iMissionToSP = Math.floor(6 * SCALE_FACTOR * ticketRate * DEF_BUF_BASE);
        if (this.iBuffer_ReadBuf(plyr, BUF_TYPE.BUF_MISSION) >= iMissionToSP) {
            const transfer = Math.floor(iMissionToSP / 3);
            this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_MISSION, transfer);
            this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_SP, transfer);
        }

        const iSPToProps = Math.floor(12 * SCALE_FACTOR * ticketRate * DEF_BUF_BASE);
        if (this.iBuffer_ReadBuf(plyr, BUF_TYPE.BUF_SP) >= iSPToProps) {
            const transfer = Math.floor(iSPToProps / 3);
            this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_SP, transfer);
            this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_PROPS, transfer);
        }

        const iPropsToJP = Math.floor(10 * SCALE_FACTOR * ticketRate * DEF_BUF_BASE);
        if (this.iBuffer_ReadBuf(plyr, BUF_TYPE.BUF_PROPS) >= iPropsToJP) {
            const transfer = Math.floor(iPropsToJP / 3);
            this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_PROPS, transfer);
            this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_JP_BOSS, transfer);
        }

        const iJPToBox = Math.floor(50 * SCALE_FACTOR * ticketRate * DEF_BUF_BASE);
        if (this.iBuffer_ReadBuf(plyr, BUF_TYPE.BUF_JP_BOSS) >= iJPToBox) {
            const transfer = Math.floor(iJPToBox / 10);
            this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_JP_BOSS, transfer);
            this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_DOUBLE_BOX, transfer);
        }

        const iBoxToMain = Math.floor(25 * SCALE_FACTOR * ticketRate * DEF_BUF_BASE);
        if (this.iBuffer_ReadBuf(plyr, BUF_TYPE.BUF_DOUBLE_BOX) >= iBoxToMain) {
            const transfer = Math.floor(iBoxToMain / 5);
            this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_DOUBLE_BOX, transfer);
            this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_MAIN, transfer);
        }

        const iShareToBoss = Math.floor(15 * SCALE_FACTOR * ticketRate * DEF_BUF_BASE);
        if (this.iBuffer_ReadBuf(plyr, BUF_TYPE.BUF_JP_SHARE) >= iShareToBoss) {
            const transfer = Math.floor(iShareToBoss / 3);
            this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_JP_SHARE, transfer);
            this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_JP_BOSS, transfer);
        }

        const iBonusToMain = Math.floor(10 * SCALE_FACTOR * ticketRate * DEF_BUF_BASE);
        if (this.iBuffer_ReadBuf(plyr, BUF_TYPE.BUF_BONUS) >= iBonusToMain) {
            const transfer = Math.floor(iBonusToMain / 3);
            this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_BONUS, transfer);
            this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_MAIN, transfer);
        }
        this.saveState();
    }

    public vBuffer_MainToSP(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 5600 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_MAIN, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_SP, value);
    }

    public vBuffer_MainToProps(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 5600 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_MAIN, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_PROPS, value);
    }

    public vBuffer_MainToJP(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 5600 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_MAIN, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_JP, value);
    }

    public vBuffer_ExtraToProps(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const propsExtraValue = Math.floor(1 * ticketRate * 500 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_PROPS, propsExtraValue);
    }

    public vBuffer_AwakeToProps(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 900 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_SP, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_PROPS, value);
    }

    public vBuffer_DoubleBoxToProps(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 400 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_DOUBLE_BOX, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_PROPS, value);
    }

    public vBuffer_MainToAwake(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 5600 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_MAIN, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_SP, value);
    }

    public vBuffer_AwakeToMain(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 900 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_SP, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_MAIN, value);
    }

    public vBuffer_MissionToMain(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 2060 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_MISSION, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_MAIN, value);
    }

    public vBuffer_MainToBonus(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 5000 / (creditSet * DEF_BUF_BASE)); // MUMMY_JP_BUF
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_MAIN, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_BONUS, value);
    }

    public vBuffer_MainToLV1Bonus(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 3650 / (creditSet * DEF_BUF_BASE)); // MUMMY_LV1_JP_BUF
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_MAIN, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_BONUS, value);
    }

    public vBuffer_PropsToMain(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 2040 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_PROPS, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_MAIN, value);
    }

    public vBuffer_RocketToMain(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 200 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_ROCKET, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_MAIN, value);
    }

    public vBuffer_BossToMain(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 300 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_JP_BOSS, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_MAIN, value);
    }

    public vBuffer_DoubleBoxToMain(plyr: number) {
        const ticketRate = 25;
        const DEF_BUF_BASE = 100;
        const creditSet = 20;
        const value = Math.floor(1 * ticketRate * 400 / (creditSet * DEF_BUF_BASE));
        this.vBuffer_SubValue(plyr, BUF_TYPE.BUF_DOUBLE_BOX, value);
        this.vBuffer_AddValue(plyr, BUF_TYPE.BUF_MAIN, value);
    }

    public loadState() {
        try {
            const savedState = localStorage.getItem('spin_rtp_buffers_state_v3');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                if (parsed.pBuffer) this.pBuffer = parsed.pBuffer;
                if (parsed.pTicketBuffer) this.pTicketBuffer = parsed.pTicketBuffer;
                if (parsed.ticketBufferRate_10) this.ticketBufferRate_10 = parsed.ticketBufferRate_10;
                return;
            }
        } catch (e) {
            console.error('Failed to load RTP buffers:', e);
        }
        this.vBuffer_Reset();
    }

    public saveState() {
        try {
            localStorage.setItem('spin_rtp_buffers_state_v3', JSON.stringify({
                pBuffer: this.pBuffer,
                pTicketBuffer: this.pTicketBuffer,
                ticketBufferRate_10: this.ticketBufferRate_10
            }));
        } catch (e) {
            console.error('Failed to save RTP buffers:', e);
        }
    }
}

export class ChanceManager {
    public pChance = {
        ulMission: Array.from({ length: 4 }, () => Array(7).fill(0)),
        ulDoubleGameCheckShoot: 0,
        ulAirdropBoxCheckShoot: 0,
        ulFlashCheckShoot: 0,
        ulRocketHitNow: Array(4).fill(0),
        ulDiamondNow: 2,
        ulJPShootCount: Array.from({ length: 4 }, () => Array(4).fill(0))
    };

    public pChanceEx = {
        ulMummyJPShootCount: Array(4).fill(0),
        ulWeaponRoundShoot: 0,
        ulMummyJPValueNow: 0
    };

    public ulRopeHit_100 = Array(25).fill(0);
    public ulRopeTickets = Array(25).fill(0);
    public ulRocketHitMax = 100;
    public ulRocketHitMaxNow = 100;
    public ulResultInfo = Array.from({ length: 4 }, () => Array(7).fill(0));
    public ulRopeHitCount = Array.from({ length: 4 }, () => Array(25).fill(0));
    public ulDoubleHitCount = Array.from({ length: 4 }, () => Array(25).fill(0));
    public ulShotMissCount = Array(4).fill(0);
    public ulRopeHit_WeaponHit_100 = Array(25).fill(0);
    public ulMissShootCount = Array(4).fill(0);

    public bReadyAwake = Array(4).fill(false);
    public ulAwakeHit = 250;
    public ulAwakeShootCount = Array(4).fill(0);
    public ulAwakeButtonCount = Array(4).fill(0);
    public ulAwakeKillCount = Array(4).fill(0);
    public ulFootballAwakeHit = 125;

    public ulAirdropBoxHit = 20;
    public ulAirdropBoxShootCount = Array(4).fill(0);
    public ulAirdropBoxShootAssign = Array(4).fill(0);
    public ulAirdropBoxPropsType = 0;
    public ulAirdropBoxCombo = 0;

    public ulRangeMissCount = Array(4).fill(0);
    public ulRangeBulletCount = Array(4).fill(0);
    public ulFlashBulletCount = Array(4).fill(0);
    public ulFlashState = 0;

    public bReadyDiamon = Array(4).fill(false);
    public ulDiamondHit = 500;
    public ulDiamondShootCount = Array(4).fill(0);
    public ulDiamondShooMin = 0;

    public bReadyToDoubleGame = false;
    public bReadyAddTime = Array(4).fill(false);
    public ulDoubleAddTimeCount = 0;
    public ulDoubleShootCount = Array(4).fill(0);
    public bReadyBox = Array(4).fill(false);
    public ulDoubleBoxTicket = Array(4).fill(0);
    public ulDoubleBoxCredit = Array(4).fill(0);
    public ulDoubleAddBoxCount = Array(4).fill(0);

    public ulMissionTickets = [0, 0, 0];
    public ulJPHit_100 = Array(26).fill(0);
    public ulJPTickets = Array(26).fill(0);
    public ulResultInfoJP = Array.from({ length: 4 }, () => Array(6).fill(0));
    public ulBossState = 0;
    public ulBossLV1Shoot = Array(4).fill(0);
    public ulBossLV2Shoot = Array(4).fill(0);
    public ulBossUpShoot = 0;
    public ulBossUpShootMax = 120;
    public ulBossUpShootMin = 60;
    public ulBossLV1DeadShootMin = 100;
    public ulBossLV2DeadShootMin = 100;
    public fJPRemainTime = 0;
    public ulJPAddTimeCount = 0;

    public ulAdjMummyTickets = 0;
    public ulMummyJpLv1Shoot = Array(4).fill(0);
    public ulMummyJpLv2Shoot = Array(4).fill(0);
    public ulMummyJpDead = Array(4).fill(0);
    public ulMummyJpBodyShoot = Array(4).fill(0);
    public ulMummyJpLv1DeadShootMin = 40;
    public ulMummyJpLv2DeadShootMin = 50;

    public uAwakeOdd_10 = 10;
    public uRocketOdd_10 = 10;
    public uComboHitOdd_10 = 10;
    public uDoubleBoxOdd_10 = 10;

    private static instance: ChanceManager | null = null;

    public static getInstance(): ChanceManager {
        if (!ChanceManager.instance) {
            ChanceManager.instance = new ChanceManager();
        }
        return ChanceManager.instance;
    }

    private constructor() {
        this.loadState();
    }

    public vChance_Init() {
        this.ulBossUpShootMax = 120 + Math.floor(Math.random() * 60);
        this.ulBossUpShootMin = 60 + Math.floor(Math.random() * 30);
        this.ulBossLV1DeadShootMin = 100 + Math.floor(Math.random() * 50);
        this.ulBossLV2DeadShootMin = 100 + Math.floor(Math.random() * 50);
        this.vAdjust_CalGiftValue();
        this.saveState();
    }

    public vAdjust_CalGiftValue() {
        const coinRate = 1;
        const ticketRate = 25;
        const creditSet = BufferManager.getInstance().energyPerCoin;
        const buffer = BufferManager.getInstance();

        buffer.ulBuffer_CalTicketBufferRate();

        const perBulletTicket_Main = Math.max(1, Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadBufferRate(BUF_TYPE.BUF_MAIN) / 100 / creditSet));
        const perBulletTicket_SP = Math.max(1, Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadBufferRate(BUF_TYPE.BUF_SP) / 100 / creditSet));
        const perBulletTicket_MummyStonWeakness = Math.max(1, Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadMummyJPBufferRate(MUMMY_JP_BUF_TYPE.MUMMY_WEAKNESS_BUF) / 100 / creditSet));
        const perBulletTicket_MummyWeakness = Math.max(1, Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadMummyJPBufferRate(MUMMY_JP_BUF_TYPE.MUMMY_JP_BUF) / 100 / creditSet));
        const perCreditTicket_MummyWeakness = Math.max(1, Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadMummyJPBufferRate(MUMMY_JP_BUF_TYPE.MUMMY_JP_BUF) / 100));
        const perBulletTicket_MummyLV1 = Math.max(1, Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadMummyJPBufferRate(MUMMY_JP_BUF_TYPE.MUMMY_LV1_JP_BUF) / 100 / creditSet));

        const _hitInit = [...cRopeHitInit];
        const ulInitTicketTmp = Array(25).fill(0);

        for (let i = 0; i < 25; i++) {
            const smallBloodHit = this.ulChance_GetSmallBloodTK(i, false);
            _hitInit[i] = smallBloodHit > 0 ? smallBloodHit : cRopeHitInit[i];

            if (i === TARGET_TYPE.GraveRobber) {
                ulInitTicketTmp[i] = Math.floor(_hitInit[i] * (perBulletTicket_Main + Math.floor(perBulletTicket_SP / 2)) / 100);
            } else if (i === TARGET_TYPE.MummyStoneWeakness) {
                ulInitTicketTmp[i] = Math.floor(_hitInit[i] * perBulletTicket_MummyStonWeakness / 100);
            } else if (i === TARGET_TYPE.MummyWeakness) {
                ulInitTicketTmp[i] = Math.floor(_hitInit[i] * perBulletTicket_MummyWeakness / 100);
            } else if (i === TARGET_TYPE.Mummy) {
                ulInitTicketTmp[i] = Math.floor(_hitInit[i] * perBulletTicket_MummyLV1 / 100);
            } else {
                ulInitTicketTmp[i] = Math.floor(_hitInit[i] * perBulletTicket_Main / 100);
            }
        }

        const ulTicketTmp = Array(25).fill(0);
        for (let i = 0; i < 25; i++) {
            ulTicketTmp[i] = this.ulAdjust_RoundOff(ulInitTicketTmp[i]);
        }

        const ulHitTimesTmp = Array(25).fill(0);
        for (let i = 0; i < 25; i++) {
            if (i === TARGET_TYPE.GraveRobber) {
                ulHitTimesTmp[i] = Math.floor(ulTicketTmp[i] * 10000 / (perBulletTicket_Main + Math.floor(perBulletTicket_SP / 2)));
            } else if (i === TARGET_TYPE.MummyStoneWeakness) {
                ulHitTimesTmp[i] = Math.floor(ulTicketTmp[i] * 10000 / perBulletTicket_MummyStonWeakness);
            } else if (i === TARGET_TYPE.MummyWeakness) {
                ulHitTimesTmp[i] = Math.floor(ulTicketTmp[i] * 10000 / perBulletTicket_MummyWeakness);
            } else if (i === TARGET_TYPE.Mummy) {
                ulHitTimesTmp[i] = Math.floor(ulTicketTmp[i] * 10000 / perBulletTicket_MummyLV1);
            } else {
                if (i === TARGET_TYPE.CartonBoy || i === TARGET_TYPE.ZombieDog || i === TARGET_TYPE.ZombieGirl || i === TARGET_TYPE.ZombieMan) {
                    ulHitTimesTmp[i] = _hitInit[i];
                    this.ulRopeHit_WeaponHit_100[i] = this.ulChance_GetSmallBloodTK(i, true);
                } else {
                    ulHitTimesTmp[i] = Math.floor(ulTicketTmp[i] * 10000 / perBulletTicket_Main);
                }
            }
        }

        let ulRopeTicketAvg = 0;
        let ulMonsterSmallTicketAvg = 0;

        for (let i = 0; i < 25; i++) {
            this.ulRopeTickets[i] = ulTicketTmp[i];
            if (i === TARGET_TYPE.Mummy) {
                this.ulAdjMummyTickets = this.ulRopeTickets[i];
            }
            this.ulRopeHit_100[i] = ulHitTimesTmp[i];

            ulRopeTicketAvg += this.ulRopeTickets[i];
            if (i === TARGET_TYPE.CartonBoy || i === TARGET_TYPE.ZombieDog || i === TARGET_TYPE.ZombieGirl || i === TARGET_TYPE.ZombieMan) {
                ulMonsterSmallTicketAvg += this.ulRopeTickets[i];
            }
        }

        ulRopeTicketAvg = Math.floor(ulRopeTicketAvg * 100 / 11);

        const perBulletTicket_JP_LV1 = Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadJPBufferRate(0) / 100 / creditSet);
        const perBulletTicket_JP_LV2 = Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadJPBufferRate(0) / 100 / creditSet);
        const perBulletTicket_JP_BODY = Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadJPBufferRate(0) / 100 / creditSet);
        const perBulletTicket_JP_ZOMBIE = Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadJPBufferRate(0) / 100 / creditSet);
        const perBulletTicket_JP_KILL = Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadJPBufferRate(4) / 100 / creditSet);

        const ulInitTicketTmp_JP = Array(26).fill(0);
        const ulTicketTmp_JP = Array(26).fill(0);
        const ulHitTimesTmp_JP = Array(26).fill(0);

        const cJPTicketMax = [200, 250, 300, 300, 500, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000];
        const bulletRateIndex = 5; // Default normal level

        for (let i = 0; i <= 25; i++) {
            if (i === 25) {
                ulTicketTmp_JP[i] = cJPTicketMax[bulletRateIndex];
                ulHitTimesTmp_JP[i] = Math.floor(ulTicketTmp_JP[i] * 10000 / perBulletTicket_JP_KILL);
            } else {
                if (i === TARGET_TYPE.Frankenstein_LV2) {
                    ulInitTicketTmp_JP[i] = Math.floor(_hitInit[i] * perBulletTicket_JP_LV2 / 100);
                    ulTicketTmp_JP[i] = this.ulAdjust_RoundOff(ulInitTicketTmp_JP[i]);
                    ulHitTimesTmp_JP[i] = Math.floor(ulTicketTmp_JP[i] * 10000 / perBulletTicket_JP_LV2);
                } else if (i === TARGET_TYPE.Frankenstein) {
                    ulInitTicketTmp_JP[i] = Math.floor(_hitInit[i] * perBulletTicket_JP_BODY / 100);
                    ulTicketTmp_JP[i] = this.ulAdjust_RoundOff(ulInitTicketTmp_JP[i]);
                    ulHitTimesTmp_JP[i] = Math.floor(ulTicketTmp_JP[i] * 10000 / perBulletTicket_JP_BODY);
                } else if (i === TARGET_TYPE.Weakness) {
                    ulInitTicketTmp_JP[i] = Math.floor(_hitInit[i] * perBulletTicket_JP_LV1 / 100);
                    ulTicketTmp_JP[i] = this.ulAdjust_RoundOff(ulInitTicketTmp_JP[i]);
                    ulHitTimesTmp_JP[i] = Math.floor(ulTicketTmp_JP[i] * 10000 / perBulletTicket_JP_LV1);
                } else if (i === TARGET_TYPE.FootballPlayer) {
                    this.ulFootballAwakeHit = Math.floor(this.ulRopeHit_100[i] * 3 / 2 / 100);
                } else {
                    ulInitTicketTmp_JP[i] = Math.floor(_hitInit[i] * perBulletTicket_JP_ZOMBIE / 100);
                    ulTicketTmp_JP[i] = this.ulAdjust_RoundOff(ulInitTicketTmp_JP[i]);
                    ulHitTimesTmp_JP[i] = Math.floor(ulTicketTmp_JP[i] * 10000 / perBulletTicket_JP_ZOMBIE);
                }
            }
            this.ulJPTickets[i] = ulTicketTmp_JP[i];
            this.ulJPHit_100[i] = ulHitTimesTmp_JP[i];
        }

        this.ulRocketHitMax = Math.floor((ulMonsterSmallTicketAvg * 30 * 10000) / (perBulletTicket_Main * 4));
        this.uRocketOdd_10 = Math.floor(this.ulRocketHitMax * 10 / 2057);
        if (this.uRocketOdd_10 <= 10) this.uRocketOdd_10 = 10;
        this.ulRocketHitMax = Math.floor(this.ulRocketHitMax * 10 / this.uRocketOdd_10);
        this.ulRocketHitMaxNow = this.ulRocketHitMax;

        this.ulAwakeHit = Math.floor((10 * ulMonsterSmallTicketAvg * 100) / (perBulletTicket_SP * 4));
        this.uAwakeOdd_10 = Math.floor(this.ulAwakeHit * 10 / 140);
        if (this.uAwakeOdd_10 <= 10) this.uAwakeOdd_10 = 10;
        this.ulAwakeHit = Math.floor(this.ulAwakeHit * 10 / this.uAwakeOdd_10);

        this.ulAirdropBoxHit = 20;
        this.ulDiamondHit = 500;

        this.uComboHitOdd_10 = 10;
        this.uDoubleBoxOdd_10 = 10;

        const cMissionNum = [
            [4, 4], [4, 4], [6, 5], [6, 8], [7, 8], [6, 35], [5, 30], [35, 35]
        ];
        const iMissionHit100_0 = Math.floor(((this.ulRopeHit_100[TARGET_TYPE.ChampionChef] + this.ulRopeHit_100[TARGET_TYPE.ChampionChef]) * cMissionNum[1][0]) / 2) + Math.floor(((this.ulRopeHit_100[TARGET_TYPE.MobBoss] + this.ulRopeHit_100[TARGET_TYPE.MobBoss]) * cMissionNum[1][1]) / 2);
        const iMissionHit100_1 = Math.floor(((this.ulRopeHit_100[TARGET_TYPE.MobBoss] + this.ulRopeHit_100[TARGET_TYPE.MobBoss]) * cMissionNum[3][0]) / 2) + Math.floor(((this.ulRopeHit_100[TARGET_TYPE.ZombieMan] + this.ulRopeHit_100[TARGET_TYPE.ZombieGirl]) * cMissionNum[3][1]) / 2);
        const iMissionHit100_2 = Math.floor(((this.ulRopeHit_100[TARGET_TYPE.MobBoss] + this.ulRopeHit_100[TARGET_TYPE.BombMan]) * cMissionNum[6][0]) / 2) + Math.floor(((this.ulRopeHit_100[TARGET_TYPE.ZombieMan] + this.ulRopeHit_100[TARGET_TYPE.ZombieGirl] + this.ulRopeHit_100[TARGET_TYPE.ZombieDog] + this.ulRopeHit_100[TARGET_TYPE.CartonBoy]) * cMissionNum[6][1]) / 4);

        const perBulletTicket_Mission = Math.max(1, Math.floor(coinRate * ticketRate * buffer.ulBuffer_ReadBufferRate(BUF_TYPE.BUF_MISSION) / 100 / creditSet));
        this.ulMissionTickets[0] = this.ulAdjust_RoundOff(Math.floor(iMissionHit100_0 * perBulletTicket_Mission / 100));
        this.ulMissionTickets[1] = this.ulAdjust_RoundOff(Math.floor(iMissionHit100_1 * perBulletTicket_Mission / 100));
        this.ulMissionTickets[2] = this.ulAdjust_RoundOff(Math.floor(iMissionHit100_2 * perBulletTicket_Mission / 100));

        this.pChanceEx.ulMummyJPValueNow = 4 * perCreditTicket_MummyWeakness * 100;
    }

    public ulAdjust_RoundOff(ulNum: number): number {
        let ulTmp = 0;
        if (ulNum > 0) {
            if (ulNum < 100) {
                ulNum = 100;
            } else if (ulNum < 1000) {
                ulNum = ulNum + 50;
            } else if (ulNum < 9000) {
                ulTmp = ulNum % 1000;
                ulNum = Math.floor(ulNum / 1000) * 1000;
                if (ulTmp >= 750) {
                    ulNum += 1000;
                } else if (ulTmp >= 250) {
                    ulNum += 500;
                }
            } else if (ulNum < 30000) {
                ulNum = ulNum + 500;
                ulNum = Math.floor(ulNum / 1000) * 1000;
            } else if (ulNum < 100000) {
                ulTmp = ulNum % 10000;
                ulNum = Math.floor(ulNum / 10000) * 10000;
                if (ulTmp >= 7500) {
                    ulNum += 10000;
                } else if (ulTmp >= 2500) {
                    ulNum += 5000;
                }
            } else {
                ulNum = ulNum + 5000;
                ulNum = Math.floor(ulNum / 10000) * 10000;
            }
            return Math.floor(ulNum / 100);
        } else {
            return 0;
        }
    }

    public ulChance_GetSmallBloodTK(type: number, isWeapon: boolean): number {
        const cFixRopeHitMax = [
            [500, 27300, 500, 600, 600, 20000, 300]
        ];
        const cFixWeaponRopeHitMax = [
            [700, 27300, 700, 700, 700, 20000, 300]
        ];

        let fixTarget = -1;
        switch (type) {
            case TARGET_TYPE.CartonBoy: fixTarget = 0; break;
            case TARGET_TYPE.Mummy: fixTarget = 1; break;
            case TARGET_TYPE.ZombieDog: fixTarget = 2; break;
            case TARGET_TYPE.ZombieGirl: fixTarget = 3; break;
            case TARGET_TYPE.ZombieMan: fixTarget = 4; break;
            case TARGET_TYPE.MummyWeakness: fixTarget = 5; break;
            case TARGET_TYPE.MummyStoneWeakness: fixTarget = 6; break;
        }

        if (fixTarget === -1) {
            return cRopeHitInit[type] || 0;
        }

        if (isWeapon) {
            return cFixWeaponRopeHitMax[0][fixTarget];
        } else {
            return cFixRopeHitMax[0][fixTarget];
        }
    }

    public ulAdjust_ReadGiftTicket(type: number): number {
        return this.ulRopeTickets[type] || 0;
    }

    public ulAdjust_ReadRocketHitMax(): number {
        return this.ulRocketHitMaxNow;
    }

    public ulAdjust_ReadRocketHitNow(plyr: number): number {
        return this.pChance.ulRocketHitNow[plyr] || 0;
    }

    public vAdjust_AddRocketHitNow(plyr: number, add: number) {
        this.pChance.ulRocketHitNow[plyr] += add;
        this.saveState();
    }

    public vAdjust_ResetRocketHitNow(plyr: number) {
        const bufLV = BufferManager.getInstance().iBuffer_GetLv(plyr, BUF_TYPE.BUF_ROCKET);
        this.ulRocketHitMaxNow = Math.floor(this.ulRocketHitMax / 2) + Math.floor(this.ulRocketHitMax * (10 - bufLV) / 10);
        this.pChance.ulRocketHitNow[plyr] = Math.floor((this.ulRocketHitMaxNow / 7) * bufLV / 10) + Math.floor(Math.random() * (this.ulRocketHitMaxNow / 7));
        this.saveState();
    }

    public ulAdjust_ReadDiamondNow(): number {
        return this.pChance.ulDiamondNow;
    }

    public vAdjust_AddDiamondNow(add: number) {
        this.pChance.ulDiamondNow += add;
        this.saveState();
    }

    public vAdjust_SubDiamondNow() {
        if (this.pChance.ulDiamondNow >= 5) this.pChance.ulDiamondNow -= 5;
        else this.pChance.ulDiamondNow = 0;
        this.saveState();
    }

    public bAdjust_CheckDiamondFull(): boolean {
        return this.pChance.ulDiamondNow >= 5;
    }

    public CheckRopeBreakOut_Normal(plyr: number, GameType: number, BulletType: number, TargetType: number, HitTimes: number, Combo: number): number {
        let ulGiftHit100Max = this.ulRopeHit_100[TargetType];
        if (ulGiftHit100Max === undefined || ulGiftHit100Max <= 0 || isNaN(ulGiftHit100Max)) {
            ulGiftHit100Max = cRopeHitInit[TargetType] || 200;
        }
        let ulRand = 0;
        let ulPowerMax = 1;
        let ulPowerNow = 1;
        let ulBufType = BUF_TYPE.BUF_MAIN;
        const buffer = BufferManager.getInstance();

        if (GameType === GAME_MODE.GAME_MODE_DOUBLE) {
            HitTimes = this.ulDoubleHitCount[plyr][TargetType];
            ulBufType = BUF_TYPE.BUF_DOUBLE;
        } else {
            HitTimes = this.ulRopeHitCount[plyr][TargetType];
            if (BulletType === BULLET_TYPE.BULLET_AWAKE) ulBufType = BUF_TYPE.BUF_SP;
            else if (BulletType === BULLET_TYPE.BULLET_ROCKET) ulBufType = BUF_TYPE.BUF_ROCKET;
            else if (BulletType === BULLET_TYPE.BULLET_RANGE || BulletType === BULLET_TYPE.BULLET_FLASH) ulBufType = BUF_TYPE.BUF_PROPS;
        }

        if (BulletType === BULLET_TYPE.BULLET_AWAKE) {
            if (TargetType === TARGET_TYPE.CartonBoy || TargetType === TARGET_TYPE.ZombieDog || TargetType === TARGET_TYPE.ZombieGirl || TargetType === TARGET_TYPE.ZombieMan) {
                if (this.ulAwakeKillCount[plyr] < 3) {
                    this.ulAwakeKillCount[plyr]++;
                    this.saveState();
                    return 1;
                } else if (Math.floor(Math.random() * (2 * this.uAwakeOdd_10 / 10)) === 0) {
                    this.ulAwakeKillCount[plyr]++;
                    this.saveState();
                    return 1;
                }
            }
        } else if (BulletType === BULLET_TYPE.BULLET_ROCKET) {
            if (TargetType === TARGET_TYPE.CartonBoy || TargetType === TARGET_TYPE.ZombieDog || TargetType === TARGET_TYPE.ZombieGirl || TargetType === TARGET_TYPE.ZombieMan) {
                if (Math.floor(Math.random() * (this.uRocketOdd_10 / 10)) === 0) {
                    return 1;
                }
            }
        } else {
            if (BulletType === BULLET_TYPE.BULLET_FLASH) {
                if (Combo === 1) {
                    ulPowerNow = 150;
                    ulPowerMax = 100;
                } else if (Combo === 2) {
                    ulPowerNow = 75;
                    ulPowerMax = 100;
                } else if (Combo === 3) {
                    ulPowerNow = 50;
                    ulPowerMax = 100;
                } else if (Combo >= 4) {
                    ulPowerNow = Math.floor(2 * 1000 / Combo);
                    ulPowerMax = 1000;
                }
            } else if (BulletType === BULLET_TYPE.BULLET_RANGE) {
                if (Combo >= 3) {
                    ulPowerNow = 67;
                    ulPowerMax = 100;
                } else if (Combo >= 2) {
                    ulPowerNow = 100;
                    ulPowerMax = 100;
                } else {
                    ulPowerNow = 200;
                    ulPowerMax = 100;
                }
            }

            if (BulletType === BULLET_TYPE.BULLET_FLASH || BulletType === BULLET_TYPE.BULLET_RANGE) {
                if (TargetType === TARGET_TYPE.CartonBoy || TargetType === TARGET_TYPE.ZombieDog || TargetType === TARGET_TYPE.ZombieGirl || TargetType === TARGET_TYPE.ZombieMan) {
                    ulGiftHit100Max = this.ulRopeHit_WeaponHit_100[TargetType];
                }
            }

            if (BulletType === BULLET_TYPE.BULLET_CATCH) {
                ulGiftHit100Max += this.ulRopeHit_100[TARGET_TYPE.GargoyleGreen];
            }

            if ((HitTimes * 100) > (ulGiftHit100Max * 2)) {
                return 1;
            }

            if (TargetType === TARGET_TYPE.MummyStoneWeakness) {
                if ((HitTimes * 100) >= ulGiftHit100Max) {
                    return 1;
                }
            }

            const bufLV = buffer.iBuffer_GetLv(plyr, ulBufType);
            if (bufLV > 5) {
                ulGiftHit100Max -= Math.floor((ulGiftHit100Max * (bufLV - 5)) / 8);
            } else {
                ulGiftHit100Max += Math.floor((ulGiftHit100Max * (5 - bufLV)) / 10);
            }

            if ((HitTimes * 100) > Math.floor(ulGiftHit100Max * 3 / 2)) {
                return 1;
            }

            ulRand = Math.floor(Math.random() * ulGiftHit100Max);
            if ((ulPowerMax * ulRand) < (100 * ulPowerNow)) {
                return 1;
            }
        }
        return 0;
    }

    public vChance_SetShoot(plyr: number, GameType: number, BulletType: number, TargetType: number, HitTimes: number, EnableAwake: boolean, Combo: number) {
        const buffer = BufferManager.getInstance();
        let ulBufType = BUF_TYPE.BUF_MAIN;

        if (BulletType === BULLET_TYPE.BULLET_NORMAL || BulletType === BULLET_TYPE.BULLET_CATCH) {
            if (TargetType === TARGET_TYPE.ShootMiss) {
                buffer.vBuffer_AddGame(plyr, GAME_MODE.GAME_MISS_SHOOT);
            } else {
                buffer.vBuffer_AddGame(plyr, GameType);
                if (GameType === GAME_MODE.GAME_MODE_MAIN) {
                    this.ulRopeHitCount[plyr][TargetType]++;
                    this.vChance_NormalBulletBufferTransform(plyr, TargetType, BulletType);
                } else if (GameType === GAME_MODE.GAME_MODE_DOUBLE) {
                    this.ulDoubleHitCount[plyr][TargetType]++;
                }
            }
        } else if (BulletType === BULLET_TYPE.BULLET_RANGE) {
            if (TargetType === TARGET_TYPE.ShootMiss) {
                this.ulRangeMissCount[plyr]++;
            } else {
                this.ulRangeBulletCount[plyr]++;
                if (this.ulRangeBulletCount[plyr] >= Combo) {
                    this.ulRangeBulletCount[plyr] = 0;
                    buffer.vBuffer_AddGame(plyr, GameType);

                    if (GameType === GAME_MODE.GAME_MODE_MAIN) {
                        this.ulRopeHitCount[plyr][TargetType]++;
                        if (TargetType === TARGET_TYPE.FootballPlayer) {
                            this.ulAwakeShootCount[plyr]++;
                        }
                        this.vChance_ShotGunBulletBufferTransform(plyr, TargetType, BulletType);
                    } else {
                        buffer.vBuffer_ExtraToProps(plyr);
                        buffer.vBuffer_MainToProps(plyr);
                        buffer.vBuffer_AwakeToProps(plyr);
                        buffer.vBuffer_DoubleBoxToProps(plyr);
                    }
                }
            }
        } else if (BulletType === BULLET_TYPE.BULLET_FLASH) {
            this.ulFlashBulletCount[plyr]++;
            if (this.ulFlashBulletCount[plyr] >= Combo) {
                this.ulFlashBulletCount[plyr] = 0;
                if (GameType === GAME_MODE.GAME_MODE_MAIN) {
                    this.ulRopeHitCount[plyr][TargetType]++;
                    if (TargetType === TARGET_TYPE.FootballPlayer) {
                        this.ulAwakeShootCount[plyr]++;
                    }
                }
            }
        }

        if (GameType === GAME_MODE.GAME_MODE_DOUBLE) {
            ulBufType = BUF_TYPE.BUF_DOUBLE;
            if (!this.bReadyAddTime[plyr]) {
                if (this.CheckAddTime(plyr) === 1) {
                    this.bReadyAddTime[plyr] = true;
                }
            }
            if (!this.bReadyBox[plyr]) {
                if (this.CheckBox(plyr) === 1) {
                    this.bReadyBox[plyr] = true;
                }
            }
        } else if (GameType === GAME_MODE.GAME_MODE_MAIN) {
            if (BulletType === BULLET_TYPE.BULLET_NORMAL) {
                if (TargetType === TARGET_TYPE.FootballPlayer) {
                    buffer.vBuffer_MainToAwake(plyr);
                }
                this.pChance.ulDoubleGameCheckShoot++;
                this.bChance_AskDoubleGame();

                if (!this.bReadyDiamon[plyr]) {
                    if (this.CheckDiamond(plyr) === 1) {
                        this.bReadyDiamon[plyr] = true;
                    }
                }

                if (this.ulAirdropBoxPropsType === 0) {
                    this.pChance.ulAirdropBoxCheckShoot++;
                    this.ulChance_AskAirdropBox(0, 0);
                }

                if (this.ulFlashState === 0) {
                    this.pChance.ulFlashCheckShoot++;
                    this.ulChance_AskFlash(0);
                }

                if (EnableAwake && !this.bReadyAwake[plyr]) {
                    if (TargetType === TARGET_TYPE.BombMan || TargetType === TARGET_TYPE.ChampionChef || TargetType === TARGET_TYPE.FootballPlayer || TargetType === TARGET_TYPE.MobBoss) {
                        this.ulAwakeShootCount[plyr]++;
                        if (this.CheckAwake(plyr, TargetType) === 1) {
                            this.bReadyAwake[plyr] = true;
                        }
                    }
                }

                if (TargetType === TARGET_TYPE.AirdropBox) {
                    this.pChanceEx.ulWeaponRoundShoot++;
                }
            } else if (BulletType === BULLET_TYPE.BULLET_AWAKE) {
                ulBufType = BUF_TYPE.BUF_SP;
            } else if (BulletType === BULLET_TYPE.BULLET_ROCKET) {
                ulBufType = BUF_TYPE.BUF_ROCKET;
            } else if (BulletType === BULLET_TYPE.BULLET_RANGE || BulletType === BULLET_TYPE.BULLET_FLASH) {
                ulBufType = BUF_TYPE.BUF_PROPS;
                if (TargetType === TARGET_TYPE.FootballPlayer) {
                    if (this.CheckAwake(plyr, TargetType) === 1) {
                        this.bReadyAwake[plyr] = true;
                    }
                }
            }
        }

        if (TargetType === TARGET_TYPE.AirdropBox) {
            this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_BREAK] = this.CheckRopeBreakOut_AirdropBox(plyr, BulletType);
        } else if (TargetType === TARGET_TYPE.Mummy) {
            this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_AWAKE] = this.CheckRopeBreakOut_MummyJP(plyr, BulletType, TargetType, HitTimes, Combo);
        } else if (TargetType === TARGET_TYPE.MummyWeakness) {
            this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_BREAK] = this.CheckRopeBreakOut_MummyJP(plyr, BulletType, TargetType, HitTimes, Combo);
        } else if (TargetType === TARGET_TYPE.MummyStoneWeakness) {
            this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_BREAK] = this.CheckRopeBreakOut_Normal(plyr, GameType, BulletType, TargetType, HitTimes, Combo);
            if (this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_BREAK] > 0) {
                this.ulRopeHitCount[plyr][TargetType] = 0;
                let iTicketOut = this.ulAdjust_ReadGiftTicket(TargetType);
                if (iTicketOut >= 2) {
                    iTicketOut = Math.floor(iTicketOut / 2) + Math.floor(Math.random() * (iTicketOut + 1));
                }
                if (iTicketOut === 0) iTicketOut = 1;
                this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_HIT_TK] = iTicketOut;
                buffer.vBuffer_SubTK(plyr, BUF_TYPE.BUF_MAIN, iTicketOut);
            }
        } else if (TargetType === TARGET_TYPE.ShootMiss) {
            if (BulletType === BULLET_TYPE.BULLET_RANGE) {
                if (this.ulRangeMissCount[plyr] >= 3) {
                    this.ulRangeMissCount[plyr] -= 3;
                    this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_CREDIT] = 1;
                    this.ulRopeHitCount[plyr][TARGET_TYPE.ShootMiss] = 0;
                    this.ulDoubleHitCount[plyr][TARGET_TYPE.ShootMiss] = 0;
                }
            } else if (BulletType === BULLET_TYPE.BULLET_NORMAL) {
                this.ulMissShootCount[plyr]++;
                this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_CREDIT] = this.CheckMissCredit(plyr);
                if (this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_CREDIT] > 0) {
                    buffer.vBuffer_SubValue(plyr, BUF_TYPE.BUF_MEDAL, Math.floor(100 * 25 * this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_CREDIT] * 1 / 20));
                    this.ulRopeHitCount[plyr][TARGET_TYPE.ShootMiss] = 0;
                    this.ulDoubleHitCount[plyr][TARGET_TYPE.ShootMiss] = 0;
                }
            }
        } else if (TargetType < TARGET_TYPE.ROPE_MAX) {
            this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_BREAK] = this.CheckRopeBreakOut_Normal(plyr, GameType, BulletType, TargetType, HitTimes, Combo);
            if (this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_BREAK] > 0) {
                let iTicketOut = this.ulAdjust_ReadGiftTicket(TargetType);
                if (GameType === 1) { // DOUBLE mode
                    this.ulDoubleHitCount[plyr][TargetType] = 0;
                    if (BulletType === BULLET_TYPE.BULLET_CATCH) {
                        iTicketOut += this.ulAdjust_ReadGiftTicket(TARGET_TYPE.GargoyleGreen);
                    }
                    iTicketOut *= 2;
                    if (this.bReadyBox[plyr]) {
                        if (TargetType !== TARGET_TYPE.GargoyleGreen && TargetType !== TARGET_TYPE.GargoyleBlue && TargetType !== TARGET_TYPE.GargoyleGold) {
                            this.bReadyBox[plyr] = false;
                            this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_BOX] = 1;
                            buffer.vBuffer_SubTK(plyr, BUF_TYPE.BUF_DOUBLE_BOX, this.ulDoubleBoxTicket[plyr]);
                            buffer.vBuffer_SubValue(plyr, BUF_TYPE.BUF_MEDAL, Math.floor(100 * 25 * this.ulDoubleBoxCredit[plyr] * 1 / 20));
                        }
                    } else if (this.bReadyAddTime[plyr]) {
                        this.bReadyAddTime[plyr] = false;
                        this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_ADD_TIME] = 1;
                    }
                } else {
                    this.ulRopeHitCount[plyr][TargetType] = 0;
                    let isMummyJP = false;
                    for (let i = 0; i < 4; i++) {
                        if (this.ulMummyJpDead[i] === 1) {
                            isMummyJP = true;
                            break;
                        }
                    }
                    if (this.bReadyDiamon[plyr] && !isMummyJP) {
                        this.bReadyDiamon[plyr] = false;
                        this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_DIAMOND] = 1;
                        buffer.vBuffer_SubTK(plyr, BUF_TYPE.BUF_JP, 0);
                        this.vAdjust_AddDiamondNow(1);
                    }

                    if (BulletType !== BULLET_TYPE.BULLET_AWAKE && BulletType !== BULLET_TYPE.BULLET_ROCKET && BulletType !== BULLET_TYPE.BULLET_FLASH) {
                        if (EnableAwake && this.bReadyAwake[plyr] && !isMummyJP && (TargetType === TARGET_TYPE.BombMan || TargetType === TARGET_TYPE.ChampionChef || TargetType === TARGET_TYPE.FootballPlayer || TargetType === TARGET_TYPE.MobBoss)) {
                            this.bReadyAwake[plyr] = false;
                            this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_AWAKE] = 1;
                            if (TargetType === TARGET_TYPE.FootballPlayer) {
                                buffer.vBuffer_SubTK(plyr, BUF_TYPE.BUF_SP, iTicketOut);
                            }
                        }
                    }

                    if (TargetType === TARGET_TYPE.GraveRobber) {
                        const iTicketOutSP = iTicketOut - this.ulAdjust_ReadGiftTicket(TARGET_TYPE.MexicoPerformer);
                        buffer.vBuffer_SubTK(plyr, BUF_TYPE.BUF_SP, iTicketOutSP);
                        iTicketOut = this.ulAdjust_ReadGiftTicket(TARGET_TYPE.MexicoPerformer);
                    } else if (TargetType === TARGET_TYPE.FootballPlayer) {
                        this.ulResultInfo[plyr][RESULT_INFO.RESULT_INFO_BREAK] = 0;
                        this.saveState();
                        return;
                    }
                }

                buffer.vBuffer_SubTK(plyr, ulBufType, iTicketOut);
            }
        }
        this.saveState();
    }

    public CheckRopeBreakOut_AirdropBox(plyr: number, BulletType: number): number {
        this.ulAirdropBoxShootCount[plyr]++;
        const buffer = BufferManager.getInstance();
        const bufLV = buffer.iBuffer_GetLv(plyr, BUF_TYPE.BUF_PROPS);
        let ulAirdropBoxHitMax = this.ulAirdropBoxHit;

        if (bufLV > 5) {
            ulAirdropBoxHitMax = Math.floor(this.ulAirdropBoxHit * (110 - 15 * (bufLV - 5)) / 100);
        } else {
            ulAirdropBoxHitMax = Math.floor(this.ulAirdropBoxHit * (100 + 15 * (5 - bufLV)) / 100);
        }

        if (this.bAdjust_CheckDiamondFull()) {
            this.saveState();
            return 0;
        }

        if (this.ulAirdropBoxShootCount[plyr] * 100 > this.ulAirdropBoxHit * 150 ||
            (this.ulAirdropBoxShootAssign[plyr] > 0 && this.ulAirdropBoxShootCount[plyr] >= this.ulAirdropBoxShootAssign[plyr])) {
            this.ulAirdropBoxShootCount[plyr] = 0;
            for (let i = 0; i < 4; i++) {
                this.ulAirdropBoxShootAssign[i] = 0;
            }
            this.saveState();
            return 1;
        }

        const ulRand = Math.floor(Math.random() * (ulAirdropBoxHitMax * 10));
        if (this.ulAirdropBoxShootCount[plyr] > 10) { // DEF_AIRDROP_KILL_BULLET_MIN
            if (ulRand < 10) {
                this.ulAirdropBoxShootCount[plyr] = 0;
                for (let i = 0; i < 4; i++) {
                    this.ulAirdropBoxShootAssign[i] = 0;
                }
                this.saveState();
                return 1;
            }
        }

        this.saveState();
        return 0;
    }

    public CheckRopeBreakOut_MummyJP(plyr: number, BulletType: number, TargetType: number, HitTimes: number, Combo: number): number {
        const buffer = BufferManager.getInstance();
        const bufLV = buffer.iBuffer_GetLv(plyr, BUF_TYPE.BUF_BONUS);
        let ulHitMax100 = this.ulRopeHit_100[TargetType];
        if (ulHitMax100 === undefined || ulHitMax100 <= 0 || isNaN(ulHitMax100)) {
            ulHitMax100 = cRopeHitInit[TargetType] || 2000;
        }
        
        if (bufLV > 5) {
            ulHitMax100 = Math.floor(ulHitMax100 * (110 - 20 * (bufLV - 5)) / 100);
        } else {
            ulHitMax100 = Math.floor(ulHitMax100 * (100 + 20 * (5 - bufLV)) / 100);
        }

        this.pChanceEx.ulMummyJPShootCount[plyr]++;
        this.ulMummyJpBodyShoot[plyr]++;

        if (TargetType === TARGET_TYPE.Mummy) {
            this.ulMummyJpLv1Shoot[plyr]++;
            if (this.ulMummyJpLv1Shoot[plyr] < this.ulMummyJpLv1DeadShootMin) {
                this.saveState();
                return 0;
            }
        } else if (TargetType === TARGET_TYPE.MummyWeakness) {
            this.ulMummyJpLv2Shoot[plyr]++;
            if (this.ulMummyJpLv1Shoot[plyr] < this.ulMummyJpLv1DeadShootMin || this.ulMummyJpLv2Shoot[plyr] < this.ulMummyJpLv2DeadShootMin) {
                this.saveState();
                return 0;
            }
        }

        if (this.bAdjust_CheckDiamondFull()) {
            this.saveState();
            return 0;
        }

        const shootCount = this.pChanceEx.ulMummyJPShootCount[plyr];
        if (shootCount * 100 > ulHitMax100 * 2) {
            this.ulMummyJpDead[plyr] = 1;
            this.saveState();
            return 1;
        }

        const ulRand = Math.floor(Math.random() * ulHitMax100);
        if (ulRand < 100) {
            this.ulMummyJpDead[plyr] = 1;
            this.saveState();
            return 1;
        }

        this.saveState();
        return 0;
    }

    public CheckAddTime(plyr: number): number {
        if (this.ulDoubleAddTimeCount < 8) {
            if (Math.floor(Math.random() * 150) === 0) { // DEF_DOUBLE_ADDTIME_SHOOT = 150
                this.ulDoubleAddTimeCount++;
                this.saveState();
                return 1;
            }
        }
        return 0;
    }

    public CheckBox(plyr: number): number {
        const buffer = BufferManager.getInstance();
        const bufLV = buffer.iBuffer_GetLv(plyr, BUF_TYPE.BUF_DOUBLE_BOX);
        let ulBase = 0;

        if (bufLV > 5) {
            ulBase = Math.floor(100 * (110 - 10 * (bufLV - 5)) * 10 / 100);
        } else {
            ulBase = Math.floor(100 * (100 + 50 * (5 - bufLV)) * 10 / 100);
        }

        if (this.ulDoubleAddBoxCount[plyr] < 5) { // DEF_DOUBLE_BOX_MAX = 5
            const rand = Math.floor(Math.random() * ulBase);
            if (rand < 10) {
                if (this.ulDoubleAddBoxCount[plyr] === 0) {
                    const cBoxGate = [
                        [3500, 4000, 2000, 500] // BUF_LV_05 defaults
                    ];
                    const cBoxOdds = [100, 200, 300, 500];
                    const randGate = Math.floor(Math.random() * 10000);
                    let accGate = 0;
                    for (let i = 0; i < 4; i++) {
                        accGate += cBoxGate[0][i];
                        if (randGate < accGate) {
                            this.ulDoubleBoxTicket[plyr] = this.ulAdjust_RoundOff(Math.floor(10 * cBoxOdds[i] * 10 / this.uDoubleBoxOdd_10));
                            break;
                        }
                    }
                    this.ulDoubleBoxCredit[plyr] = 0;
                }
                this.ulDoubleAddBoxCount[plyr]++;
                this.saveState();
                return 1;
            }
        }
        return 0;
    }

    public CheckDiamond(plyr: number): number {
        this.ulDiamondShootCount[plyr]++;
        this.ulDiamondShooMin++;

        if (this.ulDiamondShooMin < 40) { // GET_JPUNIT_BULLET_MIN
            return 0;
        }

        if (this.bAdjust_CheckDiamondFull()) {
            return 0;
        }

        let ulDiamondHitMax = this.ulDiamondHit;
        if (this.ulDiamondShootCount[plyr] > ulDiamondHitMax * 2) {
            this.ulDiamondShootCount[plyr] = 0;
            this.ulDiamondShooMin = 0;
            this.saveState();
            return 1;
        }

        const rand = Math.floor(Math.random() * (ulDiamondHitMax * 10));
        if (rand < 10) {
            this.ulDiamondShootCount[plyr] = 0;
            this.ulDiamondShooMin = 0;
            this.saveState();
            return 1;
        }

        return 0;
    }

    public CheckMissCredit(plyr: number): number {
        if (this.ulMissShootCount[plyr] * 2 >= 20) { // CREDIT_SET = 20
            this.ulMissShootCount[plyr] = 0;
            const creditSet = 20;
            const coinRate = 1;
            this.saveState();
            return Math.floor((40 + Math.floor(Math.random() * 31)) * creditSet / (100 * coinRate * 2));
        }
        return 0;
    }

    public CheckAwake(plyr: number, targetType: number): number {
        let awakeHitTmp = this.ulAwakeHit;
        if (targetType === TARGET_TYPE.FootballPlayer) {
            awakeHitTmp = this.ulFootballAwakeHit;
        }
        let ulAwakeHitMax = awakeHitTmp;
        const bufLV = BufferManager.getInstance().iBuffer_GetLv(plyr, BUF_TYPE.BUF_SP);

        if (bufLV > 5) {
            ulAwakeHitMax = Math.floor(awakeHitTmp * (110 - 20 * (bufLV - 5)) / 100);
        } else {
            ulAwakeHitMax = Math.floor(awakeHitTmp * (100 + 20 * (5 - bufLV)) / 100);
        }

        if (this.bAdjust_CheckDiamondFull()) {
            return 0;
        }

        if (this.ulAwakeShootCount[plyr] * 2 > ulAwakeHitMax * 3) {
            this.ulAwakeShootCount[plyr] = 0;
            this.ulAwakeKillCount[plyr] = 0;
            this.saveState();
            return 1;
        }

        const rand = Math.floor(Math.random() * (ulAwakeHitMax * 10));
        if (this.ulAwakeShootCount[plyr] > 20) { // DEF_AWAKE_BULLET_MIN
            if (rand < 10) {
                this.ulAwakeShootCount[plyr] = 0;
                this.ulAwakeKillCount[plyr] = 0;
                this.saveState();
                return 1;
            }
        }
        return 0;
    }

    public bChance_AskDoubleGame(): boolean {
        if (!this.bReadyToDoubleGame) {
            if (this.bAdjust_CheckDiamondFull()) return false;
            if (this.pChance.ulDoubleGameCheckShoot < 200) return false;

            const ulBase = Math.floor(3400 * 10);
            const rand = Math.floor(Math.random() * ulBase);

            if (rand < 10 || this.pChance.ulDoubleGameCheckShoot > (3400 * 2)) {
                this.bReadyToDoubleGame = true;
                this.ulDoubleAddTimeCount = 0;
                for (let i = 0; i < 4; i++) {
                    this.ulDoubleShootCount[i] = 0;
                    this.ulDoubleBoxTicket[i] = 0;
                    this.ulDoubleBoxCredit[i] = 0;
                    this.ulDoubleAddBoxCount[i] = 0;
                }
                this.saveState();
                return true;
            }
        }
        return false;
    }

    public ulChance_AskAirdropBox(assignType: number, assignShoot: number): number {
        if (this.ulAirdropBoxPropsType !== 0) return this.ulAirdropBoxPropsType;
        if (this.bAdjust_CheckDiamondFull()) return 0;

        if (this.pChance.ulAirdropBoxCheckShoot < 125) return 0; // DEF_AIRDROP_DELAY_COIN

        const base = 3000;
        const rand = Math.floor(Math.random() * base);

        if (rand < 10 || this.pChance.ulAirdropBoxCheckShoot > Math.floor(base * 2 / 10)) {
            this.ulAirdropBoxPropsType = 1; // PROPS_RANGE
            this.pChanceEx.ulWeaponRoundShoot = 1;
            this.saveState();
            return this.ulAirdropBoxPropsType;
        }

        return 0;
    }

    public ulChance_AskFlash(assignType: number): number {
        if (this.ulFlashState !== 0) return this.ulFlashState;
        if (this.bAdjust_CheckDiamondFull()) return 0;

        if (this.pChance.ulFlashCheckShoot < 250) return 0; // DEF_FLASH_DELAY_COIN

        const base = 10000;
        const rand = Math.floor(Math.random() * base);

        if (rand < 10 || this.pChance.ulFlashCheckShoot > Math.floor(base * 2 / 10)) {
            this.ulFlashState = 1;
            this.saveState();
            return this.ulFlashState;
        }

        return 0;
    }

    public ulChance_GetResult(plyr: number, resultInfo: number): number {
        const rtn = this.ulResultInfo[plyr][resultInfo] || 0;
        this.ulResultInfo[plyr][resultInfo] = 0;
        this.saveState();
        return rtn;
    }

    public vChance_NormalBulletBufferTransform(plyr: number, TargetType: number, BulletType: number) {
        const buffer = BufferManager.getInstance();
        if (TargetType === TARGET_TYPE.AirdropBox) {
            buffer.vBuffer_MainToProps(plyr);
            buffer.vBuffer_AwakeToProps(plyr);
            buffer.vBuffer_DoubleBoxToProps(plyr);
        } else if (TargetType === TARGET_TYPE.Necromancer) {
            buffer.vBuffer_MainToProps(plyr);
            buffer.vBuffer_AwakeToProps(plyr);
            buffer.vBuffer_DoubleBoxToProps(plyr);
        } else if (TargetType === TARGET_TYPE.Mummy) {
            buffer.vBuffer_MainToLV1Bonus(plyr);
            buffer.vBuffer_AwakeToMain(plyr);
            buffer.vBuffer_MissionToMain(plyr);
            this.ulChance_AddMummyHurtCount(plyr, TargetType);
        } else if (TargetType === TARGET_TYPE.MummyWeakness) {
            buffer.vBuffer_MainToBonus(plyr);
            buffer.vBuffer_PropsToMain(plyr);
            buffer.vBuffer_MissionToMain(plyr);
            buffer.vBuffer_AwakeToMain(plyr);
            buffer.vBuffer_RocketToMain(plyr);
            buffer.vBuffer_BossToMain(plyr);
            buffer.vBuffer_DoubleBoxToMain(plyr);
            this.ulChance_AddMummyHurtCount(plyr, TargetType);
        } else if (TargetType === TARGET_TYPE.MummyStoneWeakness) {
            buffer.vBuffer_PropsToMain(plyr);
            buffer.vBuffer_MissionToMain(plyr);
            buffer.vBuffer_AwakeToMain(plyr);
            buffer.vBuffer_RocketToMain(plyr);
            buffer.vBuffer_BossToMain(plyr);
            buffer.vBuffer_DoubleBoxToMain(plyr);
        }
    }

    public vChance_ShotGunBulletBufferTransform(plyr: number, TargetType: number, BulletType: number) {
        const buffer = BufferManager.getInstance();
        if (TargetType === TARGET_TYPE.Mummy) {
            buffer.vBuffer_MainToLV1Bonus(plyr);
            buffer.vBuffer_AwakeToMain(plyr);
            buffer.vBuffer_MissionToMain(plyr);
            this.ulChance_AddMummyHurtCount(plyr, TargetType);
        } else if (TargetType === TARGET_TYPE.MummyWeakness) {
            buffer.vBuffer_MainToBonus(plyr);
            buffer.vBuffer_PropsToMain(plyr);
            buffer.vBuffer_MissionToMain(plyr);
            buffer.vBuffer_AwakeToMain(plyr);
            buffer.vBuffer_RocketToMain(plyr);
            buffer.vBuffer_BossToMain(plyr);
            buffer.vBuffer_DoubleBoxToMain(plyr);
            this.ulChance_AddMummyHurtCount(plyr, TargetType);
        } else if (TargetType === TARGET_TYPE.MummyStoneWeakness) {
            buffer.vBuffer_PropsToMain(plyr);
            buffer.vBuffer_MissionToMain(plyr);
            buffer.vBuffer_AwakeToMain(plyr);
            buffer.vBuffer_RocketToMain(plyr);
            buffer.vBuffer_BossToMain(plyr);
            buffer.vBuffer_DoubleBoxToMain(plyr);
        } else {
            buffer.vBuffer_MainToProps(plyr);
            buffer.vBuffer_AwakeToProps(plyr);
            buffer.vBuffer_DoubleBoxToProps(plyr);
        }
    }

    public ulChance_AddMummyHurtCount(plyr: number, TargetType: number) {
        this.pChanceEx.ulMummyJPShootCount[plyr]++;
        this.ulMummyJpBodyShoot[plyr]++;
        if (TargetType === TARGET_TYPE.Mummy) {
            this.ulMummyJpLv1Shoot[plyr]++;
        } else if (TargetType === TARGET_TYPE.MummyWeakness) {
            this.ulMummyJpLv2Shoot[plyr]++;
        }
        this.saveState();
    }

    public loadState() {
        try {
            const savedState = localStorage.getItem('spin_rtp_chance_state_v3');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                if (parsed.pChance) this.pChance = parsed.pChance;
                if (parsed.pChanceEx) this.pChanceEx = parsed.pChanceEx;
                
                // Validate loaded ulRopeHit_100 array
                let valid = false;
                if (parsed.ulRopeHit_100 && Array.isArray(parsed.ulRopeHit_100) && parsed.ulRopeHit_100.length === 25) {
                    const hasInvalid = parsed.ulRopeHit_100.some((val: any) => val === undefined || val === null || isNaN(val) || val <= 0);
                    const isLegacySmallValues = parsed.ulRopeHit_100[7] !== undefined && parsed.ulRopeHit_100[7] < 100;
                    if (!hasInvalid && !isLegacySmallValues) {
                        this.ulRopeHit_100 = parsed.ulRopeHit_100;
                        valid = true;
                    }
                }
                
                if (parsed.ulRopeTickets) this.ulRopeTickets = parsed.ulRopeTickets;
                if (parsed.ulRocketHitMaxNow) this.ulRocketHitMaxNow = parsed.ulRocketHitMaxNow;
                if (parsed.ulDiamondNow !== undefined) this.pChance.ulDiamondNow = parsed.ulDiamondNow;
                
                if (!valid) {
                    console.warn('Invalid ulRopeHit_100 in saved state, running full vChance_Init');
                    this.vChance_Init();
                }
                return;
            }
        } catch (e) {
            console.error('Failed to load RTP chance state:', e);
        }
        this.vChance_Init();
    }

    public saveState() {
        try {
            localStorage.setItem('spin_rtp_chance_state_v3', JSON.stringify({
                pChance: this.pChance,
                pChanceEx: this.pChanceEx,
                ulRopeHit_100: this.ulRopeHit_100,
                ulRopeTickets: this.ulRopeTickets,
                ulRocketHitMaxNow: this.ulRocketHitMaxNow,
                ulDiamondNow: this.pChance.ulDiamondNow
            }));
        } catch (e) {
            console.error('Failed to save RTP chance state:', e);
        }
    }
}

export interface WaterLevelConfig {
    targetRTP: number;
    ticketValueInCoins: number;
    minBufferLimit: number;
    maxBufferLimit: number;
}

export enum GamePeriodState {
    EATING = 'EATING',
    NORMAL = 'NORMAL',
    PAYING = 'PAYING'
}

export class ProbabilityManager {
    private static instance: ProbabilityManager | null = null;

    private config: WaterLevelConfig = {
        targetRTP: 1.15,
        ticketValueInCoins: 1.0,
        minBufferLimit: -50.0,
        maxBufferLimit: 200.0
    };

    public totalEnergyDeducted: number[] = [0, 0, 0, 0];
    public totalTicketsWon: number[] = [0, 0, 0, 0];
    public totalCoinsIn: number[] = [0, 0, 0, 0];
    public energyPerCoin: number = 15;

    private constructor() {
        // Initial setup complete
    }

    public static getInstance(): ProbabilityManager {
        if (!ProbabilityManager.instance) {
            ProbabilityManager.instance = new ProbabilityManager();
        }
        return ProbabilityManager.instance;
    }

    public getBuffer(): BufferManager {
        return BufferManager.getInstance();
    }

    public getChance(): ChanceManager {
        return ChanceManager.getInstance();
    }

    public setEnergyPerCoin(val: number) {
        this.energyPerCoin = val;
        BufferManager.getInstance().setEnergyPerCoin(val);
        // Recalculate the entire probability table & values with the new energyPerCoin
        ChanceManager.getInstance().vAdjust_CalGiftValue();
        ChanceManager.getInstance().saveState();
    }

    public recordCoinIn(plyr: number, coinAmount: number = 1) {
        if (plyr < 0 || plyr >= 4) return;
        this.totalCoinsIn[plyr] += coinAmount;
        // Water levels are now accumulated during hits (recordHitEnergyDeducted), not upon coin insertion.
    }

    public recordTicketOut(plyr: number, ticketAmount: number) {
        if (plyr < 0 || plyr >= 4) return;
        this.totalTicketsWon[plyr] += ticketAmount;
    }

    public recordHitEnergyDeducted(playerIdx: number, isBoss: boolean = false) {
        if (playerIdx < 0 || playerIdx >= 4) return;
        this.totalEnergyDeducted[playerIdx] += 1;
        // vBuffer_AddGame is already called inside vChance_SetShoot on every hit.
        // We remove the duplicate call here to prevent double buffer accumulation and over-filling.
    }

    public getCurrentPeriod(): GamePeriodState {
        // Simplified mapping based on main buffer levels
        const lv = BufferManager.getInstance().iBuffer_GetLv(0, BUF_TYPE.BUF_MAIN);
        if (lv < 4) return GamePeriodState.EATING;
        if (lv > 6) return GamePeriodState.PAYING;
        return GamePeriodState.NORMAL;
    }

    public checkHitSuccess(zombieType: string, currentHits: number, baseProb: number): boolean {
        // Fallback backward-compatibility support
        const period = this.getCurrentPeriod();
        let multiplier = 1.0;
        if (period === GamePeriodState.EATING) multiplier = 0.25;
        else if (period === GamePeriodState.PAYING) multiplier = 1.8;

        const finalProb = baseProb * multiplier;
        return Math.random() < finalProb;
    }

    public getDebugInfo() {
        const buffer = BufferManager.getInstance();
        const chance = ChanceManager.getInstance();

        const lvMain = buffer.iBuffer_GetLv(0, BUF_TYPE.BUF_MAIN);
        const lvSp = buffer.iBuffer_GetLv(0, BUF_TYPE.BUF_SP);
        const lvJp = buffer.iBuffer_GetLv(0, BUF_TYPE.BUF_JP_BOSS);

        const pRTPs = [];
        for (let p = 0; p < 4; p++) {
            const spent = this.totalEnergyDeducted[p] / this.energyPerCoin;
            const won = this.totalTicketsWon[p];
            let rtpStr = '0.0%';
            if (spent > 0) {
                // Since 1 coin spent = 15 HP energy and returns 25 tickets of value at 100% RTP:
                // Equivalent ticket cost is spent * 25
                rtpStr = `${((won / (spent * 25)) * 100).toFixed(1)}%`;
            } else if (this.totalCoinsIn[p] > 0) {
                rtpStr = '0.0%';
            } else {
                rtpStr = '-';
            }
            pRTPs.push(rtpStr);
        }

        return {
            totalCoinsIn: this.totalCoinsIn,
            totalTicketsOut: chance.pChance.ulDiamondNow,
            bufferPool: buffer.pBuffer.iBuffer[0][BUF_TYPE.BUF_MAIN].toString(),
            periodState: this.getCurrentPeriod(),
            targetRTP: '115%',
            actualRTP: `1P:${pRTPs[0]} | 2P:${pRTPs[1]} | 3P:${pRTPs[2]} | 4P:${pRTPs[3]}`,
            playerRTPs: pRTPs,
            totalEnergyDeducted: this.totalEnergyDeducted,
            totalTicketsWon: this.totalTicketsWon,
            energyPerCoin: this.energyPerCoin
        };
    }

    public getRequiredHits(plyr: number, targetType: number, ulBufType: number): number {
        const chance = ChanceManager.getInstance();
        let ulGiftHit100Max = chance.ulRopeHit_100[targetType];
        if (ulGiftHit100Max === undefined || ulGiftHit100Max <= 0 || isNaN(ulGiftHit100Max)) {
            ulGiftHit100Max = cRopeHitInit[targetType] || 0;
        }
        
        const buffer = BufferManager.getInstance();
        const bufLV = buffer.iBuffer_GetLv(plyr, ulBufType);
        if (bufLV > 5) {
            ulGiftHit100Max -= Math.floor((ulGiftHit100Max * (bufLV - 5)) / 8);
        } else {
            ulGiftHit100Max += Math.floor((ulGiftHit100Max * (5 - bufLV)) / 10);
        }
        
        return Math.floor(ulGiftHit100Max / 100);
    }

    public getPlayerBuffers() {
        const buffer = BufferManager.getInstance();
        const players = [];
        for (let p = 0; p < 4; p++) {
            players.push({
                playerIndex: p + 1, // 1P, 2P, 3P, 4P
                mainVal: buffer.iBuffer_ReadBuf(p, BUF_TYPE.BUF_MAIN),
                mainLv: buffer.iBuffer_GetLv(p, BUF_TYPE.BUF_MAIN),
                spVal: buffer.iBuffer_ReadBuf(p, BUF_TYPE.BUF_SP),
                spLv: buffer.iBuffer_GetLv(p, BUF_TYPE.BUF_SP),
                jpVal: buffer.iBuffer_ReadBuf(p, BUF_TYPE.BUF_JP_BOSS),
                jpLv: buffer.iBuffer_GetLv(p, BUF_TYPE.BUF_JP_BOSS),
                propsVal: buffer.iBuffer_ReadBuf(p, BUF_TYPE.BUF_PROPS),
                propsLv: buffer.iBuffer_GetLv(p, BUF_TYPE.BUF_PROPS),
                bonusVal: buffer.iBuffer_ReadBuf(p, BUF_TYPE.BUF_BONUS),
                bonusLv: buffer.iBuffer_GetLv(p, BUF_TYPE.BUF_BONUS)
            });
        }
        return players;
    }

    public getSmallMonsterHitRequirements(plyr: number = 0) {
        return {
            cartonBoy: this.getRequiredHits(plyr, TARGET_TYPE.CartonBoy, BUF_TYPE.BUF_MAIN),
            zombieDog: this.getRequiredHits(plyr, TARGET_TYPE.ZombieDog, BUF_TYPE.BUF_MAIN),
            zombieGirl: this.getRequiredHits(plyr, TARGET_TYPE.ZombieGirl, BUF_TYPE.BUF_MAIN),
            zombieMan: this.getRequiredHits(plyr, TARGET_TYPE.ZombieMan, BUF_TYPE.BUF_MAIN),
            graveRobber: this.getRequiredHits(plyr, TARGET_TYPE.GraveRobber, BUF_TYPE.BUF_MAIN),
            footballPlayer: this.getRequiredHits(plyr, TARGET_TYPE.FootballPlayer, BUF_TYPE.BUF_MAIN),
            bombMan: this.getRequiredHits(plyr, TARGET_TYPE.BombMan, BUF_TYPE.BUF_MAIN),
        };
    }

    public resetPool() {
        BufferManager.getInstance().vBuffer_Reset();
        this.totalEnergyDeducted = [0, 0, 0, 0];
        this.totalTicketsWon = [0, 0, 0, 0];
        this.totalCoinsIn = [0, 0, 0, 0];
    }
}
