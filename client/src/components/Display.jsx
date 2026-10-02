import { fmtW } from '../hooks/useEngine.js';

const PHASE_TEXT = {
  PRONTO: 'PRONTO',
  ATTESA: 'ATTESA PESO STABILE',
  TRASMISSIONE: 'TRASMISSIONE IN CORSO',
};

export default function Display({ state: s, config: c }) {
  const main = s.overload ? '-OL-' : fmtW(s.net, c);
  const aboveThr = c.threshold > 0 && s.gross >= c.threshold;
  let line = s.message;
  if (!line) {
    line = PHASE_TEXT[s.phase];
    if (s.phase === 'ATTESA') {
      line += ` (${s.trigger})` + (c.stableTimeout > 0 ? ` ${s.waitElapsed}/${c.stableTimeout}` : '');
    }
  }
  const alarm = /AVARIA|ERRORE|NON VALIDO|SOTTO SOGLIA|FUORI/.test(s.message);

  return (
    <div className="lcd">
      <div className="annun">
        <span className={s.stable ? 'on' : ''}>STABILE</span>
        <span className={s.gross === 0 ? 'on' : ''}>→0←</span>
        <span className={s.tare > 0 ? 'on' : ''}>NET</span>
        <span className={aboveThr ? 'on' : ''}>≥SOGLIA</span>
        <span className={s.photocell ? 'on' : ''}>FC</span>
        <span className={s.armed ? 'on' : ''}>ARMATO</span>
      </div>
      <div className="weight">
        <span className="digits">{main}</span>
        <span className="unit">{c.unit}</span>
      </div>
      <div className="sub">
        <span>LORDO {fmtW(s.gross, c)}</span>
        <span>TARA {fmtW(s.tare, c)}</span>
        <span>PROG. {String(s.progressive).padStart(6, '0')}</span>
      </div>
      <div className={`msg ${alarm ? 'alarm' : ''}`}>{line}</div>
      <div className="lcd-bottom">
        <span className={`modebox ${s.opMode === 'MPP' ? 'mpp' : ''}`}>{s.opMode}</span>
        <span className={`pbox ${s.printerEnabled ? '' : 'off'}`}>STP {s.printerEnabled ? 'ON' : 'OFF'}</span>
        <span className="trig">{c.triggerMode === 'soglia' ? `SOGLIA ${fmtW(c.threshold, c)}` : 'INPUT/FC'}</span>
        <span className={`out ${s.outputs.fom ? 'lit' : ''}`}>OUT1 ERR FOM</span>
        <span className={`out ${s.outputs.pc ? 'lit' : ''}`}>OUT2 ERR PC</span>
      </div>
    </div>
  );
}
