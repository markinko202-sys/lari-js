# Pickups, shop icons and special tiles:
#   Star (invincibility), Chili (sambal-shot power), Fireball (the shot), Shield, Magnet, Bulb (hint),
#   Flagpole (level goal), CrackRock (a shot breaks it), SoftFloor (a ground pound breaks it).
import math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import lib

DEPTH = 2.4

def star_shape(r_out, r_in, n=5):
    pts = []
    for i in range(n * 2):
        a = math.pi / 2 + i * math.pi / n
        r = r_out if i % 2 == 0 else r_in
        pts.append((math.cos(a) * r, math.sin(a) * r))
    return pts

def items(x0):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    out = []
    ink = mat("it_ink", "#16141b", rough=0.4)
    white = mat("it_white", "#fbfaf6", rough=0.3)

    # star — a chunky five-pointer with a face
    r = empty("Star", P(0, 0, 0)); out.append(r)
    prism("StarBody", star_shape(0.48, 0.21), 0.2, mat("star_gold", "#ffc93c", rough=0.25, emit=0.6, coat=0.6), r, loc=P(0, 0, 0))
    lib.apply_mods(r.children[-1])
    bpy.context.view_layer.objects.active = r.children[-1]
    m = r.children[-1].modifiers.new("bev", 'BEVEL'); m.width = 0.05; m.segments = 3; apply_mods(r.children[-1])
    for y in (0.09, -0.09):
        ball(f"StarEye{y}", 0.045, P(y, -0.11, 0.04), ink, r, scale=(1, 0.5, 1.5))

    # sambal chili — the shot power-up
    r = empty("Chili", P(1.2, 0, 0)); out.append(r)
    red = mat("chili_red", "#d8261f", rough=0.25, coat=0.8)
    pts = [(0.0, 0.25), (0.08, 0.1), (0.1, -0.08), (0.04, -0.28), (-0.06, -0.36)]
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]
        limb(f"ChiliSeg{k}", P(1.2 + a[0], 0, a[1]), P(1.2 + b[0], 0, b[1]), 0.12 - k * 0.025, red, r, r2=0.12 - (k + 1) * 0.025)
    green = mat("chili_stem", "#3f8f3a", rough=0.6)
    cyl("ChiliCap", 0.1, 0.06, P(1.2, 0, 0.3), green, r, verts=12)
    limb("ChiliStem", P(1.2, 0, 0.32), P(1.26, 0, 0.45), 0.025, green, r)

    # fireball — the shot itself
    r = empty("Fireball", P(2.2, 0, 0)); out.append(r)
    ball("FireCore", 0.2, P(2.2, 0, 0), mat("fire_core", "#ffd24a", emit=6.0), r)
    ball("FireShell", 0.26, P(2.17, 0, 0), mat("fire_shell", "#ff5a1f", emit=3.0, alpha=0.7), r, scale=(1.2, 1, 1))
    for k in range(3):
        ball(f"FireTail{k}", 0.15 - k * 0.04, P(2.2 - 0.25 - k * 0.15, 0, 0.03 * k), mat("fire_tail", "#ff8a2a", emit=3.0), r)

    # bug shield
    r = empty("Shield", P(3.4, 0, 0)); out.append(r)
    teal = mat("shield_teal", "#2f8f86", rough=0.35, coat=0.6)
    rim = mat("shield_rim", "#d9d6cf", rough=0.25, metal=0.9)
    prism("ShieldBody", [(-0.36, 0.38), (0.36, 0.38), (0.36, 0.0), (0.0, -0.45), (-0.36, 0.0)], 0.14, teal, r, loc=P(3.4, 0, 0))
    prism("ShieldRim", [(-0.42, 0.44), (0.42, 0.44), (0.42, -0.02), (0.0, -0.53), (-0.42, -0.02)], 0.1, rim, r, loc=P(3.4, 0.02, 0))
    ball("ShieldBug", 0.13, P(3.4, -0.09, 0.02), mat("shield_bug", "#c8312b", rough=0.3, coat=1), r, scale=(1, 0.5, 1.15))
    rbox("ShieldSlash", (0.5, 0.04, 0.06), P(3.4, -0.14, 0.02), white, r, rot=(0, math.radians(45), 0))

    # coin magnet
    r = empty("Magnet", P(4.6, 0, 0)); out.append(r)
    mred = mat("magnet_red", "#d8261f", rough=0.35, coat=0.5)
    steel = mat("magnet_steel", "#d9dde2", rough=0.2, metal=1.0)
    bpy.ops.mesh.primitive_torus_add(location=P(4.6, 0, 0.05), major_radius=0.26, minor_radius=0.1, major_segments=32, minor_segments=12,
                                     rotation=(math.radians(90), 0, 0))
    t = bpy.context.object
    # keep only the top half of the ring: a U
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='DESELECT'); bpy.ops.object.mode_set(mode='OBJECT')
    for v in t.data.vertices: v.select = (t.matrix_world @ v.co).z < 0.04
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.delete(type='VERT'); bpy.ops.object.mode_set(mode='OBJECT')
    lib._finish(t, "MagnetArc", r, mred, True)
    for x in (-0.26, 0.26):
        cyl(f"MagnetLeg{x}", 0.1, 0.22, P(4.6 + x, 0, -0.06), mred, r, verts=16)
        cyl(f"MagnetTip{x}", 0.102, 0.12, P(4.6 + x, 0, -0.22), steel, r, verts=16)

    # light bulb — the hint ("ask a friend")
    r = empty("Bulb", P(5.8, 0, 0)); out.append(r)
    ball("BulbGlass", 0.27, P(5.8, 0, 0.1), mat("bulb_glass", "#ffe27a", rough=0.15, emit=2.5), r)
    cyl("BulbNeck", 0.14, 0.12, P(5.8, 0, -0.17), mat("bulb_glow", "#ffe27a", rough=0.15, emit=2.5), r, r2=0.17, verts=16)
    for k in range(3):
        cyl(f"BulbScrew{k}", 0.13, 0.05, P(5.8, 0, -0.27 - k * 0.06), mat("bulb_metal", "#a8adb4", rough=0.3, metal=0.9), r, verts=16)
    ball("BulbTip", 0.06, P(5.8, 0, -0.45), mat("bulb_tip", "#3b3b40", rough=0.4), r)
    for y in (0.08, -0.08):
        ball(f"BulbEye{y}", 0.035, P(5.8 + y, -0.25, 0.14), ink, r, scale=(1, 0.5, 1.4))

    # flagpole — the end of every level; the flag slides down when you grab the pole
    r = empty("Flagpole", P(7.2, 0, 0)); out.append(r)
    rbox("FlagBase", (0.9, 0.9, 0.9), P(7.2, 0, 0.45), mat("pole_base", "#3a7f4a", rough=0.6), r, bevel=0.06)
    cyl("FlagPoleMast", 0.07, 8.0, P(7.2, 0, 4.9), mat("pole_mast", "#d9dde2", rough=0.25, metal=0.9), r, verts=16)
    ball("FlagTop", 0.18, P(7.2, 0, 9.0), mat("pole_ball", "#f2b632", rough=0.25, metal=0.8), r)
    f = empty("Flag", P(7.2, 0, 8.4), r)
    prism("FlagCloth", [(0, 0.45), (0, -0.45), (-1.25, 0.0)], 0.04, mat("pole_flag", "#e2382e", rough=0.6), f, loc=P(7.2, 0, 8.4))
    ball("FlagMark", 0.12, P(7.2 - 0.4, -0.03, 8.4), mat("pole_flag_mark", "#fbfaf6", rough=0.5), f, scale=(1, 0.3, 1))

    # cracked rock (a shot breaks it) and soft floor (a ground pound breaks it)
    r = empty("CrackRock", P(9, 0, 0)); out.append(r)
    rbox("CrackBody", (0.98, DEPTH * 0.6, 0.98), P(9, 0, 0), mat("crack_rock", "#6e6a72", rough=0.85), r, bevel=0.06)
    glow = mat("crack_glow", "#ff7a2a", emit=4.0)
    for k, (dx, dz, a, L) in enumerate([(-0.1, 0.15, 35, 0.55), (0.18, -0.1, -40, 0.45), (-0.2, -0.25, 10, 0.3)]):
        rbox(f"Crack{k}", (L, 0.03, 0.04), P(9 + dx, -DEPTH * 0.3 - 0.01, dz), glow, r, rot=(0, math.radians(a), 0))
    r = empty("SoftFloor", P(10.5, 0, 0)); out.append(r)
    sand = mat("soft_dirt", "#9a7650", rough=0.95)
    for k in range(3):
        rbox(f"SoftSlab{k}", (0.31, DEPTH * 0.95, 0.9), P(10.5 - 0.32 + k * 0.32, 0, 0), sand, r, bevel=0.04)
    for k, dx in enumerate((-0.33, 0.0, 0.33)):
        ball(f"SoftPebble{k}", 0.08, P(10.5 + dx, -DEPTH * 0.47, 0.25 - k * 0.2), mat("soft_peb", "#c9a97a", rough=0.9), r, scale=(1.2, 0.6, 0.8), seg=8, rings=5)
    rbox("SoftMark", (0.5, 0.03, 0.08), P(10.5, -DEPTH * 0.48, 0.38), mat("soft_mark", "#f2d16b", emit=1.5), r)
    return out

if __name__ == "__main__":
    reset()
    roots = items(0)
    export(roots, "items.glb")
    if "render" in sys.argv:
        cam = studio(res=(1800, 520), bg="#1a1f2a")
        for o in roots:
            if o.name != "Flagpole": o.location.z += 0.6
        shoot(cam, (5.2, -13, 1.2), (5.2, 0, 0.7), 34, "items.png")
        print("RENDERED")
    print("OK items")
