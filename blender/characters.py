# Playable characters + hats. Each character is a rig of separate parts on pivots so the game
# can animate them procedurally (run cycle, jump pose): Char_<id> > Body, Head > (face, HatAnchor),
# ArmL/ArmR (pivot at shoulder), LegL/LegR (pivot at hip). Feet stand on z = 0, facing +X.
import math, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import lib

def character(cid, x0, c):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    root = empty(f"Char_{cid}", P(0, 0, 0))
    skin = mat(f"{cid}_skin", c["skin"], rough=0.55)
    top = mat(f"{cid}_top", c["top"], rough=0.7)
    bottom = mat(f"{cid}_bottom", c["bottom"], rough=0.75)
    shoe = mat(f"{cid}_shoe", c["shoe"], rough=0.5)
    dark = mat("ink", "#15131a", rough=0.4)
    white = mat("eye_white", "#fbfaf6", rough=0.3)

    # legs (pivot at hip)
    for side, y in (("L", 0.12), ("R", -0.12)):
        leg = empty(f"Leg{side}", P(0, y, 0.52), root)
        limb(f"Leg{side}Mesh", P(0, y, 0.50), P(0, y, 0.16), 0.095, bottom, leg, r2=0.085)
        rbox(f"Shoe{side}", (0.30, 0.17, 0.13), P(0.05, y, 0.07), shoe, leg, bevel=0.05)

    # torso
    body = rbox("Body", (0.44, 0.50, 0.52), P(0, 0, 0.78), top, root, bevel=0.14)
    if c.get("belt"):
        rbox("Belt", (0.46, 0.52, 0.07), P(0, 0, 0.58), mat(f"{cid}_belt", c["belt"], rough=0.5), body, bevel=0.03)

    # arms (pivot at shoulder)
    for side, y in (("L", 0.31), ("R", -0.31)):
        arm = empty(f"Arm{side}", P(0, y, 0.96), root)
        limb(f"Arm{side}Mesh", P(0, y, 0.95), P(0.02, y * 1.04, 0.66), 0.075, top, arm, r2=0.07)
        ball(f"Hand{side}", 0.075, P(0.03, y * 1.05, 0.60), mat(f"{cid}_hand", c.get("hand", c["skin"])), arm)

    # head (pivot at neck)
    head = empty("Head", P(0, 0, 1.04), root)
    hshape = c.get("head", "round")
    if hshape == "box":
        rbox("HeadMesh", (0.56, 0.58, 0.50), P(0, 0, 1.32), skin, head, bevel=0.10)
    else:
        ball("HeadMesh", 0.32, P(0, 0, 1.33), skin, head, scale=(1, 1.02, 0.95), seg=32, rings=18)
    # eyes on the front (+X), spread so they read when the body turns toward the camera
    if c.get("visor"):
        ball("Visor", 0.25, P(0.13, 0, 1.33), mat(f"{cid}_visor", c["visor"], rough=0.08, metal=0.6, coat=1.0), head,
             scale=(0.55, 1.0, 0.8), seg=32, rings=16)
    elif c.get("led"):
        for y in (0.11, -0.11):
            rbox(f"LED{y}", (0.04, 0.11, 0.07), P(0.285, y, 1.35), mat(f"{cid}_led", c["led"], emit=6.0), head, bevel=0.015)
    else:
        for y in (0.115, -0.115):
            ball(f"EyeW{y}", 0.075, P(0.24, y, 1.35), white, head, scale=(0.6, 1, 1.1))
            ball(f"Pupil{y}", 0.042, P(0.285, y * 1.04, 1.345), dark, head, scale=(0.6, 1, 1.2))
            ball(f"Shine{y}", 0.013, P(0.305, y * 1.04 - 0.012, 1.37), white, head)
        if c.get("blush"):
            for y in (0.2, -0.2):
                ball(f"Blush{y}", 0.04, P(0.24, y, 1.25), mat(f"{cid}_blush", c["blush"], rough=0.8), head, scale=(0.4, 1, 0.6))
        ball("Mouth", 0.03, P(0.3, 0, 1.22), mat("mouth", "#5a2130", rough=0.5), head, scale=(0.4, 1.4, 0.6))
    hat_anchor = empty("HatAnchor", P(0, 0, 1.6), head)

    # per-character extras
    if cid == "coder":
        hair = mat("coder_hair", "#2a1c18", rough=0.7)
        ball("Hair", 0.335, P(-0.03, 0, 1.40), hair, head, scale=(1, 1.04, 0.78))
        rbox("Fringe", (0.12, 0.5, 0.1), P(0.22, 0.02, 1.53), hair, head, bevel=0.04, rot=(0, math.radians(-25), 0))
        frame = mat("glasses", "#1d1b22", rough=0.3, metal=0.4)
        for y in (0.115, -0.115):
            torus(f"Lens{y}", 0.085, 0.012, P(0.29, y, 1.35), frame, head, rot=(0, math.radians(90), 0))
        rbox("Bridge", (0.02, 0.07, 0.015), P(0.31, 0, 1.36), frame, head)
        rbox("Backpack", (0.22, 0.42, 0.42), P(-0.29, 0, 0.80), mat("coder_pack", "#e2702e", rough=0.6), body, bevel=0.07)
        rbox("PackFlap", (0.05, 0.36, 0.14), P(-0.41, 0, 0.92), mat("coder_pack2", "#c45a22", rough=0.6), body, bevel=0.03)
        rbox("Hood", (0.18, 0.42, 0.18), P(-0.18, 0, 1.02), top, body, bevel=0.07)
        text("Logo", "</>", 0.12, P(0.225, 0, 0.82), mat("coder_logo", "#efe4cc", rough=0.5), body,
             rot=(math.radians(90), 0, math.radians(90)), extrude=0.01)
    elif cid == "kucing":
        fur = mat("kucing_fur", c["skin"], rough=0.7)
        cream = mat("kucing_cream", "#f6e7cf", rough=0.7)
        for y in (0.17, -0.17):
            tilt = math.radians(20 if y > 0 else -20)
            cyl(f"Ear{y}", 0.11, 0.22, P(0.0, y, 1.6), fur, head, verts=4, r2=0.0, rot=(-tilt, 0, math.radians(45)))
            cyl(f"EarIn{y}", 0.065, 0.14, P(0.045, y * 1.02, 1.585), mat("kucing_pink", "#e99aa6"), head, verts=4, r2=0.0,
                rot=(-tilt, 0, math.radians(45)))
        ball("Muzzle", 0.12, P(0.25, 0, 1.24), cream, head, scale=(0.6, 1.3, 0.8))
        ball("Nose", 0.025, P(0.32, 0, 1.28), mat("kucing_nose", "#d9707f"), head)
        for y in (0.08, -0.08):
            for k, dz in enumerate((0.0, -0.035)):
                limb(f"Whisker{y}{k}", P(0.3, y, 1.25 + dz), P(0.33, y * 3.2, 1.27 + dz * 1.6), 0.005, dark, head)
        tail = empty("Tail", P(-0.22, 0, 0.62), body)
        limb("TailA", P(-0.22, 0, 0.62), P(-0.42, 0, 0.75), 0.05, fur, tail)
        limb("TailB", P(-0.42, 0, 0.75), P(-0.47, 0, 1.0), 0.05, fur, tail, r2=0.045)
        ball("TailTip", 0.05, P(-0.47, 0, 1.0), cream, tail)
        for z in (0.95, 0.83, 0.71):
            rbox(f"Stripe{z}", (0.46, 0.06, 0.04), P(0, 0, z), mat("kucing_stripe", "#b85a1e"), body, bevel=0.015)
    elif cid == "robot":
        metal = mat("robot_trim", "#8d96a0", rough=0.3, metal=0.9)
        cyl("Antenna", 0.012, 0.16, P(0, 0, 1.65), metal, head, verts=8)
        ball("AntennaTip", 0.04, P(0, 0, 1.74), mat("robot_tip", "#ff5a3c", emit=5.0), head)
        for y in (0.3, -0.3):
            cyl(f"Bolt{y}", 0.06, 0.05, P(0, y, 1.32), metal, head, rot=(math.radians(90), 0, 0))
        rbox("Grille", (0.03, 0.18, 0.06), P(0.285, 0, 1.2), metal, head, bevel=0.01)
        rbox("ChestScreen", (0.03, 0.26, 0.16), P(0.225, 0, 0.83), mat("robot_screen", "#1ec8c8", emit=3.0), body, bevel=0.02)
    elif cid == "ninja":
        band = mat("ninja_band", "#c8312b", rough=0.6)
        rbox("MaskBand", (0.62, 0.66, 0.15), P(0.02, 0, 1.2), mat("ninja_mask", "#1b1a20", rough=0.7), head, bevel=0.05)
        rbox("Headband", (0.67, 0.68, 0.07), P(0, 0, 1.48), band, head, bevel=0.02)
        limb("BandTail1", P(-0.33, 0, 1.48), P(-0.55, 0.05, 1.38), 0.025, band, head)
        limb("BandTail2", P(-0.33, 0, 1.48), P(-0.52, -0.06, 1.33), 0.025, band, head)
        rbox("Sash", (0.46, 0.52, 0.07), P(0, 0, 0.6), band, body, bevel=0.03)
    elif cid == "astro":
        suit = mat("astro_trim", "#e2702e", rough=0.6)
        rbox("O2Pack", (0.22, 0.44, 0.48), P(-0.29, 0, 0.82), mat("astro_pack", "#d9d6cf", rough=0.4), body, bevel=0.08)
        for z in (0.95, 0.66):
            rbox(f"Stripe{z}", (0.46, 0.52, 0.04), P(0, 0, z), suit, body, bevel=0.015)
        torus("Collar", 0.27, 0.04, P(0, 0, 1.06), mat("astro_collar", "#bfc4c8", rough=0.3, metal=0.7), body)
        rbox("Patch", (0.02, 0.12, 0.08), P(0.225, 0.12, 0.88), mat("astro_patch", "#286eeb", emit=0.5), body, bevel=0.01)
    return root

CHARS = {
    "coder":  dict(skin="#e9b48f", top="#2f8f86", bottom="#2b3550", shoe="#efe4cc", blush="#e8907a"),
    "kucing": dict(skin="#e8913a", top="#e8913a", bottom="#e8913a", shoe="#f6e7cf", hand="#f6e7cf", blush="#e99aa6"),
    "robot":  dict(skin="#b9c2cb", top="#9aa5b0", bottom="#6b7682", shoe="#3b4450", head="box", led="#4ff0ff", hand="#6b7682"),
    "ninja":  dict(skin="#e3ad86", top="#26252d", bottom="#26252d", shoe="#15131a", belt="#c8312b"),
    "astro":  dict(skin="#f2f2ee", top="#f2f2ee", bottom="#f2f2ee", shoe="#5a5f66", visor="#d9a441", hand="#d9d6cf"),
}

def hats(x0):
    P = lambda dx, dy, dz: (x0 + dx, dy, dz)
    roots = []
    # baseball cap (backwards, coder style)
    h = empty("Hat_cap", P(0, 0, 0)); roots.append(h)
    red = mat("cap_red", "#c8312b", rough=0.6)
    ball("CapDome", 0.33, P(0, 0, 0), red, h, scale=(1, 1, 0.55))
    rbox("CapBrim", (0.26, 0.34, 0.03), P(-0.36, 0, -0.03), red, h, bevel=0.012)
    # songkok — black velvet Malay cap
    h = empty("Hat_songkok", P(1, 0, 0)); roots.append(h)
    cyl("Songkok", 0.31, 0.2, P(1, 0, 0.0), mat("songkok", "#141217", rough=0.95), h, verts=32)
    cyl("SongkokBand", 0.312, 0.025, P(1, 0, -0.07), mat("songkok_gold", "#c9a24a", rough=0.3, metal=0.8), h, verts=32)
    # crown
    h = empty("Hat_crown", P(2, 0, 0)); roots.append(h)
    gold = mat("crown_gold", "#e0b43c", rough=0.25, metal=1.0)
    cyl("CrownBand", 0.25, 0.1, P(2, 0, 0), gold, h, verts=32)
    for i in range(6):
        a = i * math.pi / 3
        cyl(f"Point{i}", 0.05, 0.14, P(2 + math.cos(a) * 0.22, math.sin(a) * 0.22, 0.11), gold, h, verts=4, r2=0.0)
        ball(f"Gem{i}", 0.025, P(2 + math.cos(a) * 0.25, math.sin(a) * 0.25, 0.0), mat("gem", "#c8312b", rough=0.1, coat=1), h)
    # headphones
    h = empty("Hat_headphones", P(3, 0, 0)); roots.append(h)
    band = mat("hp_band", "#26252d", rough=0.4)
    torus("Headband", 0.34, 0.035, P(3, 0, -0.18), band, h, rot=(0, math.radians(90), 0))
    for y in (0.35, -0.35):
        cyl(f"Cup{y}", 0.11, 0.08, P(3, y, -0.28), mat("hp_cup", "#2f8f86", rough=0.4), h, rot=(math.radians(90), 0, 0))
    # party hat
    h = empty("Hat_party", P(4, 0, 0)); roots.append(h)
    cyl("Cone", 0.18, 0.4, P(4, 0, 0.12), mat("party", "#e07a9a", rough=0.6), h, r2=0.0, verts=24)
    ball("Pom", 0.06, P(4, 0, 0.33), mat("pom", "#e8b33a", rough=0.6), h)
    return roots

if __name__ == "__main__":
    reset()
    roots = [character(cid, i * 1.4, c) for i, (cid, c) in enumerate(CHARS.items())]
    export(roots, "characters.glb")
    hat_roots = hats(10)
    export(hat_roots, "hats.glb")
    if "render" in sys.argv:
        cam = studio(res=(1500, 560))
        bpy.ops.mesh.primitive_plane_add(size=60); bpy.context.object.data.materials.append(mat("floor", "#2a2d36", rough=0.8))
        # put the coder's cap on for the preview
        shoot(cam, (6.4, -6.2, 1.9), (2.8, 0, 0.8), 40, "characters.png")
        print("RENDERED")
    print("OK characters")
