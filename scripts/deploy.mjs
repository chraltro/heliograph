// Publish the built site to the gh-pages branch.
//
//   npm run deploy
//
// A detached copy of dist/ is committed and force pushed, so the branch holds
// only the built output and no history worth keeping.
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'

const WORK = '.deploy'
const AUTHOR = ['-c', 'user.email=christian@altro.no', '-c', 'user.name=chraltro']

const remote = execSync('git remote get-url origin').toString().trim()
console.log(`publishing to ${remote} on gh-pages`)

rmSync(WORK, { recursive: true, force: true })
mkdirSync(WORK)
cpSync('dist', WORK, { recursive: true })
// Without this, Pages runs the output through Jekyll and drops anything whose
// name begins with an underscore.
writeFileSync(`${WORK}/.nojekyll`, '')

const git = (...args) =>
  execSync(['git', ...args].join(' '), { cwd: WORK, stdio: ['ignore', 'inherit', 'inherit'] })

git('init', '-q')
git('checkout', '-q', '-b', 'gh-pages')
git('add', '-A')
git(...AUTHOR, 'commit', '-q', '-m', '"Publish"')
git('push', '-q', '--force', remote, 'gh-pages')

rmSync(WORK, { recursive: true, force: true })
console.log('published')
