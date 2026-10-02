# LARI.js — from kampung to KL

**▶ Play: https://markinko202-sys.github.io/lari-js/**

A 3D Mario-style platformer for the browser where every life lesson you learn becomes a power.
*Lari* is Malay for **run**: you run from a night kampung through a rainforest, a volcano, a sunset beach
and limestone caves to the rooftops of Kuala Lumpur.

- **6 levels + a finale**, each with three life-lesson gates (friendship, health, money, feelings, safety, time, kindness…),
  a boss and a flagpole. The second gate of each level teaches a virtue that unlocks a power:
  persistence → double jump · focus → dash · patience → glide · courage → sambal shot · humility → ground pound · resilience → wall jump.
- **12 characters** (including Siti, Mei, Priya and Puteri), each with a signature emote and catchphrase; hats, trails and power-ups
  in the shop, every item with a rendered preview and try-on.
- **4 languages**: English, Русский, 中文, Bahasa Melayu.
- Desktop (keyboard) and phones (touch controls, portrait and landscape).

## How it's made

- **Three.js** with ES modules and no build step; a hand-written platformer physics module (`js/physics.js`) that runs headless in Node.
- **Every 3D model is generated with Python in Blender** (`blender/*.py` → Draco-compressed `assets/*.glb`).
- **All music and sound effects are synthesised live** with the Web Audio API — ten soundtracks, no audio files.
- `tools/check_levels.mjs` proves, with the real physics, that every level × difficulty can be finished with quick taps
  and that no power obstacle can be skipped.

```bash
python3 tools/devserver.py 5190 .     # then open http://localhost:5190  (?debug exposes window.__lari)
node tools/check_levels.mjs           # level validator
blender -b --python blender/characters.py -- render   # rebuild models
```

Built by **Artemiy Shepelev** · [Portfolio](https://artemiy-shepelev.vercel.app) · [LinkedIn](https://www.linkedin.com/in/artemiy-shepelev-063000430)
