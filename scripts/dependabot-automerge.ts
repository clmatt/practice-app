/*
 * Run by the automerge job in .github/workflows/deploy.yml after every check
 * has passed on a Dependabot branch:
 *
 *   node scripts/dependabot-automerge.ts <pr.json> <branch> <tested sha>
 *
 * Prints `merge=true|false` and `number=<pr>` for $GITHUB_OUTPUT; the rules
 * are in dependabot-automerge-policy.ts.
 */
import { readFileSync } from 'node:fs'
import { decide, type PullRequest } from './dependabot-automerge-policy.ts'

const [prFile, branch, sha] = process.argv.slice(2)
const text = readFileSync(prFile, 'utf8').trim()
const decision = decide(text ? JSON.parse(text) as PullRequest : null, { branch, sha })
console.error(`${decision.merge ? 'Merging' : 'Not merging'}: ${decision.reason}`)
console.log(`merge=${decision.merge}`)
if (decision.merge) console.log(`number=${decision.number}`)
