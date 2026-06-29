const fs = require('fs');
const lines = fs.readFileSync('src/game/GameEngine.ts', 'utf8').split('\n');
const methods = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^    (?:async )?[a-zA-Z_0-9]+(?:\<.*?\>)?\s*\(/)) {
        methods.push(`${i+1}: ${lines[i]}`);
    }
}
console.log(methods.join('\n'));
