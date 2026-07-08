import fs from 'fs';
import path from 'path';
import EmbeddedPostgres from 'embedded-postgres';
import net from 'net';

const DATA_DIR = path.resolve(__dirname, '../.data/postgres');
const PORT = 5433;
const USER = 'ledgerpro';
const PASSWORD = 'ledgerpro123';
const DATABASE = 'ledgerpro';

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: 'localhost', port, timeout: 2000 });
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
}

async function main() {
  if (await isPortOpen(PORT)) {
    console.log(`PostgreSQL already running on port ${PORT}`);
    process.exit(0);
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) await pg.initialise();
  else {
    const pidFile = path.join(DATA_DIR, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      try { process.kill(Number(fs.readFileSync(pidFile, 'utf8').split('\n')[0]), 0); } catch { fs.unlinkSync(pidFile); }
    }
  }

  await pg.start();
  for (let i = 0; i < 30; i++) { if (await isPortOpen(PORT)) break; await new Promise((r) => setTimeout(r, 500)); }
  try { await pg.createDatabase(DATABASE); } catch { /* exists */ }

  console.log(`RSS ERP PostgreSQL ready on port ${PORT}`);
  process.on('SIGINT', async () => { await pg.stop(); process.exit(0); });
}

main().catch((e) => { console.error(e); process.exit(1); });
