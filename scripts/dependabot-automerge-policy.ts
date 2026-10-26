/*
 * Decides whether CI may merge a Dependabot pull request on its own.
 * Used by scripts/dependabot-automerge.ts, which only runs once every check
 * (lint, unit tests, build, WebKit e2e) has passed on the exact commit.
 *
 * - npm: any update merges, majors and multi-package updates included —
 *   passing every check is the bar (the owner's choice).
 * - GitHub Actions: only GitHub's own actions/*. Workflow steps run with write
 *   access to the repo, so third-party actions stay open for a person to check.
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

/** The Actions group from .github/dependabot.yml (it only contains actions/*). */
const ACTIONS_GROUP = 'github-actions'

export function decide(pr: PullRequest | null, run: { branch: string; sha: string }): Decision {
  const no = (reason: string): Decision => ({ merge: false, reason })
  if (!pr) return no('no open pull request for this branch')
  if (!DEPENDABOT_LOGINS.includes(pr.author.login)) return no(`opened by ${pr.author.login}, not Dependabot`)
  if (!run.branch.startsWith('dependabot/')) return no(`${run.branch} is not a Dependabot branch`)
  if (pr.headRefOid !== run.sha) return no('the pull request changed since this commit was tested')

  const ecosystem = run.branch.split('/')[1]
  const yes = (reason: string): Decision => ({ merge: true, number: pr.number, reason })

  if (ecosystem === 'npm_and_yarn') return yes(`npm update "${pr.title}" passed every check`)
  if (ecosystem !== 'github_actions') return no(`unknown ecosystem ${ecosystem}`)

  // Dependabot follows the repo's commit style: "build(deps): bump …", "deps: bump …" or "Bump …".
  const title = pr.title.replace(/^[\w-]+(\([\w-]+\))?!?: /, '')
  const group = /^bump the (\S+) group\b/i.exec(title)
  if (group) return group[1] === ACTIONS_GROUP ? yes(`${group[1]} group`) : no(`unknown group ${group[1]}`)
  const single = /^bump (\S+) from \S+ to \S+(?: in \S+)?$/i.exec(title)
  if (!single) return no(`can't tell which actions "${pr.title}" updates`)
  return single[1].startsWith('actions/') ? yes(`GitHub's own ${single[1]}`) : no(`third-party action ${single[1]}`)
}
