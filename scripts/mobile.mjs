// "npm run mobile": compila l'interfaccia e la pubblica sulla rete locale,
// così il telefono collegato allo stesso Wi-Fi può aprirla.

import { spawnSync, spawn } from 'node:child_process'

const port = process.env.PORT ?? '8787'

console.log('[fc27-trader] compilo l\'interfaccia…')
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit' })
if (build.status !== 0) {
  console.error('[fc27-trader] build fallita: correggi gli errori e riprova.')
  process.exit(build.status ?? 1)
}

const server = spawn(process.execPath, ['server/index.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, HOST: '0.0.0.0', PORT: port },
})

const stop = () => {
  if (!server.killed) server.kill('SIGTERM')
}
process.on('SIGINT', () => {
  stop()
  process.exit(0)
})
server.on('exit', (code) => process.exit(code ?? 0))
