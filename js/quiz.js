// The code gates. Each level has three: two lesson gates and one power gate (the level's skill).
// A gate shows a tiny lesson, then one question picked by difficulty. Right answer → the gate compiles open.

export const LESSONS = {
  // ---- level 1 · kampung
  let: {
    title: 'Variables remember things',
    body: '<code>let</code> creates a variable you can change later; <code>const</code> one you can\'t.',
    code: `let coins = 0;
coins = coins + 5;      // now 5
const name = "Lari";   // fixed`,
  },
  loop: {
    title: 'Loops repeat code',
    body: 'A <code>for</code> loop runs the same block several times: a counter, a condition, and a step.',
    code: `for (let i = 0; i < 2; i++) {
  jump();   // runs twice → double jump
}`,
    power: 'Double jump — press jump again in the air.',
  },
  if: {
    title: 'if / else makes decisions',
    body: 'Code inside <code>if</code> runs only when the condition is true; otherwise <code>else</code> runs.',
    code: `if (bug.isBelow(player)) {
  stomp(bug);
} else {
  loseHeart();
}`,
  },
  // ---- level 2 · rainforest
  array: {
    title: 'Arrays are ordered lists',
    body: 'Square brackets hold many values. Count from <b>0</b>; <code>.length</code> tells how many.',
    code: `const fruit = ["durian", "rambutan", "mangosteen"];
fruit[0];        // "durian"
fruit.length;    // 3`,
  },
  function: {
    title: 'Functions are reusable moves',
    body: 'A <code>function</code> gives a block of code a name. Define it once, call it whenever you need it.',
    code: `function dash(direction) {
  speed = 17 * direction;
}
dash(+1);   // call it`,
    power: 'Dash — press Shift, or double-tap ◀ / ▶ on a phone.',
  },
  object: {
    title: 'Objects group named values',
    body: 'Curly braces hold <b>key: value</b> pairs. Read them with a dot.',
    code: `const hornbill = { name: "Kenyalang", wings: 2 };
hornbill.name;    // "Kenyalang"`,
  },
  // ---- level 3 · volcano
  event: {
    title: 'Events call you back',
    body: 'You hand the browser a function; it calls it later, when the event happens.',
    code: `button.addEventListener("click", () => {
  erupt();
});`,
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
  try: {
    title: 'try / catch survives errors',
    body: 'If code inside <code>try</code> throws, <code>catch</code> runs instead of crashing the whole program.',
    code: `try {
  crossLava();
} catch (err) {
  respawn();
}`,
  },
};

// difficulty: 0 easy · 1 normal · 2 hard · 3 very hard. `a` is the index of the right answer.
const Q = (q, code, o, a) => ({ q, code, o, a });
export const QUESTIONS = {
  let: [
    [Q('What is coins now?', 'let coins = 2;\ncoins = coins + 3;', ['2', '5', '23'], 1)],
    [Q('What is logged?', 'let a = 1;\nlet b = a;\na = 9;\nconsole.log(b);', ['1', '9', 'undefined', 'Error'], 0),
     Q('Which line causes an error?', 'const lives = 3;   // 1\nlet coins = 0;     // 2\ncoins = 10;        // 3\nlives = 4;         // 4', ['line 1', 'line 2', 'line 3', 'line 4'], 3)],
    [Q('What is logged?', 'let x = "5";\nlet y = 2;\nconsole.log(x + y, x * y);', ['7 10', '52 10', '52 52', '7 7'], 1)],
    [Q('What is logged?', 'console.log(typeof score);\nlet score = 1;', ['undefined', 'number', 'ReferenceError', '"score"'], 2)],
  ],
  loop: [
    [Q('How many times does jump() run?', 'for (let i = 0; i < 2; i++) {\n  jump();\n}', ['1', '2', '3'], 1),
     Q('Which keyword starts a loop?', '___ (let i = 0; i < 3; i++) { }', ['for', 'if', 'let'], 0)],
    [Q('What does this print?', 'let s = "";\nfor (let i = 1; i <= 3; i++) s += i;\nconsole.log(s);', ['6', '123', '321', '1,2,3'], 1),
     Q('How many coins are collected?', 'let coins = 0;\nfor (let i = 0; i < 10; i += 2) coins++;', ['10', '4', '5', '6'], 2)],
    [Q('Which loop never ends?', '// pick the infinite one', ['for (let i = 0; i < 5; i++)', 'for (let i = 5; i > 0; i--)', 'for (let i = 0; i < 5; i--)', 'for (let i = 0; i < 5; i += 5)'], 2)],
    [Q('What is logged?', 'const out = [];\nfor (var i = 0; i < 3; i++) {\n  setTimeout(() => out.push(i));\n}\nsetTimeout(() => console.log(out));', ['[0,1,2]', '[3,3,3]', '[1,2,3]', '[]'], 1)],
  ],
  if: [
    [Q('What is logged?', 'const hearts = 0;\nif (hearts > 0) console.log("run");\nelse console.log("game over");', ['run', 'game over', 'nothing'], 1)],
    [Q('Which branch runs when coins = 50?', 'if (coins > 100) buy("crown");\nelse if (coins > 40) buy("cap");\nelse save();', ['buy("crown")', 'buy("cap")', 'save()', 'all three'], 1)],
    [Q('What is logged?', 'const lives = "0";\nif (lives) console.log("alive");\nelse console.log("dead");', ['alive', 'dead', 'Error', 'undefined'], 0)],
    [Q('What is logged?', 'const a = [], b = [];\nconsole.log(a == b, a === a, null ?? "x", 0 || "y");', ['true true x y', 'false true x y', 'false true null y', 'false false x 0'], 1)],
  ],
  array: [
    [Q('What is fruit[1]?', 'const fruit = ["durian", "rambutan", "nangka"];', ['"durian"', '"rambutan"', '"nangka"'], 1)],
    [Q('What is logged?', 'const a = [3, 1, 2];\na.push(5);\nconsole.log(a.length);', ['3', '4', '5', '11'], 1),
     Q('What does this return?', '[1, 2, 3].map(n => n * 2)', ['[1,2,3]', '[2,4,6]', '6', '12'], 1)],
    [Q('What is logged?', 'const t = [5, 12, 8, 20];\nconsole.log(t.filter(n => n > 10).length);', ['1', '2', '3', '4'], 1)],
    [Q('What is logged?', 'const a = [1, 2, 3];\nconst b = a;\nb.push(4);\nconsole.log(a.length, [10, 1, 2].sort()[0]);', ['3 1', '4 1', '4 10', '3 10'], 1)],
  ],
  function: [
    [Q('How do you call this function?', 'function dash() {\n  // ...\n}', ['dash', 'dash()', 'call dash'], 1),
     Q('What does it return?', 'function double(n) {\n  return n * 2;\n}\ndouble(4);', ['4', '8', '42'], 1)],
    [Q('What is the value of x?', 'function add(a, b = 10) {\n  return a + b;\n}\nconst x = add(5);', ['5', '15', 'NaN', 'undefined'], 1),
     Q('What does this log?', 'const greet = name => `Hi ${name}`;\nconsole.log(greet("KL"));', ['Hi name', 'Hi KL', 'greet KL', 'undefined'], 1)],
    [Q('What does counter() return the 3rd time?', 'function make() {\n  let n = 0;\n  return () => ++n;\n}\nconst counter = make();', ['0', '1', '3', 'NaN'], 2)],
    [Q('What is logged?', 'console.log(typeof hoisted, typeof later);\nfunction hoisted() {}\nvar later = () => {};', ['function function', 'function undefined', 'undefined undefined', 'ReferenceError'], 1)],
  ],
  object: [
    [Q('What is bird.name?', 'const bird = { name: "hornbill", wings: 2 };', ['"bird"', '"hornbill"', '2'], 1)],
    [Q('What is logged?', 'const p = { x: 1 };\np.y = 2;\nconsole.log(Object.keys(p).length);', ['1', '2', '3', 'undefined'], 1)],
    [Q('What is logged?', 'const { name, speed = 7 } = { name: "Rimba" };\nconsole.log(name, speed);', ['Rimba undefined', 'Rimba 7', 'undefined 7', 'Error'], 1)],
    [Q('What is logged?', 'const a = { n: 1 };\nconst b = { ...a };\nb.n = 2;\nconsole.log(a.n, JSON.stringify({ u: undefined }));', ['1 {}', '2 {}', '1 {"u":undefined}', '2 {"u":null}'], 0)],
  ],
  event: [
    [Q('When does erupt() run?', 'button.addEventListener("click", erupt);', ['right away', 'when the button is clicked', 'never'], 1)],
    [Q('In what order are the letters logged?', 'console.log("A");\nsetTimeout(() => console.log("B"), 0);\nconsole.log("C");', ['A B C', 'A C B', 'B A C', 'C A B'], 1)],
    [Q('What is wrong here?', 'btn.addEventListener("click", erupt());', ['nothing', 'erupt runs immediately, not on click', '"click" should be "onclick"', 'missing semicolon'], 1)],
    [Q('What is logged?', 'console.log(1);\nPromise.resolve().then(() => console.log(2));\nsetTimeout(() => console.log(3));\nconsole.log(4);', ['1 2 3 4', '1 4 2 3', '1 4 3 2', '1 2 4 3'], 1)],
  ],
  async: [
    [Q('Which keyword waits for a Promise?', 'async function load() {\n  const data = ___ fetch(url);\n}', ['wait', 'await', 'then'], 1),
     Q('An async function always returns…', 'async function f() { return 1; }', ['a number', 'a Promise', 'nothing'], 1)],
    [Q('What does this log?', 'async function f() { return 7; }\nf().then(v => console.log(v + 1));', ['7', '8', 'Promise', 'undefined'], 1)],
    [Q('How long until "done" (roughly)?', 'const wait = ms => new Promise(r => setTimeout(r, ms));\nawait Promise.all([wait(300), wait(500)]);\nconsole.log("done");', ['300 ms', '500 ms', '800 ms', 'never'], 1)],
    [Q('How long until "done" (roughly)?', 'const wait = ms => new Promise(r => setTimeout(r, ms));\nfor (const ms of [300, 500]) await wait(ms);\nconsole.log("done");', ['300 ms', '500 ms', '800 ms', 'never'], 2)],
  ],
  try: [
    [Q('What runs if crossLava() throws?', 'try { crossLava(); }\ncatch (e) { respawn(); }', ['nothing', 'respawn()', 'the game crashes'], 1)],
    [Q('What is logged?', 'try {\n  JSON.parse("{bad json}");\n  console.log("ok");\n} catch {\n  console.log("oops");\n}', ['ok', 'oops', 'ok oops', 'nothing'], 1)],
    [Q('What is logged?', 'function f() {\n  try { return "try"; }\n  finally { console.log("finally"); }\n}\nconsole.log(f());', ['try', 'finally try', 'try finally', 'finally'], 1)],
    [Q('Is the error caught?', 'try {\n  setTimeout(() => { throw new Error("boom"); });\n} catch (e) {\n  console.log("caught");\n}', ['yes, logs "caught"', 'no — it throws later, outside the try', 'yes, silently', 'syntax error'], 1)],
  ],
};

export function pickQuestion(topic, difficulty) {
  const pool = QUESTIONS[topic][Math.min(difficulty, QUESTIONS[topic].length - 1)];
  return pool[Math.floor(Math.random() * pool.length)];
}

// tiny JS highlighter for the code panels — one pass, so it never re-highlights its own markup
const TOKENS = /(\/\/.*$)|("[^"\n]*"|`[^`]*`)|\b(for|let|const|var|function|return|async|await|if|else|new|typeof|try|catch|finally|throw|console|setTimeout|Promise|JSON|Object)\b|\b(\d+)\b/gm;
export function highlight(src) {
  const esc = src.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(TOKENS, (m, com, str, kw, num) =>
    com ? `<span class="c-com">${com}</span>` :
    str ? `<span class="c-str">${str}</span>` :
    kw ? `<span class="c-kw">${kw}</span>` :
    `<span class="c-num">${num}</span>`);
}
