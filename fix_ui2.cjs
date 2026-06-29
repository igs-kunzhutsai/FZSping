const fs = require('fs');
let content = fs.readFileSync('src/game/renderers/UIRenderer.ts', 'utf8');

// Remove the weird truncated `drawUI(engine: GameEngine) { ... }` block
const startIdx = content.indexOf('    drawUI(engine: GameEngine) {');
const exportFuncIdx = content.indexOf('export function drawUI(ctx: CanvasRenderingContext2D, engine: GameEngine) {');
content = content.substring(0, startIdx) + content.substring(exportFuncIdx);

// Also replace `export function }` with `}` 
content = content.replace(/export function \}/g, '}');

// Also replace `this.drawIntroMessage` with `drawIntroMessage`
content = content.replace(/this\.drawIntroMessage/g, 'drawIntroMessage');
content = content.replace(/this\.drawBossIntroMessage/g, 'drawBossIntroMessage');
content = content.replace(/this\.drawVersusEndMessage/g, 'drawVersusEndMessage');

// In drawVersusEndMessage, the internal lines were ALSO prefixed with `export function `:
content = content.replace(/export function     /g, '    ');
// Let's replace any `export function         ` as well just in case
content = content.replace(/export function         /g, '        ');

// Wait! Some `export function ` might be lingering.
// The only valid `export function ` are:
// export function drawUIWorld
// export function drawUIScreen
// export function drawUI
// export function drawIntroMessage
// export function drawBossIntroMessage
// export function drawVersusEndMessage
// export function drawCapsuleBorder

let lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('export function ') && !lines[i].includes('(')) {
        lines[i] = lines[i].replace('export function ', '    ');
    }
}
content = lines.join('\n');

fs.writeFileSync('src/game/renderers/UIRenderer.ts', content);
