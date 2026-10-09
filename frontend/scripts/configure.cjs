const fs = require('node:fs');
const path = require('node:path');

const envPath = path.resolve(__dirname, '../../backend/.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const match = envContent.match(/^APP_URL=(.*)$/m);
const backendUrl = (process.env.APP_URL || match?.[1] || '').trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '');
const settings = { apiUrl: backendUrl ? `${backendUrl}/api` : '/api' };

fs.writeFileSync(path.resolve(__dirname, '../public/config.json'), `${JSON.stringify(settings, null, 2)}\n`);
