import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Las URLs salen de backend/.env (APP_URL y FRONTEND_URL); una variable de entorno las reemplaza.
const envFile = resolve(__dirname, '../../../.env');
const content = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';

function setting(name: string, fallback: string): string {
  const fromFile = content.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim();

  return (process.env[name] || fromFile || fallback).replace(/\/$/, '');
}

export const backendUrl = setting('APP_URL', 'http://localhost:8000');
export const frontendUrl = setting('FRONTEND_URL', 'http://localhost:4200');
