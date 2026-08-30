import type { TimeOfDay, WeatherType } from '../data/types';
import type { Track } from '../track/track';

export interface WeatherState {
  weather: WeatherType;
  time: TimeOfDay;
  puddles: { x: number; y: number; radius: number }[];
}

const GRIP_BY_WEATHER: Record<WeatherType, number> = {
  sunny: 1.0,
  cloudy: 0.96,
  rain: 0.8,
  storm: 0.65,
};

const VISIBILITY_BY_WEATHER: Record<WeatherType, number> = {
  sunny: 1.0,
  cloudy: 0.92,
  rain: 0.72,
  storm: 0.5,
};

export function weatherGripMultiplier(w: WeatherType): number {
  return GRIP_BY_WEATHER[w];
}

export function weatherVisibility(w: WeatherType): number {
  return VISIBILITY_BY_WEATHER[w];
}

export function createWeatherState(weather: WeatherType, time: TimeOfDay, track: Track): WeatherState {
  const puddles: { x: number; y: number; radius: number }[] = [];
  if (weather === 'rain' || weather === 'storm') {
    const count = weather === 'storm' ? 14 : 8;
    for (let i = 0; i < count; i++) {
      const idx = Math.floor((i / count) * track.samples.length);
      const sample = track.samples[idx];
      if (sample.surface !== 'asfalto') continue;
      const perp = { x: Math.cos(sample.angle + Math.PI / 2), y: Math.sin(sample.angle + Math.PI / 2) };
      const offset = (Math.random() - 0.5) * sample.halfWidth * 1.2;
      puddles.push({ x: sample.x + perp.x * offset, y: sample.y + perp.y * offset, radius: 2 + Math.random() * 2.5 });
    }
  }
  return { weather, time, puddles };
}

export function isOverPuddle(state: WeatherState, x: number, y: number): boolean {
  for (const p of state.puddles) {
    if ((p.x - x) ** 2 + (p.y - y) ** 2 <= p.radius * p.radius) return true;
  }
  return false;
}
