import { MarbleColorDef, WeaponType, ZombieType } from './types';

export const GRID_COLS = 5;
export const GRID_ROWS = 5;
export const ROOM_SIZE = 500;
export const SOCKET_WIDTH = 190;
export const HALF_SW = SOCKET_WIDTH / 2; // 95px
export const WORLD_W = ROOM_SIZE * GRID_COLS; // 2500px
export const WORLD_H = ROOM_SIZE * GRID_ROWS; // 2500px
export const DEFAULT_SEED = 'zombierun808';

// All 14 marble colors with Spanish default names appropriate to each color
export const DEFAULT_MARBLE_COLORS: MarbleColorDef[] = [
  { id: 'red', name: 'Rojo Fuego', color: '#e05757', mass: 0.92, restitution: 0.62, materialType: 'bouncy' },
  { id: 'green', name: 'Verde Esmeralda', color: '#3eb874', mass: 1.00, restitution: 0.50, materialType: 'glass' },
  { id: 'blue', name: 'Azul Zafiro', color: '#4d82e8', mass: 1.15, restitution: 0.48, materialType: 'crystal' },
  { id: 'cyan', name: 'Cian Turquesa', color: '#2dbfd6', mass: 0.88, restitution: 0.58, materialType: 'polymer' },
  { id: 'magenta', name: 'Magenta Fucsia', color: '#d64998', mass: 0.95, restitution: 0.65, materialType: 'bouncy' },
  { id: 'yellow', name: 'Amarillo Sol', color: '#f0be38', mass: 0.90, restitution: 0.60, materialType: 'bouncy' },
  { id: 'orange', name: 'Naranja Biohazard', color: '#ed7e38', mass: 1.05, restitution: 0.52, materialType: 'polymer' },
  { id: 'chartreuse', name: 'Verde Lima', color: '#99cc33', mass: 0.94, restitution: 0.56, materialType: 'glass' },
  { id: 'spring_green', name: 'Verde Menta', color: '#3bd48e', mass: 1.02, restitution: 0.50, materialType: 'glass' },
  { id: 'azure', name: 'Azul Celeste', color: '#3b9ee6', mass: 0.98, restitution: 0.53, materialType: 'crystal' },
  { id: 'violet', name: 'Violeta Amatista', color: '#8958e0', mass: 1.20, restitution: 0.45, materialType: 'dense' },
  { id: 'rose', name: 'Rosa Coral', color: '#e85678', mass: 1.08, restitution: 0.49, materialType: 'polymer' },
  { id: 'white', name: 'Blanco Nieve', color: '#f8fafc', border: '#94a3b8', mass: 1.25, restitution: 0.42, materialType: 'dense' },
  { id: 'black', name: 'Negro Obsidiana', color: '#242734', border: '#64748b', mass: 1.35, restitution: 0.38, materialType: 'dense' },
];

export const SIMULATION_SPEEDS = [0.5, 1, 2, 4] as const;

export const CAMERA_MODES = [
  { id: 'follow', label: 'Seguir', description: 'Siguiendo Canica' },
  { id: 'half_pack', label: 'Grupo', description: 'Mitad del Grupo (Auto)' },
  { id: 'leader', label: 'Líder', description: 'Líder de Carrera' },
  { id: 'overview', label: '5×5', description: 'Vista Completa' },
] as const;

export interface WeaponSpec {
  id: WeaponType;
  name: string;
  icon: string;
  range: number;
  cooldown: number;
  damage: number;
  knockback: number;
  color: string;
  pellets?: number;
  isMelee?: boolean;
}

export const WEAPON_SPECS: Record<WeaponType, WeaponSpec> = {
  blaster: {
    id: 'blaster',
    name: 'Bláster',
    icon: '🔫',
    range: 230,
    cooldown: 0.55,
    damage: 1.2,
    knockback: 6.5,
    color: '#38bdf8',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Escopeta',
    icon: '💥',
    range: 145,
    cooldown: 0.95,
    damage: 1.4,
    knockback: 10.5,
    color: '#fb923c',
    pellets: 4,
  },
  rifle: {
    id: 'rifle',
    name: 'Rifle',
    icon: '🎯',
    range: 340,
    cooldown: 0.85,
    damage: 2.5,
    knockback: 5.0,
    color: '#22d3ee',
  },
  spread: {
    id: 'spread',
    name: 'Triple',
    icon: '🔱',
    range: 240,
    cooldown: 0.52,
    damage: 1.1,
    knockback: 6.0,
    color: '#f59e0b',
    pellets: 3,
  },
  rapid: {
    id: 'rapid',
    name: 'Ráfaga',
    icon: '⚡',
    range: 225,
    cooldown: 0.24,
    damage: 0.85,
    knockback: 4.8,
    color: '#a855f7',
  },
  bat: {
    id: 'bat',
    name: 'Bate',
    icon: '🏏',
    range: 56,
    cooldown: 0.45,
    damage: 1.5,
    knockback: 13.0,
    color: '#facc15',
    isMelee: true,
  },
  sword: {
    id: 'sword',
    name: 'Espada',
    icon: '🗡️',
    range: 64,
    cooldown: 0.34,
    damage: 2.2,
    knockback: 7.5,
    color: '#f43f5e',
    isMelee: true,
  },
};

export interface ZombieSpec {
  id: ZombieType;
  label: string;
  radius: number;
  hp: number;
  mass: number;
  speedMult: number;
  forceMult: number;
  color: string;
  border: string;
}

export const ZOMBIE_SPECS: Record<ZombieType, ZombieSpec> = {
  walker: {
    id: 'walker',
    label: 'Caminante',
    radius: 12.5,
    hp: 4,
    mass: 1.0,
    speedMult: 1.0,
    forceMult: 1.0,
    color: '#4d9b36',
    border: '#84cc16',
  },
  runner: {
    id: 'runner',
    label: 'Corredor',
    radius: 10.5,
    hp: 2.5,
    mass: 0.85,
    speedMult: 1.35,
    forceMult: 1.55,
    color: '#b8cc26',
    border: '#fde047',
  },
  tank: {
    id: 'tank',
    label: 'Tanque',
    radius: 16.0,
    hp: 10,
    mass: 1.9,
    speedMult: 0.85,
    forceMult: 1.15,
    color: '#2c5e2b',
    border: '#4ade80',
  },
  boss: {
    id: 'boss',
    label: 'Jefe Alfa',
    radius: 18.0,
    hp: 20,
    mass: 2.4,
    speedMult: 0.95,
    forceMult: 1.3,
    color: '#6b21a8',
    border: '#c084fc',
  },
};
