# World kits: shared gameplay props + one kit per level (night kampung, rainforest, volcano) + the KL finale.
# Tiles are 1 x 1 in the play plane (X right, Z up) and DEPTH deep along Y so the side view reads as 3D.
import math, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import lib

DEPTH = 2.4
random.seed(11)

# ------------------------------------------------------------------ shared props
def common(x0):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    out = []
    gold = mat("coin_gold", "#f2b632", rough=0.25, metal=0.9)
    goldd = mat("coin_gold_dark", "#c98a1c", rough=0.3, metal=0.9)

    r = empty("Coin", P(0, 0, 0)); out.append(r)
    cyl("CoinDisc", 0.32, 0.08, P(0, 0, 0), gold, r, rot=(math.radians(90), 0, 0), verts=32)
    torus("CoinRim", 0.30, 0.025, P(0, 0, 0), goldd, r, rot=(math.radians(90), 0, 0))
    text("CoinMark", "{}", 0.32, P(0, -0.045, 0.0), goldd, r, extrude=0.012)

    # the enemy is literally a bug
    r = empty("Bug", P(2, 0, 0)); out.append(r)
    shell = mat("bug_shell", "#c8312b", rough=0.3, coat=1.0)
    ink = mat("bug_ink", "#16141b", rough=0.4)
    ball("Shell", 0.36, P(2, 0, 0.3), shell, r, scale=(1.15, 1.0, 0.75), seg=32, rings=16)
    rbox("Split", (0.74, 0.03, 0.02), P(2 - 0.02, 0, 0.57), ink, r)
    for i, (dx, dy) in enumerate([(-0.15, 0.15), (0.12, 0.2), (-0.05, -0.18), (0.2, -0.1), (-0.25, -0.05)]):
        ball(f"Spot{i}", 0.06, P(2 + dx, dy, 0.53), ink, r, scale=(1, 1, 0.4))
    ball("BugHead", 0.17, P(2 + 0.36, 0, 0.27), ink, r)
    white = mat("bug_eye", "#fbfaf6", rough=0.3)
    for y in (0.08, -0.08):
        ball(f"BugEye{y}", 0.055, P(2 + 0.48, y, 0.32), white, r)
        ball(f"BugPupil{y}", 0.028, P(2 + 0.52, y, 0.32), ink, r)
        limb(f"Antenna{y}", P(2 + 0.42, y * 0.8, 0.4), P(2 + 0.6, y * 2.2, 0.62), 0.012, ink, r)
        ball(f"AntTip{y}", 0.03, P(2 + 0.6, y * 2.2, 0.62), shell, r)
    for side in (1, -1):
        for k, dx in enumerate((-0.2, 0.0, 0.2)):
            leg = empty(f"BugLeg{'L' if side > 0 else 'R'}{k}", P(2 + dx, side * 0.25, 0.22), r)
            limb(f"BugLegMesh{side}{k}", P(2 + dx, side * 0.25, 0.22), P(2 + dx + 0.04, side * 0.42, 0.02), 0.025, ink, leg)

    # winged bug for the air
    r = empty("FlyBug", P(4, 0, 0)); out.append(r)
    ball("FlyBody", 0.25, P(4, 0, 0), mat("fly_body", "#5b3fa8", rough=0.3, coat=1.0), r, scale=(1.2, 1, 0.9))
    for y in (0.08, -0.08):
        ball(f"FlyEye{y}", 0.07, P(4 + 0.24, y, 0.06), white, r)
        ball(f"FlyPupil{y}", 0.035, P(4 + 0.29, y, 0.06), ink, r)
    for side in ("L", "R"):
        y = 0.18 if side == "L" else -0.18
        w = empty(f"Wing{side}", P(4 - 0.05, y, 0.18), r)
        ball(f"WingMesh{side}", 0.22, P(4 - 0.1, y * 1.6, 0.34), mat("wing", "#cfe8f2", rough=0.1, alpha=0.6), w, scale=(1, 0.5, 0.25))

    # code block (the "?" block) and its spent version
    cb = mat("block_teal", "#2f8f86", rough=0.45, coat=0.5)
    cream = mat("block_cream", "#efe4cc", rough=0.5)
    r = empty("CodeBlock", P(6, 0, 0)); out.append(r)
    rbox("CodeBlockMesh", (0.96, 0.96, 0.96), P(6, 0, 0), cb, r, bevel=0.08)
    text("CodeBlockMark", "{ }", 0.42, P(6, -0.49, 0.02), cream, r, extrude=0.03)
    for dx in (-0.36, 0.36):
        for dz in (-0.36, 0.36):
            ball(f"Rivet{dx}{dz}", 0.04, P(6 + dx, -0.48, dz), cream, r)
    r = empty("CodeBlockUsed", P(7.2, 0, 0)); out.append(r)
    rbox("UsedMesh", (0.96, 0.96, 0.96), P(7.2, 0, 0), mat("block_used", "#5a4a3e", rough=0.7), r, bevel=0.08)

    # code gate: stone arch with a glowing terminal screen and a barrier you "compile" open
    r = empty("Gate", P(9, 0, 0)); out.append(r)
    stone = mat("gate_stone", "#4a4f5a", rough=0.8)
    rbox("PillarL", (0.45, 0.7, 3.0), P(9 - 0.95, 0, 1.5), stone, r, bevel=0.06)
    rbox("PillarR", (0.45, 0.7, 3.0), P(9 + 0.95, 0, 1.5), stone, r, bevel=0.06)
    rbox("Lintel", (2.4, 0.8, 0.5), P(9, 0, 3.15), stone, r, bevel=0.06)
    rbox("Screen", (1.3, 0.06, 0.34), P(9, -0.41, 3.15), mat("gate_screen", "#0f2a2b", rough=0.3), r, bevel=0.02)
    text("ScreenText", "if (skill)", 0.16, P(9, -0.45, 3.15), mat("gate_glow", "#4ff0c8", emit=4.0), r, extrude=0.005)
    bar = empty("GateBarrier", P(9, 0, 1.45), r)
    rbox("BarrierMesh", (1.45, 0.12, 2.85), P(9, 0, 1.45), mat("barrier", "#4ff0c8", emit=2.5, alpha=0.45), bar)

    # heart pickup
    r = empty("Heart", P(11, 0, 0)); out.append(r)
    red = mat("heart_red", "#e2384f", rough=0.25, coat=1.0)
    ball("HeartL", 0.2, P(11 - 0.12, 0, 0.1), red, r)
    ball("HeartR", 0.2, P(11 + 0.12, 0, 0.1), red, r)
    cyl("HeartTip", 0.27, 0.36, P(11, 0, -0.14), red, r, verts=24, r2=0.0, rot=(math.radians(180), 0, 0))

    # checkpoint flag
    r = empty("Checkpoint", P(13, 0, 0)); out.append(r)
    cyl("Pole", 0.04, 2.2, P(13, 0, 1.1), mat("pole", "#d9d6cf", rough=0.3, metal=0.8), r, verts=12)
    flag = empty("Flag", P(13, 0, 2.0), r)
    rbox("FlagCloth", (0.8, 0.04, 0.5), P(13 + 0.42, 0, 1.92), mat("flag", "#e8b33a", rough=0.6), flag)
    text("FlagMark", "</>", 0.22, P(13 + 0.42, -0.03, 1.92), mat("flag_ink", "#26252d"), flag, extrude=0.01)
    ball("PoleTop", 0.07, P(13, 0, 2.22), mat("pole_top", "#e8b33a", rough=0.3, metal=0.6), r)

    # spring pad
    r = empty("Spring", P(15, 0, 0)); out.append(r)
    cyl("SpringBase", 0.4, 0.12, P(15, 0, 0.06), mat("spring_base", "#26252d"), r)
    for k in range(4):
        torus(f"Coil{k}", 0.26, 0.04, P(15, 0, 0.18 + k * 0.08), mat("coil", "#bfc4c8", rough=0.25, metal=0.9), r)
    cyl("SpringTop", 0.42, 0.1, P(15, 0, 0.5), mat("spring_top", "#c8312b", rough=0.4, coat=0.6), r)
    return out

# ------------------------------------------------------------------ tile helpers
def tile_set(prefix, x0, top_col, fill_col, lip_col=None, top_rough=0.75):
    out = []
    top = mat(f"{prefix}_top", top_col, rough=top_rough)
    fill = mat(f"{prefix}_fill", fill_col, rough=0.9)
    r = empty(f"{prefix}_TileTop", (x0, 0, 0)); out.append(r)
    rbox(f"{prefix}_TT_dirt", (1.0, DEPTH, 0.86), (x0, 0, -0.07), fill, r)
    rbox(f"{prefix}_TT_cap", (1.04, DEPTH + 0.04, 0.2), (x0, 0, 0.4), top, r, bevel=0.05)
    if lip_col:  # little bumps along the front edge
        lip = mat(f"{prefix}_lip", lip_col, rough=0.8)
        for k in range(3):
            ball(f"{prefix}_bump{k}", 0.11, (x0 - 0.33 + k * 0.33, -DEPTH / 2 + 0.02, 0.33), lip, r, scale=(1.3, 0.7, 0.8), seg=12, rings=6)
    r = empty(f"{prefix}_TileFill", (x0 + 1.2, 0, 0)); out.append(r)
    rbox(f"{prefix}_TF", (1.0, DEPTH, 1.0), (x0 + 1.2, 0, 0), fill, r)
    for k in range(2):  # pebbles so the dirt doesn't read as flat
        ball(f"{prefix}_peb{k}", 0.07, (x0 + 1.2 + random.uniform(-0.3, 0.3), -DEPTH / 2, random.uniform(-0.3, 0.3)),
             mat(f"{prefix}_peb", fill_col, rough=0.9), r, scale=(1.2, 0.5, 0.8), seg=8, rings=5)
    return out

# ------------------------------------------------------------------ level 1: night kampung
def kit_village(x0):
    out = tile_set("vil", x0, "#2e5a3a", "#4a3426", lip_col="#3d7046")
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    wood = mat("vil_wood", "#7a5232", rough=0.8)
    wood_d = mat("vil_wood_dark", "#4e321f", rough=0.85)
    thatch = mat("vil_attap", "#6b5a3a", rough=0.95)
    window = mat("vil_window", "#ffb85c", emit=4.0)

    r = empty("vil_Plank", P(3, 0, 0)); out.append(r)
    for k in range(3):
        rbox(f"Plank{k}", (1.0, DEPTH * 0.7 / 3 - 0.03, 0.12), P(3, -DEPTH * 0.35 + DEPTH * 0.7 / 6 + k * DEPTH * 0.7 / 3, 0.4),
             wood if k % 2 else wood_d, r, bevel=0.02)
    rbox("PlankBeam", (1.0, 0.1, 0.14), P(3, -DEPTH * 0.35, 0.3), wood_d, r)

    # kampung stilt house
    r = empty("vil_House", P(6, 0, 0)); out.append(r)
    for dx in (-1.3, 1.3):
        for dy in (-0.9, 0.9):
            cyl(f"Stilt{dx}{dy}", 0.08, 1.2, P(6 + dx, dy, 0.6), wood_d, r, verts=8)
    rbox("Floor", (3.0, 2.2, 0.15), P(6, 0, 1.25), wood_d, r)
    rbox("Walls", (2.8, 2.0, 1.5), P(6, 0, 2.05), wood, r, bevel=0.02)
    for k in range(7):
        rbox(f"Slat{k}", (0.04, 0.02, 1.5), P(6 - 1.2 + k * 0.4, -1.01, 2.05), wood_d, r)
    for dx in (-0.65, 0.65):
        rbox(f"Window{dx}", (0.55, 0.05, 0.6), P(6 + dx, -1.02, 2.15), window, r)
        rbox(f"WinFrame{dx}", (0.65, 0.04, 0.08), P(6 + dx, -1.04, 2.48), wood_d, r)
    prism("Roof", [(-1.9, 0), (1.9, 0), (0, 1.5)], 2.6, thatch, r, loc=P(6, 0, 2.8))
    prism("RoofTrim", [(-1.95, -0.05), (1.95, -0.05), (0, 1.52), (0, 1.62)], 2.7, wood_d, r, loc=P(6, 0, 2.8))
    for k in range(5):
        rbox(f"Step{k}", (0.5, 0.25, 0.06), P(6 + 1.75 + k * 0.12, -0.6, 0.25 + k * 0.24), wood_d, r)

    # coconut palm
    r = empty("vil_Palm", P(10, 0, 0)); out.append(r)
    trunk = mat("palm_trunk", "#6e5640", rough=0.9)
    leaf = mat("palm_leaf", "#2f6b3a", rough=0.7)
    pts = [(0, 0), (0.15, 1.2), (0.45, 2.4), (0.9, 3.4)]
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]
        limb(f"Trunk{k}", P(a[0], 0, a[1]), P(b[0], 0, b[1]), 0.17 - k * 0.03, trunk, r, r2=0.15 - k * 0.03)
    top = P(0.9, 0, 3.45)
    for k in range(7):
        a = k * 2 * math.pi / 7
        tip = (top[0] + math.cos(a) * 1.5, math.sin(a) * 1.3, top[2] - 0.6 - (0.3 if k % 2 else 0))
        mid = ((top[0] + tip[0]) / 2, (top[1] + tip[1]) / 2, top[2] + 0.25)
        limb(f"FrondA{k}", top, mid, 0.09, leaf, r, r2=0.12)
        limb(f"FrondB{k}", mid, tip, 0.12, leaf, r, r2=0.02)
    for k in range(3):
        ball(f"Coconut{k}", 0.13, (top[0] - 0.1 + k * 0.1, 0.1 - k * 0.1, top[2] - 0.2), mat("coconut", "#5a4a2a"), r)

    # pelita (bamboo oil torch)
    r = empty("vil_Lantern", P(12, 0, 0)); out.append(r)
    cyl("Bamboo", 0.05, 1.5, P(12, 0, 0.75), mat("bamboo", "#b59a52", rough=0.6), r, verts=10)
    for z in (0.4, 0.9, 1.3):
        torus(f"Node{z}", 0.05, 0.012, P(12, 0, z), mat("bamboo_node", "#8a7238"), r)
    cyl("Wick", 0.07, 0.12, P(12, 0, 1.55), mat("tin", "#6b6b66", metal=0.8, rough=0.4), r, verts=12)
    ball("Flame", 0.11, P(12, 0, 1.72), mat("flame", "#ffb347", emit=12.0), r, scale=(0.8, 0.8, 1.4))

    r = empty("vil_Fence", P(14, 0, 0)); out.append(r)
    for k in range(4):
        rbox(f"Picket{k}", (0.1, 0.06, 0.7), P(14 - 0.36 + k * 0.24, 0, 0.35), wood, r)
    rbox("Rail", (1.0, 0.05, 0.08), P(14, -0.04, 0.45), wood_d, r)

    r = empty("vil_Bush", P(16, 0, 0)); out.append(r)
    for k, (dx, s) in enumerate([(-0.3, 0.35), (0.05, 0.45), (0.38, 0.32)]):
        ball(f"BushBall{k}", s, P(16 + dx, 0, s * 0.8), mat("vil_bush", "#25502f", rough=0.85), r)
    return out

# ------------------------------------------------------------------ level 2: rainforest
def kit_forest(x0):
    out = tile_set("for", x0, "#4f8a3a", "#5a4030", lip_col="#6aa646")
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    bark = mat("for_bark", "#5e4430", rough=0.9)
    leafA = mat("for_leafA", "#2f7a3a", rough=0.75)
    leafB = mat("for_leafB", "#4f9a3e", rough=0.75)

    r = empty("for_Log", P(3, 0, 0)); out.append(r)
    cyl("LogBody", 0.32, DEPTH * 0.7, P(3, 0, 0.18), bark, r, rot=(math.radians(90), 0, 0), verts=16)
    cyl("LogRing", 0.27, 0.02, P(3, -DEPTH * 0.35, 0.18), mat("for_ring", "#c9a26a"), r, rot=(math.radians(90), 0, 0), verts=16)
    rbox("Moss", (0.6, DEPTH * 0.6, 0.08), P(3, 0, 0.48), leafB, r, bevel=0.03)

    r = empty("for_Tree", P(6, 0, 0)); out.append(r)
    limb("TrunkMain", P(6, 0, 0), P(6.1, 0, 3.2), 0.32, bark, r, r2=0.22)
    limb("Root1", P(6, 0, 0.3), P(5.5, -0.3, 0.0), 0.12, bark, r, r2=0.06)
    limb("Root2", P(6, 0, 0.3), P(6.5, 0.2, 0.0), 0.12, bark, r, r2=0.06)
    for k, (dx, dz, s, m) in enumerate([(0, 3.6, 1.3, leafA), (-0.9, 3.0, 0.9, leafB), (0.9, 3.1, 0.95, leafA), (0.1, 4.4, 0.85, leafB)]):
        ball(f"Canopy{k}", s, P(6 + dx, 0, dz), m, r, scale=(1, 0.9, 0.8), seg=16, rings=10)
    for k in range(3):
        limb(f"Vine{k}", P(6 - 0.8 + k * 0.8, -0.6, 3.0), P(6 - 0.85 + k * 0.8, -0.65, 1.6 + k * 0.3), 0.03, leafB, r)

    r = empty("for_Mushroom", P(9, 0, 0)); out.append(r)
    cyl("Stem", 0.12, 0.45, P(9, 0, 0.22), mat("for_stem", "#efe4cc"), r, verts=16, r2=0.1)
    ball("Cap", 0.32, P(9, 0, 0.45), mat("for_cap", "#c8312b", rough=0.4, coat=0.5), r, scale=(1, 1, 0.6))
    for k in range(6):
        a = k * 1.05
        ball(f"Dot{k}", 0.05, P(9 + math.cos(a) * 0.2, math.sin(a) * 0.2, 0.6), mat("for_dot", "#fbfaf6"), r, scale=(1, 1, 0.4))

    r = empty("for_Fern", P(11, 0, 0)); out.append(r)
    for k in range(6):
        a = k * math.pi / 3
        limb(f"Frond{k}", P(11, 0, 0.05), P(11 + math.cos(a) * 0.55, math.sin(a) * 0.4, 0.55), 0.06, leafB, r, r2=0.01)

    r = empty("for_Rock", P(13, 0, 0)); out.append(r)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5, location=P(13, 0, 0.3))
    o = bpy.context.object; o.scale = (1.3, 1, 0.8)
    for v in o.data.vertices: v.co *= random.uniform(0.85, 1.15)
    lib._finish(o, "RockMesh", r, mat("for_rock", "#7a7f86", rough=0.85), False)
    rbox("RockMoss", (0.8, 0.8, 0.08), P(13, 0, 0.66), leafB, r, bevel=0.03)

    r = empty("for_Hornbill", P(15, 0, 0)); out.append(r)   # Malaysian hornbill perched in the canopy
    ball("HbBody", 0.25, P(15, 0, 0.3), mat("hb_black", "#1b1a20"), r, scale=(1.3, 0.8, 0.9))
    ball("HbHead", 0.15, P(15 + 0.3, 0, 0.5), mat("hb_black", "#1b1a20"), r)
    cyl("HbBeak", 0.08, 0.4, P(15 + 0.6, 0, 0.47), mat("hb_beak", "#f2b632", rough=0.4), r, rot=(0, math.radians(100), 0), r2=0.01, verts=12)
    rbox("HbCasque", (0.3, 0.08, 0.1), P(15 + 0.45, 0, 0.6), mat("hb_casque", "#e2702e"), r, bevel=0.04)
    rbox("HbTail", (0.5, 0.06, 0.15), P(15 - 0.45, 0, 0.2), mat("hb_white", "#efe4cc"), r, bevel=0.04)
    return out

# ------------------------------------------------------------------ level 3: volcano
def kit_volcano(x0):
    out = tile_set("vol", x0, "#3a3030", "#241e1e", top_rough=0.85)
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    ember = mat("vol_ember", "#ff6a1f", emit=6.0)
    basalt = mat("vol_basalt", "#2b2626", rough=0.9)
    # glowing seams on the TOP of the cap (not the front face — there they read as road markings)
    top_root = [o for o in out if o.name == "vol_TileTop"][0]
    rbox("Seam", (0.5, DEPTH * 0.5, 0.02), (x0 + 0.1, 0.2, 0.505), ember, top_root, rot=(0, 0, math.radians(25)))

    r = empty("vol_Platform", P(3, 0, 0)); out.append(r)
    rbox("BasaltSlab", (1.0, DEPTH * 0.7, 0.4), P(3, 0, 0.3), basalt, r, bevel=0.05)
    rbox("SlabGlow", (0.9, 0.02, 0.04), P(3, -DEPTH * 0.35 - 0.01, 0.2), ember, r)

    r = empty("vol_Mountain", P(8, 0, 0)); out.append(r)
    cyl("Cone", 4.0, 5.0, P(8, 0, 2.5), mat("vol_mountain", "#3d2f2c", rough=0.95), r, verts=10, r2=1.0, smooth=False)
    cyl("Crater", 1.05, 0.2, P(8, 0, 5.0), mat("vol_lava_glow", "#ff5a14", emit=10.0), r, verts=10)
    for k in range(4):
        a = k * 1.5 + 0.4
        limb(f"Flow{k}", P(8 + math.cos(a) * 1.0, math.sin(a) * 1.0 - 0.1, 4.9), P(8 + math.cos(a) * 2.6, math.sin(a) * 2.6 - 0.2, 2.0),
             0.12, ember, r, r2=0.05)

    r = empty("vol_Spike", P(14, 0, 0)); out.append(r)
    for k, (dx, h) in enumerate([(-0.25, 0.8), (0.0, 1.2), (0.25, 0.7)]):
        cyl(f"Spike{k}", 0.2, h, P(14 + dx, 0, h / 2), basalt, r, verts=6, r2=0.02, smooth=False)

    r = empty("vol_Crystal", P(16, 0, 0)); out.append(r)
    for k, (dx, h, tilt) in enumerate([(-0.15, 0.7, -15), (0.05, 1.0, 5), (0.22, 0.6, 20)]):
        cyl(f"Crystal{k}", 0.12, h, P(16 + dx, 0, h / 2), mat("vol_crystal", "#ff8a3d", rough=0.15, emit=2.5), r,
            verts=6, r2=0.0, rot=(0, math.radians(tilt), 0), smooth=False)

    r = empty("vol_DeadTree", P(18, 0, 0)); out.append(r)
    charcoal = mat("vol_char", "#1c1818", rough=0.9)
    limb("DTrunk", P(18, 0, 0), P(18.1, 0, 2.0), 0.14, charcoal, r, r2=0.06)
    limb("DBranch1", P(18.08, 0, 1.4), P(18.6, 0, 2.0), 0.05, charcoal, r, r2=0.02)
    limb("DBranch2", P(18.06, 0, 1.1), P(17.5, 0, 1.6), 0.05, charcoal, r, r2=0.02)
    return out

# ------------------------------------------------------------------ finale: Kuala Lumpur skyline
def kit_city(x0):
    out = []
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    steel = mat("city_steel", "#c9ced4", rough=0.2, metal=1.0)
    glass = mat("city_glass", "#1d2a3a", rough=0.15, metal=0.3)
    lit = mat("city_window", "#ffd27a", emit=3.0)

    r = empty("city_Petronas", P(0, 0, 0)); out.append(r)
    for sx in (-1.1, 1.1):
        z, rad = 0.0, 0.8
        for i, h in enumerate([4.0, 1.6, 1.2, 0.9, 0.7, 0.5]):
            cyl(f"PT{sx}_{i}", rad, h, P(sx, 0, z + h / 2), steel, r, verts=16)
            for k in range(int(h / 0.35)):
                cyl(f"PTband{sx}_{i}_{k}", rad + 0.01, 0.05, P(sx, 0, z + 0.2 + k * 0.35), lit, r, verts=16)
            z += h; rad *= 0.85
        cyl(f"Spire{sx}", 0.08, 1.8, P(sx, 0, z + 0.9), steel, r, verts=8, r2=0.01)
    rbox("Skybridge", (1.4, 0.3, 0.25), P(0, 0, 3.4), steel, r)
    rbox("SkyLegs", (1.0, 0.2, 0.9), P(0, 0, 2.9), steel, r)

    r = empty("city_KLTower", P(5, 0, 0)); out.append(r)
    cyl("KLShaft", 0.3, 6.5, P(5, 0, 3.25), mat("city_concrete", "#d9d6cf", rough=0.6), r, verts=16, r2=0.22)
    ball("KLPod", 0.8, P(5, 0, 6.3), glass, r, scale=(1, 1, 0.6))
    cyl("KLPodBand", 0.82, 0.12, P(5, 0, 6.3), lit, r, verts=24)
    cyl("KLAntenna", 0.06, 2.0, P(5, 0, 7.6), steel, r, verts=8, r2=0.01)

    for k in range(4):  # generic towers with window grids
        w, h = random.uniform(1.4, 2.2), random.uniform(3.0, 6.0)
        r = empty(f"city_Tower{k}", P(8 + k * 3, 0, 0)); out.append(r)
        rbox(f"TowerBody{k}", (w, 1.6, h), P(8 + k * 3, 0, h / 2), glass, r)
        rows, cols = int(h / 0.5), int(w / 0.35)
        for i in range(rows):
            for j in range(cols):
                if random.random() < 0.55:
                    rbox(f"Win{k}_{i}_{j}", (0.18, 0.02, 0.24), P(8 + k * 3 - w / 2 + 0.25 + j * 0.35, -0.81, 0.4 + i * 0.5), lit, r)
    return out

if __name__ == "__main__":
    reset()
    export(common(0), "common.glb")
    export(kit_village(30), "kit_village.glb")
    export(kit_forest(60), "kit_forest.glb")
    export(kit_volcano(90), "kit_volcano.glb")
    export(kit_city(130), "kit_city.glb")
    if "render" in sys.argv:
        cam = studio(res=(1600, 520), bg="#101320")
        shoot(cam, (8, -14, 2.5), (8, 0, 0.9), 34, "common.png")
        shoot(cam, (38, -16, 4.5), (38, 0, 1.6), 38, "village.png")
        shoot(cam, (68, -16, 4), (68, 0, 1.6), 38, "forest.png")
        shoot(cam, (99, -18, 4.5), (99, 0, 1.8), 38, "volcano.png")
        shoot(cam, (139, -20, 4.5), (139, 0, 3), 36, "city.png")
        print("RENDERED")
    print("OK world")
