const { spawn } = require('child_process')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const nextBin = process.platform === 'win32'
  ? path.join(projectRoot, 'node_modules', '.bin', 'next.cmd')
  : path.join(projectRoot, 'node_modules', '.bin', 'next')

const port = process.env.PORT || '3000'

const child = spawn(nextBin, ['dev', '-H', '0.0.0.0', '-p', String(port)], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NEXT_DIST_DIR: '.next-dev'
  }
})

child.on('exit', (code) => process.exit(code ?? 0))
