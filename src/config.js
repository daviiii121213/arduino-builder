/** Central tuning knobs for population and world simulation. */
export const GameConfig = {
  pedestrianCount: 20,
  trafficCount: 10,
  parkedCount: 18,
  /** Real-time minutes for a full 24 h cycle. */
  dayLengthMinutes: 12,
  startHour: 13.5,
  /** Keeps the clock still (always daytime for now); set false to run the full day/night cycle. */
  freezeTime: true,
  /** Patrolling police present while the player is not wanted. */
  patrolCars: 2,
  patrolOfficers: 2,
  /** Hard caps for the police response (performance). */
  maxPoliceCars: 5,
  maxPoliceOfficers: 10,
  /** Pooled real lights placed at the street lamps nearest the camera at night. */
  lampLightCount: 4,
};
