const MAX_ACCIDENTS = 3;

/**
 * Small traffic accidents: cars that touched stop with hazard lights, the
 * drivers get out and look at the damage, bystanders stop to watch, traffic
 * slows past the scene, a patrol car may come to take a look. After a while
 * the drivers get back in and drive on (if the car still runs).
 */
export class Accidents {
  constructor({ npcs, vehicleUse, audio, police, player }) {
    Object.assign(this, { npcs, vehicleUse, audio, police, player });
    this.list = [];
    this.hazards = []; // [{x, z, r}] read by traffic AI
  }

  /** Two AI cars collided. */
  onCollision({ cars, rigs, speed, pos }) {
    this.add(cars, rigs, pos, speed);
  }

  /** Something went wrong with a single car (skid into the curb, a pole...). */
  single(vehicle, rig) {
    vehicle.hazardOn = true;
    vehicle.persistent = false;
    this.add([vehicle], [rig], vehicle.currPos.clone(), 6);
  }

  add(cars, rigs, pos, severity) {
    if (this.list.length >= MAX_ACCIDENTS) this.list.shift();
    const a = { cars, rigs, pos: pos.clone(), t: 0, npcs: [], phase: 'stopped', severity, exitAt: 2.5 + Math.random() * 1.5 };
    this.list.push(a);
    // Bystanders stop and look; someone yelps at a hard hit.
    let yelled = false;
    for (const n of this.npcs.npcs) {
      if (n.isOfficer || n.currPos.distanceTo(pos) > 28) continue;
      if (n.lookAt(pos, 3 + Math.random() * 5) && !yelled && severity > 6) {
        this.audio.play('yelp', n.currPos, 0.6);
        yelled = true;
      }
    }
    if (severity > 4) this.police?.investigate?.(pos);
    return a;
  }

  update(dt) {
    this.hazards.length = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      a.t += dt;
      const cars = a.cars.filter((c) => !c.disposed);
      if (!cars.length || a.t > 120) {
        for (const c of cars) {
          c.hazardOn = false;
          if (!c.driver) c.abandoned = true; // towed away once the player has left
        }
        this.list.splice(i, 1);
        continue;
      }
      if (a.t < 60) this.hazards.push({ x: a.pos.x, z: a.pos.z, r: 24 });

      // Drivers get out once the cars have stopped.
      if (a.phase === 'stopped' && a.t > a.exitAt) {
        a.phase = 'outside';
        a.cars.forEach((car, k) => {
          const rig = a.rigs[k];
          if (!rig || car.disposed || rig.root.parent !== car.model.root || car.driver) return;
          this.vehicleUse.driverExits(car, rig, {
            onDone: (npc) => {
              npc.lookAt(car.currPos, 14 + Math.random() * 6);
              a.npcs.push({ npc, car, rig: npc.rig });
            },
          });
        });
      }
      // ...and later carry on, if their car still runs and nobody is in the way.
      if (a.phase === 'outside' && a.t > 26) {
        a.phase = 'leaving';
        for (const { npc, car, rig } of a.npcs) {
          const ok = npc.rig === rig && npc.state === 'idle' || npc.state === 'walk';
          const near = car.currPos.distanceTo(this.player.position) < 10;
          if (ok && !near && !car.disposed && car.damage.usable && car.mode === 'parked' && !car.driver && car.damage.health > 30) {
            car.hazardOn = false;
            this.vehicleUse.sendNpcToCar(npc, car);
          }
        }
      }
    }
  }
}
