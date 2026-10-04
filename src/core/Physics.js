import RAPIER from '@dimforge/rapier3d-compat';

/** Collision membership bits. QUERY is never a membership of a body; it lets scene queries see everything. */
export const Layer = {
  STATIC: 1 << 0,
  PLAYER: 1 << 1,
  NPC: 1 << 2,
  VEHICLE: 1 << 3,
  QUERY: 1 << 4,
  PROP: 1 << 5,
};
const ALL = 0xffff;

export const groups = (membership, filter) => ((membership & 0xffff) << 16) | (filter & 0xffff);

export const Groups = {
  static: groups(Layer.STATIC, ALL),
  player: groups(Layer.PLAYER, ALL),
  npc: groups(Layer.NPC, ALL),
  // Cars collide with the world and each other; NPC/player hits are handled in gameplay code.
  vehicle: groups(Layer.VEHICLE, Layer.STATIC | Layer.VEHICLE | Layer.PROP | Layer.QUERY),
  prop: groups(Layer.PROP, ALL),
};

export const QueryGroups = {
  playerMove: groups(Layer.QUERY, Layer.STATIC | Layer.NPC | Layer.VEHICLE | Layer.PROP),
  npcMove: groups(Layer.QUERY, Layer.STATIC | Layer.PLAYER | Layer.VEHICLE | Layer.PROP),
  wheels: groups(Layer.QUERY, Layer.STATIC),
  bullets: groups(Layer.QUERY, Layer.STATIC | Layer.NPC | Layer.VEHICLE | Layer.PROP),
  camera: groups(Layer.QUERY, Layer.STATIC | Layer.VEHICLE),
  solid: groups(Layer.QUERY, Layer.STATIC | Layer.VEHICLE | Layer.NPC),
  ground: groups(Layer.QUERY, Layer.STATIC),
};

export const FIXED_DT = 1 / 60;

export class Physics {
  static async init() {
    await RAPIER.init();
    return new Physics();
  }

  constructor() {
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_DT;
    /** collider handle -> gameplay owner (NPC, Car...) */
    this.owners = new Map();
  }

  step() {
    this.world.step();
  }

  addStaticBox(cx, cy, cz, hx, hy, hz, rotation) {
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(cx, cy, cz)
      .setCollisionGroups(Groups.static)
      .setFriction(0.8);
    if (rotation) desc.setRotation(rotation);
    return this.world.createCollider(desc);
  }

  addStaticCylinder(cx, cy, cz, halfHeight, radius) {
    const desc = RAPIER.ColliderDesc.cylinder(halfHeight, radius)
      .setTranslation(cx, cy, cz)
      .setCollisionGroups(Groups.static);
    return this.world.createCollider(desc);
  }

  setOwner(collider, owner) {
    this.owners.set(collider.handle, owner);
  }

  ownerOf(collider) {
    return this.owners.get(collider.handle) ?? null;
  }

  /**
   * Raycast returning {point, normal, distance, collider} or null.
   * `exclude` is an optional rigid body to ignore.
   */
  raycast(origin, dir, maxDist, queryGroups = QueryGroups.solid, excludeBody = undefined) {
    const ray = new RAPIER.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(ray, maxDist, true, undefined, queryGroups, undefined, excludeBody);
    if (!hit) return null;
    const t = hit.timeOfImpact;
    return {
      distance: t,
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
      normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
      collider: hit.collider,
    };
  }

  /** Height of the static surface below (x, z), searching down from `fromY`. */
  groundHeight(x, z, fromY = 30) {
    const hit = this.raycast({ x, y: fromY, z }, { x: 0, y: -1, z: 0 }, fromY + 5, QueryGroups.ground);
    return hit ? hit.point.y : 0;
  }

  /** Sphere sweep; returns distance travelled before contact (or maxDist). */
  sphereCast(origin, dir, radius, maxDist, queryGroups = QueryGroups.camera, excludeBody = undefined) {
    const shape = new RAPIER.Ball(radius);
    const hit = this.world.castShape(
      origin, { x: 0, y: 0, z: 0, w: 1 }, dir, shape, 0, maxDist, true,
      undefined, queryGroups, undefined, excludeBody,
    );
    return hit ? hit.time_of_impact ?? hit.timeOfImpact : maxDist;
  }
}
