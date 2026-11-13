// ==============================================================================
// COMPONENTE: CRONÓMETRO AUXILIAR / CONTEO DE ESPERA Y RECESO (TATAMI)
// ==============================================================================
//
// CARACTERÍSTICAS:
// 1. Conteo manual y consciente para llamados sin comparecencia (30s) o recesos/calentamiento.
// 2. Números gigantes de alta visibilidad para la mesa de control y emisión al marcador TV.
// 3. Audio sintetizado nativo mediante Web Audio API (tonos en 5s-1s y chicharra en 0s).
// 4. Flexibilidad total: al llegar a 0s, permite continuar normalmente, agregar tiempo,
//    o declarar victoria por no presentación (Fusen-gachi) si corresponde.
// ==============================================================================

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, X, Volume2, VolumeX, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import { AuxTimerData } from '@/types/events';

interface BreakCountdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  tatamiNumber: number;
  matchNumber?: number;
  whiteAthleteName: string;
  blueAthleteName: string;
  onDeclareFusenGachi?: (winnerColor: 'WHITE' | 'BLUE') => void;
  onBroadcastTimerUpdate?: (data: AuxTimerData | null) => void;
}

type TimerPreset = 30 | 120 | 300 | 'CUSTOM';

export function BreakCountdownModal({
  isOpen,
  onClose,
  tatamiNumber,
  matchNumber,
  whiteAthleteName,
  blueAthleteName,
  onDeclareFusenGachi,
  onBroadcastTimerUpdate,
}: BreakCountdownModalProps) {
  // Preset seleccionado y tiempo en segundos
  const [selectedPreset, setSelectedPreset] = useState<TimerPreset>(30);
  const [initialSeconds, setInitialSeconds] = useState<number>(30);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [customInputMins, setCustomInputMins] = useState<string>('1');
  const [customInputSecs, setCustomInputSecs] = useState<string>('0');
  const [title, setTitle] = useState<string>('Conteo de Espera (30s)');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [hasFinished, setHasFinished] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sintetizador Web Audio API para tonos y chicharra
  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = 'sine') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio no disponible o silenciado por el navegador
    }
  }, [soundEnabled]);

  const playBuzzer = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 1.2);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {}
  }, [soundEnabled]);

  // Selección de presets
  const handleSelectPreset = (preset: TimerPreset) => {
    setIsRunning(false);
    setSelectedPreset(preset);
    setHasFinished(false);

    if (preset === 30) {
      setInitialSeconds(30);
      setSecondsRemaining(30);
      setTitle('Conteo de Espera (30s)');
    } else if (preset === 120) {
      setInitialSeconds(120);
      setSecondsRemaining(120);
      setTitle('Descanso / Intermedio (2 min)');
    } else if (preset === 300) {
      setInitialSeconds(300);
      setSecondsRemaining(300);
      setTitle('Receso de Tatami (5 min)');
    }
  };

  const handleApplyCustom = () => {
    const mins = Math.max(0, parseInt(customInputMins || '0', 10));
    const secs = Math.max(0, parseInt(customInputSecs || '0', 10));
    const total = mins * 60 + secs;
    if (total > 0) {
      setIsRunning(false);
      setSelectedPreset('CUSTOM');
      setInitialSeconds(total);
      setSecondsRemaining(total);
      setTitle(`Pausa / Receso (${mins > 0 ? `${mins}m ` : ''}${secs}s)`);
      setHasFinished(false);
    }
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleApplyCustom();
    }
  };

  // Controles del cronómetro
  const toggleRunning = () => {
    if (secondsRemaining <= 0) {
      setSecondsRemaining(initialSeconds);
      setHasFinished(false);
    }
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsRemaining(initialSeconds);
    setHasFinished(false);
  };

  const adjustSeconds = (delta: number) => {
    setSecondsRemaining((prev) => Math.max(0, prev + delta));
    setInitialSeconds((prev) => Math.max(prev, prev + delta));
  };

  // Bucle del cronómetro
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setHasFinished(true);
            playBuzzer();
            return 0;
          }
          if (prev <= 6 && prev >= 2) {
            playTone(520, 0.1, 'sine');
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, playBuzzer, playTone]);

  const onBroadcastRef = useRef(onBroadcastTimerUpdate);
  useEffect(() => {
    onBroadcastRef.current = onBroadcastTimerUpdate;
  }, [onBroadcastTimerUpdate]);

  const lastBroadcastPayloadRef = useRef<string>('');

  // Emitir sincronización hacia la pantalla pública (TV) de forma controlada y sin bucles
  useEffect(() => {
    if (!isOpen) {
      if (lastBroadcastPayloadRef.current !== 'null') {
        lastBroadcastPayloadRef.current = 'null';
        onBroadcastRef.current?.(null);
      }
      return;
    }

    const isActive = isRunning || secondsRemaining < initialSeconds;
    const payload: AuxTimerData = {
      is_active: isActive,
      seconds_remaining: secondsRemaining,
      total_seconds: initialSeconds,
      title,
    };
    const payloadStr = JSON.stringify(payload);
    if (payloadStr !== lastBroadcastPayloadRef.current) {
      lastBroadcastPayloadRef.current = payloadStr;
      onBroadcastRef.current?.(payload);
    }
  }, [isOpen, isRunning, secondsRemaining, initialSeconds, title]);

  // Tecla de atajo: Barra espaciadora para Iniciar/Pausar, Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleRunning();
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggleRunning]);

  const handleCloseModal = () => {
    setIsRunning(false);
    lastBroadcastPayloadRef.current = 'null';
    onBroadcastRef.current?.(null);
    onClose();
  };

  if (!isOpen) return null;

  // Formato mm:ss
  const formatTimeDisplay = (totalSecs: number) => {
    const mins = Math.floor(Math.abs(totalSecs) / 60);
    const secs = Math.abs(totalSecs) % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Porcentaje restante para barra de progreso
  const progressPercent = initialSeconds > 0 ? (secondsRemaining / initialSeconds) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl bg-slate-900 border-2 border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col space-y-4 p-6 sm:p-8">
        
        {/* Cabecera del Cronómetro Auxiliar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center space-x-2">
                <span>{title}</span>
                {matchNumber && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Tatami {tatamiNumber} • Combate #{matchNumber}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Conteo manual en pantalla grande para no presentación, calentamiento o pausas de tatami.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`p-2 rounded-xl border transition ${
                soundEnabled
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-red-950/60 border-red-800 text-red-400'
              }`}
              title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={handleCloseModal}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
              title="Cerrar modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selector de Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleSelectPreset(30)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center space-x-1.5 ${
              selectedPreset === 30
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <span>⏱ 30s (Espera Judoka)</span>
          </button>
          <button
            onClick={() => handleSelectPreset(120)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center space-x-1.5 ${
              selectedPreset === 120
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <span>2 min (Descanso)</span>
          </button>
          <button
            onClick={() => handleSelectPreset(300)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center space-x-1.5 ${
              selectedPreset === 300
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <span>5 min (Receso)</span>
          </button>

          {/* Formulario Custom */}
          <div className="flex items-center space-x-1 ml-auto">
            <input
              type="number"
              min="0"
              max="60"
              value={customInputMins}
              onChange={(e) => setCustomInputMins(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              className="w-12 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white text-center focus:border-amber-500 focus:outline-none"
              placeholder="m"
              title="Minutos (Presiona Enter para fijar)"
            />
            <span className="text-slate-500 font-mono">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={customInputSecs}
              onChange={(e) => setCustomInputSecs(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              className="w-12 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white text-center focus:border-amber-500 focus:outline-none"
              placeholder="s"
              title="Segundos (Presiona Enter para fijar)"
            />
            <button
              type="button"
              onClick={handleApplyCustom}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                selectedPreset === 'CUSTOM'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
              title="Fijar tiempo (o presiona Enter)"
            >
              Fijar [Enter]
            </button>
          </div>
        </div>

        {/* DISPLAY GIGANTE DEL CRONÓMETRO */}
        <div
          onClick={toggleRunning}
          className={`relative rounded-3xl p-8 sm:p-12 text-center select-none cursor-pointer border-2 transition-all flex flex-col items-center justify-center overflow-hidden ${
            hasFinished
              ? 'bg-red-950/40 border-red-500 ring-4 ring-red-500/30'
              : isRunning
              ? 'bg-slate-950 border-emerald-500/80 shadow-2xl shadow-emerald-500/10'
              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
          }`}
        >
          {/* Barra de Progreso Superior */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                hasFinished ? 'bg-red-500' : isRunning ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div
            className={`font-mono font-black tracking-tighter leading-none transition-colors ${
              hasFinished
                ? 'text-red-500 animate-pulse text-8xl sm:text-9xl'
                : secondsRemaining <= 10 && isRunning
                ? 'text-amber-400 text-8xl sm:text-9xl'
                : isRunning
                ? 'text-emerald-400 text-8xl sm:text-9xl'
                : 'text-white text-8xl sm:text-9xl'
            }`}
          >
            {formatTimeDisplay(secondsRemaining)}
          </div>

          <span className="text-xs text-slate-400 mt-4 font-mono font-medium block">
            {isRunning ? 'Haz clic o presiona [Espacio] para Pausar' : 'Haz clic o presiona [Espacio] para Iniciar'}
          </span>
        </div>

        {/* CONTROLES Y AJUSTES */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => adjustSeconds(-10)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition flex items-center space-x-1"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>10s</span>
            </button>
            <button
              onClick={() => adjustSeconds(10)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>10s</span>
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition flex items-center space-x-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reiniciar</span>
            </button>
            <button
              onClick={toggleRunning}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center space-x-2 ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isRunning ? 'Pausar' : 'Iniciar Conteo'}</span>
            </button>
          </div>
        </div>

        {/* ACCIONES AL FINALIZAR LA CUENTA ATRÁS (MÁXIMA FLEXIBILIDAD) */}
        {hasFinished && (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 animate-fadeIn">
            <div className="flex items-center space-x-2 text-xs font-black text-amber-400 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Tiempo de Espera Concluido • Opciones de Continuación</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Puedes continuar el combate normalmente como si la cuenta no hubiera terminado, o declarar la victoria por no presentación (Fusen-gachi) si un judoka no compareció.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Opción 1: Continuar normalmente */}
              <button
                onClick={handleCloseModal}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Continuar Combate</span>
              </button>

              {/* Opción 2: Declarar Fusen-Gachi a Blanco (Gana Blanco) */}
              {onDeclareFusenGachi && (
                <button
                  onClick={() => {
                    onDeclareFusenGachi('WHITE');
                    handleCloseModal();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-black transition flex items-center justify-center space-x-1.5 shadow"
                  title="El rival azul no se presentó. Gana el judoka blanco."
                >
                  <span>Gana Blanco (Fusen-gachi)</span>
                </button>
              )}

              {/* Opción 3: Declarar Fusen-Gachi a Azul (Gana Azul) */}
              {onDeclareFusenGachi && (
                <button
                  onClick={() => {
                    onDeclareFusenGachi('BLUE');
                    handleCloseModal();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black transition flex items-center justify-center space-x-1.5 shadow"
                  title="El rival blanco no se presentó. Gana el judoka azul."
                >
                  <span>Gana Azul (Fusen-gachi)</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

