const fs = require('fs');

let engine = fs.readFileSync('src/game/GameEngine.ts', 'utf-8');

function extractMethod(methodName) {
    const regex = new RegExp(`^\\s*${methodName}\\s*\\([\\s\\S]*?\\)\\s*(?::\\s*[a-zA-Z0-9_\\[\\]]+)?\\s*\\{`, 'm');
    const match = engine.match(regex);
    if (!match) {
        console.log(`Failed to match method: ${methodName}`);
        return null;
    }

    let start = match.index;
    let braceLevel = 0;
    let i = start + match[0].indexOf('{');
    
    braceLevel = 1;
    i++;
    
    while (braceLevel > 0 && i < engine.length) {
        if (engine[i] === '{') braceLevel++;
        if (engine[i] === '}') braceLevel--;
        i++;
    }
    
    const methodStr = engine.substring(start, i);
    engine = engine.substring(0, start) + engine.substring(i);
    return methodStr;
}

const updateTopStandby = extractMethod('updateTopStandby');
const getStandbyRadiusForModel = extractMethod('getStandbyRadiusForModel');
const getStandbyRadius = extractMethod('getStandbyRadius');

if (updateTopStandby && getStandbyRadiusForModel && getStandbyRadius) {
    let topMovementTs = `import { GameEngine } from './GameEngine';\nimport { Top } from './types';\n\n`;

    // getStandbyRadius
    let code1 = getStandbyRadius.replace(/getStandbyRadius\(top: any\)/, 'export function getStandbyRadius(top: Top, engine: GameEngine)');
    code1 = code1.replace(/this\./g, 'engine.');
    
    // getStandbyRadiusForModel
    let code2 = getStandbyRadiusForModel.replace(/getStandbyRadiusForModel\(top: any, angle: number\)/, 'export function getStandbyRadiusForModel(top: Top, engine: GameEngine, angle: number)');
    code2 = code2.replace(/this\./g, 'engine.');
    code2 = code2.replace(/engine\.getStandbyRadius\(top\)/, 'getStandbyRadius(top, engine)');
    
    // updateTopStandby
    let code3 = updateTopStandby.replace(/updateTopStandby\(top: any, dt: number\)/, 'export function updateTopStandby(top: Top, engine: GameEngine, dt: number)');
    code3 = code3.replace(/this\./g, 'engine.');
    code3 = code3.replace(/engine\.getStandbyRadiusForModel/g, 'getStandbyRadiusForModel');
    code3 = code3.replace(/engine\.getStandbyRadius/g, 'getStandbyRadius');

    topMovementTs += code1 + '\n\n' + code2 + '\n\n' + code3 + '\n';
    
    fs.writeFileSync('src/game/topMovement.ts', topMovementTs);
    
    engine = engine.replace(/this\.updateTopStandby\(([^,]+),([^)]+)\)/g, 'updateTopStandby($1, this, $2)');
    engine = engine.replace(/this\.getStandbyRadiusForModel\(([^,]+),([^)]+)\)/g, 'getStandbyRadiusForModel($1, this, $2)');
    engine = engine.replace(/this\.getStandbyRadius\(([^)]+)\)/g, 'getStandbyRadius($1, this)');
    
    engine = `import { updateTopStandby, getStandbyRadiusForModel, getStandbyRadius } from './topMovement';\n` + engine;
    
    fs.writeFileSync('src/game/GameEngine.ts', engine);
    console.log('topMovement.ts extracted successfully!');
} else {
    console.log('Methods not found', {
        updateTopStandby: !!updateTopStandby,
        getStandbyRadiusForModel: !!getStandbyRadiusForModel,
        getStandbyRadius: !!getStandbyRadius
    });
}
