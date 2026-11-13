const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx={window:{}}; vm.createContext(ctx); vm.runInContext(fs.readFileSync('levels.js','utf8'),ctx);
for (const [index, level] of ctx.window.CATDOKU_LEVELS.entries()) {
  test(`level ${index+1}: valid shape, stored solution and exactly one solution`, () => {
    const {size:n, regions, solution}=level;
    assert.equal(regions.length,n); assert.ok(regions.every(r=>r.length===n));
    assert.equal(new Set(regions.join('')).size,n); assert.equal(solution.length,n);
    const solutions=[];
    function search(cols=[], rooms=new Set()) {
      const row=cols.length;
      if(row===n) {solutions.push([...cols]); return;}
      for(let col=0;col<n;col++) {
        const room=regions[row][col];
        if(cols.includes(col)||rooms.has(room)||(row>0&&Math.abs(cols[row-1]-col)<=1)) continue;
        search([...cols,col],new Set([...rooms,room]));
      }
    }
    search(); assert.equal(solutions.length,1);
    assert.deepEqual(solutions[0],Array.from(solution));
  });
}
