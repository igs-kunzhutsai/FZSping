const fs = require('fs');
const content = fs.readFileSync('src/game/GameEngine.ts', 'utf8');

const getNextIdx = (startIdx, funcName) => {
    let searchFunc = `    ${funcName.split('(')[0]}`;
    let idx = content.indexOf(`\n${searchFunc}(`, startIdx);
    if(idx === -1) {
        idx = content.indexOf(`\n${searchFunc} (`, startIdx);
    }
    if(idx === -1) {
        idx = content.indexOf(`\n${searchFunc}{`, startIdx);
    }
    if(idx === -1) {
        idx = content.indexOf(`\n${searchFunc} {`, startIdx);
    }
    return idx;
};

const extractFunc = (funcName, nextFuncName) => {
    let funcPrefix = `    ${funcName.split('(')[0]}`;
    let startIdx = content.indexOf(`\n${funcPrefix}(`);
    if(startIdx === -1) startIdx = content.indexOf(`\n${funcPrefix} (`);
    if(startIdx === -1) startIdx = content.indexOf(`\n${funcPrefix}{`);
    if(startIdx === -1) startIdx = content.indexOf(`\n${funcPrefix} {`);
    
    if (startIdx === -1) throw new Error("Not found: " + funcName);
    
    let endIdx = nextFuncName ? getNextIdx(startIdx + 1, nextFuncName) : content.lastIndexOf('}');
    
    if (endIdx === -1) throw new Error("Next func not found: " + nextFuncName);
    
    // Substring
    let text = content.substring(startIdx + 1, endIdx);
    return text.replace(/^    /gm, ''); // removing 4 spaces indent
};

console.log(extractFunc('handleKeyDown', 'handleKeyUp').substring(0, 100));
