/**
 * dsh-restart-handoff — who may restart the host.
 *
 * Rule: only the main (root) Session may restart. A subagent, a teammate and
 * any other delegated Session must not: it reports "this change needs a
 * restart" in its own result and the main Session performs the restart.
 *
 * The root Session is not refused while other agents are running — it waits
 * until every session is idle and then restarts (see `evaluateDeferred`).
 *
 * The two signals a Session header carries for a child are `origin: "subagent"`
 * and a `parentSession`; `delegationDepth > 0` catches nested delegation.
 */

/** True/False for a readable Session header, undefined when the shape is unknown. */
export function isDelegatedHeader(header) {
  if (!header || typeof header !== "object") return undefined;
  if (header.origin === "subagent") return true;
  if (typeof header.parentSession === "string" && header.parentSession.length > 0) return true;
  if (Number.isFinite(header.delegationDepth) && header.delegationDepth > 0) return true;
  return false;
}

/** Same question, asked of an Agent object. */
export function isChildAgent(agent) {
  const session = agent && typeof agent === "object" ? agent.session : undefined;
  const header = session && typeof session === "object" ? session.header : undefined;
  return isDelegatedHeader(header);
}