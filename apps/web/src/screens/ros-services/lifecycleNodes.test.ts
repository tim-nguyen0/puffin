import { describe, expect, it } from "vitest";
import { lifecycleNodeNames } from "./lifecycleNodes";

describe("lifecycleNodeNames", () => {
  it("derives node names from change_state services", () => {
    const names = lifecycleNodeNames([
      { name: "/offboard_demo/change_state", type: "lifecycle_msgs/srv/ChangeState" },
      { name: "/offboard_demo/get_state", type: "lifecycle_msgs/srv/GetState" },
      { name: "/other_node/change_state", type: "lifecycle_msgs/srv/ChangeState" },
      { name: "/puffin_api/describe_parameters", type: "rcl_interfaces/srv/DescribeParameters" },
    ]);
    expect(names).toEqual(["/offboard_demo", "/other_node"]);
  });

  it("ignores impostor services with the wrong type", () => {
    const names = lifecycleNodeNames([
      { name: "/sneaky/change_state", type: "std_srvs/srv/Trigger" },
    ]);
    expect(names).toEqual([]);
  });
});
