import React from 'react';
import { Map as MapIcon, X } from 'lucide-react';
import { CourseData, Marble } from '../types';

interface LabyrinthMapModalProps {
  course: CourseData;
  seed: string;
  standings: Marble[];
  onClose: () => void;
}

export const LabyrinthMapModal: React.FC<LabyrinthMapModalProps> = ({
  course,
  seed,
  standings,
  onClose,
}) => {
  return (
    <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 max-w-lg w-full shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <MapIcon size={16} className="text-cyan-400" />
              <span>Plano del Laberinto 5×5 ({seed})</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Inicio (1,1) arriba-izq → Búnker (5,5) abajo-der · Puertas abiertas conectadas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1 aspect-square bg-slate-950 p-2 rounded-xl border border-slate-800">
          {course.chunks.map((room) => {
            const doors = room.doors || { n: false, e: false, s: false, w: false };
            const occupants = standings.filter((m) => !m.gone && m.currentRoomId === room.id);
            const playerOcc = occupants.filter((m) => !m.id.startsWith('npc_'));
            const npcOcc = occupants.filter((m) => m.id.startsWith('npc_'));

            return (
              <div
                key={room.id}
                className={`relative p-1 flex flex-col justify-between text-[9px] rounded ${
                  room.isStart
                    ? 'bg-cyan-950/60'
                    : room.isFinish
                      ? 'bg-emerald-950/70'
                      : room.isDeadEnd
                        ? 'bg-purple-950/40'
                        : 'bg-slate-900/90'
                }`}
                style={{
                  borderTop: doors.n ? '2px dashed rgba(56,189,248,0.45)' : '3px solid #475569',
                  borderRight: doors.e ? '2px dashed rgba(56,189,248,0.45)' : '3px solid #475569',
                  borderBottom: doors.s ? '2px dashed rgba(56,189,248,0.45)' : '3px solid #475569',
                  borderLeft: doors.w ? '2px dashed rgba(56,189,248,0.45)' : '3px solid #475569',
                }}
                title={`Sala (${room.col + 1},${room.row + 1}): ${room.name}`}
              >
                <div className="flex items-center justify-between font-mono text-[8px] text-slate-400">
                  <span>
                    {room.col + 1},{room.row + 1}
                  </span>
                  {room.isStart && <span className="text-cyan-300 font-bold">IN</span>}
                  {room.isFinish && <span className="text-emerald-300 font-bold">EX</span>}
                  {room.isDeadEnd && !room.isStart && !room.isFinish && (
                    <span className="text-purple-300 font-bold">★</span>
                  )}
                </div>
                <div className="text-[8px] font-bold text-slate-200 leading-tight truncate">{room.name}</div>
                <div className="flex flex-wrap gap-0.5 items-center min-h-[10px]">
                  {playerOcc.slice(0, 6).map((m) => (
                    <span
                      key={m.id}
                      className="w-2 h-2 rounded-full inline-block border border-white/50"
                      style={{ backgroundColor: m.isZombie ? '#22c55e' : m.color }}
                    />
                  ))}
                  {npcOcc.length > 0 && (
                    <span className="text-[8px] font-mono text-lime-400 ml-auto">☣{npcOcc.length}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
