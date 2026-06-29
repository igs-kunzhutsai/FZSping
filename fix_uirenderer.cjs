const fs = require('fs');
let content = fs.readFileSync('src/game/renderers/UIRenderer.ts', 'utf8');

// The faulty regex replacement was executed as:
// .replace(/^    /gm, 'export function ')
// Let's reverse it. We can simply replace any line that stars with "export function     " with "    "

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('export function     ')) {
        lines[i] = lines[i].replace('export function     ', '    ');
    } else if (lines[i] === 'export function ') {
        lines[i] = '';
    }
}

// But wait, the function declarations were specifically fixed to:
// export function drawUI(ctx: CanvasRenderingContext2D, engine: GameEngine) {
// which is perfectly fine and shouldn't be touched by the above since it doesn't have 4 trailing spaces.

fs.writeFileSync('src/game/renderers/UIRenderer.ts', lines.join('\n'));
console.log('Fixed UIRenderer!');
