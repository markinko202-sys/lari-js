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
    arms = {}
    for side, y in (("L", 0.31), ("R", -0.31)):
        arm = arms[side] = empty(f"Arm{side}", P(0, y, 0.96), root)
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
            ball(f"Pupil{y}", 0.042, P(0.285, y * 1.04, 1.345), mat(f"{cid}_pupil", c["eyecol"]) if c.get("eyecol") else dark, head, scale=(0.6, 1, 1.2))
            ball(f"Shine{y}", 0.013, P(0.305, y * 1.04 - 0.012, 1.37), white, head)
        if c.get("blush"):
            for y in (0.2, -0.2):
                ball(f"Blush{y}", 0.04, P(0.24, y, 1.25), mat(f"{cid}_blush", c["blush"], rough=0.8), head, scale=(0.4, 1, 0.6))
        if cid != "kenyalang":
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
    elif cid in ("siti", "mei", "priya", "puteri"):
        girl(cid, P, c, root, body, head, dark, arms)
    elif cid == "kancil":
        fur = mat("kancil_fur", c["skin"], rough=0.75)
        cream = mat("kancil_cream", "#f2dfc2", rough=0.75)
        ball("Snout", 0.15, P(0.27, 0, 1.24), fur, head, scale=(1.35, 0.85, 0.75))
        ball("SnoutTip", 0.07, P(0.44, 0, 1.25), cream, head, scale=(0.9, 1.1, 0.8))
        ball("Nose", 0.04, P(0.49, 0, 1.28), dark, head)
        for y in (0.17, -0.17):
            tilt = math.radians(28 if y > 0 else -28)
            cyl(f"Ear{y}", 0.075, 0.3, P(-0.05, y, 1.66), fur, head, r2=0.0, verts=12, rot=(-tilt, math.radians(-10), 0))
            cyl(f"EarIn{y}", 0.045, 0.2, P(-0.03, y * 1.03, 1.64), mat("kancil_pink", "#e9a6a6"), head, r2=0.0, verts=10, rot=(-tilt, math.radians(-10), 0))
        for z, w in ((0.92, 0.34), (0.8, 0.3)):
            rbox(f"Throat{z}", (0.02, w, 0.05), P(0.225, 0, z), cream, body, bevel=0.01)
        ball("Belly", 0.2, P(0.12, 0, 0.72), cream, body, scale=(0.6, 1.1, 1.0))
        tail = empty("Tail", P(-0.23, 0, 0.7), body)
        ball("TailPuff", 0.08, P(-0.28, 0, 0.74), cream, tail, scale=(1, 0.9, 1.3))
    elif cid == "harimau":
        fur = mat("harimau_fur", c["skin"], rough=0.7)
        white = mat("harimau_white", "#f7efe2", rough=0.7)
        ink = mat("harimau_stripe", "#1b1a20", rough=0.6)
        for y in (0.2, -0.2):
            ball(f"Ear{y}", 0.1, P(-0.02, y, 1.6), fur, head, scale=(0.6, 1, 1))
            ball(f"EarIn{y}", 0.06, P(0.02, y, 1.6), white, head, scale=(0.4, 1, 1))
        ball("Muzzle", 0.14, P(0.24, 0, 1.23), white, head, scale=(0.65, 1.35, 0.8))
        ball("Nose", 0.035, P(0.33, 0, 1.28), mat("harimau_nose", "#2a1a1a"), head, scale=(0.8, 1.3, 0.8))
        for k, (y, z) in enumerate([(0, 1.62), (0.09, 1.6), (-0.09, 1.6)]):
            rbox(f"HeadStripe{k}", (0.2, 0.035, 0.1), P(0.08, y, z - 0.02), ink, head, rot=(0, math.radians(-30), 0))
        for y in (0.27, -0.27):
            for k, z in enumerate((1.38, 1.28)):
                rbox(f"Cheek{y}{k}", (0.12, 0.03, 0.03), P(0.12, y, z), ink, head, rot=(math.radians(15 if y > 0 else -15), 0, 0))
        ball("Belly", 0.21, P(0.12, 0, 0.74), white, body, scale=(0.55, 1.1, 1.05))
        for z in (0.98, 0.86, 0.74, 0.62):
            rbox(f"Stripe{z}", (0.3, 0.52, 0.04), P(-0.08, 0, z), ink, body, bevel=0.015)
        tail = empty("Tail", P(-0.22, 0, 0.62), body)
        limb("TailA", P(-0.22, 0, 0.62), P(-0.45, 0, 0.72), 0.055, fur, tail)
        limb("TailB", P(-0.45, 0, 0.72), P(-0.52, 0, 0.98), 0.055, fur, tail, r2=0.05)
        for k, (x, z) in enumerate([(-0.35, 0.67), (-0.48, 0.8), (-0.51, 0.92)]):
            torus(f"TailRing{k}", 0.05, 0.015, P(x, 0, z), ink, tail, rot=(0, math.radians(60 + k * 20), 0))
    elif cid == "kenyalang":
        black = mat("hb_black", "#1b1a20", rough=0.6)
        white = mat("hb_white", "#efe4cc", rough=0.7)
        beak = mat("hb_beak", "#f2b632", rough=0.35, coat=0.5)
        casque = mat("hb_casque", "#e2482e", rough=0.35, coat=0.5)
        limb("Beak", P(0.27, 0, 1.2), P(0.68, 0, 1.06), 0.08, beak, head, r2=0.02)
        limb("Casque", P(0.26, 0, 1.31), P(0.52, 0, 1.27), 0.055, casque, head, r2=0.035)
        limb("CasqueTip", P(0.52, 0, 1.27), P(0.6, 0, 1.36), 0.035, casque, head, r2=0.015)
        ball("Belly", 0.22, P(0.11, 0, 0.72), white, body, scale=(0.55, 1.1, 1.0))
        for y in (0.31, -0.31):     # white wing tips
            rbox(f"WingTip{y}", (0.16, 0.06, 0.18), P(0.03, y * 1.05, 0.62), white, arms["L" if y > 0 else "R"], bevel=0.03)
        tail = empty("Tail", P(-0.22, 0, 0.62), body)
        rbox("TailFan", (0.36, 0.3, 0.06), P(-0.38, 0, 0.6), white, tail, bevel=0.03, rot=(0, math.radians(-25), 0))
        rbox("TailBand", (0.08, 0.31, 0.065), P(-0.44, 0, 0.63), black, tail, bevel=0.02, rot=(0, math.radians(-25), 0))
    return root

def girl(cid, P, c, root, body, head, dark, arms):
    """Shared bits for the girls: lashes, hair styles, skirts and accessories."""
    for y in (0.115, -0.115):
        for k, dy in enumerate((0.02, 0.055)):
            rbox(f"Lash{y}{k}", (0.012, 0.035, 0.012), P(0.272, y + (dy if y > 0 else -dy), 1.42 - k * 0.008), dark, head,
                 rot=(math.radians(35 if y > 0 else -35), 0, 0))
    hair = mat(f"{cid}_hair", c.get("hair", "#1d1a22"), rough=0.7)
    if cid == "siti":
        scarf = mat("siti_tudung", c["scarf"], rough=0.85)
        ball("Tudung", 0.36, P(-0.06, 0, 1.34), scarf, head, scale=(1, 1.03, 0.98), seg=32, rings=18)
        cyl("TudungDrape", 0.31, 0.3, P(0.0, 0, 1.0), scarf, body, r2=0.19, verts=32)
        ball("Pin", 0.025, P(0.2, 0.17, 1.12), mat("siti_pin", "#f2d16b", rough=0.3, metal=0.8), head)
        cyl("KurungHem", 0.3, 0.2, P(0, 0, 0.5), mat(f"{cid}_top", c["top"], rough=0.7), body, r2=0.26, verts=32)
        kain = cyl("Kain", 0.31, 0.4, P(0, 0, 0.3), mat(f"{cid}_bottom", c["bottom"], rough=0.75), root, r2=0.24, verts=32)
        flower = mat("siti_flower", "#f6d6e2", rough=0.6)
        for k, (y, z) in enumerate([(0.12, 0.22), (-0.1, 0.32), (0.02, 0.4), (-0.16, 0.16), (0.2, 0.36)]):
            ball(f"KainDot{k}", 0.025, P(0.27 - abs(y) * 0.2, y, z), flower, kain, scale=(0.5, 1, 1))
    elif cid == "mei":
        ball("Hair", 0.335, P(-0.04, 0, 1.4), hair, head, scale=(1, 1.04, 0.8))
        rbox("Fringe", (0.12, 0.52, 0.1), P(0.21, 0, 1.56), hair, head, bevel=0.045, rot=(0, math.radians(-30), 0))
        tie = mat("mei_tie", "#e2382e", rough=0.5)
        for y in (0.22, -0.22):
            ball(f"Bun{y}", 0.13, P(-0.06, y, 1.66), hair, head)
            torus(f"BunTie{y}", 0.1, 0.022, P(-0.06, y * 0.93, 1.58), tie, head, rot=(math.radians(-25 if y > 0 else 25), 0, 0))
        stripe = mat("mei_stripe", "#fbfaf6", rough=0.6)
        rbox("Zip", (0.02, 0.035, 0.5), P(0.225, 0, 0.8), stripe, body)
        for y in (0.31, -0.31):
            limb(f"SleeveStripe{y}", P(0.0, y * 1.0, 0.93), P(0.02, y * 1.04, 0.7), 0.078, stripe, arms["L" if y > 0 else "R"], r2=0.073)
    elif cid == "priya":
        ball("Hair", 0.335, P(-0.04, 0, 1.4), hair, head, scale=(1, 1.04, 0.84))
        braid = empty("Braid", P(-0.3, 0, 1.3), head)
        for k in range(6):
            ball(f"BraidKnot{k}", 0.09 - k * 0.008, P(-0.32 - k * 0.025, 0, 1.24 - k * 0.11), hair, braid, scale=(1, 1.1, 1))
        gold = mat("priya_gold", "#e0b43c", rough=0.25, metal=1.0)
        torus("BraidTie", 0.05, 0.015, P(-0.45, 0, 0.62), gold, braid)
        jasmine = mat("priya_jasmine", "#fbfaf6", rough=0.5)
        for k in range(5):
            ball(f"Jasmine{k}", 0.035, P(-0.3, -0.12 + k * 0.06, 1.38 - abs(k - 2) * 0.03), jasmine, head)
        for y in (0.31, -0.31):
            ball(f"Earring{y}", 0.03, P(0.0, y, 1.2), gold, head)
        cyl("TunicHem", 0.29, 0.2, P(0, 0, 0.5), mat(f"{cid}_top", c["top"], rough=0.7), body, r2=0.25, verts=32)
        torus("TunicTrim", 0.29, 0.018, P(0, 0, 0.41), gold, body)
        torus("Neckline", 0.13, 0.02, P(0.06, 0, 1.04), gold, body)
    elif cid == "puteri":
        ball("Hair", 0.34, P(-0.04, 0, 1.4), hair, head, scale=(1, 1.05, 0.86))
        rbox("HairBack", (0.16, 0.58, 0.75), P(-0.22, 0, 1.08), hair, head, bevel=0.07)
        gold = mat("puteri_gold", "#e0b43c", rough=0.25, metal=1.0)
        torus("Tiara", 0.235, 0.022, P(0.05, 0, 1.6), gold, head, rot=(0, math.radians(-28), 0))
        for k, (y, hgt) in enumerate([(0, 0.2), (0.09, 0.14), (-0.09, 0.14), (0.17, 0.09), (-0.17, 0.09)]):
            cyl(f"TiaraPoint{k}", 0.035, hgt, P(0.2 - abs(y) * 0.35, y, 1.68 + hgt / 2 - abs(y) * 0.25), gold, head, r2=0.0, verts=6)
        ball("TiaraGem", 0.04, P(0.23, 0, 1.69), mat("puteri_gem", "#4ff0c8", rough=0.1, emit=1.5), head)
        gown = cyl("Gown", 0.42, 0.62, P(0, 0, 0.33), mat(f"{cid}_bottom", c["bottom"], rough=0.6), root, r2=0.25, verts=32)
        for k, (z, rr) in enumerate([(0.12, 0.395), (0.3, 0.34), (0.48, 0.29)]):
            torus(f"Songket{k}", rr, 0.02, P(0, 0, z), gold, gown)
        rbox("Sash", (0.46, 0.52, 0.06), P(0, 0, 0.62), gold, body, bevel=0.02)

CHARS = {
    "coder":  dict(skin="#e9b48f", top="#2f8f86", bottom="#2b3550", shoe="#efe4cc", blush="#e8907a"),
    "kucing": dict(skin="#e8913a", top="#e8913a", bottom="#e8913a", shoe="#f6e7cf", hand="#f6e7cf", blush="#e99aa6"),
    "robot":  dict(skin="#b9c2cb", top="#9aa5b0", bottom="#6b7682", shoe="#3b4450", head="box", led="#4ff0ff", hand="#6b7682"),
    "ninja":  dict(skin="#e3ad86", top="#26252d", bottom="#26252d", shoe="#15131a", belt="#c8312b"),
    "astro":  dict(skin="#f2f2ee", top="#f2f2ee", bottom="#f2f2ee", shoe="#5a5f66", visor="#d9a441", hand="#d9d6cf"),
    # the girls
    "siti":   dict(skin="#d9a37e", top="#7b5cc4", bottom="#6a4db3", shoe="#efe4cc", blush="#e8907a", scarf="#e59bb5"),
    "mei":    dict(skin="#f2cba6", top="#e2382e", bottom="#2b3550", shoe="#fbfaf6", blush="#f09a8a", hair="#1d1a22"),
    "priya":  dict(skin="#a8714f", top="#d6336c", bottom="#f3e3c3", shoe="#7a2a3a", blush="#c86a5a", hair="#15121a"),
    "puteri": dict(skin="#e3b08a", top="#7a1f3d", bottom="#7a1f3d", shoe="#c9a24a", blush="#e8907a", hair="#1b1418"),
    # animals of Malaysia
    "kancil":    dict(skin="#a0683a", top="#a0683a", bottom="#a0683a", shoe="#3a2416", hand="#a0683a", blush="#e9a6a6"),
    "harimau":   dict(skin="#e8822a", top="#e8822a", bottom="#e8822a", shoe="#f7efe2", hand="#f7efe2", blush="#f0a08a"),
    "kenyalang": dict(skin="#1b1a20", top="#1b1a20", bottom="#6b6870", shoe="#6b6870", hand="#efe4cc", eyecol="#c8312b"),
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
    # terendak — the wide conical straw hat of the paddy fields
    h = empty("Hat_terendak", P(5, 0, 0)); roots.append(h)
    straw = mat("straw", "#d9b56a", rough=0.85)
    cyl("Terendak", 0.62, 0.26, P(5, 0, 0.02), straw, h, r2=0.02, verts=40)
    torus("TerendakRim", 0.6, 0.018, P(5, 0, -0.1), mat("straw_rim", "#a8432a", rough=0.6), h, seg=40)
    for k in range(6):
        a = k * math.pi / 3
        limb(f"Weave{k}", P(5 + math.cos(a) * 0.08, math.sin(a) * 0.08, 0.13), P(5 + math.cos(a) * 0.58, math.sin(a) * 0.58, -0.09), 0.008, mat("straw_d", "#b08a42"), h)
    # tengkolok — folded songket headdress with a proud peak
    h = empty("Hat_tengkolok", P(6, 0, 0)); roots.append(h)
    songket = mat("tengkolok", "#1f2a5a", rough=0.6)
    gold = mat("tengkolok_gold", "#e0b43c", rough=0.3, metal=0.9)
    cyl("TengBand", 0.31, 0.16, P(6, 0, -0.02), songket, h, verts=32)
    torus("TengTrim", 0.31, 0.015, P(6, 0, -0.08), gold, h)
    prism("TengPeak", [(-0.28, 0), (0.1, 0), (0.0, 0.34), (-0.18, 0.3)], 0.07, songket, h, loc=P(6, 0.12, 0.05), rot=(0, 0, math.radians(90)))
    rbox("TengStripe", (0.02, 0.08, 0.3), P(6, 0.12, 0.2), gold, h)
    # bunga raya — a hibiscus tucked over the ear
    h = empty("Hat_bunga", P(7, 0, 0)); roots.append(h)
    petal = mat("hibiscus", "#e2263f", rough=0.5, coat=0.4)
    for k in range(5):
        a = k * 2 * math.pi / 5
        ball(f"Petal{k}", 0.085, P(7 + 0.05 + math.cos(a) * 0.08, 0.29, -0.14 + math.sin(a) * 0.08), petal, h, scale=(1, 0.4, 1))
    ball("Pistil", 0.035, P(7 + 0.05, 0.33, -0.14), mat("pistil", "#f2d16b", emit=1.0), h)
    # kitty-ear headband
    h = empty("Hat_ears", P(8, 0, 0)); roots.append(h)
    band = mat("ears_band", "#26252d", rough=0.5)
    torus("EarBand", 0.34, 0.02, P(8, 0, -0.27), band, h, rot=(0, math.radians(90), 0))
    for y in (0.17, -0.17):
        cyl(f"Ear{y}", 0.1, 0.2, P(8, y, 0.06), band, h, verts=4, r2=0.0, rot=(math.radians(-20 if y > 0 else 20), 0, math.radians(45)))
        cyl(f"EarPink{y}", 0.06, 0.14, P(8 + 0.03, y, 0.05), mat("ears_pink", "#f29ab8"), h, verts=4, r2=0.0, rot=(math.radians(-20 if y > 0 else 20), 0, math.radians(45)))
    return roots

if __name__ == "__main__":
    reset()
    roots = [character(cid, i * 1.4, c) for i, (cid, c) in enumerate(CHARS.items())]
    export(roots, "characters.glb")
    hat_roots = hats(24)
    export(hat_roots, "hats.glb")
    if "render" in sys.argv:
        cam = studio(res=(2200, 560))
        bpy.ops.mesh.primitive_plane_add(size=80); bpy.context.object.data.materials.append(mat("floor", "#2a2d36", rough=0.8))
        # turn everyone toward the camera for the line-up
        for o in roots: o.rotation_euler = (0, 0, math.radians(-60))
        shoot(cam, (3.6, -9, 1.6), (3.6, 0, 0.8), 40, "characters.png", res=(1500, 560))
        shoot(cam, (11.9, -9, 1.6), (11.9, 0, 0.8), 40, "characters2.png", res=(1500, 560))
        for h in hat_roots: h.location.z += 1.2
        shoot(cam, (28, -6.5, 1.8), (28, 0, 1.1), 40, "hats.png", res=(1600, 420))
        print("RENDERED")
    print("OK characters")
