import { z } from 'zod';
export const RUNNING_ACTIVITY_KEY = 'runningActivity';
export function initialRunningActivity() {
    return {
        key: `${RUNNING_ACTIVITY_KEY}:idle`,
        phase: 'idle',
        toolName: null,
        turn: 0,
        step: 0,
        tools: [],
        approvals: [],
    };
}
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function number(value, fallback) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}
function makeState(event, turn, step, tools, approvals, fallbackPhase) {
    const approval = approvals.at(-1);
    const tool = tools.at(-1);
    const phase = approval ? 'approval' : tool ? 'tool' : fallbackPhase;
    const identity = approval ? `approval:${approval.id}` : tool ? `call:${tool.callId}` : null;
    const position = identity ?? (typeof event.seq === 'number' ? `seq:${event.seq}` : `at:${turn}:${step}`);
    return {
        key: `${RUNNING_ACTIVITY_KEY}:${position}:${phase}`,
        phase,
        toolName: approval ? null : (tool?.name ?? null),
        turn,
        step,
        tools,
        approvals,
    };
}
export function applyRunningActivity(current, event) {
    const data = event.data ?? {};
    const turn = number(data.turn, current.turn);
    const step = number(data.step, current.step);
    switch (event.type) {
        case 'turn/start':
            return makeState(event, number(data.turn, current.turn + 1), 0, [], [], 'working');
        case 'turn/end': {
            const reason = record(data.reason);
            return makeState(event, turn, step, [], [], reason?.kind === 'error' ? 'error' : 'idle');
        }
        case 'step/start':
            return makeState(event, turn, step, [], current.approvals, 'working');
        case 'step/end':
            return makeState(event, turn, step, current.tools, current.approvals, 'working');
        case 'tool/call': {
            if (typeof data.callId !== 'string' || typeof data.name !== 'string')
                return current;
            const tools = current.tools.filter((tool) => tool.callId !== data.callId);
            tools.push({ callId: data.callId, name: data.name });
            return makeState(event, turn, step, tools, current.approvals, 'working');
        }
        case 'tool/result': {
            const message = record(data.message);
            const source = record(message?.source);
            const callId = typeof source?.callId === 'string'
                ? source.callId
                : typeof message?.toolCallId === 'string'
                    ? message.toolCallId
                    : null;
            if (callId === null || !current.tools.some((tool) => tool.callId === callId))
                return current;
            const tools = current.tools.filter((tool) => tool.callId !== callId);
            return makeState(event, turn, step, tools, current.approvals, 'working');
        }
        case 'approval/asked': {
            if (typeof data.id !== 'string' || typeof data.toolName !== 'string')
                return current;
            const approvals = current.approvals.filter((approval) => approval.id !== data.id);
            approvals.push({
                id: data.id,
                toolName: data.toolName,
                callId: typeof data.callId === 'string' ? data.callId : null,
            });
            return makeState(event, turn, step, current.tools, approvals, 'working');
        }
        case 'approval/decided': {
            if (typeof data.id !== 'string' ||
                !current.approvals.some((approval) => approval.id === data.id))
                return current;
            const approvals = current.approvals.filter((approval) => approval.id !== data.id);
            return makeState(event, turn, step, current.tools, approvals, 'working');
        }
        case 'assistant/message':
            return makeState(event, turn, step, current.tools, current.approvals, 'working');
        default:
            return current;
    }
}
const views = new WeakMap();
export function runningActivityView(state) {
    const cached = views.get(state);
    if (cached !== undefined)
        return cached;
    const view = {
        key: state.key,
        phase: state.phase,
        toolName: state.toolName,
        attemptId: null,
        turn: state.turn,
        step: state.step,
    };
    views.set(state, view);
    return view;
}
const approvalSchema = z.object({
    id: z.string(),
    toolName: z.string(),
    callId: z.string().nullable(),
});
const toolSchema = z.object({ callId: z.string(), name: z.string() });
export const runningActivityStateSchema = z.object({
    key: z.string(),
    phase: z.enum(['waiting', 'working', 'tool', 'approval', 'error', 'idle']),
    toolName: z.string().nullable(),
    turn: z.number().int().nonnegative(),
    step: z.number().int().nonnegative(),
    tools: z.array(toolSchema),
    approvals: z.array(approvalSchema),
});
export const runningActivityViewSchema = z.object({
    key: z.string(),
    phase: z.enum([
        'preparing',
        'waiting',
        'thinking',
        'responding',
        'tool',
        'approval',
        'working',
        'error',
        'idle',
    ]),
    toolName: z.string().nullable(),
    attemptId: z.string().nullable(),
    turn: z.number().int().nonnegative(),
    step: z.number().int().nonnegative(),
});
export function registerRunningActivity(ctx) {
    if (typeof ctx.inject !== 'function')
        return undefined;
    return ctx.inject(['sessionProjections'], (scope) => {
        const projections = scope.sessionProjections;
        if (!projections || typeof projections.register !== 'function')
            return;
        return projections.register({
            key: RUNNING_ACTIVITY_KEY,
            stateSchema: runningActivityStateSchema,
            init: () => initialRunningActivity(),
            apply: applyRunningActivity,
            wire: { viewSchema: runningActivityViewSchema, view: runningActivityView },
            stateVersion: 3,
        });
    });
}
