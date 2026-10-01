# Small modelling helpers shared by the LARI.js asset scripts (Blender 5.x, run headless).
# Conventions: Blender is Z-up; characters face +X (the direction of travel); the camera
# looks at the -Y side, so anything that should face the player points to -Y.
import bpy, bmesh, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
RENDERS = os.path.join(ROOT, "renders")
scn = None

def reset():
    global scn
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    _mats.clear()
    return scn

def hexc(h):
    h = h.lstrip("#")
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))

_mats = {}
def mat(name, color, rough=0.6, metal=0.0, coat=0.0, trans=0.0, emit=0.0, alpha=1.0):
    """Principled material; `color` is a hex string. `emit` > 0 makes it glow in its own colour."""
    key = name
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    c = hexc(color)
    b.inputs["Base Color"].default_value = (*c, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Transmission Weight"].default_value = trans
    if emit:
        b.inputs["Emission Color"].default_value = (*c, 1)
        b.inputs["Emission Strength"].default_value = emit
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        m.surface_render_method = 'BLENDED' if hasattr(m, "surface_render_method") else None
    _mats[key] = m
    return m

def _finish(o, name, parent, material, smooth):
    o.name = name
    if material is not None:
        o.data.materials.clear(); o.data.materials.append(material)
    if smooth is not None and o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = smooth
    if parent is not None:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o

def apply_mods(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True); bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def empty(name, loc=(0, 0, 0), parent=None):
    bpy.ops.object.empty_add(location=loc, radius=0.1)
    return _finish(bpy.context.object, name, parent, None, None)

def rbox(name, size, loc, material, parent=None, bevel=0.0, rot=(0, 0, 0), seg=3):
    """Box with full size (sx, sy, sz) centred at loc, optional rounded edges."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        m = o.modifiers.new("bevel", 'BEVEL'); m.width = bevel; m.segments = seg
        apply_mods(o)
    return _finish(o, name, parent, material, bool(bevel))

def ball(name, r, loc, material, parent=None, scale=(1, 1, 1), seg=24, rings=14, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=rings, rotation=rot)
    o = bpy.context.object; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return _finish(o, name, parent, material, True)

def cyl(name, r, depth, loc, material, parent=None, rot=(0, 0, 0), verts=24, r2=None, smooth=True):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    _finish(o, name, parent, material, None)
    if smooth:  # smooth the sides, keep caps flat
        for p in o.data.polygons:
            n = p.normal
            p.use_smooth = abs(n.z) < 0.7
        if rot != (0, 0, 0):
            for p in o.data.polygons: p.use_smooth = True
    return o

def torus(name, R, r, loc, material, parent=None, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_torus_add(location=loc, major_radius=R, minor_radius=r, rotation=rot,
                                     major_segments=seg, minor_segments=10)
    return _finish(bpy.context.object, name, parent, material, True)

def limb(name, a, b, r, material, parent=None, r2=None):
    """Rounded limb (capsule) from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a; L = d.length
    r2 = r if r2 is None else r2
    bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=L, vertices=16, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    caps = []
    for p, rr in ((a, r), (b, r2)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rr, location=p, segments=16, ring_count=8)
        caps.append(bpy.context.object)
    o = join([o] + caps, name)
    return _finish(o, name, parent, material, True)

def text(name, body, size, loc, material, parent=None, rot=(math.radians(90), 0, 0), extrude=0.02, font=None):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.object; o.data.body = body; o.data.size = size; o.data.extrude = extrude
    o.data.align_x = 'CENTER'; o.data.align_y = 'CENTER'
    if font: o.data.font = font
    bpy.ops.object.convert(target='MESH')
    return _finish(bpy.context.object, name, parent, material, False)

def prism(name, pts, depth, material, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), axis='Y'):
    """Extrude a 2D outline (x, z) along Y by `depth` (centred)."""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs = [bm.verts.new((x, -depth / 2, z)) for x, z in pts]
    f = bm.faces.new(vs)
    ex = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ex["geom"] if isinstance(e, bmesh.types.BMVert)]: v.co.y += depth
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scn.collection.objects.link(o)
    o.location = loc; o.rotation_euler = rot
    return _finish(o, name, parent, material, False)

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    return objs[0]

def origin_to(o, point):
    """Move an object's origin to a world point without moving its mesh."""
    saved = scn.cursor.location.copy()
    scn.cursor.location = point
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    scn.cursor.location = saved

def export(roots, filename):
    bpy.ops.object.select_all(action='DESELECT')
    for r in roots:
        r.select_set(True)
        for c in r.children_recursive: c.select_set(True)
    os.makedirs(ASSETS, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(ASSETS, filename), export_format='GLB',
                              use_selection=True, export_apply=True, export_yup=True,
                              export_extras=False, export_lights=False, export_cameras=False)

def studio(res=(900, 700), samples=40, bg="#14161c", strength=0.7):
    scn.render.engine = 'CYCLES'; scn.cycles.samples = samples; scn.cycles.device = 'CPU'
    scn.render.resolution_x, scn.render.resolution_y = res
    scn.view_settings.view_transform = 'AgX'
    w = bpy.data.worlds.new("w"); scn.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*hexc(bg), 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = strength
    bpy.ops.object.light_add(type='AREA', location=(3, -4, 5))
    k = bpy.context.object; k.data.energy = 900; k.data.size = 4
    k.rotation_euler = (Vector((0, 0, 0.8)) - k.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.light_add(type='AREA', location=(-4, -2, 3))
    f = bpy.context.object; f.data.energy = 300; f.data.size = 5
    f.rotation_euler = (Vector((0, 0, 0.8)) - f.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add(); cam = bpy.context.object; scn.camera = cam
    return cam

def shoot(cam, loc, target, lens, filename, res=None):
    if res: scn.render.resolution_x, scn.render.resolution_y = res
    # keep the key/fill lights framed on whatever we are shooting
    for o in scn.objects:
        if o.type == 'LIGHT':
            base = o.get("base")
            if base is None: o["base"] = base = list(o.location)
            o.location = (base[0] + target[0], base[1] + target[1], base[2] + max(0, target[2] - 0.8))
            o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()
    cam.location = loc; cam.data.lens = lens
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    os.makedirs(RENDERS, exist_ok=True)
    scn.render.filepath = os.path.join(RENDERS, filename)
    bpy.ops.render.render(write_still=True)
