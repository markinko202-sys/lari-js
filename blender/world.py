# World kits: shared gameplay props + one kit per level (night kampung, rainforest, volcano) + the KL finale.
# Tiles are 1 x 1 in the play plane (X right, Z up) and DEPTH deep along Y so the side view reads as 3D.
import math, random, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import lib

DEPTH = 2.4
random.seed(11)

# ------------------------------------------------------------------ shared props
def star_outline(r_out, r_in, n=5):
    pts = []
    for i in range(n * 2):
        a = math.pi / 2 + i * math.pi / n
        r = r_out if i % 2 == 0 else r_in
        pts.append((math.cos(a) * r, math.sin(a) * r))
    return pts

def common(x0):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    out = []
    gold = mat("coin_gold", "#f2b632", rough=0.25, metal=0.9)
    goldd = mat("coin_gold_dark", "#c98a1c", rough=0.3, metal=0.9)

    r = empty("Coin", P(0, 0, 0)); out.append(r)
    cyl("CoinDisc", 0.32, 0.08, P(0, 0, 0), gold, r, rot=(math.radians(90), 0, 0), verts=32)
    torus("CoinRim", 0.30, 0.025, P(0, 0, 0), goldd, r, rot=(math.radians(90), 0, 0))
    for side in (-1, 1):   # a raised star on both faces (the coin spins)
        prism(f"CoinStar{side}", star_outline(0.17, 0.075), 0.03, goldd, r, loc=P(0, side * 0.045, 0.0))

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

    # the surprise block and its spent version
    cb = mat("block_teal", "#2f8f86", rough=0.45, coat=0.5)
    cream = mat("block_cream", "#efe4cc", rough=0.5)
    r = empty("CodeBlock", P(6, 0, 0)); out.append(r)
    rbox("CodeBlockMesh", (0.96, 0.96, 0.96), P(6, 0, 0), cb, r, bevel=0.08)
    # the surprise block: a big "?" — coins, a heart, a star or a 1-UP inside
    text("CodeBlockMarkShadow", "?", 1.0, P(6 + 0.045, -0.488, -0.045), mat("block_shadow", "#123c39", rough=0.6), r, extrude=0.02)
    text("CodeBlockMark", "?", 1.0, P(6, -0.5, 0.0), cream, r, extrude=0.03)
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
    text("ScreenText", "learn · run", 0.15, P(9, -0.45, 3.15), mat("gate_glow", "#4ff0c8", emit=4.0), r, extrude=0.005)
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
    prism("FlagMark", star_outline(0.15, 0.065), 0.06, mat("flag_ink", "#26252d"), flag, loc=P(13 + 0.42, 0, 1.92))
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

# ------------------------------------------------------------------ level 4: pantai (beach at sunset)
def eyes(P, x, z, parent, y=0.09, r=0.06, angry=False, glow=None):
    white = mat("en_eye", "#fbfaf6", rough=0.3)
    ink = mat("en_ink", "#16141b", rough=0.4)
    for s in (1, -1):
        if glow:
            ball(f"EyeG{s}", r, P(x, s * y, z), mat(f"en_glow_{glow}", glow, emit=5.0), parent)
        else:
            ball(f"EyeW{s}", r, P(x, s * y, z), white, parent)
            ball(f"EyeP{s}", r * 0.55, P(x + r * 0.6, s * y, z), ink, parent)
        if angry:
            rbox(f"Brow{s}", (0.05, r * 2.2, 0.03), P(x + 0.01, s * y, z + r * 1.1), ink, parent, rot=(math.radians(-25 * s), 0, 0))

def kit_beach(x0):
    out = tile_set("bch", x0, "#efd09a", "#d2ac72", lip_col="#fff3d6")
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    wood = mat("bch_wood", "#b4865a", rough=0.8)
    wood_d = mat("bch_wood_d", "#7a5636", rough=0.85)
    sand = mat("bch_sand", "#e8c88e", rough=0.95)

    r = empty("bch_Pier", P(3, 0, 0)); out.append(r)
    for k in range(3):
        rbox(f"PierPlank{k}", (1.0, DEPTH * 0.7 / 3 - 0.03, 0.1), P(3, -DEPTH * 0.35 + DEPTH * 0.7 / 6 + k * DEPTH * 0.7 / 3, 0.42),
             wood if k % 2 else wood_d, r, bevel=0.02)
    for dy in (-0.7, 0.7):
        cyl(f"PierPost{dy}", 0.07, 1.6, P(3, dy, -0.35), wood_d, r, verts=8)

    r = empty("bch_Umbrella", P(5, 0, 0)); out.append(r)
    cyl("UmbPole", 0.04, 2.0, P(5, 0, 1.0), mat("umb_pole", "#efe4cc"), r, verts=8)
    top = cyl("UmbTop", 1.0, 0.45, P(5, 0, 2.05), mat("umb_red", "#e2382e", rough=0.6), r, r2=0.05, verts=16, smooth=False)
    top.data.materials.append(mat("umb_white", "#fbfaf6", rough=0.6))
    for i, poly in enumerate(top.data.polygons):      # alternate red / white wedges
        if abs(poly.normal.z) < 0.99:
            a = math.atan2(poly.center.y, poly.center.x - 5)
            poly.material_index = int((a + math.pi) / (math.pi / 4)) % 2
    rbox("Towel", (1.1, 0.6, 0.03), P(5 + 0.4, -0.5, 0.02), mat("towel", "#286eeb", rough=0.9), r)

    r = empty("bch_Castle", P(7.5, 0, 0)); out.append(r)
    rbox("CastleBase", (0.9, 0.7, 0.35), P(7.5, 0, 0.17), sand, r, bevel=0.05)
    for k, (dx, h) in enumerate([(-0.3, 0.55), (0.0, 0.75), (0.3, 0.5)]):
        cyl(f"CastleTower{k}", 0.15, h, P(7.5 + dx, 0, 0.3 + h / 2), sand, r, verts=12)
        cyl(f"CastleCone{k}", 0.18, 0.22, P(7.5 + dx, 0, 0.3 + h + 0.11), sand, r, r2=0.0, verts=12)
    rbox("CastleFlag", (0.18, 0.02, 0.12), P(7.5 + 0.09, 0, 1.38), mat("castle_flag", "#e2382e"), r)
    cyl("CastleStick", 0.01, 0.35, P(7.5, 0, 1.3), mat("castle_stick", "#7a5636"), r, verts=6)

    r = empty("bch_Hut", P(10, 0, 0)); out.append(r)     # chalet on stilts
    for dx in (-1.1, 1.1):
        for dy in (-0.8, 0.8):
            cyl(f"HutStilt{dx}{dy}", 0.07, 1.0, P(10 + dx, dy, 0.5), wood_d, r, verts=8)
    rbox("HutFloor", (2.6, 2.0, 0.14), P(10, 0, 1.05), wood_d, r)
    rbox("HutWalls", (2.4, 1.8, 1.3), P(10, 0, 1.75), mat("hut_blue", "#4fb0c6", rough=0.7), r, bevel=0.02)
    rbox("HutDoor", (0.5, 0.04, 0.85), P(10 + 0.4, -0.92, 1.55), mat("hut_door", "#f2b632"), r)
    rbox("HutWindow", (0.45, 0.04, 0.4), P(10 - 0.55, -0.92, 1.8), mat("hut_win", "#ffcf7a", emit=2.0), r)
    prism("HutRoof", [(-1.6, 0), (1.6, 0), (0, 1.0)], 2.2, mat("hut_roof", "#c9573a", rough=0.8), r, loc=P(10, 0, 2.4))

    r = empty("bch_Rock", P(13, 0, 0)); out.append(r)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.55, location=P(13, 0, 0.25))
    o = bpy.context.object; o.scale = (1.4, 1, 0.7)
    for v in o.data.vertices: v.co *= random.uniform(0.88, 1.12)
    lib._finish(o, "BchRockMesh", r, mat("bch_rock", "#6f6a66", rough=0.8), False)
    for k in range(4):
        ball(f"Barnacle{k}", 0.05, P(13 - 0.3 + k * 0.2, -0.45, 0.2 + (k % 2) * 0.12), mat("barnacle", "#d9d2c2"), r, scale=(1, 0.6, 1))

    r = empty("bch_Shell", P(15, 0, 0)); out.append(r)
    for k in range(5):
        a = math.radians(-50 + k * 25)
        limb(f"ShellRib{k}", P(15, 0, 0.04), P(15 + math.sin(a) * 0.32, -0.05, 0.04 + math.cos(a) * 0.3), 0.06, mat("seashell", "#f6c9b6", rough=0.4), r, r2=0.03)

    r = empty("bch_Boat", P(17, 0, 0)); out.append(r)     # perahu with a painted prow
    prism("BoatHull", [(-1.6, 0.4), (1.6, 0.4), (1.1, -0.15), (-1.1, -0.15)], 0.9, mat("boat_hull", "#2f8f86", rough=0.6), r, loc=P(17, 0, 0.2))
    rbox("BoatStripe", (3.2, 0.92, 0.1), P(17, 0, 0.5), mat("boat_stripe", "#e2382e"), r)
    prism("BoatProw", [(0, 0), (0.25, 0), (0.6, 0.9), (0.4, 1.0)], 0.12, mat("boat_prow", "#f2b632"), r, loc=P(17 + 1.4, 0, 0.55))
    cyl("BoatMast", 0.04, 1.8, P(17 - 0.2, 0, 1.4), wood_d, r, verts=8)
    prism("BoatSail", [(0, 0), (1.0, 0), (0, 1.4)], 0.03, mat("boat_sail", "#fbf3df", rough=0.7), r, loc=P(17 - 0.15, 0, 0.75))

    r = empty("bch_Lighthouse", P(20, 0, 0)); out.append(r)
    for k in range(5):
        cyl(f"LhBand{k}", 0.62 - k * 0.07, 1.0, P(20, 0, 0.5 + k * 1.0), mat("lh_red" if k % 2 else "lh_white", "#e2382e" if k % 2 else "#f6f1e6", rough=0.6), r,
            r2=0.62 - (k + 1) * 0.07, verts=20)
    cyl("LhGallery", 0.42, 0.12, P(20, 0, 5.06), mat("lh_dark", "#26252d"), r, verts=20)
    cyl("LhLamp", 0.25, 0.5, P(20, 0, 5.37), mat("lh_lamp", "#fff1a8", emit=8.0), r, verts=16)
    cyl("LhCap", 0.32, 0.35, P(20, 0, 5.8), mat("lh_red", "#e2382e"), r, r2=0.03, verts=16)

    r = empty("bch_Block", P(23, 0, 0)); out.append(r)
    rbox("BchBlockBody", (0.98, DEPTH * 0.55, 0.98), P(23, 0, 0), mat("bch_block", "#e3c48a", rough=0.9), r, bevel=0.06)
    rbox("BchBlockBand", (1.0, DEPTH * 0.56, 0.12), P(23, 0, -0.3), mat("bch_block_band", "#4fb0c6", rough=0.6), r, bevel=0.03)
    for k in range(3):
        a = math.radians(-40 + k * 40)
        limb(f"BlockShell{k}", P(23, -DEPTH * 0.28 - 0.01, 0.0), P(23 + math.sin(a) * 0.22, -DEPTH * 0.28 - 0.01, math.cos(a) * 0.22 + 0.0), 0.035,
             mat("seashell", "#f6c9b6"), r, r2=0.02)

    # beach enemies
    r = empty("Ketam", P(26, 0, 0)); out.append(r)        # red beach crab
    shell = mat("ketam_shell", "#e2482e", rough=0.4, coat=0.7)
    ball("KetamBody", 0.32, P(26, 0, 0.32), shell, r, scale=(1.25, 1.0, 0.6))
    for s_ in (1, -1):
        limb(f"KetamStalk{s_}", P(26 + 0.25, s_ * 0.1, 0.42), P(26 + 0.3, s_ * 0.12, 0.62), 0.025, shell, r)
    eyes(P, 26 + 0.3, 0.66, r, y=0.12, r=0.06)
    for s_ in (1, -1):
        limb(f"KetamArm{s_}", P(26 + 0.3, s_ * 0.25, 0.3), P(26 + 0.55, s_ * 0.35, 0.4), 0.05, shell, r)
        ball(f"KetamClaw{s_}", 0.13, P(26 + 0.65, s_ * 0.36, 0.45), shell, r, scale=(1.3, 0.7, 1.0))
        for k in range(3):
            leg = empty(f"KetamLeg{'L' if s_ > 0 else 'R'}{k}", P(26 - 0.2 + k * 0.18, s_ * 0.3, 0.25), r)
            limb(f"KetamLegMesh{s_}{k}", P(26 - 0.2 + k * 0.18, s_ * 0.3, 0.25), P(26 - 0.25 + k * 0.2, s_ * 0.5, 0.0), 0.03, shell, leg)

    r = empty("Camar", P(28, 0, 0)); out.append(r)        # seagull
    gull = mat("gull_white", "#f6f4ee", rough=0.6)
    grey = mat("gull_grey", "#9aa3ad", rough=0.6)
    ball("GullBody", 0.22, P(28, 0, 0), gull, r, scale=(1.4, 0.9, 0.9))
    ball("GullHead", 0.14, P(28 + 0.28, 0, 0.12), gull, r)
    cyl("GullBeak", 0.045, 0.16, P(28 + 0.45, 0, 0.1), mat("gull_beak", "#f2b632"), r, rot=(0, math.radians(90), 0), r2=0.0, verts=8)
    eyes(P, 28 + 0.36, 0.17, r, y=0.07, r=0.035, angry=True)
    rbox("GullTail", (0.22, 0.16, 0.05), P(28 - 0.32, 0, 0.03), grey, r, bevel=0.02)
    shape = [(0.15, 0.0), (0.05, 0.5), (-0.15, 0.62), (-0.3, 0.3), (-0.12, 0.0)]
    for s_, n in ((1, "L"), (-1, "R")):
        w = empty(f"Wing{n}", P(28, s_ * 0.12, 0.08), r)
        prism(f"GullWing{n}", shape, 0.025, grey, w, loc=P(28 + 0.05, s_ * 0.12, 0.08), rot=(math.radians(-55 * s_), 0, 0))

    r = empty("OborObor", P(30, 0, 0)); out.append(r)     # jellyfish
    jelly = mat("jelly", "#f29ad0", rough=0.15, emit=1.2, alpha=0.75)
    ball("JellyDome", 0.34, P(30, 0, 0.1), jelly, r, scale=(1, 1, 0.7))
    for k in range(6):
        a = k * math.pi / 3
        limb(f"JellyTentacle{k}", P(30 + math.cos(a) * 0.18, math.sin(a) * 0.18, 0.0), P(30 + math.cos(a) * 0.22, math.sin(a) * 0.22, -0.45), 0.03,
             mat("jelly_t", "#c870c0", emit=1.0), r, r2=0.01)
    eyes(P, 30 + 0.27, 0.15, r, y=0.1, r=0.06, angry=True)
    return out

# ------------------------------------------------------------------ level 5: gua (limestone caves, Batu-Caves style)
def kit_cave(x0):
    out = tile_set("gua", x0, "#b3aa98", "#5c544b", lip_col="#5f7f4f")
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    lime = mat("gua_lime", "#9c9384", rough=0.9)
    lime_d = mat("gua_lime_d", "#6e675c", rough=0.9)
    teal = mat("gua_crystal", "#4ff0c8", rough=0.1, emit=3.0)

    r = empty("gua_Ledge", P(3, 0, 0)); out.append(r)
    rbox("LedgeSlab", (1.0, DEPTH * 0.7, 0.35), P(3, 0, 0.32), lime, r, bevel=0.06)
    ball("LedgeMoss", 0.2, P(3 - 0.2, -DEPTH * 0.3, 0.48), mat("gua_moss", "#5f7f4f"), r, scale=(1.6, 0.5, 0.3))

    r = empty("gua_Stalagmite", P(5, 0, 0)); out.append(r)
    for k, (dx, h, rr) in enumerate([(-0.25, 1.1, 0.25), (0.15, 1.7, 0.32), (0.45, 0.8, 0.18)]):
        cyl(f"Mite{k}", rr, h, P(5 + dx, 0, h / 2), lime_d if k % 2 else lime, r, r2=0.03, verts=10)

    r = empty("gua_Crystal", P(7, 0, 0)); out.append(r)
    for k, (dx, h, tilt) in enumerate([(-0.18, 0.7, -18), (0.04, 1.05, 4), (0.24, 0.6, 22), (-0.02, 0.45, -35)]):
        cyl(f"GCrystal{k}", 0.12, h, P(7 + dx, 0, h / 2), teal, r, verts=6, r2=0.0, rot=(0, math.radians(tilt), 0), smooth=False)
    ball("CrystalRock", 0.3, P(7, 0, 0.05), lime_d, r, scale=(1.4, 1, 0.5))

    r = empty("gua_Shroom", P(9, 0, 0)); out.append(r)
    for k, (dx, h, rr) in enumerate([(-0.2, 0.35, 0.18), (0.12, 0.5, 0.24), (0.35, 0.25, 0.13)]):
        cyl(f"ShStem{k}", 0.04, h, P(9 + dx, 0, h / 2), mat("shroom_stem", "#d9e6ef"), r, verts=8)
        ball(f"ShCap{k}", rr, P(9 + dx, 0, h), mat("shroom_cap", "#5ab8ff", emit=2.5), r, scale=(1, 1, 0.5))

    r = empty("gua_Column", P(11, 0, 0)); out.append(r)      # floor-to-ceiling limestone column, far back
    cyl("ColBody", 0.9, 14, P(11, 0, 7), lime_d, r, verts=12, r2=0.7)
    for k in range(5):
        torus(f"ColRing{k}", 0.85 - k * 0.03, 0.12, P(11, 0, 1.5 + k * 2.6), lime, r)

    r = empty("gua_Lantern", P(13, 0, 0)); out.append(r)
    cyl("LanPost", 0.06, 1.3, P(13, 0, 0.65), mat("lan_wood", "#5a3a22"), r, verts=8)
    rbox("LanBox", (0.32, 0.32, 0.4), P(13, 0, 1.45), mat("lan_frame", "#2a2a30", metal=0.6, rough=0.4), r, bevel=0.03)
    rbox("LanGlow", (0.24, 0.34, 0.3), P(13, 0, 1.45), mat("lan_glow", "#ffb347", emit=8.0), r)
    cyl("LanRoof", 0.28, 0.16, P(13, 0, 1.73), mat("lan_frame", "#2a2a30"), r, r2=0.03, verts=4)

    r = empty("gua_Steps", P(16, 0, 0)); out.append(r)       # the famous rainbow staircase, as backdrop
    colors = ["#e2382e", "#f2902e", "#f2d13a", "#5abf4a", "#2f8fdb", "#7b5cc4", "#e2508f"]
    for k in range(14):
        c = colors[k % 7]
        rbox(f"Step{k}", (1.8, 0.35, 0.3), P(16, -k * 0.35, k * 0.3 + 0.15), mat(f"step_{c}", c, rough=0.6), r)
    for dx in (-1.0, 1.0):
        rbox(f"StepRail{dx}", (0.12, 5.0, 0.12), P(16 + dx, -2.4, 2.6), mat("rail", "#d9d6cf", metal=0.6, rough=0.3), r, rot=(math.radians(-40), 0, 0))

    r = empty("gua_Block", P(19, 0, 0)); out.append(r)
    rbox("GuaBlockBody", (0.98, DEPTH * 0.55, 0.98), P(19, 0, 0), mat("gua_block", "#b8ae9c", rough=0.85), r, bevel=0.06)
    for k in range(4):     # ammonite fossil spiral
        torus(f"Fossil{k}", 0.08 + k * 0.06, 0.018, P(19 + k * 0.02, -DEPTH * 0.28 - 0.01, -0.02 + k * 0.015), mat("fossil", "#7a705f"), r,
              rot=(math.radians(90), 0, 0))

    r = empty("Stalactite", P(21, 0, 0)); out.append(r)     # falls when you pass below
    cyl("StalBody", 0.3, 1.1, P(21, 0, -0.55), lime, r, r2=0.02, verts=10, rot=(math.radians(180), 0, 0))
    cyl("StalTop", 0.34, 0.2, P(21, 0, 0.0), lime_d, r, verts=10)
    eyes(P, 21 + 0.17, -0.25, r, y=0.09, r=0.05, angry=True)

    r = empty("Kera", P(23, 0, 0)); out.append(r)           # long-tailed macaque that charges and leaps
    fur = mat("kera_fur", "#8a7a64", rough=0.85)
    face = mat("kera_face", "#e8a99a", rough=0.6)
    ball("KeraBody", 0.3, P(23, 0, 0.55), fur, r, scale=(1.1, 0.9, 1.1))
    ball("KeraHead", 0.22, P(23 + 0.3, 0, 0.85), fur, r)
    ball("KeraFace", 0.15, P(23 + 0.42, 0, 0.83), face, r, scale=(0.6, 1.1, 1))
    eyes(P, 23 + 0.5, 0.88, r, y=0.06, r=0.04, angry=True)
    for s_ in (1, -1):
        ball(f"KeraEar{s_}", 0.06, P(23 + 0.28, s_ * 0.2, 0.92), face, r, scale=(0.5, 1, 1))
    for s_, n in ((1, "L"), (-1, "R")):
        leg = empty(f"KeraLeg{n}", P(23, s_ * 0.13, 0.35), r)
        limb(f"KeraLegMesh{n}", P(23, s_ * 0.13, 0.35), P(23 + 0.05, s_ * 0.14, 0.04), 0.06, fur, leg)
        limb(f"KeraArm{n}", P(23 + 0.15, s_ * 0.28, 0.65), P(23 + 0.32, s_ * 0.3, 0.3), 0.05, fur, r)
    limb("KeraTail1", P(23 - 0.28, 0, 0.5), P(23 - 0.55, 0, 0.7), 0.035, fur, r)
    limb("KeraTail2", P(23 - 0.55, 0, 0.7), P(23 - 0.6, 0, 1.05), 0.03, fur, r, r2=0.02)

    r = empty("Lipan", P(26, 0, 0)); out.append(r)          # centipede
    seg_a = mat("lipan_a", "#8a2a2a", rough=0.4, coat=0.6)
    seg_b = mat("lipan_b", "#2a1a1a", rough=0.4, coat=0.6)
    for k in range(5):
        ball(f"LipanSeg{k}", 0.17 - k * 0.012, P(26 + 0.3 - k * 0.2, 0, 0.18), seg_a if k % 2 == 0 else seg_b, r, scale=(1, 1.1, 0.8))
        for s_ in (1, -1):
            leg = empty(f"LipanLeg{'L' if s_ > 0 else 'R'}{k}", P(26 + 0.3 - k * 0.2, s_ * 0.12, 0.15), r)
            limb(f"LipanLegMesh{s_}{k}", P(26 + 0.3 - k * 0.2, s_ * 0.12, 0.15), P(26 + 0.3 - k * 0.2, s_ * 0.3, 0.0), 0.02, mat("lipan_leg", "#f2b632"), leg)
    eyes(P, 26 + 0.42, 0.25, r, y=0.07, r=0.045, angry=True)
    for s_ in (1, -1):
        limb(f"LipanAnt{s_}", P(26 + 0.42, s_ * 0.05, 0.3), P(26 + 0.62, s_ * 0.16, 0.45), 0.012, seg_b, r)
    return out

# ------------------------------------------------------------------ level 6: KL rooftops at night
def kit_kota(x0):
    out = tile_set("kota", x0, "#8f959e", "#2e3644")
    top_root = [o for o in out if o.name == "kota_TileTop"][0]
    rbox("Parapet", (1.04, 0.1, 0.16), (x0, -DEPTH / 2 + 0.05, 0.58), mat("parapet", "#c9ced4", rough=0.6), top_root)
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    # the fill tiles are building facade: one lit window each (and an unlit twin for variety)
    fill = [o for o in out if o.name == "kota_TileFill"][0]
    rbox("KotaWin", (0.42, 0.03, 0.5), (x0 + 1.2, -DEPTH / 2 - 0.01, 0.05), mat("kota_win", "#ffd27a", emit=3.0), fill)
    r = empty("kota_TileFill2", P(1.2, 3, 0)); out.append(r)
    rbox("KotaTF2", (1.0, DEPTH, 1.0), P(1.2, 3, 0), mat("kota_fill", "#2e3644", rough=0.9), r)
    rbox("KotaWin2", (0.42, 0.03, 0.5), P(1.2, 3 - DEPTH / 2 - 0.01, 0.05), mat("kota_win_off", "#3e5068", rough=0.2, metal=0.4), r)
    steel = mat("kota_steel", "#c9ced4", rough=0.3, metal=0.9)
    dark = mat("kota_dark", "#3b4250", rough=0.6)

    r = empty("kota_Girder", P(3, 0, 0)); out.append(r)
    girder = mat("girder", "#d8452e", rough=0.5, metal=0.5)
    rbox("GirderTop", (1.0, DEPTH * 0.6, 0.08), P(3, 0, 0.46), girder, r)
    rbox("GirderWeb", (1.0, 0.1, 0.3), P(3, 0, 0.27), girder, r)
    rbox("GirderBot", (1.0, DEPTH * 0.6, 0.08), P(3, 0, 0.1), girder, r)

    r = empty("kota_AC", P(5, 0, 0)); out.append(r)
    rbox("ACBox", (0.9, 0.6, 0.6), P(5, 0, 0.3), mat("ac_body", "#e4e6ea", rough=0.5), r, bevel=0.04)
    cyl("ACFan", 0.22, 0.03, P(5 + 0.1, -0.31, 0.3), dark, r, rot=(math.radians(90), 0, 0), verts=20)
    for k in range(4):
        rbox(f"ACGrill{k}", (0.46, 0.02, 0.02), P(5 + 0.1, -0.33, 0.18 + k * 0.08), steel, r)

    r = empty("kota_Tank", P(7, 0, 0)); out.append(r)
    for dx in (-0.4, 0.4):
        for dy in (-0.4, 0.4):
            cyl(f"TankLeg{dx}{dy}", 0.04, 0.9, P(7 + dx, dy, 0.45), dark, r, verts=6)
    cyl("TankBody", 0.62, 1.0, P(7, 0, 1.4), mat("tank", "#5a8fb0", rough=0.5), r, verts=20)
    cyl("TankLid", 0.66, 0.2, P(7, 0, 2.0), mat("tank_lid", "#3e6a88"), r, r2=0.1, verts=20)

    r = empty("kota_Antenna", P(9, 0, 0)); out.append(r)
    cyl("AntMast", 0.05, 3.0, P(9, 0, 1.5), steel, r, verts=8)
    for k in range(3):
        rbox(f"AntBar{k}", (0.7 - k * 0.15, 0.04, 0.04), P(9, 0, 1.4 + k * 0.55), steel, r)
    ball("AntLight", 0.09, P(9, 0, 3.05), mat("ant_red", "#ff2a2a", emit=8.0), r)

    r = empty("kota_Neon", P(11, 0, 0)); out.append(r)
    for dx in (-0.8, 0.8):
        cyl(f"NeonPost{dx}", 0.04, 1.2, P(11 + dx, 0, 0.6), dark, r, verts=6)
    rbox("NeonBoard", (2.0, 0.12, 0.8), P(11, 0, 1.55), mat("neon_board", "#1a1830", rough=0.4), r, bevel=0.04)
    text("NeonText", "LARI", 0.5, P(11, -0.08, 1.55), mat("neon_pink", "#ff4fb0", emit=6.0), r, extrude=0.02)
    torus("NeonRing", 0.12, 0.025, P(11 + 0.75, -0.08, 1.7), mat("neon_teal", "#4ff0e0", emit=6.0), r, rot=(math.radians(90), 0, 0))

    r = empty("kota_Dish", P(13, 0, 0)); out.append(r)
    cyl("DishPost", 0.05, 0.7, P(13, 0, 0.35), dark, r, verts=8)
    ball("DishBowl", 0.45, P(13, -0.1, 0.9), mat("dish", "#eceef2", rough=0.3), r, scale=(0.35, 1, 1), rot=(0, 0, math.radians(-20)))
    limb("DishArm", P(13 - 0.1, -0.1, 0.9), P(13 - 0.45, -0.2, 0.95), 0.015, steel, r)

    r = empty("kota_Crane", P(16, 0, 0)); out.append(r)     # tower crane, far back
    crane = mat("crane", "#f2b632", rough=0.5, metal=0.3)
    rbox("CraneMast", (0.5, 0.5, 9.0), P(16, 0, 4.5), crane, r)
    rbox("CraneJib", (7.0, 0.35, 0.35), P(16 + 2.0, 0, 9.1), crane, r)
    rbox("CraneCab", (0.7, 0.6, 0.5), P(16, 0, 8.6), mat("crane_cab", "#3e6a88"), r)
    rbox("CraneWeight", (1.0, 0.6, 0.7), P(16 - 1.2, 0, 8.8), dark, r)
    cyl("CraneCable", 0.015, 3.0, P(16 + 4.5, 0, 7.6), dark, r, verts=6)
    rbox("CraneLoad", (0.8, 0.5, 0.4), P(16 + 4.5, 0, 6.0), mat("crane_load", "#d8452e"), r)
    ball("CraneLight", 0.1, P(16 + 5.4, 0, 9.35), mat("ant_red", "#ff2a2a", emit=8.0), r)

    r = empty("kota_Box", P(19, 0, 0)); out.append(r)
    rbox("KotaBoxBody", (0.98, DEPTH * 0.55, 0.98), P(19, 0, 0), mat("kota_box", "#7c8592", rough=0.5, metal=0.5), r, bevel=0.04)
    for dz in (-0.3, 0.3):
        rbox(f"KotaBoxRib{dz}", (1.0, DEPTH * 0.56, 0.06), P(19, 0, dz), dark, r)
    rbox("KotaBoxHazard", (0.5, 0.03, 0.14), P(19, -DEPTH * 0.28 - 0.01, 0), mat("hazard_y", "#f2b632", emit=0.5), r)

    # city enemies
    r = empty("RoboVac", P(22, 0, 0)); out.append(r)
    cyl("VacBody", 0.4, 0.2, P(22, 0, 0.14), mat("vac_body", "#2a2d36", rough=0.3, coat=0.8), r, verts=28)
    cyl("VacTop", 0.3, 0.04, P(22, 0, 0.26), mat("vac_top", "#4a4f5a", rough=0.3), r, verts=28)
    rbox("VacBumper", (0.08, 0.6, 0.1), P(22 + 0.36, 0, 0.12), mat("vac_bumper", "#c9ced4"), r, bevel=0.03)
    ball("VacEye", 0.07, P(22 + 0.25, 0, 0.3), mat("vac_eye", "#ff2a2a", emit=6.0), r, scale=(1, 1.6, 0.6))
    for s_ in (1, -1):
        leg = empty(f"VacLeg{'L' if s_ > 0 else 'R'}0", P(22 + 0.2, s_ * 0.3, 0.06), r)
        cyl(f"VacBrush{s_}", 0.1, 0.02, P(22 + 0.3, s_ * 0.3, 0.04), mat("vac_brush", "#f2b632"), leg, verts=6)

    r = empty("Merpati", P(24, 0, 0)); out.append(r)         # rooftop pigeon
    pg = mat("pigeon", "#8a8f9e", rough=0.6)
    ball("PigeonBody", 0.27, P(24, 0, 0.42), pg, r, scale=(1.3, 0.9, 1.0))
    ball("PigeonHead", 0.15, P(24 + 0.3, 0, 0.72), pg, r)
    ball("PigeonNeck", 0.16, P(24 + 0.2, 0, 0.58), mat("pigeon_neck", "#4f9a8a", rough=0.3, coat=0.8), r)
    cyl("PigeonBeak", 0.035, 0.12, P(24 + 0.47, 0, 0.71), mat("pigeon_beak", "#e9b38a"), r, rot=(0, math.radians(90), 0), r2=0.0, verts=8)
    eyes(P, 24 + 0.38, 0.77, r, y=0.07, r=0.035, angry=True)
    rbox("PigeonTail", (0.25, 0.18, 0.05), P(24 - 0.35, 0, 0.42), mat("pigeon_d", "#5a5f6e"), r, bevel=0.02)
    for s_, n in ((1, "L"), (-1, "R")):
        leg = empty(f"PigeonLeg{n}", P(24, s_ * 0.08, 0.2), r)
        limb(f"PigeonLegMesh{n}", P(24, s_ * 0.08, 0.2), P(24 + 0.02, s_ * 0.08, 0.02), 0.02, mat("pigeon_feet", "#d9707f"), leg)

    r = empty("Drone", P(26, 0, 0)); out.append(r)
    rbox("DroneBody", (0.5, 0.5, 0.16), P(26, 0, 0), mat("drone", "#e4e6ea", rough=0.4), r, bevel=0.05)
    ball("DroneCam", 0.09, P(26 + 0.22, 0, -0.1), mat("drone_cam", "#16141b", rough=0.1, coat=1), r)
    ball("DroneEye", 0.05, P(26 + 0.29, 0, -0.1), mat("vac_eye", "#ff2a2a", emit=6.0), r)
    for k, (dx, dy) in enumerate([(0.3, 0.3), (0.3, -0.3), (-0.3, 0.3), (-0.3, -0.3)]):
        limb(f"DroneArm{k}", P(26, 0, 0.02), P(26 + dx, dy, 0.05), 0.025, dark, r)
        w = empty(f"Wing{'L' if dy > 0 else 'R'}{k}", P(26 + dx, dy, 0.1), r)
        rbox(f"Rotor{k}", (0.36, 0.05, 0.015), P(26 + dx, dy, 0.1), mat("rotor", "#2a2d36"), w)
    return out

if __name__ == "__main__":
    reset()
    export(common(0), "common.glb")
    export(kit_village(30), "kit_village.glb")
    export(kit_forest(60), "kit_forest.glb")
    export(kit_volcano(90), "kit_volcano.glb")
    export(kit_city(130), "kit_city.glb")
    export(kit_beach(170), "kit_beach.glb")
    export(kit_cave(210), "kit_cave.glb")
    export(kit_kota(250), "kit_kota.glb")
    if "render" in sys.argv:
        cam = studio(res=(1600, 520), bg="#101320")
        shoot(cam, (8, -14, 2.5), (8, 0, 0.9), 34, "common.png")
        shoot(cam, (38, -16, 4.5), (38, 0, 1.6), 38, "village.png")
        shoot(cam, (68, -16, 4), (68, 0, 1.6), 38, "forest.png")
        shoot(cam, (99, -18, 4.5), (99, 0, 1.8), 38, "volcano.png")
        shoot(cam, (139, -20, 4.5), (139, 0, 3), 36, "city.png")
        shoot(cam, (185, -26, 3.5), (185, 0, 1.6), 40, "beach.png")
        shoot(cam, (223, -24, 3.5), (223, 0, 1.6), 40, "cave.png")
        shoot(cam, (263, -26, 4), (263, 0, 2), 40, "kota.png")
        print("RENDERED")
    print("OK world")
