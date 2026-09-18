// Avvia insieme il proxy dati e il dev server di Vite, senza dipendenze extra.
import { spawn } from 'node:child_process'

const children = []

function start(name, command, args) {
  const child = spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[${name}] terminato con codice ${code}`)
    shutdown()
  })
  children.push(child)
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
}

process.on('SIGINT', () => {
  shutdown()
  process.exit(0)
})

start('server', process.execPath, ['server/index.mjs'])
start('vite', process.execPath, ['node_modules/vite/bin/vite.js'])
