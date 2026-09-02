import { drawText } from './font';
import { rng } from './pixel';
import { awardForPlace, getAward, getDriver, type Award } from './drivers';
import { t } from './i18n';
import { drawTable } from './standings';
import type { Standing } from './championship';
import type { CarSpec } from './cars';

/**
 * The podium scene played after a top-three finish: the car rolls in, the
 * driver climbs out and raises the trophy or the medal, confetti falls.
 */

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  spin: number;
}

const PALETTE = ['#c8332b', '#f2c14e', '#59d8f0', '#5fd06a', '#f2f0e8', '#e2701c'];

/** Beat times, in seconds from the start of the scene. */
const DRIVE_IN = 0.9;
const CLIMB_OUT = 1.5;
const RAISE = 2.1;
export const VICTORY_LENGTH = 6.5;

const INK = '#0d1014';
const BONE = '#f2f0e8';

export class Celebration {
  private time = 0;
  private confetti: Confetti[] = [];
  private rand = rng(1312);
  readonly award: Award;

  constructor(
    readonly spec: CarSpec,
    readonly place: number,
    /**
     * Set for the end of a championship: its own heading, the champion's name
     * and the final table drawn alongside the podium.
     */
    private readonly season?: { title: string; subtitle: string; rows: Standing[]; specs: CarSpec[] },
  ) {
    this.award = awardForPlace(place) ?? 'bronze';
  }

  /** True once the scene has run its course (or the player skipped it). */
  done = false;

  skip(): void {
    this.done = true;
  }

  get title(): string {
    if (this.season) return this.season.title;
    return this.place === 1 ? t('champion') : this.place === 2 ? t('secondPlace') : t('thirdPlace');
  }

  get awardName(): string {
    return this.place === 1 ? t('trophy') : this.place === 2 ? t('silverMedal') : t('bronzeMedal');
  }

  update(dt: number, w: number, h: number): void {
    this.time += dt;
    if (this.time > VICTORY_LENGTH) this.done = true;

    if (this.time > RAISE && this.confetti.length < 90 && this.rand() < dt * 60) {
      for (let i = 0; i < 2; i++) {
        this.confetti.push({
          x: this.rand() * w,
          y: -4,
          vx: (this.rand() - 0.5) * 26,
          vy: 26 + this.rand() * 44,
          color: PALETTE[Math.floor(this.rand() * PALETTE.length)],
          size: this.rand() < 0.5 ? 2 : 3,
          spin: this.rand() * 6,
        });
      }
    }
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.x += c.vx * dt + Math.sin((this.time + c.spin) * 3) * 12 * dt;
      c.y += c.vy * dt;
      if (c.y > h + 6) this.confetti.splice(i, 1);
    }
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number): void {
    const rect = (x: number, y: number, rw: number, rh: number, color: string): void => {
      g.fillStyle = color;
      g.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh));
    };

    // Night-sky backdrop with a few stars, so the podium reads as a stage.
    rect(0, 0, w, h, '#131a2a');
    const stars = rng(77);
    for (let i = 0; i < 70; i++) {
      const sx = Math.floor(stars() * w);
      const sy = Math.floor(stars() * h * 0.6);
      rect(sx, sy, 1, 1, stars() < 0.3 ? '#8fa4d0' : '#3d4b6b');
    }

    const groundY = Math.round(h * 0.68);

    // Grandstand behind the podium: a dark bank of heads behind a rail, with
    // the odd camera flash going off in it.
    const standH = 34;
    const standTop = groundY - standH;
    rect(0, standTop, w, standH, '#161d2c');
    const crowd = rng(4242);
    for (let row = 0; row < 4; row++) {
      const hy = standTop + 4 + row * 7;
      for (let hx = 2 + (row % 2) * 3; hx < w; hx += 6) {
        if (crowd() < 0.15) continue;
        rect(hx, hy, 3, 3, crowd() < 0.5 ? '#28334c' : '#1f2739');
        rect(hx, hy + 3, 3, 3, '#141a28');
        if (crowd() < 0.02 && Math.floor(this.time * 7 + hx) % 5 === 0) {
          rect(hx, hy - 2, 2, 2, '#fff3c4');
        }
      }
    }
    rect(0, standTop, w, 2, '#3b4a6b');
    rect(0, groundY - 4, w, 4, '#101623');

    rect(0, groundY, w, h - groundY, '#232936');
    rect(0, groundY, w, 2, '#39445a');
    // Chequered apron along the front of the stage.
    for (let i = 0; i * 8 < w; i++) {
      rect(i * 8, h - 8, 8, 8, i % 2 === 0 ? BONE : INK);
    }

    const cx = Math.round(w / 2);
    const podiumW = 96;
    const podiumH = this.place === 1 ? 46 : this.place === 2 ? 34 : 26;
    const podiumX = cx - podiumW / 2;
    const podiumY = groundY - podiumH;
    rect(podiumX - 2, podiumY - 2, podiumW + 4, podiumH + 4, INK);
    rect(podiumX, podiumY, podiumW, podiumH, '#3a4560');
    rect(podiumX, podiumY, podiumW, 3, '#5c6c92');
    rect(podiumX, podiumY + podiumH - 3, podiumW, 3, '#222a3c');
    drawText(g, String(this.place), cx, podiumY + Math.round(podiumH / 2) - 10, {
      scale: 3,
      color: BONE,
      shadow: INK,
      align: 'center',
    });

    // The car rolls in from the left and parks beside the podium.
    const carSprite = this.spec.sprite;
    const carScale = 3;
    const carTargetX = cx + podiumW / 2 + 42;
    const carX = this.time < DRIVE_IN ? -40 + (carTargetX + 40) * (this.time / DRIVE_IN) : carTargetX;
    const carY = groundY - carSprite.height * carScale * 0.5;
    g.imageSmoothingEnabled = false;
    g.save();
    g.translate(Math.round(carX), Math.round(carY));
    // Parked broadside so the artwork reads at this size.
    g.rotate(-Math.PI / 2);
    g.drawImage(
      carSprite,
      -Math.round((carSprite.width * carScale) / 2),
      -Math.round((carSprite.height * carScale) / 2),
      carSprite.width * carScale,
      carSprite.height * carScale,
    );
    g.restore();

    if (this.time < CLIMB_OUT) return this.drawTitleLater(g, w, h);

    const driver = getDriver(this.spec.id);
    const raising = this.time >= RAISE;
    const sprite = raising ? driver.cheer : driver.idle;
    const scale = 4;
    const dw = sprite.width * scale;
    const dh = sprite.height * scale;
    // Climbing out: the driver rises from behind the car onto the podium.
    const climb = Math.min(1, (this.time - CLIMB_OUT) / (RAISE - CLIMB_OUT));
    const hop = raising ? Math.round(Math.sin(this.time * 6) * 2) : 0;
    const dx = Math.round(cx - dw / 2);
    const dy = Math.round(podiumY - dh + (1 - climb) * 18) + hop;
    rect(dx + 4, podiumY - 2, dw - 8, 2, '#1a2030');
    g.drawImage(sprite, dx, dy, dw, dh);

    if (raising) {
      const award = getAward(this.award);
      const awardScale = 3;
      const aw = award.width * awardScale;
      const ah = award.height * awardScale;
      const lift = Math.round(Math.sin(this.time * 4) * 3);
      const ax = Math.round(cx - aw / 2);
      const ay = Math.round(dy - ah + scale * 2 + lift);
      if (this.award === 'trophy') {
        // Cup lifted overhead, its base resting in both hands.
        g.drawImage(award, ax, ay, aw, ah);
      } else {
        // A medal is held up by its ribbon, so it hangs disc-up from the hands.
        g.save();
        g.translate(cx, ay + ah);
        g.scale(1, -1);
        g.drawImage(award, Math.round(-aw / 2), 0, aw, ah);
        g.restore();
      }

      // Sparkles around the silverware.
      const spark = rng(Math.floor(this.time * 8) + 5);
      for (let i = 0; i < 6; i++) {
        const sx = cx - aw / 2 - 6 + spark() * (aw + 12);
        const sy = dy - ah + spark() * (ah + 10);
        rect(sx, sy, 2, 2, spark() < 0.5 ? '#fff3c4' : '#ffd75e');
      }
    }

    for (const c of this.confetti) rect(c.x, c.y, c.size, c.size, c.color);
    this.drawTitle(g, w);

    // Final table beside the podium, so the season reads at a glance.
    if (this.season) {
      const tableW = Math.min(168, Math.round(w * 0.3));
      drawTable(g, 12, 74, tableW, this.season.rows, {
        showRacePoints: false,
        rowHeight: 12,
        specs: this.season.specs,
      });
    }
  }

  private drawTitleLater(g: CanvasRenderingContext2D, w: number, h: number): void {
    // Before the driver is out, keep the banner but leave the stage clear.
    if (this.time > 0.35) this.drawTitle(g, w);
    void h;
  }

  private drawTitle(g: CanvasRenderingContext2D, w: number): void {
    const cx = Math.round(w / 2);
    const scale = this.season ? 2 : 3;
    drawText(g, this.title, cx, 22, { scale, color: '#f2c14e', shadow: INK, align: 'center' });
    drawText(g, this.season ? this.season.subtitle : `${this.spec.name}   ${this.awardName}`, cx, 52, {
      scale: 1,
      color: BONE,
      shadow: INK,
      align: 'center',
    });
    if (this.time > 1.6 && Math.floor(this.time * 2) % 2 === 0) {
      drawText(g, t('skipHint'), cx, 66, { scale: 1, color: '#98a0ad', shadow: INK, align: 'center' });
    }
  }
}
