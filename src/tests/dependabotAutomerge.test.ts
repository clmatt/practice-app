import { describe, it, expect } from 'vitest'
import { decide, type PullRequest } from '../../scripts/dependabot-automerge-policy.ts'

const SHA = 'abc123'

const pr = (title: string, o: Partial<PullRequest> = {}): PullRequest => ({
  number: 7, title, author: { login: 'app/dependabot' }, headRefOid: SHA, ...o,
})

const npm = { branch: 'dependabot/npm_and_yarn/vite-8.4.0', sha: SHA }
const actions = { branch: 'dependabot/github_actions/actions/checkout-8', sha: SHA }

describe('Dependabot auto-merge decision', () => {
  it('merges the weekly minor-and-patch npm group', () => {
    expect(decide(pr('Bump the minor-and-patch group with 4 updates'), { branch: 'dependabot/npm_and_yarn/minor-and-patch-1a2b', sha: SHA }))
      .toEqual({ merge: true, number: 7, reason: expect.any(String) })
  })

  it('merges the group title that names the directory too', () => {
    expect(decide(pr('Bump the minor-and-patch group across 1 directory with 4 updates'), { branch: 'dependabot/npm_and_yarn/minor-and-patch-1a2b', sha: SHA }).merge).toBe(true)
  })

  it('merges a single npm minor or patch update, such as a security fix', () => {
    expect(decide(pr('Bump vite from 8.3.5 to 8.4.0'), npm).merge).toBe(true)
    expect(decide(pr('Bump undici from 7.10.1 to 7.10.2'), npm).merge).toBe(true)
    expect(decide(pr('Bump postcss from 8.5.31 to 8.5.32 in /'), npm).merge).toBe(true)
  })

  it('merges npm major updates too: passing every check is the bar', () => {
    expect(decide(pr('Bump vite from 8.3.5 to 9.0.0'), npm).merge).toBe(true)
    expect(decide(pr('Bump sharp from 0.34.5 to 0.35.5'), npm).merge).toBe(true)
  })

  it('merges any npm update, including several packages at once', () => {
    expect(decide(pr('Bump react and @types/react'), npm).merge).toBe(true)
    expect(decide(pr('Bump vite from 8.x to 9.x'), npm).merge).toBe(true)
    expect(decide(pr('Bump the everything group with 3 updates'), npm).merge).toBe(true)
  })

  it("merges updates to GitHub's own actions, majors included", () => {
    expect(decide(pr('Bump actions/checkout from 7 to 8'), actions).merge).toBe(true)
    expect(decide(pr('Bump the github-actions group with 2 updates'), { branch: 'dependabot/github_actions/github-actions-9f8e', sha: SHA }).merge).toBe(true)
  })

  it('leaves third-party actions', () => {
    expect(decide(pr('Bump peaceiris/actions-gh-pages from 3 to 4'), actions).merge).toBe(false)
  })

  it('only merges pull requests opened by Dependabot', () => {
    expect(decide(pr('Bump vite from 8.3.5 to 8.4.0', { author: { login: 'clmatt' } }), npm).merge).toBe(false)
    expect(decide(pr('Bump vite from 8.3.5 to 8.4.0', { author: { login: 'dependabot[bot]' } }), npm).merge).toBe(true)
  })

  it('only merges the exact commit that passed the checks', () => {
    expect(decide(pr('Bump vite from 8.3.5 to 8.4.0', { headRefOid: 'newer' }), npm))
      .toEqual({ merge: false, reason: expect.stringMatching(/changed/) })
  })

  it('needs a Dependabot branch and an open pull request', () => {
    expect(decide(pr('Bump vite from 8.3.5 to 8.4.0'), { branch: 'my-feature', sha: SHA }).merge).toBe(false)
    expect(decide(null, npm)).toEqual({ merge: false, reason: expect.stringMatching(/no open pull request/) })
  })
})

describe('real Dependabot titles (prefixed in the repo commit style, lower-case "bump")', () => {
  it('merges the prefixed minor-and-patch group', () => {
    expect(decide(pr('build(deps): bump the minor-and-patch group with 13 updates'), { branch: 'dependabot/npm_and_yarn/minor-and-patch-5c0214e722', sha: SHA }).merge).toBe(true)
  })

  it('merges a prefixed single minor or patch update', () => {
    expect(decide(pr('chore(deps): bump undici from 7.25.0 to 7.30.1'), { branch: 'dependabot/npm_and_yarn/undici-7.30.1', sha: SHA }).merge).toBe(true)
    expect(decide(pr('chore(deps-dev): bump fast-uri from 3.1.2 to 3.1.9'), { branch: 'dependabot/npm_and_yarn/fast-uri-3.1.9', sha: SHA }).merge).toBe(true)
    expect(decide(pr('deps: bump vite from 8.0.13 to 8.3.5'), npm).merge).toBe(true)
  })

  it('merges prefixed majors and multi-package updates', () => {
    expect(decide(pr('build(deps-dev): bump jsdom from 29.1.1 to 30.1.3'), npm).merge).toBe(true)
    expect(decide(pr('chore(deps): bump @vitest/mocker and vitest'), npm).merge).toBe(true)
  })

  it('still leaves third-party actions and unknown action groups (they run with write access)', () => {
    expect(decide(pr('ci(deps): bump peaceiris/actions-gh-pages from 3 to 4'), actions).merge).toBe(false)
    expect(decide(pr('Bump the everything group with 2 updates'), { branch: 'dependabot/github_actions/everything-1', sha: SHA }).merge).toBe(false)
    expect(decide(pr('Bump actions/checkout and peaceiris/actions-gh-pages'), actions).merge).toBe(false)
  })

  it('leaves other ecosystems alone', () => {
    expect(decide(pr('Bump requests from 2.0 to 2.1'), { branch: 'dependabot/pip/requests-2.1', sha: SHA }).merge).toBe(false)
  })

  it('merges prefixed updates to GitHub actions', () => {
    expect(decide(pr('ci(deps): bump actions/checkout from 7 to 8'), actions).merge).toBe(true)
  })
})
