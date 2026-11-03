import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyRunningActivity,
  initialRunningActivity,
  runningActivityView,
} from '../lib/host/running-activity.js'

function fold(events) {
  return events.reduce(
    (state, event) => applyRunningActivity(state, event),
    initialRunningActivity(),
  )
}

test('running activity reflects durable turn and step lifecycle without inventing model-stream states', () => {
  const state = fold([
    { type: 'turn/start', data: { turn: 3 } },
    { type: 'step/start', data: { turn: 3, step: 1 } },
  ])
  assert.deepEqual(state, {
    key: 'runningActivity:at:3:1:working',
    phase: 'working',
    toolName: null,
    turn: 3,
    step: 1,
    tools: [],
    approvals: [],
  })
  assert.deepEqual(runningActivityView(state), {
    key: 'runningActivity:at:3:1:working',
    phase: 'working',
    toolName: null,
    attemptId: null,
    turn: 3,
    step: 1,
  })
})

test('activity keys distinguish durable calls and wire views stay stable per state', () => {
  const first = applyRunningActivity(initialRunningActivity(), {
    type: 'tool/call',
    seq: 12,
    data: { turn: 1, step: 1, callId: 'call-a', name: 'search' },
  })
  const second = applyRunningActivity(first, {
    type: 'tool/call',
    seq: 13,
    data: { turn: 1, step: 1, callId: 'call-b', name: 'search' },
  })
  assert.notEqual(runningActivityView(first).key, runningActivityView(second).key)
  assert.equal(runningActivityView(first), runningActivityView(first))
  assert.equal(runningActivityView(first).key, 'runningActivity:call:call-a:tool')
})
test('tool calls remain active until their matching results arrive', () => {
  const state = fold([
    { type: 'step/start', data: { turn: 1, step: 1 } },
    { type: 'tool/call', data: { turn: 1, step: 1, callId: 'a', name: 'search' } },
    { type: 'tool/call', data: { turn: 1, step: 1, callId: 'b', name: 'read' } },
    { type: 'tool/result', data: { turn: 1, step: 1, message: { toolCallId: 'a' } } },
  ])
  assert.equal(state.key, 'runningActivity:call:b:tool')
  assert.equal(state.phase, 'tool')
  assert.equal(state.toolName, 'read')
  assert.deepEqual(state.tools, [{ callId: 'b', name: 'read' }])
  const settled = applyRunningActivity(state, {
    type: 'tool/result',
    data: { turn: 1, step: 1, message: { toolCallId: 'b' } },
  })
  assert.equal(settled.phase, 'working')
  assert.equal(settled.toolName, null)
  assert.deepEqual(settled.tools, [])
})

test('approval pairs take precedence and restore the pending call after decision', () => {
  const call = applyRunningActivity(initialRunningActivity(), {
    type: 'tool/call',
    data: { turn: 1, step: 1, callId: 'call-x', name: 'shell' },
  })
  const asked = applyRunningActivity(call, {
    type: 'approval/asked',
    seq: 18,
    data: { id: 'approval-x', toolName: 'shell', callId: 'call-x', reason: 'outside workspace' },
  })
  assert.equal(asked.phase, 'approval')
  assert.equal(asked.toolName, null)
  assert.equal(asked.key, 'runningActivity:approval:approval-x:approval')
  const decided = applyRunningActivity(asked, {
    type: 'approval/decided',
    seq: 19,
    data: { id: 'approval-x', outcome: 'allowed-once' },
  })
  assert.equal(decided.phase, 'tool')
  assert.equal(decided.toolName, 'shell')
  assert.equal(decided.key, 'runningActivity:call:call-x:tool')
})
test('turn end clears tool state and preserves error vs idle outcome', () => {
  const busy = fold([
    { type: 'turn/start', data: { turn: 2 } },
    { type: 'tool/call', data: { turn: 2, step: 1, callId: 'x', name: 'shell' } },
  ])
  const failed = applyRunningActivity(busy, {
    type: 'turn/end',
    data: { turn: 2, reason: { kind: 'error' } },
  })
  assert.equal(failed.phase, 'error')
  assert.deepEqual(failed.tools, [])
  assert.equal(
    applyRunningActivity(busy, {
      type: 'turn/end',
      data: { turn: 2, reason: { kind: 'completed' } },
    }).phase,
    'idle',
  )
})

test('unmatched, malformed, and unrelated events do not falsely settle active tools', () => {
  const busy = applyRunningActivity(initialRunningActivity(), {
    type: 'tool/call',
    data: { callId: 'x', name: 'shell' },
  })
  assert.equal(
    applyRunningActivity(busy, {
      type: 'tool/result',
      data: { message: { toolCallId: 'other' } },
    }),
    busy,
  )
  assert.equal(applyRunningActivity(busy, { type: 'provider/private-event' }), busy)
  assert.equal(applyRunningActivity(busy, { type: 'tool/call', data: {} }), busy)
})
