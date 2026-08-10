import type { components } from "@puffin/api-types";
// straight at the module, not the barrel: the barrel pulls in a react
// component and these helpers stay unit-testable without a dom
import {
  forgedNodeMeta,
  metaForNode,
  type ServiceNodeMeta,
} from "../../components/lifecycle/serviceNodes";

type ForgeState = components["schemas"]["ForgeStatus"]["state"];
type ProcessInfo = components["schemas"]["ProcessInfo"];

// metaForNode hands back a placeholder package for anything outside its
// known-node map - that is the signal a node came from somewhere else and
// is worth one forge lookup
export function isForgeCandidate(nodeName: string): boolean {
  return metaForNode(nodeName).package === "—";
}

// a finished forge build is the only case where we can say more than
// "some lifecycle node"; queued/building/failed/unknown keep the fallback
export function describeNode(nodeName: string, forge: ForgeState | undefined): ServiceNodeMeta {
  return forge === "done" ? forgedNodeMeta(nodeName) : metaForNode(nodeName);
}

export interface HealthSummary {
  running: number;
  total: number;
  healthy: boolean;
}

// supervisord reports every program; only RUNNING counts as up, and an
// empty roster is not healthy - it means the stack never came up
export function healthSummary(processes: readonly ProcessInfo[]): HealthSummary {
  const running = processes.filter((proc) => proc.state === "RUNNING").length;
  return {
    running,
    total: processes.length,
    healthy: processes.length > 0 && running === processes.length,
  };
}
