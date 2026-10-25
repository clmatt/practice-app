/*
 * Decides whether CI may merge a Dependabot pull request on its own.
 * Used by scripts/dependabot-automerge.ts (run in CI). Merges:
 * the weekly npm minor-and-patch group, single npm minor/patch updates
 * (security fixes included), and updates to GitHub's own actions/*. npm
 * major updates stay open for the owner. Anything it can't read stays open.
 */
export interface PullRequest {
  number: number
  title: string
  author: { login: string }
  /** The commit at the head of the pull request. */
  headRefOid: string
}

export type Decision =
  | { merge: true; number: number; reason: string }
  | { merge: false; reason: string }

// gh reports the bot as app/dependabot; the REST API as dependabot[bot].
const DEPENDABOT_LOGINS = ['app/dependabot', 'dependabot[bot]', 'dependabot']

/** Groups from .github/dependabot.yml whose updates are safe by construction, per ecosystem. */
const SAFE_GROUPS: Record<string, string> = {
  npm_and_yarn: 'minor-and-patch',
  github_actions: 'github-actions',
}

/** Whether going from one version to another is a breaking (major) change; unreadable versions count as major. */
function isMajor(from: string, to: string): boolean {
  const parse = (v: string) => /^v?(\d+)\.(\d+)/.exec(v)
  const a = parse(from)
  const b = parse(to)
  if (!a || !b) return true
  // Below 1.0, a minor bump is a breaking change (0.34 → 0.35).
  return a[1] !== b[1] || (a[1] === '0' && a[2] !== b[2])
}

export function decide(pr: PullRequest | null, run: { branch: string; sha: string }): Decision {
  const no = (reason: string): Decision => ({ merge: false, reason })
  if (!pr) return no('no open pull request for this branch')
  if (!DEPENDABOT_LOGINS.includes(pr.author.login)) return no(`opened by ${pr.author.login}, not Dependabot`)
  if (!run.branch.startsWith('dependabot/')) return no(`${run.branch} is not a Dependabot branch`)
  if (pr.headRefOid !== run.sha) return no('the pull request changed since this commit was tested')

  const ecosystem = run.branch.split('/')[1]
  const yes = (reason: string): Decision => ({ merge: true, number: pr.number, reason })

  const group = /^Bump the (\S+) group\b/.exec(pr.title)
  if (group) {
    return SAFE_GROUPS[ecosystem] === group[1] ? yes(`${group[1]} group`) : no(`unknown group ${group[1]}`)
  }

  const single = /^Bump (\S+) from (\S+) to (\S+)(?: in \S+)?$/.exec(pr.title)
  if (!single) return no(`can't tell what "${pr.title}" updates`)
  const [, name, from, to] = single
  if (ecosystem === 'github_actions') {
    return name.startsWith('actions/') ? yes(`GitHub's own ${name}`) : no(`third-party action ${name}`)
  }
  if (ecosystem === 'npm_and_yarn') {
    return isMajor(from, to) ? no(`${name} ${from} → ${to} is a major update: left for you`) : yes(`${name} ${from} → ${to}`)
  }
  return no(`unknown ecosystem ${ecosystem}`)
}
