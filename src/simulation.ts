import {
  CourseData,
  Marble,
  Projectile,
  CombatParticle,
  FloatingText,
  TemporaryBarricade,
  CombatEvent,
  HighlightEvent,
  ReplayFrame,
} from './types';
import {
  updateSimulation,
  matterRaceEngine,
  FocusTrigger,
  initPhysicsEngine,
  isPhysicsReady,
} from './physics';

export { initPhysicsEngine, isPhysicsReady };

export interface SimulationCallbacks {
  onWinner?: (winner: Marble) => void;
  onStageChange?: (stageName: string, stageIndex: number) => void;
}

/**
 * Decoupled Physics Simulation Engine (Rapier2D WASM Backend)
 *
 * Implements a canonical fixed-timestep accumulator at 120Hz with Rapier's native
 * Continuous Collision Detection (CCD) and multi-iteration constraint solver.
 */
export class SimulationEngine {
  public static readonly FIXED_TIMESTEP = 1 / 120; // 8.333ms fixed physics tick
  public static readonly MAX_ACCUMULATOR = 0.20; // 200ms cap
  public static readonly SUBSTEPS = 1; // Rapier natively runs CCD + 6 solver iterations per 120Hz tick

  private course: CourseData | null = null;
  private marbles: Marble[] = [];
  private raceTime: number = 0;
  private accumulator: number = 0;
  private currentStageIndex: number = -1;
  private winner: Marble | null = null;

  constructor(course?: CourseData, marbles?: Marble[]) {
    if (course && marbles) {
      this.init(course, marbles);
    }
  }

  public init(course: CourseData, marbles: Marble[]) {
    this.course = course;
    this.marbles = marbles;
    this.raceTime = 0;
    this.accumulator = 0;
    this.currentStageIndex = 0;
    this.winner = null;

    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i];
      m.prevX = m.x;
      m.prevY = m.y;
      m.prevAngle = m.angle ?? 0;
      m.renderX = m.x;
      m.renderY = m.y;
      m.renderAngle = m.angle ?? 0;
    }

    if (isPhysicsReady()) {
      matterRaceEngine.init(course, marbles);
    }
  }

  public dispose() {
    matterRaceEngine.dispose();
  }

  public getCourse(): CourseData | null {
    return this.course;
  }

  public getMarbles(): Marble[] {
    return this.marbles;
  }

  public getPlayerMarbles(): Marble[] {
    return this.marbles.filter((m) => !m.id.startsWith('npc_'));
  }

  public getProjectiles(): Projectile[] {
    return matterRaceEngine.projectiles;
  }

  public getParticles(): CombatParticle[] {
    return matterRaceEngine.particles;
  }

  public getFloatingTexts(): FloatingText[] {
    return matterRaceEngine.floatingTexts;
  }

  public getBarricades(): TemporaryBarricade[] {
    return matterRaceEngine.barricades;
  }

  public getCombatFeed(): CombatEvent[] {
    return matterRaceEngine.combatFeed;
  }

  public getActiveChunkCount(): number {
    return matterRaceEngine.activeChunkIndices.length;
  }

  public getActiveChunkIndices(): number[] {
    return matterRaceEngine.activeChunkIndices;
  }

  public triggerEmp(x: number, y: number) {
    matterRaceEngine.triggerEmpShockwave(x, y);
  }

  public deployBarricade(x: number, y: number) {
    matterRaceEngine.deployBarricade(x, y);
  }

  public deployAirdrop(x: number, y: number) {
    if (this.course) {
      matterRaceEngine.deployAirdrop(x, y, this.course);
    }
  }

  public triggerBoost(marbleId: string): boolean {
    return matterRaceEngine.triggerMarbleBoost(marbleId);
  }

  public triggerShield(marbleId: string): boolean {
    return matterRaceEngine.triggerMarbleShield(marbleId);
  }

  public triggerHeal(marbleId: string): boolean {
    return matterRaceEngine.triggerMarbleHeal(marbleId);
  }

  public setFollowedMarbleId(id: string | null) {
    matterRaceEngine.followedMarbleId = id;
  }

  public consumePendingFocus(): FocusTrigger | null {
    const f = matterRaceEngine.pendingFocus;
    matterRaceEngine.pendingFocus = null;
    return f;
  }

  public consumePendingDamageFlash(): boolean {
    const f = matterRaceEngine.pendingDamageFlash;
    matterRaceEngine.pendingDamageFlash = false;
    return f;
  }

  public getReplayFrames(): ReplayFrame[] {
    return matterRaceEngine.replayFrames;
  }

  public getHighlightEvents(): HighlightEvent[] {
    return matterRaceEngine.highlightEvents;
  }

  public getRoomDamageCounts(): Record<number, number> {
    return matterRaceEngine.roomDamageCounts;
  }

  public getRaceTime(): number {
    return this.raceTime;
  }

  public getLeader(): Marble | null {
    for (let i = 0; i < this.marbles.length; i++) {
      if (!this.marbles[i].id.startsWith('npc_') && !this.marbles[i].gone) {
        return this.marbles[i];
      }
    }
    return this.marbles.length > 0 ? this.marbles[0] : null;
  }

  public getWinner(): Marble | null {
    return this.winner;
  }

  public getAccumulator(): number {
    return this.accumulator;
  }

  public getCurrentStageIndex(): number {
    return this.currentStageIndex;
  }

  /**
   * Calculates overall pack leader progress percentage [0, 100] using BFS labyrinth distance.
   */
  public getLeaderProgressPercent(): number {
    if (!this.course || this.marbles.length === 0) {
      return 0;
    }
    const leader = this.getLeader();
    if (!leader) return 0;
    if (leader.isExtracted || leader.finished) return 100;
    const maxDist = Math.max(1, this.course.maxDistToFinish || 12);
    return Math.max(0, Math.min(100, Math.floor((leader.progressScore / maxDist) * 100)));
  }

  public update(
    realDt: number,
    simSpeed: number,
    isPaused: boolean,
    callbacks?: SimulationCallbacks
  ): number {
    if (isPaused || !this.course || this.marbles.length === 0) {
      return 0;
    }

    const clampedDt = Math.min(Math.max(0, realDt), 0.1);
    this.accumulator += clampedDt * simSpeed;

    if (this.accumulator > SimulationEngine.MAX_ACCUMULATOR) {
      this.accumulator = SimulationEngine.MAX_ACCUMULATOR;
    }

    let stepsExecuted = 0;
    const fixedDt = SimulationEngine.FIXED_TIMESTEP;
    const substepDt = fixedDt / SimulationEngine.SUBSTEPS;

    while (this.accumulator >= fixedDt) {
      for (let i = 0; i < this.marbles.length; i++) {
        const m = this.marbles[i];
        m.prevX = m.x;
        m.prevY = m.y;
        m.prevAngle = m.angle ?? 0;
      }

      for (let s = 0; s < SimulationEngine.SUBSTEPS; s++) {
        updateSimulation(
          this.course,
          this.marbles,
          substepDt,
          1.0,
          this.raceTime,
          (w) => {
            if (!this.winner) {
              this.winner = w;
              callbacks?.onWinner?.(w);
            }
          }
        );
      }

      this.raceTime += fixedDt;
      this.accumulator -= fixedDt;
      stepsExecuted++;

      // Room announcement when pack leader advances into a new labyrinth room
      const leader = this.getLeader();
      if (this.course && leader && leader.currentRoomId !== undefined) {
        const rIdx = leader.currentRoomId;
        if (rIdx !== this.currentStageIndex) {
          this.currentStageIndex = rIdx;
          const room = this.course.chunks[rIdx];
          if (room) {
            const label =
              room.id === 24
                ? 'BÚNKER DE EXTRACCIÓN (SECTOR 25)'
                : `SALA (${room.col + 1},${room.row + 1}): ${room.name}`;
            callbacks?.onStageChange?.(label, rIdx);
          }
        }
      }
    }

    const alpha = Math.max(0, Math.min(1, this.accumulator / fixedDt));
    this.interpolate(alpha);

    return stepsExecuted;
  }

  public step(fixedDt = SimulationEngine.FIXED_TIMESTEP) {
    if (!this.course || this.marbles.length === 0) return;

    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i];
      m.prevX = m.x;
      m.prevY = m.y;
      m.prevAngle = m.angle ?? 0;
    }

    const substepDt = fixedDt / SimulationEngine.SUBSTEPS;
    for (let s = 0; s < SimulationEngine.SUBSTEPS; s++) {
      updateSimulation(
        this.course,
        this.marbles,
        substepDt,
        1.0,
        this.raceTime,
        (w) => {
          if (!this.winner) this.winner = w;
        }
      );
    }

    this.raceTime += fixedDt;

    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i];
      m.renderX = m.x;
      m.renderY = m.y;
      m.renderAngle = m.angle;
    }
  }

  public interpolate(alpha: number) {
    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i];
      const px = m.prevX ?? m.x;
      const py = m.prevY ?? m.y;
      const pa = m.prevAngle ?? m.angle ?? 0;
      m.renderX = px + (m.x - px) * alpha;
      m.renderY = py + (m.y - py) * alpha;
      m.renderAngle = pa + ((m.angle ?? 0) - pa) * alpha;
    }
  }
}
