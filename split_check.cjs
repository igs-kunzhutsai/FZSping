const fs = require('fs');
const content = fs.readFileSync('src/game/GameRenderer.ts', 'utf8');

const anchor1 = content.indexOf('        // Deep space black backdrop');
const anchor2 = content.indexOf('        // Draw Concrete Blocks');
const anchor3 = content.indexOf('        // Draw Particles');
const anchor4 = content.indexOf('        // Draw Tops');
const anchor5 = content.indexOf('        // Draw Coop/Deadlock Battle Standoff UI in world space');
const anchor6 = content.indexOf('        this.ctx.restore();\n\n        // Draw Overlay UI (Corners for players)');
const anchorExt1 = content.indexOf('    drawUI(engine: GameEngine) {');

console.log(anchor1, anchor2, anchor3, anchor4, anchor5, anchor6, anchorExt1);
