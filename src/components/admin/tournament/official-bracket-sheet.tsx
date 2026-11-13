// ==============================================================================
// COMPONENTE: HOJA OFICIAL DE POOLS Y LLAVES PARA EXPORTACIÓN A PDF
// ==============================================================================
//
// CARACTERÍSTICAS:
// - Estándar oficial de Judo IJF (estilo Judomanager / Smoothcomp).
// - Adaptación paramétrica rigurosa según la cantidad de judokas pesados (N):
//   1. N in [9, 16]: Eliminatoria Cuadro de 16 (Réplica exacta foto de 9 judokas IJF):
//      - 4 pastillas verticales de Pools A-D en la izquierda.
//      - 8 cajas de primera ronda divididas blanco / azul con círculos (1) a (8).
//      - Distribución reglamentaria de 16-N Byes con nombres sobre líneas de avance.
//      - Finales de Pool / Cuartos (9) a (12).
//      - Semifinales (15) y (16).
//      - Gran Final (19) y línea de coronación para el Campeón.
//   2. N in [6, 8]: Eliminatoria Cuadro de 8:
//      - 4 pastillas verticales de Pools A-D.
//      - 4 combates de cuartos de final con Byes si N < 8.
//      - Semifinales (5) y (6), Gran Final (7) y línea de Oro.
//   3. N in [3, 5]: Round Robin (Réplica exacta foto de 3 judokas IJF):
//      - Matriz Berger oficial N x N con encabezado amarillo (#, Judoka, Club, 1..N, Wins, Score).
//      - Casillas cruzadas con diagonal gris.
//      - Emparejamientos con cajas blanco/azul, círculo de combate y línea de ganador.
//   4. N = 2: Al Mejor de 3 (Best of 3) con alternancia reglamentaria de judogi.
//   5. N = 1: Campeón Directo (Oro oficial proclamado).
// - Insignia ovalada de judokas en cabecera: "${N} Judoka" idéntica a la imagen oficial.
// - Dimensionamiento estricto A4 Landscape (1100px x 740px) sin divisiones ni líneas negras.
//
// ==============================================================================

'use client';

import React from 'react';
import { BracketResult, GeneratedMatch } from '@/lib/rules/bracket-engine';
import { CategoryBracketStatus } from '@/app/actions/brackets';
import { RegisteredAthleteSummary } from '@/app/actions/registrations';

interface OfficialBracketSheetProps {
  category: CategoryBracketStatus;
  tournamentName: string;
  bracket?: BracketResult | null;
  athletes: RegisteredAthleteSummary[];
}

export function OfficialBracketSheet({
  category,
  tournamentName,
  bracket,
  athletes,
}: OfficialBracketSheetProps) {
  const competitorCount = athletes.length;
  const durationMinutes = Math.round((category.match_duration_seconds || 240) / 60);

  // Formato oficial de nombre de competidor: APELLIDO, NOMBRE (CLUB)
  const formatCompetitorName = (ath: RegisteredAthleteSummary | undefined) => {
    if (!ath) return 'POR DETERMINAR';
    const parts = ath.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].toUpperCase();
    const lastName = parts.slice(1).join(' ').toUpperCase();
    const firstName = parts[0].toUpperCase();
    return `${lastName}, ${firstName}`;
  };

  const getClubCode = (ath: RegisteredAthleteSummary | undefined) => {
    if (!ath) return '';
    return ath.club_name ? `(${ath.club_name.toUpperCase()})` : '';
  };

  return (
    <div className="official-bracket-page bg-white text-slate-950 p-6 rounded-none font-sans text-xs w-[1100px] h-[740px] max-h-[740px] mx-auto flex flex-col justify-between border border-slate-300 print:border-0 print:p-4 overflow-hidden shadow-sm">
      {/* CABECERA OFICIAL */}
      <div className="border-b-2 border-slate-900 pb-2.5 flex justify-between items-start flex-shrink-0">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
            {tournamentName} • Hoja Oficial de Competición
          </span>
          <h2 className="text-xl font-black text-slate-950 tracking-tight">
            {category.name}
          </h2>
          <div className="flex items-center space-x-3 text-[11px] font-bold text-slate-700 mt-0.5">
            <span className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded font-mono">
              Tatami #{category.assigned_tatami_number}
            </span>
            <span>Tiempo: {durationMinutes} min</span>
            <span>•</span>
            <span>{competitorCount} Judoka{competitorCount === 1 ? '' : 's'} Pesado{competitorCount === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* INSIGNIA OVALADA OFICIAL: "${N} Judoka" (IDÉNTICA A LA IMAGEN DEL USUARIO) */}
          <div className="border-2 border-slate-800 bg-slate-50 rounded-full px-5 py-1 shadow-sm text-center">
            <span className="text-sm font-black text-slate-950 tracking-tight block">
              {competitorCount} Judoka{competitorCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-black font-mono px-3 py-1 bg-slate-900 text-white rounded">
              {competitorCount === 1
                ? 'Campeón Directo'
                : competitorCount === 2
                ? 'Al Mejor de 3'
                : competitorCount <= 5
                ? 'Round Robin (Berger)'
                : competitorCount <= 8
                ? 'Cuadro de 8 (Pools A-D)'
                : 'Cuadro de 16 (Pools A-D)'}
            </span>
            <span className="block text-[9px] text-slate-500 font-mono mt-1">
              Emitido: {new Date().toLocaleDateString('es-CL')}
            </span>
          </div>
        </div>
      </div>

      {/* CONTENIDO DEL CUADRO SEGÚN LA CANTIDAD DE JUDOKAS (N) */}
      <div className="flex-1 my-2 flex items-center justify-center overflow-hidden">
        {/* CASO 1: CAMPEÓN DIRECTO (1 JUDOKA) */}
        {competitorCount <= 1 && (
          <UncontestedSheet athlete={athletes[0]} />
        )}

        {/* CASO 2: AL MEJOR DE 3 (2 JUDOKAS) */}
        {competitorCount === 2 && (
          <BestOfThreeSheet athletes={athletes} matches={bracket?.matches || []} />
        )}

        {/* CASO 3: ROUND ROBIN BERGER (3 A 5 JUDOKAS • IDÉNTICO A FOTO 1) */}
        {competitorCount >= 3 && competitorCount <= 5 && (
          <RoundRobinBergerSheet athletes={athletes} matches={bracket?.matches || []} />
        )}

        {/* CASO 4: ELIMINATORIA CUADRO DE 8 (6 A 8 JUDOKAS • POOLS A-D) */}
        {competitorCount >= 6 && competitorCount <= 8 && (
          <EliminationTree8Sheet athletes={athletes} matches={bracket?.matches || []} />
        )}

        {/* CASO 5: ELIMINATORIA CUADRO DE 16 (9 A 16 JUDOKAS • RÉPLICA EXACTA FOTO 9 JUDOKAS) */}
        {competitorCount >= 9 && (
          <EliminationTree16Sheet athletes={athletes} matches={bracket?.matches || []} />
        )}
      </div>

      {/* PIE DE HOJA OFICIAL */}
      <div className="border-t border-slate-300 pt-1.5 flex justify-between items-center text-[10px] text-slate-500 font-mono flex-shrink-0">
        <span>Mesa de Control • Software Oficial de Judo</span>
        <span>Posición Inicial de Sorteo / Llave Oficial</span>
        <span>Categoría Oficial IJF</span>
      </div>
    </div>
  );
}

// ==============================================================================
// 1. SUB-COMPONENTE: CUADRO DE 16 (RÉPLICA EXACTA FOTO DE 9 JUDOKAS IJF)
// ==============================================================================
function EliminationTree16Sheet({
  athletes,
  matches,
}: {
  athletes: RegisteredAthleteSummary[];
  matches: GeneratedMatch[];
}) {
  const n = athletes.length;

  // Orden estándar de sembrado para 16 slots
  const standardSeeds16 = [1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2];

  // Si existen matches generados de R16 / Ronda 1, los usamos directamente
  const r1Matches = matches.filter(
    (m) => m.round.startsWith('R16') || m.round.startsWith('R1') || m.round.includes('Octavos')
  );

  // Mapeo de slots 0 a 15 (8 combates de 2 competidores)
  interface SlotInfo {
    name: string;
    club: string;
    isBye: boolean;
  }

  const slots: SlotInfo[] = [];

  if (r1Matches.length === 8) {
    // Si tenemos los 8 combates generados del bracket
    for (let i = 0; i < 8; i++) {
      const m = r1Matches[i];
      const isWhiteBye = !m.white_athlete_name || m.white_athlete_name === '—' || m.white_athlete_name.includes('BYE');
      const isBlueBye = !m.blue_athlete_name || m.blue_athlete_name === '—' || m.blue_athlete_name.includes('BYE');

      slots.push({
        name: isWhiteBye ? '' : formatNameDisplay(m.white_athlete_name),
        club: m.white_club_name ? `(${m.white_club_name.toUpperCase()})` : '',
        isBye: isWhiteBye,
      });

      slots.push({
        name: isBlueBye ? '' : formatNameDisplay(m.blue_athlete_name),
        club: m.blue_club_name ? `(${m.blue_club_name.toUpperCase()})` : '',
        isBye: isBlueBye,
      });
    }
  } else {
    // Mapeo reglamentario por sembrado con atletas pesados
    // Los primeros N atletas ocupan las posiciones de seed 1..N
    // Las posiciones con seed > N son BYEs
    for (let slotIdx = 0; slotIdx < 16; slotIdx++) {
      const seedVal = standardSeeds16[slotIdx];
      if (seedVal <= n && athletes[seedVal - 1]) {
        const ath = athletes[seedVal - 1];
        slots.push({
          name: formatNameDisplay(ath.name),
          club: ath.club_name ? `(${ath.club_name.toUpperCase()})` : '',
          isBye: false,
        });
      } else {
        slots.push({
          name: '',
          club: '',
          isBye: true,
        });
      }
    }
  }

  // Agrupar en 8 combates de primera ronda
  interface MatchBox {
    matchNum: number;
    white: SlotInfo;
    blue: SlotInfo;
    advancingText: string; // Nombre sobre la línea si hay Bye
    yCenter: number;
  }

  // Centros verticales para los 8 combates (distribuidos en 580px)
  const yCenters = [42, 104, 184, 246, 334, 396, 476, 538];

  const matchBoxes: MatchBox[] = [];
  for (let mIdx = 0; mIdx < 8; mIdx++) {
    const white = slots[mIdx * 2];
    const blue = slots[mIdx * 2 + 1];

    let advancingText = '';
    if (white.isBye && !blue.isBye) {
      advancingText = `${blue.name} ${blue.club}`.trim();
    } else if (!white.isBye && blue.isBye) {
      advancingText = `${white.name} ${white.club}`.trim();
    }

    matchBoxes.push({
      matchNum: mIdx + 1,
      white,
      blue,
      advancingText,
      yCenter: yCenters[mIdx],
    });
  }

  // Coordenadas de los Pools verticales (A, B, C, D)
  const pools = [
    { label: 'Pool A', bg: '#f3e8ff', border: '#c084fc', text: '#581c87', yTop: 20, yBottom: 126 },
    { label: 'Pool B', bg: '#ccfbf1', border: '#5eead4', text: '#134e4a', yTop: 162, yBottom: 268 },
    { label: 'Pool C', bg: '#ffe4e6', border: '#fda4af', text: '#881337', yTop: 312, yBottom: 418 },
    { label: 'Pool D', bg: '#fef9c3', border: '#fde047', text: '#713f12', yTop: 454, yBottom: 560 },
  ];

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg
        viewBox="0 0 1060 580"
        className="w-full h-full max-h-[580px] select-none"
        style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
      >
        {/* ============================================================== */}
        {/* 1. PASTILLAS VERTICALES DE POOLS A, B, C, D                     */}
        {/* ============================================================== */}
        {pools.map((p) => {
          const height = p.yBottom - p.yTop;
          const centerY = p.yTop + height / 2;
          return (
            <g key={p.label}>
              {/* Fondo redondeado tipo pastilla */}
              <rect
                x="12"
                y={p.yTop}
                width="30"
                height={height}
                rx="15"
                fill={p.bg}
                stroke={p.border}
                strokeWidth="2"
              />
              {/* Texto vertical rotado */}
              <text
                x={centerY}
                y="-27"
                transform="rotate(90)"
                textAnchor="middle"
                fontSize="12"
                fontWeight="900"
                fill={p.text}
                letterSpacing="1px"
              >
                {p.label}
              </text>
            </g>
          );
        })}

        {/* ============================================================== */}
        {/* 2. CAJAS DE COMBATE DE RONDA 1 (COMBATES 1 AL 8)               */}
        {/* ============================================================== */}
        {matchBoxes.map((mb) => {
          const cardX = 48;
          const cardWidth = 230;
          const cardHeight = 44;
          const cardY = mb.yCenter - cardHeight / 2;
          const circleX = cardX + cardWidth + 9;
          const circleY = mb.yCenter;

          return (
            <g key={mb.matchNum}>
              {/* Contenedor del combate con bordes redondeados a la izquierda */}
              <rect
                x={cardX}
                y={cardY}
                width={cardWidth}
                height={cardHeight}
                rx="6"
                fill="#ffffff"
                stroke="#64748b"
                strokeWidth="1.5"
              />

              {/* Ranura Azul (mitad inferior con fondo celeste/lavanda) */}
              <path
                d={`M ${cardX} ${cardY + cardHeight / 2} L ${cardX + cardWidth} ${cardY + cardHeight / 2} L ${cardX + cardWidth} ${cardY + cardHeight - 6} Q ${cardX + cardWidth} ${cardY + cardHeight} ${cardX + cardWidth - 6} ${cardY + cardHeight} L ${cardX + 6} ${cardY + cardHeight} Q ${cardX} ${cardY + cardHeight} ${cardX} ${cardY + cardHeight - 6} Z`}
                fill="#eef2ff"
              />

              {/* Línea divisoria central entre blanco y azul */}
              <line
                x1={cardX}
                y1={cardY + cardHeight / 2}
                x2={cardX + cardWidth}
                y2={cardY + cardHeight / 2}
                stroke="#94a3b8"
                strokeWidth="1"
              />

              {/* Texto de Atleta Blanco (arriba) */}
              <text
                x={cardX + 8}
                y={cardY + 15}
                fontSize="9"
                fontWeight="800"
                fill="#0f172a"
              >
                {mb.white.name || ''}
                {mb.white.club && (
                  <tspan fontSize="8" fontWeight="600" fill="#64748b" dx="4">
                    {mb.white.club}
                  </tspan>
                )}
              </text>

              {/* Texto de Atleta Azul (abajo) */}
              <text
                x={cardX + 8}
                y={cardY + 36}
                fontSize="9"
                fontWeight="800"
                fill="#1e1b4b"
              >
                {mb.blue.name || ''}
                {mb.blue.club && (
                  <tspan fontSize="8" fontWeight="600" fill="#4338ca" dx="4">
                    {mb.blue.club}
                  </tspan>
                )}
              </text>

              {/* Conector al círculo de combate */}
              <line
                x1={cardX + cardWidth}
                y1={circleY}
                x2={circleX}
                y2={circleY}
                stroke="#475569"
                strokeWidth="1.5"
              />

              {/* Círculo con el número de combate (1 a 8) */}
              <circle
                cx={circleX}
                cy={circleY}
                r="9"
                fill="#ffffff"
                stroke="#334155"
                strokeWidth="1.5"
              />
              <text
                x={circleX}
                y={circleY + 3.5}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="900"
                fontFamily="ui-monospace, monospace"
                fill="#0f172a"
              >
                {mb.matchNum}
              </text>

              {/* Línea horizontal saliendo del círculo hacia Cuartos de Final */}
              <line
                x1={circleX + 9}
                y1={circleY}
                x2="395"
                y2={circleY}
                stroke="#475569"
                strokeWidth="1.5"
              />

              {/* Nombre del atleta clasificado por Bye sobre la línea */}
              {mb.advancingText && (
                <text
                  x={circleX + 14}
                  y={circleY - 4}
                  fontSize="8"
                  fontWeight="800"
                  fill="#0f172a"
                >
                  {mb.advancingText}
                </text>
              )}
            </g>
          );
        })}

        {/* ============================================================== */}
        {/* 3. COLUMNA 2: CUARTOS DE FINAL / FINALES DE POOL (9 A 12)       */}
        {/* ============================================================== */}
        {[
          { qNum: 9, y1: yCenters[0], y2: yCenters[1], label: 'Ganador Pool A' },
          { qNum: 10, y1: yCenters[2], y2: yCenters[3], label: 'Ganador Pool B' },
          { qNum: 11, y1: yCenters[4], y2: yCenters[5], label: 'Ganador Pool C' },
          { qNum: 12, y1: yCenters[6], y2: yCenters[7], label: 'Ganador Pool D' },
        ].map((q) => {
          const midY = (q.y1 + q.y2) / 2;
          const circleX = 405;

          return (
            <g key={q.qNum}>
              {/* Barra vertical de cruce de cuartos */}
              <line
                x1="395"
                y1={q.y1}
                x2="395"
                y2={q.y2}
                stroke="#475569"
                strokeWidth="2"
              />

              {/* Conector horizontal al círculo de cuartos */}
              <line
                x1="395"
                y1={midY}
                x2={circleX}
                y2={midY}
                stroke="#475569"
                strokeWidth="1.5"
              />

              {/* Círculo de cuartos (9, 10, 11, 12) */}
              <circle
                cx={circleX}
                cy={midY}
                r="10"
                fill="#ffffff"
                stroke="#334155"
                strokeWidth="2"
              />
              <text
                x={circleX}
                y={midY + 4}
                textAnchor="middle"
                fontSize="10"
                fontWeight="900"
                fontFamily="ui-monospace, monospace"
                fill="#0f172a"
              >
                {q.qNum}
              </text>

              {/* Línea horizontal saliendo hacia Semifinales */}
              <line
                x1={circleX + 10}
                y1={midY}
                x2="550"
                y2={midY}
                stroke="#475569"
                strokeWidth="1.5"
              />
            </g>
          );
        })}

        {/* ============================================================== */}
        {/* 4. COLUMNA 3: SEMIFINALES (15 Y 16)                            */}
        {/* ============================================================== */}
        {[
          { sNum: 15, y1: (yCenters[0] + yCenters[1]) / 2, y2: (yCenters[2] + yCenters[3]) / 2 },
          { sNum: 16, y1: (yCenters[4] + yCenters[5]) / 2, y2: (yCenters[6] + yCenters[7]) / 2 },
        ].map((s) => {
          const midY = (s.y1 + s.y2) / 2;
          const circleX = 561;

          return (
            <g key={s.sNum}>
              {/* Barra vertical de cruce de semifinales */}
              <line
                x1="550"
                y1={s.y1}
                x2="550"
                y2={s.y2}
                stroke="#334155"
                strokeWidth="2.5"
              />

              {/* Conector horizontal al círculo de semifinales */}
              <line
                x1="550"
                y1={midY}
                x2={circleX}
                y2={midY}
                stroke="#334155"
                strokeWidth="2"
              />

              {/* Círculo de semifinales (15, 16) */}
              <circle
                cx={circleX}
                cy={midY}
                r="11"
                fill="#ffffff"
                stroke="#1e293b"
                strokeWidth="2"
              />
              <text
                x={circleX}
                y={midY + 4}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="900"
                fontFamily="ui-monospace, monospace"
                fill="#0f172a"
              >
                {s.sNum}
              </text>

              {/* Línea horizontal saliendo hacia la Gran Final */}
              <line
                x1={circleX + 11}
                y1={midY}
                x2="730"
                y2={midY}
                stroke="#334155"
                strokeWidth="2"
              />
            </g>
          );
        })}

        {/* ============================================================== */}
        {/* 5. COLUMNA 4: GRAN FINAL (19) Y LÍNEA DE CAMPEÓN (ORO)         */}
        {/* ============================================================== */}
        {(() => {
          const semi1Y = ((yCenters[0] + yCenters[1]) / 2 + (yCenters[2] + yCenters[3]) / 2) / 2;
          const semi2Y = ((yCenters[4] + yCenters[5]) / 2 + (yCenters[6] + yCenters[7]) / 2) / 2;
          const finalY = (semi1Y + semi2Y) / 2;
          const circleX = 743;

          return (
            <g>
              {/* Barra vertical de cruce de la final */}
              <line
                x1="730"
                y1={semi1Y}
                x2="730"
                y2={semi2Y}
                stroke="#0f172a"
                strokeWidth="3"
              />

              {/* Conector horizontal al círculo de la final */}
              <line
                x1="730"
                y1={finalY}
                x2={circleX}
                y2={finalY}
                stroke="#0f172a"
                strokeWidth="2.5"
              />

              {/* Círculo de la Gran Final (19) */}
              <circle
                cx={circleX}
                cy={finalY}
                r="12"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="2.5"
              />
              <text
                x={circleX}
                y={finalY + 4.5}
                textAnchor="middle"
                fontSize="11"
                fontWeight="900"
                fontFamily="ui-monospace, monospace"
                fill="#0f172a"
              >
                19
              </text>

              {/* Línea horizontal extendida hacia el Campeón */}
              <line
                x1={circleX + 12}
                y1={finalY}
                x2="950"
                y2={finalY}
                stroke="#0f172a"
                strokeWidth="2.5"
              />

              {/* Etiqueta de Campeón 1° Lugar (Oro) */}
              <rect
                x="840"
                y={finalY - 22}
                width="105"
                height="18"
                rx="4"
                fill="#fef3c7"
                stroke="#f59e0b"
                strokeWidth="1.5"
              />
              <text
                x="892"
                y={finalY - 10}
                textAnchor="middle"
                fontSize="9"
                fontWeight="900"
                fill="#92400e"
                letterSpacing="0.5px"
              >
                1° LUGAR (ORO)
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ==============================================================================
// 2. SUB-COMPONENTE: CUADRO DE 8 (POOLS A-D CON 4 COMBATES DE CUARTOS)
// ==============================================================================
function EliminationTree8Sheet({
  athletes,
  matches,
}: {
  athletes: RegisteredAthleteSummary[];
  matches: GeneratedMatch[];
}) {
  const n = athletes.length;
  const standardSeeds8 = [1, 8, 5, 4, 3, 6, 7, 2];

  const qfMatches = matches.filter(
    (m) => m.round.startsWith('QF') || m.round.includes('Cuartos')
  );

  interface SlotInfo {
    name: string;
    club: string;
    isBye: boolean;
  }

  const slots: SlotInfo[] = [];

  if (qfMatches.length === 4) {
    for (let i = 0; i < 4; i++) {
      const m = qfMatches[i];
      const isWhiteBye = !m.white_athlete_name || m.white_athlete_name === '—' || m.white_athlete_name.includes('BYE');
      const isBlueBye = !m.blue_athlete_name || m.blue_athlete_name === '—' || m.blue_athlete_name.includes('BYE');

      slots.push({
        name: isWhiteBye ? '' : formatNameDisplay(m.white_athlete_name),
        club: m.white_club_name ? `(${m.white_club_name.toUpperCase()})` : '',
        isBye: isWhiteBye,
      });

      slots.push({
        name: isBlueBye ? '' : formatNameDisplay(m.blue_athlete_name),
        club: m.blue_club_name ? `(${m.blue_club_name.toUpperCase()})` : '',
        isBye: isBlueBye,
      });
    }
  } else {
    for (let slotIdx = 0; slotIdx < 8; slotIdx++) {
      const seedVal = standardSeeds8[slotIdx];
      if (seedVal <= n && athletes[seedVal - 1]) {
        const ath = athletes[seedVal - 1];
        slots.push({
          name: formatNameDisplay(ath.name),
          club: ath.club_name ? `(${ath.club_name.toUpperCase()})` : '',
          isBye: false,
        });
      } else {
        slots.push({
          name: '',
          club: '',
          isBye: true,
        });
      }
    }
  }

  const yCenters = [75, 195, 345, 465];

  const pools = [
    { label: 'Pool A', bg: '#f3e8ff', border: '#c084fc', text: '#581c87', y: yCenters[0] },
    { label: 'Pool B', bg: '#ccfbf1', border: '#5eead4', text: '#134e4a', y: yCenters[1] },
    { label: 'Pool C', bg: '#ffe4e6', border: '#fda4af', text: '#881337', y: yCenters[2] },
    { label: 'Pool D', bg: '#fef9c3', border: '#fde047', text: '#713f12', y: yCenters[3] },
  ];

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg
        viewBox="0 0 1060 560"
        className="w-full h-full max-h-[560px] select-none"
        style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
      >
        {/* PASTILLAS VERTICALES DE POOL */}
        {pools.map((p) => (
          <g key={p.label}>
            <rect
              x="15"
              y={p.y - 35}
              width="30"
              height="70"
              rx="15"
              fill={p.bg}
              stroke={p.border}
              strokeWidth="2"
            />
            <text
              x={p.y}
              y="-29"
              transform="rotate(90)"
              textAnchor="middle"
              fontSize="11.5"
              fontWeight="900"
              fill={p.text}
              letterSpacing="0.5px"
            >
              {p.label}
            </text>
          </g>
        ))}

        {/* 4 CAJAS DE CUARTOS DE FINAL (1 POR POOL) */}
        {[0, 1, 2, 3].map((idx) => {
          const white = slots[idx * 2];
          const blue = slots[idx * 2 + 1];
          const yCenter = yCenters[idx];
          const cardX = 52;
          const cardWidth = 250;
          const cardHeight = 48;
          const cardY = yCenter - cardHeight / 2;
          const circleX = cardX + cardWidth + 10;

          let advancingText = '';
          if (white.isBye && !blue.isBye) advancingText = `${blue.name} ${blue.club}`.trim();
          if (!white.isBye && blue.isBye) advancingText = `${white.name} ${white.club}`.trim();

          return (
            <g key={idx}>
              <rect
                x={cardX}
                y={cardY}
                width={cardWidth}
                height={cardHeight}
                rx="6"
                fill="#ffffff"
                stroke="#64748b"
                strokeWidth="1.5"
              />
              <path
                d={`M ${cardX} ${cardY + 24} L ${cardX + cardWidth} ${cardY + 24} L ${cardX + cardWidth} ${cardY + 42} Q ${cardX + cardWidth} ${cardY + 48} ${cardX + cardWidth - 6} ${cardY + 48} L ${cardX + 6} ${cardY + 48} Q ${cardX} ${cardY + 48} ${cardX} ${cardY + 42} Z`}
                fill="#eef2ff"
              />
              <line
                x1={cardX}
                y1={cardY + 24}
                x2={cardX + cardWidth}
                y2={cardY + 24}
                stroke="#94a3b8"
                strokeWidth="1"
              />

              <text x={cardX + 8} y={cardY + 16} fontSize="9.5" fontWeight="800" fill="#0f172a">
                {white.name || ''}
                {white.club && <tspan fontSize="8" fontWeight="600" fill="#64748b" dx="4">{white.club}</tspan>}
              </text>
              <text x={cardX + 8} y={cardY + 39} fontSize="9.5" fontWeight="800" fill="#1e1b4b">
                {blue.name || ''}
                {blue.club && <tspan fontSize="8" fontWeight="600" fill="#4338ca" dx="4">{blue.club}</tspan>}
              </text>

              <line x1={cardX + cardWidth} y1={yCenter} x2={circleX} y2={yCenter} stroke="#475569" strokeWidth="1.5" />
              <circle cx={circleX} cy={yCenter} r="10" fill="#ffffff" stroke="#334155" strokeWidth="2" />
              <text x={circleX} y={yCenter + 3.5} textAnchor="middle" fontSize="10" fontWeight="900" fontFamily="ui-monospace, monospace" fill="#0f172a">
                {idx + 1}
              </text>

              <line x1={circleX + 10} y1={yCenter} x2="450" y2={yCenter} stroke="#475569" strokeWidth="2" />
              {advancingText && (
                <text x={circleX + 14} y={yCenter - 5} fontSize="8.5" fontWeight="800" fill="#0f172a">
                  {advancingText}
                </text>
              )}
            </g>
          );
        })}

        {/* SEMIFINALES (COMBATES 5 Y 6) */}
        {[
          { num: 5, y1: yCenters[0], y2: yCenters[1] },
          { num: 6, y1: yCenters[2], y2: yCenters[3] },
        ].map((s) => {
          const midY = (s.y1 + s.y2) / 2;
          const circleX = 462;
          return (
            <g key={s.num}>
              <line x1="450" y1={s.y1} x2="450" y2={s.y2} stroke="#334155" strokeWidth="2.5" />
              <line x1="450" y1={midY} x2={circleX} y2={midY} stroke="#334155" strokeWidth="2" />
              <circle cx={circleX} cy={midY} r="11" fill="#ffffff" stroke="#1e293b" strokeWidth="2" />
              <text x={circleX} y={midY + 4} textAnchor="middle" fontSize="10.5" fontWeight="900" fontFamily="ui-monospace, monospace" fill="#0f172a">
                {s.num}
              </text>
              <line x1={circleX + 11} y1={midY} x2="680" y2={midY} stroke="#334155" strokeWidth="2" />
            </g>
          );
        })}

        {/* GRAN FINAL (COMBATE 7) */}
        {(() => {
          const s1Y = (yCenters[0] + yCenters[1]) / 2;
          const s2Y = (yCenters[2] + yCenters[3]) / 2;
          const finalY = (s1Y + s2Y) / 2;
          const circleX = 694;

          return (
            <g>
              <line x1="680" y1={s1Y} x2="680" y2={s2Y} stroke="#0f172a" strokeWidth="3" />
              <line x1="680" y1={finalY} x2={circleX} y2={finalY} stroke="#0f172a" strokeWidth="2.5" />
              <circle cx={circleX} cy={finalY} r="12" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
              <text x={circleX} y={finalY + 4.5} textAnchor="middle" fontSize="11" fontWeight="900" fontFamily="ui-monospace, monospace" fill="#0f172a">
                7
              </text>
              <line x1={circleX + 12} y1={finalY} x2="940" y2={finalY} stroke="#0f172a" strokeWidth="2.5" />

              <rect x="830" y={finalY - 22} width="105" height="18" rx="4" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="882" y={finalY - 10} textAnchor="middle" fontSize="9" fontWeight="900" fill="#92400e" letterSpacing="0.5px">
                1° LUGAR (ORO)
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ==============================================================================
// 3. SUB-COMPONENTE: ROUND ROBIN (MATRIZ BERGER + COMBATES • IDÉNTICO A FOTO 1)
// ==============================================================================
function RoundRobinBergerSheet({
  athletes,
  matches,
}: {
  athletes: RegisteredAthleteSummary[];
  matches: GeneratedMatch[];
}) {
  const n = athletes.length;

  return (
    <div className="w-full space-y-4 px-2">
      {/* 1. MATRIZ BERGER OFICIAL N x N (IDÉNTICA A LA IMAGEN 1 DEL USUARIO) */}
      <div className="border-2 border-slate-700 rounded-xl overflow-hidden shadow-sm bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-amber-400 text-slate-950 font-black border-b-2 border-slate-700 text-[11px]">
              <th className="py-2 px-3 w-10 text-center border-r border-slate-700">#</th>
              <th className="py-2 px-4 text-left border-r border-slate-700">Judoka</th>
              <th className="py-2 px-3 text-left border-r border-slate-700">Club</th>
              {athletes.map((_, idx) => (
                <th key={idx} className="py-2 px-3 w-12 text-center border-r border-slate-700 font-black font-mono">
                  {idx + 1}
                </th>
              ))}
              <th className="py-2 px-3 w-16 text-center border-r border-slate-700 bg-amber-300">Wins</th>
              <th className="py-2 px-3 w-16 text-center bg-orange-300/80">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400 font-sans">
            {athletes.map((ath, rowIdx) => {
              const formattedName = formatNameDisplay(ath.name);

              return (
                <tr key={ath.id} className="hover:bg-slate-50 transition">
                  {/* Número de competidor en badge amarillo */}
                  <td className="py-2.5 px-3 text-center font-black bg-amber-300 text-slate-950 border-r border-slate-700 font-mono text-sm">
                    {rowIdx + 1}
                  </td>
                  <td className="py-2.5 px-4 font-black text-slate-950 border-r border-slate-700 tracking-wide text-xs">
                    {formattedName}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 font-bold border-r border-slate-700 font-mono text-[11px]">
                    {ath.club_name?.toUpperCase() || '-'}
                  </td>

                  {/* Celdas cruzadas: diagonal gris, blancas para puntos */}
                  {athletes.map((_, colIdx) => {
                    const isDiagonal = rowIdx === colIdx;
                    return (
                      <td
                        key={colIdx}
                        className={`py-2 px-2 text-center border-r border-slate-700 font-mono ${
                          isDiagonal ? 'bg-slate-300' : 'bg-white'
                        }`}
                      >
                        {isDiagonal ? '' : ''}
                      </td>
                    );
                  })}

                  {/* Resultados iniciales */}
                  <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 border-r border-slate-700 bg-amber-50 text-sm">
                    0
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 bg-orange-50 text-sm">
                    0
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. EMPAREJAMIENTOS OFICIALES DE COMBATES CON CAJAS Y LÍNEAS DE GANADOR */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-300 pb-0.5">
          Combates Programados (Orden Oficial Berger)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {matches.map((m, idx) => {
            const whiteName = formatNameDisplay(m.white_athlete_name);
            const blueName = formatNameDisplay(m.blue_athlete_name);
            const whiteClub = m.white_club_name ? `(${m.white_club_name.toUpperCase()})` : '';
            const blueClub = m.blue_club_name ? `(${m.blue_club_name.toUpperCase()})` : '';

            return (
              <div
                key={m.id || idx}
                className="flex items-center space-x-2"
              >
                {/* Caja de Combate Blanco / Azul */}
                <div className="w-[200px] border border-slate-600 rounded-md overflow-hidden bg-white shadow-2xs flex-shrink-0">
                  <div className="px-2 py-1 bg-white text-[10px] font-black text-slate-900 truncate border-b border-slate-300 flex items-center justify-between">
                    <span className="truncate">{whiteName}</span>
                    <span className="text-[8px] text-slate-500 font-normal ml-1">{whiteClub}</span>
                  </div>
                  <div className="px-2 py-1 bg-blue-50 text-[10px] font-black text-blue-950 truncate flex items-center justify-between">
                    <span className="truncate">{blueName}</span>
                    <span className="text-[8px] text-blue-600 font-normal ml-1">{blueClub}</span>
                  </div>
                </div>

                {/* Círculo de Combate */}
                <div className="w-6 h-6 rounded-full border border-slate-700 bg-white flex items-center justify-center font-black font-mono text-[10px] text-slate-900 flex-shrink-0 shadow-2xs">
                  {m.match_number || idx + 1}
                </div>

                {/* Línea extendida para anotar al ganador */}
                <div className="flex-1 border-b-2 border-slate-400 self-center" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// 4. SUB-COMPONENTE: AL MEJOR DE 3 (2 JUDOKAS)
// ==============================================================================
function BestOfThreeSheet({
  athletes,
  matches,
}: {
  athletes: RegisteredAthleteSummary[];
  matches: GeneratedMatch[];
}) {
  const comp1 = athletes[0];
  const comp2 = athletes[1];

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="text-center space-y-1">
        <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider">
          Serie Oficial al Mejor de 3 Combates
        </h3>
        <p className="text-xs text-slate-600 font-mono">
          El primer judoka en ganar 2 combates se consagra Campeón de la Categoría.
        </p>
      </div>

      <div className="space-y-3">
        {[1, 2, 3].map((num) => {
          const isDecider = num === 3;
          // Alternancia de judogis
          const isComp1White = num % 2 === 1;
          const whiteAth = isComp1White ? comp1 : comp2;
          const blueAth = isComp1White ? comp2 : comp1;

          return (
            <div
              key={num}
              className="flex items-center space-x-3 p-2.5 border border-slate-400 rounded-xl bg-slate-50/50"
            >
              <div className="w-8 h-8 rounded-full border-2 border-slate-700 bg-white flex items-center justify-center font-black font-mono text-sm text-slate-900 flex-shrink-0">
                {num}
              </div>

              <div className="flex-1 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">
                  Combate #{num} {isDecider ? '(Solo si es necesario por empate 1-1)' : ''}
                </span>

                <div className="border border-slate-400 rounded-lg overflow-hidden bg-white">
                  <div className="px-3 py-1 bg-white text-xs font-black text-slate-900 border-b border-slate-300 flex justify-between">
                    <span>{formatNameDisplay(whiteAth?.name)}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({whiteAth?.club_name?.toUpperCase() || '-'})</span>
                  </div>
                  <div className="px-3 py-1 bg-blue-50 text-xs font-black text-blue-950 flex justify-between">
                    <span>{formatNameDisplay(blueAth?.name)}</span>
                    <span className="text-[10px] text-blue-600 font-mono">({blueAth?.club_name?.toUpperCase() || '-'})</span>
                  </div>
                </div>
              </div>

              <div className="w-32 border-b-2 border-slate-400 self-center text-center">
                <span className="text-[9px] text-slate-400 font-mono block mb-1">Firma Ganador</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==============================================================================
// 5. SUB-COMPONENTE: CAMPEÓN DIRECTO (1 JUDOKA)
// ==============================================================================
function UncontestedSheet({
  athlete,
}: {
  athlete?: RegisteredAthleteSummary;
}) {
  return (
    <div className="w-full max-w-lg mx-auto border-2 border-amber-400 bg-amber-50/60 rounded-2xl p-8 text-center space-y-4 shadow-sm">
      <span className="text-xs font-black uppercase tracking-widest text-amber-900 block font-mono">
        Proclamación Oficial IJF
      </span>

      <div className="w-16 h-16 mx-auto rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-md border-2 border-amber-500">
        1°
      </div>

      <div className="space-y-1">
        <h3 className="text-2xl font-black text-slate-950 tracking-tight">
          {formatNameDisplay(athlete?.name) || 'ÚNICO COMPETIDOR'}
        </h3>
        <p className="text-xs text-slate-600 font-mono">
          Club: <strong>{athlete?.club_name?.toUpperCase() || 'Sin Club Asignado'}</strong>
        </p>
        <p className="text-xs text-slate-600 font-mono">
          Peso Oficial Registrado: <strong>{athlete?.actual_weight ? `${athlete.actual_weight} kg` : 'Aprobado'}</strong>
        </p>
      </div>

      <div className="pt-2">
        <span className="px-4 py-1.5 bg-amber-400 text-slate-950 rounded-full font-black text-xs uppercase shadow-sm border border-amber-500">
          Medalla de Oro • Campeón Directo de la Categoría
        </span>
      </div>

      <p className="text-[10px] text-slate-500 font-mono pt-3 border-t border-amber-200">
        Certificado por la Comisión Técnica y Mesa de Control Oficial.
      </p>
    </div>
  );
}

// ==============================================================================
// UTILIDAD: FORMATO DE NOMBRE APELLIDO, NOMBRE
// ==============================================================================
function formatNameDisplay(fullName: string | null | undefined): string {
  if (!fullName || fullName === '—' || fullName === 'BYE / Pase Directo') return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();
  const lastName = parts.slice(1).join(' ').toUpperCase();
  const firstName = parts[0].toUpperCase();
  return `${lastName}, ${firstName}`;
}
