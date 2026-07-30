# ROS 2 service graph

The screen fetches the generated `RosService[]` contract from
`GET /api/ros/services` with TanStack Query. Development mode uses the
contract-checked MSW fixture in `src/mocks/handlers.ts`; the same component
automatically renders live discovery data when Puffin runs with the API.

`graphModel.ts` converts the flat service list into visualization data:

- every discovered ROS service becomes one graph node;
- services in the same namespace are connected as one provider group;
- services using the same interface package are connected across providers;
- duplicate relationships are removed and input is sorted for stable output.

The current ROS contract exposes service names and types, but not the ROS node
that provides each service or the clients calling it. The inferred links are
therefore a UI scaffold, not claimed runtime call edges. A future dynamic graph
can replace `buildServiceGraph()` input with explicit provider/client IDs while
keeping the force renderer unchanged.

The SVG renderer uses `d3-force` for link distance, repulsion, centering, and
collision. React owns the accessible controls and selection state. Pointer
events add node dragging, canvas panning, and cursor-centered zooming.

The reusable controls live in `src/components/graph-filter`. `GraphFilterBar`
composes independently exported status, search, refresh, and layout controls.
The layout toggle switches between a stable namespace-grouped hierarchy and the
physics-based force-directed view; both layouts use the same service nodes,
links, selection, and viewport interactions.

The current discovery endpoint returns only services visible in the live ROS
graph, so they are all treated as active. The `All Services` status option is a
forward-compatible control for retained or explicitly inactive records when
the API exposes them; it does not invent inactive services today.
