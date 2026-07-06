import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { detectNewOfferedCallIds } from './offeredCallAlerts'

describe('detectNewOfferedCallIds', () => {
  it('returns ids present now but not previously seen', () => {
    const result = detectNewOfferedCallIds(new Set(['a', 'b']), ['a', 'b', 'c'])
    assert.deepEqual(result, ['c'])
  })

  it('treats every id as new on the first (empty) seen set', () => {
    const result = detectNewOfferedCallIds(new Set(), ['a', 'b'])
    assert.deepEqual(result, ['a', 'b'])
  })

  it('returns nothing when there are no new calls', () => {
    const result = detectNewOfferedCallIds(new Set(['a', 'b']), ['a', 'b'])
    assert.deepEqual(result, [])
  })

  it('ignores calls that disappeared (accepted) — no alert', () => {
    const result = detectNewOfferedCallIds(new Set(['a', 'b']), ['a'])
    assert.deepEqual(result, [])
  })

  it('re-alerts a call that disappeared and came back', () => {
    // seen no longer has 'b' (it was removed last cycle); it reappears → new
    const result = detectNewOfferedCallIds(new Set(['a']), ['a', 'b'])
    assert.deepEqual(result, ['b'])
  })
})
