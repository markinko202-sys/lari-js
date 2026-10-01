# Level-specific enemies + climbable cubes and spikes.
#   kampung: Ayam (charging chicken), Kelawar (swooping bat)
#   forest:  Spider (drops on a thread), Siput (snail — stomp it into a kickable shell)
#   volcano: LavaBlob (leaps out of lava), MagmaCrab (spiky — can't be stomped)
import math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import lib

DEPTH = 2.4

def eyes(P, x, z, y=0.09, r=0.06, parent=None, angry=False, glow=None):
    white = mat("en_eye", "#fbfaf6", rough=0.3)
    ink = mat("en_ink", "#16141b", rough=0.4)
    for s in (1, -1):
        if glow:
            ball(f"EyeG{s}", r, P(x, s * y, z), mat(f"en_glow_{glow}", glow, emit=5.0), parent)
        else:
            ball(f"EyeW{s}", r, P(x, s * y, z), white, parent)
            ball(f"EyeP{s}", r * 0.55, P(x + r * 0.6, s * y, z), ink, parent)
        if angry:
            rbox(f"Brow{s}", (0.05, r * 2.2, 0.03), P(x + 0.01, s * y, z + r * 1.1), ink, parent,
                 rot=(math.radians(-25 * s), 0, 0))

def ayam(x0):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    r = empty("Ayam", P(0, 0, 0))
    feather = mat("ayam_body", "#efe4cc", rough=0.8)
    brown = mat("ayam_brown", "#a8693a", rough=0.8)
    red = mat("ayam_red", "#d9322a", rough=0.5)
    yellow = mat("ayam_beak", "#f2b632", rough=0.5)
    ball("AyamBody", 0.32, P(0, 0, 0.55), feather, r, scale=(1.25, 0.9, 1.0))
    ball("AyamWing", 0.2, P(-0.05, 0.27, 0.55), brown, r, scale=(1.3, 0.35, 0.8))
    ball("AyamWing2", 0.2, P(-0.05, -0.27, 0.55), brown, r, scale=(1.3, 0.35, 0.8))
    for k in range(3):
        ball(f"Tail{k}", 0.14, P(-0.42 - k * 0.03, 0, 0.75 + k * 0.1), mat("ayam_tail", "#2a3a2a", rough=0.4, coat=0.6), r, scale=(0.6, 0.25, 1.4),
             rot=(0, math.radians(-30 + k * 15), 0))
    head = empty("AyamHead", P(0.3, 0, 0.8), r)
    ball("AyamHeadMesh", 0.17, P(0.38, 0, 0.92), feather, head)
    for k in range(3):
        ball(f"Comb{k}", 0.055, P(0.32 + k * 0.06, 0, 1.08 - abs(k - 1) * 0.02), red, head)
    cyl("Beak", 0.05, 0.12, P(0.55, 0, 0.9), yellow, head, rot=(0, math.radians(90), 0), r2=0.0, verts=8)
    ball("Wattle", 0.04, P(0.5, 0, 0.82), red, head, scale=(0.7, 0.8, 1.3))
    eyes(P, 0.48, 0.96, y=0.08, r=0.04, parent=head, angry=True)
    for s, n in ((1, "L"), (-1, "R")):
        leg = empty(f"AyamLeg{n}", P(0, s * 0.1, 0.3), r)
        limb(f"AyamLegMesh{n}", P(0, s * 0.1, 0.32), P(0.02, s * 0.1, 0.03), 0.025, yellow, leg)
        rbox(f"AyamFoot{n}", (0.16, 0.08, 0.03), P(0.06, s * 0.1, 0.015), yellow, leg)
    return r

def kelawar(x0):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    r = empty("Kelawar", P(0, 0, 0))
    fur = mat("bat_fur", "#3a2a4a", rough=0.7)
    wing = mat("bat_wing", "#5b3f7a", rough=0.6)
    ball("BatBody", 0.22, P(0, 0, 0), fur, r, scale=(1, 0.9, 1.1))
    for s in (1, -1):
        cyl(f"BatEar{s}", 0.07, 0.16, P(0.05, s * 0.1, 0.22), fur, r, verts=4, r2=0.0, rot=(math.radians(-15 * s), 0, 0))
    eyes(P, 0.17, 0.05, y=0.07, r=0.045, parent=r, glow="#ffd23a")
    for s in (1, -1):
        cyl(f"Fang{s}", 0.015, 0.05, P(0.2, s * 0.03, -0.07), mat("fang", "#fbfaf6"), r, verts=6, r2=0.0, rot=(math.radians(180), 0, 0))
    # membrane wings spread up and out in a V, so they read from the side camera
    shape = [(0.12, 0.0), (0.02, 0.45), (-0.12, 0.62), (-0.2, 0.42), (-0.32, 0.5), (-0.36, 0.28), (-0.46, 0.3), (-0.4, 0.05), (-0.1, -0.02)]
    for s, n in ((1, "L"), (-1, "R")):
        w = empty(f"Wing{n}", P(0, s * 0.12, 0.08), r)
        prism(f"WingMesh{n}", shape, 0.025, wing, w, loc=P(0.05, s * 0.12, 0.08), rot=(math.radians(-50 * s), 0, 0))
    return r

def spider(x0):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    r = empty("Spider", P(0, 0, 0))
    black = mat("spider_body", "#1f1a24", rough=0.4, coat=0.5)
    stripe = mat("spider_stripe", "#e2b33a", rough=0.5)
    ball("Abdomen", 0.3, P(-0.15, 0, 0.0), black, r, scale=(1.1, 1, 1))
    for k in range(3):
        torus(f"Stripe{k}", 0.25 - abs(k - 1) * 0.06, 0.03, P(-0.15 + (k - 1) * 0.13, 0, 0.0), stripe, r, rot=(0, math.radians(90), 0))
    ball("Thorax", 0.18, P(0.22, 0, -0.02), black, r)
    for k, (y, z) in enumerate([(0.06, 0.06), (-0.06, 0.06), (0.1, 0.0), (-0.1, 0.0)]):
        ball(f"SpEye{k}", 0.035 if k < 2 else 0.025, P(0.37, y, z), mat("spider_eye", "#ff3a3a", emit=4.0), r)
    for s in (1, -1):
        for k in range(4):
            a = math.radians(-50 + k * 33)
            knee = P(0.15 + math.cos(a) * 0.3 * 0.6, s * (0.3), 0.2)
            foot = P(0.15 + math.cos(a) * 0.5, s * 0.45, -0.25)
            limb(f"SpLegA{s}{k}", P(0.15, s * 0.1, 0.0), knee, 0.025, black, r)
            limb(f"SpLegB{s}{k}", knee, foot, 0.02, black, r)
    return r

def siput(x0):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    r = empty("Siput", P(0, 0, 0))
    body = mat("snail_body", "#c9d48a", rough=0.5, coat=0.6)
    shellA = mat("snail_shell", "#c8702e", rough=0.4, coat=0.8)
    shellB = mat("snail_shell2", "#8a4320", rough=0.4, coat=0.8)
    b = empty("SiputBody", P(0, 0, 0), r)
    ball("Foot", 0.2, P(0.05, 0, 0.12), body, b, scale=(2.2, 1, 0.6))
    limb("Neck", P(0.3, 0, 0.12), P(0.42, 0, 0.42), 0.09, body, b)
    for s in (1, -1):
        limb(f"Stalk{s}", P(0.42, s * 0.04, 0.45), P(0.48, s * 0.12, 0.66), 0.02, body, b)
        ball(f"StalkEye{s}", 0.045, P(0.48, s * 0.12, 0.68), mat("en_eye", "#fbfaf6"), b)
        ball(f"StalkPupil{s}", 0.025, P(0.51, s * 0.12, 0.68), mat("en_ink", "#16141b"), b)
    sh = empty("SiputShell", P(0, 0, 0.4), r)
    for k in range(5):     # spiral of shrinking balls reads as a shell
        a = k * 1.25
        rad = 0.32 * (0.82 ** k)
        ball(f"Coil{k}", rad, P(-0.05 + math.cos(a) * 0.12 * k * 0.4, 0, 0.42 + math.sin(a) * 0.12 * k * 0.4), shellA if k % 2 == 0 else shellB, sh,
             scale=(1, 0.8, 1))
    return r

def lavablob(x0):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    r = empty("LavaBlob", P(0, 0, 0))
    ball("BlobBody", 0.34, P(0, 0, 0), mat("blob_core", "#ff7a1f", emit=3.0), r, scale=(1, 1, 1.05), seg=32, rings=16)
    for k, (x, y, z) in enumerate([(-0.15, 0.2, 0.18), (0.1, -0.22, 0.15), (-0.25, -0.1, -0.1), (0.05, 0.25, -0.2)]):
        ball(f"Crust{k}", 0.1, P(x, y, z), mat("blob_crust", "#3a1c18", rough=0.9), r, scale=(1.2, 0.6, 1))
    eyes(P, 0.26, 0.08, y=0.1, r=0.07, parent=r, angry=True)
    return r

def magmacrab(x0):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    r = empty("MagmaCrab", P(0, 0, 0))
    rock = mat("crab_rock", "#2b2626", rough=0.9)
    glow = mat("crab_glow", "#ff6a1f", emit=4.0)
    ball("CrabBody", 0.38, P(0, 0, 0.35), rock, r, scale=(1.3, 1.0, 0.6))
    for k in range(5):
        a = (k - 2) * 0.35
        cyl(f"Spike{k}", 0.07, 0.3, P(math.sin(a) * 0.3, math.cos(a) * 0.12 - 0.06, 0.6), glow, r, verts=6, r2=0.0)
    rbox("Crack", (0.6, 0.03, 0.03), P(0, -0.38, 0.3), glow, r)
    eyes(P, 0.42, 0.45, y=0.1, r=0.06, parent=r, glow="#ffd23a")
    for s in (1, -1):
        limb(f"Arm{s}", P(0.35, s * 0.25, 0.3), P(0.6, s * 0.35, 0.35), 0.05, rock, r)
        ball(f"Claw{s}", 0.11, P(0.68, s * 0.37, 0.38), glow, r, scale=(1.3, 0.8, 0.9))
        for k in range(3):
            limb(f"CrabLeg{s}{k}", P(-0.2 + k * 0.18, s * 0.3, 0.25), P(-0.25 + k * 0.2, s * 0.52, 0.0), 0.03, rock, r)
    return r

def cubes(x0):
    out = []
    # climbable cubes, one look per world
    r = empty("vil_Crate", (x0, 0, 0)); out.append(r)
    wood = mat("crate_wood", "#a0703e", rough=0.75)
    dark = mat("crate_dark", "#6b4526", rough=0.8)
    rbox("CrateBody", (0.98, DEPTH * 0.55, 0.98), (x0, 0, 0), wood, r, bevel=0.03)
    for dz in (-0.38, 0.38):
        rbox(f"CrateBand{dz}", (1.0, DEPTH * 0.56, 0.1), (x0, 0, dz), dark, r)
    rbox("CrateX1", (1.25, 0.03, 0.1), (x0, -DEPTH * 0.28 - 0.01, 0), dark, r, rot=(0, math.radians(42), 0))
    rbox("CrateX2", (1.25, 0.03, 0.1), (x0, -DEPTH * 0.28 - 0.01, 0), dark, r, rot=(0, math.radians(-42), 0))

    r = empty("for_Stone", (x0 + 1.5, 0, 0)); out.append(r)
    rbox("StoneBody", (0.98, DEPTH * 0.55, 0.98), (x0 + 1.5, 0, 0), mat("stone", "#8a8f86", rough=0.85), r, bevel=0.06)
    rbox("StoneMoss", (1.0, DEPTH * 0.56, 0.16), (x0 + 1.5, 0, 0.44), mat("stone_moss", "#4f8a3a", rough=0.8), r, bevel=0.04)
    rbox("StoneRune", (0.3, 0.03, 0.3), (x0 + 1.5, -DEPTH * 0.28 - 0.01, -0.05), mat("stone_rune", "#4ff0c8", emit=1.5), r, rot=(0, math.radians(45), 0))

    r = empty("vol_Block", (x0 + 3, 0, 0)); out.append(r)
    rbox("BasaltBody", (0.98, DEPTH * 0.55, 0.98), (x0 + 3, 0, 0), mat("basalt_block", "#3a3232", rough=0.9), r, bevel=0.05)
    rbox("BasaltGlow1", (0.5, 0.03, 0.04), (x0 + 3 - 0.1, -DEPTH * 0.28 - 0.01, 0.15), mat("basalt_glow", "#ff6a1f", emit=4.0), r, rot=(0, math.radians(20), 0))
    rbox("BasaltGlow2", (0.35, 0.03, 0.04), (x0 + 3 + 0.15, -DEPTH * 0.28 - 0.01, -0.2), mat("basalt_glow", "#ff6a1f", emit=4.0), r, rot=(0, math.radians(-30), 0))

    # spikes: a hazard tile you get hurt (not killed) on
    r = empty("Spikes", (x0 + 4.5, 0, 0)); out.append(r)
    rbox("SpikeBase", (0.98, DEPTH * 0.6, 0.12), (x0 + 4.5, 0, -0.44), mat("spike_base", "#3b3b40", rough=0.5, metal=0.6), r)
    steel = mat("spike_steel", "#c9ced4", rough=0.25, metal=1.0)
    for i in range(3):
        for j in range(3):
            cyl(f"Spike{i}{j}", 0.11, 0.5, (x0 + 4.5 - 0.3 + i * 0.3, -0.45 + j * 0.45, -0.13), steel, r, verts=6, r2=0.0, smooth=False)
    return out

if __name__ == "__main__":
    reset()
    roots = [ayam(0), kelawar(2), spider(4), siput(6), lavablob(8), magmacrab(10)] + cubes(14)
    export(roots, "enemies.glb")
    if "render" in sys.argv:
        cam = studio(res=(1700, 520), bg="#1a1f2a")
        for o in [o for o in bpy.data.objects if o.name in ("Kelawar", "LavaBlob")]: o.location.z = 0.6
        for o in [o for o in bpy.data.objects if o.name == "Spider"]: o.location.z = 0.5
        shoot(cam, (10, -13, 2.6), (10, 0, 0.5), 38, "enemies.png")
        shoot(cam, (2.2, -5.5, 1.4), (1.2, 0, 0.5), 40, "enemies_left.png", res=(1000, 520))
        print("RENDERED")
    print("OK enemies")
