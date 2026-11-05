import { MarbleColorDef } from './types';

// All 14 marble colors with Spanish default names appropriate to each color
export const DEFAULT_MARBLE_COLORS: MarbleColorDef[] = [
  { id: 'red', name: 'Rojo Fuego', color: '#e05757' },
  { id: 'green', name: 'Verde Esmeralda', color: '#3eb874' },
  { id: 'blue', name: 'Azul Zafiro', color: '#4d82e8' },
  { id: 'cyan', name: 'Cian Turquesa', color: '#2dbfd6' },
  { id: 'magenta', name: 'Magenta Fucsia', color: '#d64998' },
  { id: 'yellow', name: 'Amarillo Sol', color: '#f0be38' },
  { id: 'orange', name: 'Mikan Naranja 🍊', color: '#ed7e38', isMikan: true },
  { id: 'chartreuse', name: 'Verde Lima', color: '#99cc33' },
  { id: 'spring_green', name: 'Verde Menta', color: '#3bd48e' },
  { id: 'azure', name: 'Azul Celeste', color: '#3b9ee6' },
  { id: 'violet', name: 'Violeta Amatista', color: '#8958e0' },
  { id: 'rose', name: 'Rosa Coral', color: '#e85678' },
  { id: 'white', name: 'Blanco Nieve', color: '#f8fafc', border: '#94a3b8' },
  { id: 'black', name: 'Negro Obsidiana', color: '#242734', border: '#64748b' },
];

export const SIMULATION_SPEEDS = [1, 2, 5, 10] as const;

export const CAMERA_MODES = [
  { id: 'half_pack', label: 'Mitad del Grupo (Auto)' },
  { id: 'leader', label: 'Líder de Carrera' },
  { id: 'overview', label: 'Vista Completa' },
] as const;
