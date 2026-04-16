const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

const targets = [
  '.next',
  '.next-dev',
  '.next-build',
  '.next-hma',
  '.next-hma2',
  '.next-hma3',
  '.next-hma4'
]

for (const dir of targets) {
  const full = path.join(projectRoot, dir)
  try {
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true })
      process.stdout.write(`Removido: ${dir}\n`)
    }
  } catch (e) {
    process.stderr.write(`Falha ao remover ${dir}: ${e && e.message ? e.message : String(e)}\n`)
    process.exitCode = 1
  }
}
