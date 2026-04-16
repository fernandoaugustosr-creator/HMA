const { spawn } = require('child_process')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const nextBin = process.platform === 'win32'
  ? path.join(projectRoot, 'node_modules', '.bin', 'next.cmd')
  : path.join(projectRoot, 'node_modules', '.bin', 'next')

const child = spawn(nextBin, ['start', '-p', '3000'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NEXT_DIST_DIR: '.next-build'
  }
})

child.on('exit', (code) => process.exit(code ?? 0))
