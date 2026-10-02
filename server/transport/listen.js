// Ricevitore da riga di comando, utile per provare l'invio da un'altra macchina.
//   node server/listen.js [porta] [tcp|udp] [ack|nak|none]
import { TestReceiver } from './receiver.js';
import { visible } from '../domain/format.js';

const [port = '9100', proto = 'tcp', reply = 'ack'] = process.argv.slice(2);
const r = new TestReceiver();
r.on('status', (s) => console.log(`[${proto.toUpperCase()} ${port}] ${s}`));
r.on('message', (m) => console.log(`${new Date().toLocaleTimeString()} ${m.from} (${m.data.length}) ${visible(m.data)}`));
r.start({ port, proto, reply });
