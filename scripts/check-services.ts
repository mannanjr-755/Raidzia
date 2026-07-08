import net from 'net';

const checks = [
  { name: 'PostgreSQL', port: 5433, hint: 'Run: npm run db:start' },
  { name: 'API', port: 4000, hint: 'Run: npm run dev:api' },
  { name: 'Web', port: 3000, hint: 'Run: npm run dev:web' },
];

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port, timeout: 2000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  let allHealthy = true;

  for (const check of checks) {
    const open = await isPortOpen(check.port);
    if (open) {
      console.log(`OK  ${check.name} (port ${check.port})`);
    } else {
      allHealthy = false;
      console.log(`ERR ${check.name} (port ${check.port}) - ${check.hint}`);
    }
  }

  if (allHealthy) {
    try {
      const res = await fetch('http://127.0.0.1:4000/api/health');
      const json = await res.json();
      console.log(`OK  API health (${json.message ?? 'healthy'})`);
    } catch {
      allHealthy = false;
      console.log('ERR API health endpoint is not responding');
    }
  }

  process.exit(allHealthy ? 0 : 1);
}

main();
