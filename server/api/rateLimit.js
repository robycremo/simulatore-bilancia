// Limite comandi per connessione (Rate limiting): finestra scorrevole di 1 secondo.
// - al massimo `max` comandi in qualsiasi intervallo di 1 s
// - in eccesso: comando scartato, `notify` vero al massimo una volta al secondo
// - `close` vero dopo `closeAfterSeconds` secondi consecutivi con scarti
export class RateLimiter {
  constructor({ max = 50, windowMs = 1000, closeAfterSeconds = 10, now = () => Date.now() } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.closeAfterSeconds = closeAfterSeconds;
    this.now = now;
    this.stamps = []; // istanti dei comandi accettati nella finestra
    this.lastDropSecond = null;
    this.consecutiveSeconds = 0;
  }

  take() {
    const t = this.now();
    while (this.stamps.length && this.stamps[0] <= t - this.windowMs) this.stamps.shift();
    if (this.stamps.length < this.max) {
      this.stamps.push(t);
      return { allowed: true, notify: false, close: false };
    }
    const sec = Math.floor(t / 1000);
    let notify = false;
    if (sec !== this.lastDropSecond) {
      this.consecutiveSeconds = this.lastDropSecond !== null && sec === this.lastDropSecond + 1 ? this.consecutiveSeconds + 1 : 1;
      this.lastDropSecond = sec;
      notify = true;
    }
    return { allowed: false, notify, close: this.consecutiveSeconds >= this.closeAfterSeconds };
  }
}
