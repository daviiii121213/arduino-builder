import { clamp } from './math';
import { ctx2d } from './pixel';
import { drawText, textWidth } from './font';
import { drawSpeedometer } from './speedo';
import { getCarSpecs, getTournamentSpecs, type CarSpec } from './cars';
import { getDecorSprites } from './decor';
import { getWeatherIcons, getTrafficLight } from './icons';
import type { Controls, RaceCar } from './car';
import { buildTracks, type Track } from './tracks';
import { buildWorld, headlessWorld, type World } from './world';
import { WEATHERS } from './weather';
import { difficultyAt, difficultyById, RACECRAFT_CHAMPIONSHIP } from './difficulty';
import { Championship, type Entrant } from './championship';
import { drawStandingsScreen, drawPhaseScreen, type PhaseRow } from './standings';
import {
  PHASES,
  TOURNAMENT_LAPS,
  Tournament,
  buildEntrants,
  type Entrant as TourEntrant,
} from './tournament';
import { weatherById } from './weather';
import { Race, STEP } from './race';
import { Celebration } from './victory';
import { t } from './i18n';
import { Input } from './input';
import { MenuModel, type MenuAction, type MenuEvent } from './menu';
import { MenuRenderer, segmentBar } from './menuRender';
import { Audio } from './audio';

export const TOTAL_LAPS = 3;
/** Roughly how many world pixels tall the view should be; sets the zoom. */
const TARGET_VIEW_HEIGHT = 360;

const INK = '#0d1014';
const BONE = '#f2f0e8';
const DIM = '#98a0ad';

type Mode = 'menu' | 'race' | 'paused' | 'victory' | 'standings' | 'bracket';

/** The app: a menu with a live race behind it, and the race itself. */
export class Game {
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private input: Input;
  private specs: CarSpec[];
  private tracks: Track[];
  private worlds = new Map<string, World>();
  private audio = new Audio();

  private menu: MenuModel;
  private menuUi = new MenuRenderer();
  private mode: Mode = 'menu';
  private race: Race | null = null;
  /** All-AI race running behind the menu, previewing the current selection. */
  private attract: Race | null = null;
  private attractKey = '';
  private resultsTimer = 0;
  private celebration: Celebration | null = null;
  /** Set while a championship is running. */
  private season: Championship | null = null;
  private standingsTimer = 0;
  /** Laps for the race in progress: three by default, more in a championship. */
  private laps = TOTAL_LAPS;
  /** Set while an elimination tournament is running. */
  private tournament: Tournament | null = null;
  private tourSpecs: CarSpec[] = [];
  /** The other group of the opening round, simulated alongside the player's. */
  private sideRace: Race | null = null;
  private bracketTimer = 0;
  private zoom = 2;
  private lastTs = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = ctx2d(canvas);
    this.input = new Input(canvas);
    this.specs = getCarSpecs();
    this.tracks = buildTracks();
    this.menu = new MenuModel(this.specs.length, this.tracks.length, WEATHERS.length);
    this.audio.apply(this.menu.sound);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private world(track: Track): World {
    let w = this.worlds.get(track.def.id);
    if (!w) {
      w = buildWorld(track);
      this.worlds.set(track.def.id, w);
    }
    return w;
  }

  private resize(): void {
    // Measure the element, not the window, so the game fits whatever box the
    // page gives it (full screen, or a panel under a header).
    const cssW = Math.max(320, this.canvas.clientWidth || window.innerWidth);
    const cssH = Math.max(240, this.canvas.clientHeight || window.innerHeight);
    this.zoom = clamp(Math.round(cssH / TARGET_VIEW_HEIGHT), 2, 5);
    this.canvas.width = Math.ceil(cssW / this.zoom);
    this.canvas.height = Math.ceil(cssH / this.zoom);
    this.g = ctx2d(this.canvas);
  }

  start(): void {
    const frame = (ts: number): void => {
      const dt = this.lastTs === 0 ? 0 : Math.min(0.1, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      this.update(dt);
      this.render();
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ---- menu ---------------------------------------------------------------

  private updateMenu(dt: number): void {
    this.menuUi.update(dt);
    const events: MenuEvent[] = [];

    // Every key press is replayed in order, so quick taps never get swallowed.
    const bindings: Record<string, MenuAction> = {
      arrowup: 'up',
      w: 'up',
      arrowdown: 'down',
      s: 'down',
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right',
      enter: 'confirm',
      ' ': 'confirm',
      escape: 'back',
      backspace: 'back',
    };
    for (const key of this.input.keyPresses) {
      const action = bindings[key];
      if (action) events.push(...this.menu.input(action));
    }

    // A click selects the row under the pointer; a second click activates it.
    for (const click of this.input.clicks) {
      const hit = this.menuUi.hitBoxes.find(
        (b) => click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h,
      );
      if (!hit) continue;
      const wasSelected = this.menu.index === hit.index;
      events.push(...this.menu.select(hit.index));
      if (wasSelected) events.push(...this.menu.input('confirm'));
    }

    for (const event of events) {
      switch (event.type) {
        case 'move':
          this.audio.move();
          break;
        case 'confirm':
          this.audio.confirm();
          break;
        case 'back':
          this.audio.back();
          break;
        case 'sound':
          this.audio.apply(this.menu.sound);
          break;
        case 'start':
          this.season = null;
          this.beginRace(event.car, event.track, event.weather, event.opponents, event.difficulty);
          break;
        case 'season':
          this.startSeason(event.car);
          break;
        case 'tournament':
          this.startTournament(event.car);
          break;
        case 'resume':
          if (this.race) this.mode = 'race';
          break;
        case 'quit':
          this.exitToMenu();
          break;
      }
    }

    // The attract race behind the menu always shows the current selection.
    if (this.mode === 'menu' || this.mode === 'paused') {
      const track = this.tracks[this.menu.trackIndex];
      const weather = WEATHERS[this.menu.weatherIndex];
      const key = `${track.def.id}:${weather.id}`;
      if (key !== this.attractKey || !this.attract) {
        this.attractKey = key;
        this.attract = new Race({
          track,
          weather,
          specs: this.specs,
          laps: 99,
          playerCarIndex: null,
          world: this.world(track),
          skipStart: true,
          // A demo race has no player, so every car is an opponent.
          opponents: this.specs.length,
        });
      }
      this.attract.update(dt, this.canvas.width, this.canvas.height);
      this.audio.idleEngine();
    }
  }

  /** Opens a championship and rolls straight into its first round. */
  private startSeason(carIndex: number): void {
    this.season = new Championship();
    this.beginSeasonRound(carIndex);
  }

  /** Builds the race for the championship round now due. */
  private beginSeasonRound(carIndex: number): void {
    const season = this.season;
    if (!season) return;
    const round = season.currentRound;
    const track = this.tracks.find((tr) => tr.def.id === round.trackId) ?? this.tracks[0];
    this.laps = round.laps;
    this.race = new Race({
      track,
      weather: weatherById(round.weather),
      specs: this.specs,
      laps: round.laps,
      playerCarIndex: carIndex,
      world: this.world(track),
      // The championship always runs the full six-car grid.
      opponents: this.specs.length - 1,
      difficulty: difficultyById(round.difficulty),
      racecraft: RACECRAFT_CHAMPIONSHIP,
    });
    this.attract = null;
    this.attractKey = '';
    this.resultsTimer = 0;
    this.celebration = null;
    this.mode = 'race';
  }

  // ---- tournament ---------------------------------------------------------

  /** Opens a twelve-car elimination tournament and runs its first round. */
  private startTournament(carIndex: number): void {
    this.tourSpecs = getTournamentSpecs();
    const names = this.tourSpecs.map((spec) => spec.name);
    this.season = null;
    this.tournament = new Tournament(buildEntrants(this.specs.length, carIndex, names));
    this.beginTournamentRace();
  }

  /** Builds the race (and, in the group stage, the parallel group) for the phase now due. */
  private beginTournamentRace(): void {
    const tournament = this.tournament;
    if (!tournament) return;
    const phase = tournament.phase;
    const track = this.tracks.find((tr) => tr.def.id === phase.trackId) ?? this.tracks[0];
    const weather = weatherById(phase.weather);
    const difficulty = difficultyById(phase.difficulty);
    const player = tournament.player;

    const myGroup = tournament.groupField(tournament.playerGroup);
    // The player starts mid-pack rather than on pole.
    const grid = myGroup.map((e) => e.carIndex).filter((index) => index !== player?.carIndex);
    if (player) grid.splice(Math.min(2, grid.length), 0, player.carIndex);

    this.laps = TOURNAMENT_LAPS;
    this.race = new Race({
      track,
      weather,
      specs: this.tourSpecs,
      laps: TOURNAMENT_LAPS,
      playerCarIndex: player ? player.carIndex : null,
      world: this.world(track),
      difficulty,
      racecraft: RACECRAFT_CHAMPIONSHIP,
      grid,
    });

    // The opening round runs two groups: the one the player is not in is
    // simulated out of sight, on its own world so it leaves no marks.
    this.sideRace = null;
    if (phase.groups > 1) {
      const other = tournament.groupField(tournament.playerGroup === 0 ? 1 : 0);
      this.sideRace = new Race({
        track,
        weather,
        specs: this.tourSpecs,
        laps: TOURNAMENT_LAPS,
        playerCarIndex: null,
        world: headlessWorld(),
        difficulty,
        racecraft: RACECRAFT_CHAMPIONSHIP,
        grid: other.map((e) => e.carIndex),
        skipStart: true,
      });
    }

    this.attract = null;
    this.attractKey = '';
    this.resultsTimer = 0;
    this.celebration = null;
    this.bracketTimer = 0;
    this.mode = 'race';
  }

  /** Runs the parallel group a little each frame, or to the flag on demand. */
  private stepSideRace(steps: number): void {
    const side = this.sideRace;
    if (!side) return;
    for (let i = 0; i < steps && side.cars.some((c) => !c.finished); i++) side.step(STEP);
  }

  /** Scores the round: who went through, who is out, and what comes next. */
  private scoreTournamentRound(race: Race): void {
    const tournament = this.tournament;
    if (!tournament) return;

    // Finish the other group before classifying, so both are complete.
    if (this.sideRace) this.stepSideRace(120 * 400);

    const byCar = new Map<number, TourEntrant>();
    for (const entrant of tournament.groupField(0)) byCar.set(entrant.carIndex, entrant);
    for (const entrant of tournament.groupField(1)) byCar.set(entrant.carIndex, entrant);

    const orderOf = (source: Race): TourEntrant[] =>
      source
        .standings()
        .map((car) => byCar.get(car.carIndex))
        .filter((entrant): entrant is TourEntrant => entrant !== undefined);

    const orders: TourEntrant[][] = [];
    const playerFirst = tournament.playerGroup === 0;
    const mine = orderOf(race);
    const theirs = this.sideRace ? orderOf(this.sideRace) : null;
    if (theirs && !playerFirst) orders.push(theirs);
    orders.push(mine);
    if (theirs && playerFirst) orders.push(theirs);

    tournament.record(orders);
    this.sideRace = null;
    this.bracketTimer = 0;
    this.mode = 'bracket';
  }

  private updateBracket(dt: number): void {
    this.bracketTimer += dt;
    this.audio.idleEngine();
    if (this.bracketTimer < 0.4) return;
    const tournament = this.tournament;
    if (!tournament) {
      this.exitToMenu();
      return;
    }
    if (this.input.tapped('escape')) {
      this.exitToMenu();
      return;
    }
    if (!this.input.tapped('enter', ' ')) return;

    if (tournament.playerOut) {
      // The player's run is over: there is nothing to continue to.
      this.exitToMenu();
      return;
    }
    if (tournament.finished) {
      this.showTournamentChampion();
      return;
    }
    if (tournament.advance()) {
      this.audio.confirm();
      this.beginTournamentRace();
    } else {
      this.exitToMenu();
    }
  }

  private showTournamentChampion(): void {
    const tournament = this.tournament;
    const champion = tournament?.champion;
    if (!tournament || !champion) {
      this.exitToMenu();
      return;
    }
    // The final's classification, so the champion screen shows the head to head
    // that decided it rather than an empty points table.
    const finalOrder = tournament.lastResult?.order[0] ?? [];
    this.celebration = new Celebration(this.tourSpecs[champion.carIndex], 1, {
      title: t('tournamentChampion'),
      subtitle: champion.isPlayer ? champion.name : `${champion.name}   ${t('youFinished')} P2`,
      rows: finalOrder.map((entrant, i) => ({
        carIndex: entrant.carIndex,
        name: entrant.name,
        isPlayer: entrant.isPlayer,
        points: 0,
        lastPoints: 0,
        lastPosition: i + 1,
        place: i + 1,
      })),
      specs: this.tourSpecs,
      showPoints: false,
    });
    this.mode = 'victory';
  }

  private beginRace(
    carIndex: number,
    trackIndex: number,
    weatherIndex: number,
    opponents: number,
    difficulty: number,
  ): void {
    const track = this.tracks[trackIndex];
    this.laps = TOTAL_LAPS;
    this.race = new Race({
      track,
      weather: WEATHERS[weatherIndex],
      specs: this.specs,
      laps: TOTAL_LAPS,
      playerCarIndex: carIndex,
      world: this.world(track),
      opponents,
      difficulty: difficultyAt(difficulty),
    });
    this.attract = null;
    this.attractKey = '';
    this.resultsTimer = 0;
    this.celebration = null;
    this.mode = 'race';
  }

  private exitToMenu(): void {
    this.race = null;
    this.celebration = null;
    this.season = null;
    this.tournament = null;
    this.sideRace = null;
    this.laps = TOTAL_LAPS;
    this.mode = 'menu';
    this.menu.reset();
    this.audio.idleEngine();
    this.audio.back();
  }

  // ---- race ---------------------------------------------------------------

  private playerControls(): Controls {
    const up = this.input.held('w', 'arrowup');
    const down = this.input.held('s', 'arrowdown');
    const left = this.input.held('a', 'arrowleft');
    const right = this.input.held('d', 'arrowright');
    return {
      throttle: (up ? 1 : 0) + (down ? -1 : 0),
      steer: (right ? 1 : 0) + (left ? -1 : 0),
      handbrake: this.input.held(' '),
      nitro: this.input.held('shift'),
    };
  }

  private updateRace(dt: number): void {
    const race = this.race;
    if (!race) return;

    if (this.input.tapped('escape')) {
      this.menu.openPause();
      this.mode = 'paused';
      this.audio.idleEngine();
      this.audio.back();
      return;
    }
    if (this.input.tapped('r')) {
      if (this.tournament) this.beginTournamentRace();
      else if (this.season) this.beginSeasonRound(this.menu.carIndex);
      else {
        this.beginRace(
          this.menu.carIndex,
          this.menu.trackIndex,
          this.menu.weatherIndex,
          this.menu.opponents,
          this.menu.difficulty,
        );
      }
      return;
    }

    race.setPlayerControls(this.playerControls());
    race.update(dt, this.canvas.width, this.canvas.height);

    // One tone per lamp, and a higher one when the lights go out.
    const beat = race.takeStartBeat();
    if (beat !== null) {
      if (beat < 3) this.audio.move();
      else this.audio.confirm();
    }

    // Keep the parallel group rolling while the player races.
    if (this.sideRace) this.stepSideRace(14);

    if (race.takeFinished()) {
      this.audio.fanfare();
      const player = race.player;
      if (this.tournament) {
        this.scoreTournamentRound(race);
        return;
      }
      if (this.season) {
        this.scoreSeasonRound(race);
        return;
      }
      // A podium finish gets its animation before the results board.
      if (player && player.position <= 3) {
        this.celebration = new Celebration(this.specs[player.carIndex], player.position);
        this.mode = 'victory';
        return;
      }
    }

    if (race.over) {
      this.resultsTimer += dt;
      if (this.input.tapped('enter', ' ')) this.exitToMenu();
    }

    const player = race.player;
    if (player && !race.over && race.released) {
      if (player.shifted) this.audio.gearShift(player.shifted === 'up');
      this.audio.updateEngine(player.rpm, player.controls.throttle > 0 ? 1 : 0, player.nitroActive);
    } else {
      this.audio.idleEngine();
    }
  }

  /** Records the round's points and shows the table, or crowns the champion. */
  private scoreSeasonRound(race: Race): void {
    const season = this.season;
    if (!season) return;
    const order: Entrant[] = race
      .standings()
      .map((car) => ({ carIndex: car.carIndex, name: car.name, isPlayer: car.isPlayer }));
    season.scoreRace(order);
    this.standingsTimer = 0;

    if (season.finished) {
      const rows = season.standings();
      const champion = rows[0];
      const player = rows.find((row) => row.isPlayer);
      this.celebration = new Celebration(this.specs[champion.carIndex], 1, {
        title: t('seasonChampion'),
        subtitle: `${champion.name}   ${champion.points} ${t('pts')}${player ? `   ${t('youFinished')} P${player.place}` : ''}`,
        rows,
        specs: this.specs,
      });
      this.mode = 'victory';
      return;
    }
    this.mode = 'standings';
  }

  private updateStandings(dt: number): void {
    this.standingsTimer += dt;
    this.audio.idleEngine();
    if (this.standingsTimer < 0.4) return;
    if (this.input.tapped('escape')) {
      this.exitToMenu();
      return;
    }
    if (this.input.tapped('enter', ' ')) {
      const season = this.season;
      if (season && season.advance()) {
        this.audio.confirm();
        this.beginSeasonRound(this.menu.carIndex);
      } else {
        this.exitToMenu();
      }
    }
  }

  private updateVictory(dt: number): void {
    const show = this.celebration;
    if (!show) {
      this.mode = 'race';
      return;
    }
    this.audio.idleEngine();
    show.update(dt, this.canvas.width, this.canvas.height);
    if (this.input.tapped('enter', ' ', 'escape')) show.skip();
    if (show.done) {
      this.celebration = null;
      this.resultsTimer = 0;
      // A finished season ends at the menu; a single race falls back to its
      // own results board.
      if (this.season && this.season.finished) this.exitToMenu();
      else this.mode = 'race';
    }
  }

  private update(dt: number): void {
    // Browsers only allow audio to start inside a gesture.
    if (this.input.anyInput) this.audio.start();
    if (this.mode === 'menu' || this.mode === 'paused') this.updateMenu(dt);
    else if (this.mode === 'victory') this.updateVictory(dt);
    else if (this.mode === 'standings') this.updateStandings(dt);
    else if (this.mode === 'bracket') this.updateBracket(dt);
    else this.updateRace(dt);
  }

  // ---- drawing ------------------------------------------------------------

  private render(): void {
    const g = this.g;
    const w = this.canvas.width;
    const h = this.canvas.height;
    g.imageSmoothingEnabled = false;

    if (this.mode === 'victory') {
      this.celebration?.draw(g, w, h);
      return;
    }

    if (this.mode === 'bracket') {
      const race = this.race;
      if (race) race.render(g, w, h);
      this.drawBracket(g, w, h);
      return;
    }

    if (this.mode === 'standings') {
      const season = this.season;
      const race = this.race;
      if (race) race.render(g, w, h);
      if (season) {
        const rows = season.standings();
        const player = rows.find((row) => row.isPlayer);
        const next = season.rounds[season.round + 1];
        const nextTrack = next ? this.tracks.find((tr) => tr.def.id === next.trackId) : undefined;
        drawStandingsScreen(g, w, h, {
          rows,
          round: season.roundNumber,
          totalRounds: season.totalRounds,
          playerPosition: player?.lastPosition ?? 0,
          playerPoints: player?.lastPoints ?? 0,
          nextRound: next && nextTrack ? `${nextTrack.def.name}  ${next.laps} ${t('laps')}` : '',
          specs: this.specs,
          time: this.standingsTimer,
        });
      }
      return;
    }

    const backdrop = this.mode === 'menu' ? this.attract : this.race;
    if (backdrop) backdrop.render(g, w, h);
    else {
      g.fillStyle = INK;
      g.fillRect(0, 0, w, h);
    }

    if (this.mode === 'menu' || this.mode === 'paused') {
      this.menuUi.draw(g, w, h, this.menu, {
        specs: this.specs,
        tracks: this.tracks,
        weathers: WEATHERS,
      });
    } else {
      this.drawHud(g, w, h);
    }
  }

  /** The elimination screen for the round just run. */
  private drawBracket(g: CanvasRenderingContext2D, w: number, h: number): void {
    const tournament = this.tournament;
    const result = tournament?.lastResult;
    if (!tournament || !result) return;

    const phaseIndex = PHASES.findIndex((p) => p.id === result.phase);
    const advance = PHASES[phaseIndex].advance;
    const title =
      result.phase === 'group'
        ? t('groupStage')
        : result.phase === 'six'
          ? t('phaseSix')
          : result.phase === 'four'
            ? t('phaseFour')
            : t('phaseFinal');

    const toRow = (entrant: TourEntrant, i: number): PhaseRow => ({
      place: i + 1,
      name: entrant.name,
      advanced: i < advance,
      isPlayer: entrant.isPlayer,
      tint: this.tourSpecs[entrant.carIndex]?.tint,
    });

    const groups = result.order.map((order, i) => ({
      label:
        result.order.length > 1
          ? `${t('group')} ${String.fromCharCode(65 + i)}${order.some((e) => e.isPlayer) ? '' : `  (${t('otherGroup')})`}`
          : `${t('entrants')} ${order.length}`,
      rows: order.map(toRow),
    }));

    const next = PHASES[phaseIndex + 1];
    const nextTrack = next ? this.tracks.find((tr) => tr.def.id === next.trackId) : undefined;
    const nextName = next
      ? next.id === 'six'
        ? t('phaseSix')
        : next.id === 'four'
          ? t('phaseFour')
          : t('phaseFinal')
      : '';

    drawPhaseScreen(g, w, h, {
      title,
      subtitle: `${t('advancesN').replace('%', String(advance))}   ${t('youFinished')} P${result.playerPosition}`,
      groups,
      cut: advance,
      nextLine:
        next && nextTrack ? `${t('nextRound')}: ${nextName}  ${nextTrack.def.name}` : t('phaseFinal'),
      playerOut: tournament.playerOut,
      outMessage: `${t('youAreOut')}   ${t('outBlurb')}`,
      hint: tournament.playerOut ? t('footOut') : t('continueRace'),
      time: this.bracketTimer,
    });
  }

  /** Race HUD: laps, position, speed and the nitro gauge. */
  private drawHud(g: CanvasRenderingContext2D, w: number, h: number): void {
    const race = this.race;
    const player = race?.player;
    if (!race || !player) return;
    const spec = race.specs[player.carIndex];

    drawText(g, `${t('lap')} ${player.displayLap(race.laps)}/${race.laps}`, 8, 8, {
      scale: 2,
      color: BONE,
      shadow: INK,
    });
    drawText(g, `${t('pos')} ${player.position}/${race.cars.length}`, 8, 24, {
      scale: 2,
      color: BONE,
      shadow: INK,
    });

    drawText(g, race.track.def.name, w - 8, 8, { scale: 1, color: BONE, shadow: INK, align: 'right' });
    const icon = getWeatherIcons()[race.weather.id];
    g.drawImage(icon, w - 8 - icon.width, 18);

    if (this.season) this.drawSeasonStrip(g, w, player);
    else if (this.tournament) this.drawTournamentStrip(g, w);

    // Gauges stack in the bottom-left corner; the dial sits opposite them.
    const barW = 104;
    const barX = 8 + 34;
    const nitroY = h - 34;
    const brakeY = h - 20;

    const flashing = player.nitroActive && Math.floor(race.time * 14) % 2 === 0;
    const empty = player.nitroLocked;
    drawText(g, t('nitro'), 8, nitroY + 2, {
      scale: 1,
      color: empty ? '#8a3b3b' : player.nitroActive ? BONE : '#59d8f0',
      shadow: INK,
    });
    segmentBar(
      g,
      barX,
      nitroY,
      barW,
      10,
      player.nitroRatio,
      flashing ? '#bff6ff' : empty ? '#5c2b2b' : '#59d8f0',
      10,
    );
    if (player.nitroActive) {
      // Little exhaust ticks either side of the gauge while it burns.
      g.fillStyle = flashing ? '#ffd75e' : '#ff9a3c';
      g.fillRect(barX + barW + 3, nitroY + 2, 2, 6);
      g.fillRect(barX + barW + 6, nitroY + 4, 2, 2);
    }

    // Brake condition, in the same shape as the nitro gauge, colour-coded by
    // the band the brakes are in.
    const condition = player.brake;
    const brakeColor =
      condition >= 76 ? '#5fd06a' : condition >= 51 ? '#c8d84a' : condition >= 26 ? '#f2b33d' : condition >= 1 ? '#e0813f' : '#c8332b';
    drawText(g, t('brakes'), 8, brakeY + 2, { scale: 1, color: brakeColor, shadow: INK });
    segmentBar(g, barX, brakeY, barW, 10, condition / 100, brakeColor, 10);
    drawText(g, `${condition}%`, barX + barW + 6, brakeY + 2, {
      scale: 1,
      color: brakeColor,
      shadow: INK,
    });

    // The dial: speed, revs and the gear the box has chosen.
    const radius = Math.min(46, Math.round(Math.min(w, h) * 0.13));
    drawSpeedometer(g, w - radius - 12, h - radius - 26, radius, {
      kmh: Math.abs(player.forwardSpeed) * 0.75,
      gear: player.gear,
      gearCount: player.gearCount,
      rpm: player.rpm,
      tint: spec.tint,
    });

    if (player.blinking) {
      // Tell the player why the car is flickering and being moved.
      drawText(g, t('recovering'), w / 2, h - 46, {
        scale: 1,
        color: Math.floor(race.time * 6) % 2 === 0 ? '#f2c14e' : BONE,
        shadow: INK,
        align: 'center',
      });
    }

    this.drawStartSequence(g, w, h, race);
    if (race.over) this.drawResults(g, w, h, race);
  }

  /** The gantry lights, centred over the track. */
  private drawStartSequence(g: CanvasRenderingContext2D, w: number, h: number, race: Race): void {
    const signal = race.startSignal;
    if (signal.kind === 'none') return;
    const cx = Math.round(w / 2);

    // A soft band behind the sequence so it reads over the pack and the tarmac.
    g.fillStyle = 'rgba(8,10,16,0.35)';
    g.fillRect(0, Math.round(h * 0.12), w, Math.round(h * 0.36));

    if (signal.kind === 'go') {
      const flash = Math.floor(race.startTime * 12) % 2 === 0;
      drawText(g, t('go'), cx, Math.round(h * 0.3), {
        scale: 8,
        color: flash ? '#5fd06a' : BONE,
        shadow: INK,
        align: 'center',
      });
      return;
    }

    const light = getTrafficLight(signal.state);
    const scale = 3;
    const lw = light.width * scale;
    const lh = light.height * scale;
    const lx = Math.round(cx - lw / 2);
    const ly = Math.round(h * 0.18);
    g.imageSmoothingEnabled = false;
    g.drawImage(light, lx, ly, lw, lh);

    // A soft glow behind whichever lamp is burning.
    // Fractions of the sprite height where each lamp actually sits.
    const lampY = signal.state === 'green' ? 0.62 : signal.state === 'redYellow' ? 0.41 : 0.19;
    const glow = signal.state === 'green' ? '#57e05a' : signal.state === 'redYellow' ? '#ffd53d' : '#ff4438';
    g.globalAlpha = 0.25;
    g.fillStyle = glow;
    g.fillRect(lx - 5, Math.round(ly + lh * lampY), lw + 10, 12);
    g.fillRect(lx - 9, Math.round(ly + lh * lampY) + 3, lw + 18, 6);
    g.globalAlpha = 1;
  }

  /**
   * A slim championship strip across the top: the round, the player's points
   * and where those points put them. It sits above the racing surface.
   */
  private drawSeasonStrip(g: CanvasRenderingContext2D, w: number, player: RaceCar): void {
    const season = this.season;
    if (!season) return;
    const rows = season.standings();
    const me = rows.find((row) => row.isPlayer);
    const leader = rows[0];
    const strip = `${t('round')} ${season.roundNumber}/${season.totalRounds}`;
    const mine = `${t('pts')} ${me ? me.points : 0}`;
    const place = me && me.place ? `P${me.place}` : `P${player.position}`;
    const top = leader ? `${leader.name} ${leader.points}` : '';

    const text = `${strip}   ${mine}   ${place}${top ? `   ${top}` : ''}`;
    const width = textWidth(text, { scale: 1 }) + 12;
    const x = Math.round(w / 2 - width / 2);
    g.fillStyle = 'rgba(8,10,16,0.62)';
    g.fillRect(x, 4, width, 12);
    g.fillStyle = '#c8332b';
    g.fillRect(x, 4, 2, 12);
    g.fillStyle = '#f2f0e8';
    g.fillRect(x + width - 2, 4, 2, 12);
    drawText(g, text, w / 2, 7, { scale: 1, color: BONE, shadow: INK, align: 'center' });
  }

  /** A slim strip naming the round and what it takes to get through. */
  private drawTournamentStrip(g: CanvasRenderingContext2D, w: number): void {
    const tournament = this.tournament;
    if (!tournament) return;
    const phase = tournament.phase;
    const name =
      phase.id === 'group'
        ? `${t('group')} ${String.fromCharCode(65 + tournament.playerGroup)}`
        : phase.id === 'six'
          ? t('phaseSix')
          : phase.id === 'four'
            ? t('phaseFour')
            : t('phaseFinal');
    const cut =
      phase.id === 'final' ? t('winnerTakesAll') : t('advancesN').replace('%', String(phase.advance));
    const text = `${name}   ${cut}`;
    const width = textWidth(text, { scale: 1 }) + 12;
    const x = Math.round(w / 2 - width / 2);
    g.fillStyle = 'rgba(8,10,16,0.62)';
    g.fillRect(x, 4, width, 12);
    g.fillStyle = '#c8332b';
    g.fillRect(x, 4, 2, 12);
    g.fillStyle = '#f2f0e8';
    g.fillRect(x + width - 2, 4, 2, 12);
    drawText(g, text, w / 2, 7, { scale: 1, color: BONE, shadow: INK, align: 'center' });
  }

  private drawResults(g: CanvasRenderingContext2D, w: number, h: number, race: Race): void {
    const standings = race.standings();
    const pw = 200;
    const rows = standings.length;
    const ph = rows * 12 + 54;
    const px = Math.round((w - pw) / 2);
    const py = Math.round((h - ph) / 2);

    g.fillStyle = 'rgba(8,10,16,0.78)';
    g.fillRect(0, 0, w, h);
    g.fillStyle = INK;
    g.fillRect(px - 2, py - 2, pw + 4, ph + 4);
    g.fillStyle = '#232936';
    g.fillRect(px, py, pw, ph);

    const player = race.player;
    drawText(g, player ? `${t('finished')}  P${player.position}` : t('results'), px + pw / 2, py + 8, {
      scale: 2,
      color: BONE,
      shadow: INK,
      align: 'center',
    });
    // Chequered rule under the heading, echoing the start/finish line.
    for (let i = 0; i * 4 < pw - 16; i++) {
      g.fillStyle = i % 2 === 0 ? BONE : INK;
      g.fillRect(px + 8 + i * 4, py + 23, 4, 2);
      g.fillStyle = i % 2 === 0 ? INK : BONE;
      g.fillRect(px + 8 + i * 4, py + 25, 4, 2);
    }

    standings.forEach((car, i) => {
      const y = py + 32 + i * 12;
      const mine = car.isPlayer;
      const spec = race.specs[car.carIndex];
      drawText(g, `${car.position}`, px + 10, y, { scale: 1, color: mine ? BONE : DIM });
      drawText(g, car.name, px + 24, y, { scale: 1, color: mine ? spec.tint : DIM });
      drawText(g, car.finished ? `${car.finishTime.toFixed(1)}S` : '-', px + pw - 10, y, {
        scale: 1,
        color: mine ? BONE : DIM,
        align: 'right',
      });
    });

    if (this.resultsTimer > 0.8 && Math.floor(this.resultsTimer * 2) % 2 === 0) {
      drawText(g, t('resultsHint'), px + pw / 2, py + ph - 12, {
        scale: 1,
        color: BONE,
        align: 'center',
      });
    }
  }

  // ---- helpers used by the automated browser smoke test --------------------

  trackName(): string {
    return (this.race ?? this.attract)?.track.def.name ?? this.tracks[this.menu.trackIndex].def.name;
  }

  menuState(): Record<string, string | number | boolean> {
    const race = this.race;
    return {
      mode: this.mode,
      screen: this.menu.screen,
      index: this.menu.index,
      car: this.menu.carIndex,
      track: this.menu.trackIndex,
      weather: this.menu.weatherIndex,
      opponents: this.menu.opponents,
      difficulty: this.menu.difficulty,
      fieldSize: race ? race.cars.length : 0,
      language: this.menu.language,
      released: race ? race.released : true,
      startTime: race ? Number(race.startTime.toFixed(2)) : 0,
      startSignal: race ? race.startSignal.kind : 'none',
      celebrating: this.celebration !== null,
      place: this.celebration ? this.celebration.place : 0,
      tournament: this.tournament !== null,
      phase: this.tournament ? this.tournament.phase.id : '',
      phaseNumber: this.tournament ? this.tournament.phaseNumber : 0,
      fieldLeft: this.tournament ? this.tournament.field.length : 0,
      playerOut: this.tournament ? this.tournament.playerOut : false,
      tourChampion: this.tournament?.champion?.name ?? '',
      season: this.season !== null,
      seasonRound: this.season ? this.season.roundNumber : 0,
      seasonDone: this.season ? this.season.finished : false,
      laps: race ? race.laps : this.laps,
      playerPoints: this.season
        ? (this.season.standings().find((row) => row.isPlayer)?.points ?? 0)
        : 0,
    };
  }

  /** Plays the podium scene for a given place; used by the browser test. */
  showVictory(place: number, carIndex = this.menu.carIndex): void {
    this.celebration = new Celebration(this.specs[carIndex], place);
    this.mode = 'victory';
  }

  /** Skips the start sequence; used by the automated browser test. */
  releaseStart(): void {
    this.race?.start.skip();
  }

  /** Dumps the player out on the grass, to exercise recovery from the test. */
  strandPlayer(): void {
    const race = this.race;
    const player = race?.player;
    if (!race || !player) return;
    const near = race.track.nearest(player.pos, player.wpHint);
    const at = race.track.pointAt(near.along);
    const off = race.track.def.halfWidth + 70;
    player.pos = {
      x: at.pos.x - Math.sin(at.heading) * off,
      y: at.pos.y + Math.cos(at.heading) * off,
    };
    player.vel = { x: 0, y: 0 };
  }

  carsDebug(): Array<Record<string, number | string | boolean>> {
    const race = this.race ?? this.attract;
    if (!race) return [];
    return race.cars.map((c) => ({
      name: c.name,
      isPlayer: c.isPlayer,
      x: Math.round(c.pos.x),
      y: Math.round(c.pos.y),
      speed: Math.round(c.speed),
      forward: Math.round(c.forwardSpeed),
      heading: Number(c.heading.toFixed(3)),
      lap: c.lap,
      displayLap: c.displayLap(race.laps),
      position: c.position,
      offTrack: c.offTrack,
      finished: c.finished,
      nitro: Number(c.nitro.toFixed(2)),
      nitroActive: c.nitroActive,
      recovery: c.recovery,
      offTrackTime: Number(c.offTrackTime.toFixed(2)),
      gear: c.gear,
      gearCount: c.gearCount,
      rpm: Number(c.rpm.toFixed(2)),
      brake: c.brake,
    }));
  }

  /** Fast-forwards the running race with an AI standing in for the player. */
  autopilot(seconds: number): void {
    (this.race ?? this.attract)?.autopilot(seconds);
  }

  /** Runs a whole race headlessly and reports how it finished. */
  simulateRace(maxSeconds: number): Record<string, unknown> {
    const race = this.race;
    if (!race) return { error: 'not racing' };
    let t = 0;
    while (t < maxSeconds && race.cars.some((c) => !c.finished)) {
      race.autopilot(STEP);
      t += STEP;
    }
    return {
      seconds: Number(t.toFixed(1)),
      laps: race.cars.map((c) => c.lap),
      positions: race.cars.map((c) => c.position),
      finishTimes: race.cars.map((c) => Number(c.finishTime.toFixed(1))),
      allFinished: race.cars.every((c) => c.finished),
    };
  }
}

/** Touching the sprite caches early keeps the first frame hitch-free. */
export function preloadArt(): void {
  getCarSpecs();
  getDecorSprites();
  getWeatherIcons();
}
