const fs = require('fs');

let content = fs.readFileSync('src/game/renderers/UIRenderer.ts', 'utf8');
content = content.replace(/drawIntroMessage\(engine\)/g, 'drawIntroMessage(ctx, engine)');
content = content.replace(/drawBossIntroMessage\(engine\)/g, 'drawBossIntroMessage(ctx, engine)');
content = content.replace(/drawVersusEndMessage\(engine\)/g, 'drawVersusEndMessage(ctx, engine)');

fs.writeFileSync('src/game/renderers/UIRenderer.ts', content);
