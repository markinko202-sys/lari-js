// The code gates: a short lesson, then one question picked by difficulty.
// Answer right → the gate compiles open and the skill becomes a power.

export const LESSONS = {
  loop: {
    title: 'Loops repeat code',
    body: 'A <code>for</code> loop runs the same block several times. You set a counter, a condition, and how the counter changes.',
    code: `for (let i = 0; i < 2; i++) {
  jump();   // runs twice → double jump
}`,
    power: 'Double jump — press jump again in the air.',
  },
  function: {
    title: 'Functions are reusable moves',
    body: 'A <code>function</code> gives a block of code a name. Define it once, call it whenever you need it.',
    code: `function dash(direction) {
  speed = 17 * direction;
}
dash(+1);   // call it`,
    power: 'Dash — press Shift (or the ⇥ button) for a burst of speed, even mid-air.',
  },
  async: {
    title: 'async / await waits without freezing',
    body: '<code>await</code> pauses an <code>async</code> function until a Promise resolves — the rest of the game keeps running.',
    code: `async function cross() {
  await glideUntil(ground);
  land();
}`,
    power: 'Glide — hold jump while falling to float across lava.',
  },
};

// difficulty: 0 easy, 1 normal, 2 hard. `a` is the index of the right answer.
export const QUESTIONS = {
  loop: [
    [ // easy
      { q: 'How many times does jump() run?', code: 'for (let i = 0; i < 2; i++) {\n  jump();\n}', o: ['1', '2', '3'], a: 1 },
      { q: 'Which keyword starts a loop?', code: '___ (let i = 0; i < 3; i++) { }', o: ['for', 'if', 'let'], a: 0 },
    ],
    [ // normal
      { q: 'What does this print?', code: 'let s = "";\nfor (let i = 1; i <= 3; i++) s += i;\nconsole.log(s);', o: ['6', '123', '321', '1,2,3'], a: 1 },
      { q: 'How many coins are collected?', code: 'let coins = 0;\nfor (let i = 0; i < 10; i += 2) coins++;', o: ['10', '4', '5', '6'], a: 2 },
    ],
    [ // hard
      { q: 'What is logged?', code: 'const out = [];\nfor (var i = 0; i < 3; i++) {\n  setTimeout(() => out.push(i));\n}\nsetTimeout(() => console.log(out));', o: ['[0,1,2]', '[3,3,3]', '[1,2,3]', '[]'], a: 1 },
      { q: 'Which loop never ends?', code: '// pick the infinite one', o: ['for (let i = 0; i < 5; i++)', 'for (let i = 5; i > 0; i--)', 'for (let i = 0; i < 5; i--)', 'for (let i = 0; i < 5; i += 5)'], a: 2 },
    ],
  ],
  function: [
    [
      { q: 'How do you call this function?', code: 'function dash() {\n  // ...\n}', o: ['dash', 'dash()', 'call dash'], a: 1 },
      { q: 'What does it return?', code: 'function double(n) {\n  return n * 2;\n}\ndouble(4);', o: ['4', '8', '42'], a: 1 },
    ],
    [
      { q: 'What is the value of x?', code: 'function add(a, b = 10) {\n  return a + b;\n}\nconst x = add(5);', o: ['5', '15', 'NaN', 'undefined'], a: 1 },
      { q: 'What does this log?', code: 'const greet = name => `Hi ${name}`;\nconsole.log(greet("KL"));', o: ['Hi name', 'Hi KL', 'greet KL', 'undefined'], a: 1 },
    ],
    [
      { q: 'What does counter() return the 3rd time?', code: 'function make() {\n  let n = 0;\n  return () => ++n;\n}\nconst counter = make();', o: ['0', '1', '3', 'NaN'], a: 2 },
      { q: 'What is logged?', code: 'console.log(typeof hoisted);\nfunction hoisted() {}', o: ['undefined', 'function', 'object', 'ReferenceError'], a: 1 },
    ],
  ],
  async: [
    [
      { q: 'Which keyword waits for a Promise?', code: 'async function load() {\n  const data = ___ fetch(url);\n}', o: ['wait', 'await', 'then'], a: 1 },
      { q: 'An async function always returns…', code: 'async function f() { return 1; }', o: ['a number', 'a Promise', 'nothing'], a: 1 },
    ],
    [
      { q: 'In what order are the letters logged?', code: 'console.log("A");\nsetTimeout(() => console.log("B"), 0);\nconsole.log("C");', o: ['A B C', 'A C B', 'B A C', 'C A B'], a: 1 },
      { q: 'What does this log?', code: 'async function f() { return 7; }\nf().then(v => console.log(v + 1));', o: ['7', '8', 'Promise', 'undefined'], a: 1 },
    ],
    [
      { q: 'What is logged?', code: 'console.log(1);\nPromise.resolve().then(() => console.log(2));\nsetTimeout(() => console.log(3));\nconsole.log(4);', o: ['1 2 3 4', '1 4 2 3', '1 4 3 2', '1 2 4 3'], a: 1 },
      { q: 'How long until "done" (roughly)?', code: 'const wait = ms => new Promise(r => setTimeout(r, ms));\nawait Promise.all([wait(300), wait(500)]);\nconsole.log("done");', o: ['300 ms', '500 ms', '800 ms', 'never'], a: 1 },
    ],
  ],
};

export function pickQuestion(skill, difficulty) {
  const pool = QUESTIONS[skill][difficulty];
  return pool[Math.floor(Math.random() * pool.length)];
}

// tiny JS highlighter for the code panels — one pass, so it never re-highlights its own markup
const TOKENS = /(\/\/.*$)|("[^"\n]*"|`[^`]*`)|\b(for|let|const|var|function|return|async|await|if|else|new|typeof|console|setTimeout|Promise)\b|\b(\d+)\b/gm;
export function highlight(src) {
  const esc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(TOKENS, (m, com, str, kw, num) =>
    com ? `<span class="c-com">${com}</span>` :
    str ? `<span class="c-str">${str}</span>` :
    kw ? `<span class="c-kw">${kw}</span>` :
    `<span class="c-num">${num}</span>`);
}
