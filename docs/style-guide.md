# Puffin UI Style Guide

The console design: a light operations page with dark "console" surfaces
wherever live systems render — viewports, graphs, terminals. Every value
below is a token in `apps/web/src/styles/tokens.css`; that file is the
single source of truth and the only place raw hex/px may appear
(stylelint enforces it).

## Principles

1. **Two worlds, one page.** Chrome and cards are light; anything that
   *is* the running system (3D scene, graph canvas, terminal, command
   readouts) sits on a dark console surface. The contrast tells the user
   what is interface and what is machine.
2. **Tokens only.** Components consume `var(--token)` exclusively. A new
   value means a new token with a name that says what it's *for*, not
   what it looks like.
3. **Mono means data.** Machine names, topics, coordinates, uptimes, and
   statuses render in the mono stack. Prose and labels stay in the body
   face. If a human typed it into a terminal once, it's mono.
4. **State is shown, not claimed.** Status comes from live queries and
   telemetry (dots, tags, indicators), never from what button was
   pressed last.

## Color

### Base palette (Figma "Base Palette")
| Token | Value | Use |
| --- | --- | --- |
| `--base-palette-cloud` | `#f8fafb` | launch-page fields |
| `--base-palette-blue` | `#06c` | primary actions, brand |
| `--base-palette-storm` | `#1c2835` | launch-page text |
| `--base-palette-not-quite-gray` | `#036` | headings on light surfaces |

### Page palette (light chrome)
| Token | Value | Use |
| --- | --- | --- |
| `--color-page-bg` | `#f3f6fa` | screen background |
| `--color-page-surface` | `#fff` | cards, panels |
| `--color-page-text` | `#17202b` | body text |
| `--color-page-muted` | `#667085` | secondary text, labels |
| `--color-page-border` | `#dce3ec` | card and row borders |
| `--color-page-control` | `#f8fafc` | inputs, secondary buttons |
| `--color-page-focus` | `#74b6ff` | focus rings |

### Console palette (dark surfaces)
| Token | Value | Use |
| --- | --- | --- |
| `--color-graph-bg` | `#0d1726` | canvas/terminal background |
| `--color-graph-surface` | `#111e30` | dark cards (viewport panel) |
| `--color-graph-surface-raised` | `#14243a` | hover/raised on dark |
| `--color-graph-border` | `#243a57` | borders on dark |
| `--color-graph-text` | `#f5f8ff` | primary text on dark |
| `--color-graph-muted` | `#8ea3bd` | secondary text on dark |
| `--color-command-accent` | `#20d49a` | live/ok accents in consoles |
| `--color-command-link` | `#5ab5ff` | links on dark |

### Status colors
| Token | Value | Meaning |
| --- | --- | --- |
| `--color-status-running` | `#0eb77a` | active / healthy / armed-and-flying |
| `--color-status-armed` | `#ed9707` | ready / configured / attention |
| `--color-status-stopped` | `#93a4ba` | inactive / disabled |
| `--color-discovery` | `#28c98b` | connectivity (discovery, links up) |
| `--color-danger-strong` | `#e5242a` | destructive actions, errors |

Each status color has a `-soft` companion for tag fills. The lifecycle
mapping is fixed: **active → running**, **inactive(configured) →
armed**, **unconfigured/finalized → stopped**.

### Service tones (graph entities)
`--color-service-{cyan,blue,amber,violet}` + `-fill` pairs: cyan = ros
nodes, blue = px4 interfaces, amber = rcl/system, violet = everything
else. Publish edges draw blue, subscribe edges draw discovery green.

## Typography

| Token | Value |
| --- | --- |
| `--font-body` | Inter, system-ui |
| `--font-mono` | JetBrains Mono, ui-monospace |
| `--text-sm` / `--text-md` / `--text-lg` / `--text-xl` | 12 / 14 / 18 / 24px |
| `--text-graph-micro` | micro labels on consoles |

Conventions: panel titles are `--text-md` bold in
`--base-palette-not-quite-gray`; kickers (SELECTED NODE, DETAILS) are
mono micro, uppercase, letter-spaced, in `--color-inspector-kicker`;
inline separators use `·`.

## Spacing, radii, borders

- Space scale: `--space-1..5` = 4 / 8 / 16 / 24 / 40px. No other gaps.
- Radii: `--radius-1` (4px) inputs and small controls, `--radius-2`
  (8px) chips, `--dashboard-panel-radius` panels, `--graph-card-radius`
  large canvases, pill radii only on launch-page buttons.
- Borders: `--graph-border-width` everywhere in the console design
  (`--border-width` survives in legacy dark components).

## Layout patterns

- **Screen bleed**: every screen paints its own `--color-page-bg` edge
  to edge over `main`'s padding — `margin: calc(var(--space-4) * -1);
  padding: var(--graph-page-gap)` — and sets
  `min-height: calc(100vh - var(--topbar-height))`.
- **Named-area grids** for purposeful layouts (dashboard), scoped as
  `.screen-grid > .area-class` — never bare class selectors, which leak
  across screens (we learned this the hard way).
- **Breakpoints** are rem range queries: `@media (width <= 74rem)` and
  `(width <= 48rem)`. No pixel breakpoints.
- **Scroll containment**: wide content scrolls inside its card
  (`overflow-x: auto` on the canvas), the page never scrolls sideways.
- **16:9 viewports**: stream and scene containers hold the sim's aspect
  (`aspect-ratio: 16 / 9`); the content fills them edge to edge.

## Components

| Component | Use | Notes |
| --- | --- | --- |
| `DashboardPanel` | every card | title + optional icon + headerAction; body is unpadded — wrap content in `.panel-pad` |
| `MetricCard` | single-value readouts | `tone="dark"` on console surfaces; `mono` for numbers |
| `StatusTag` | state chips | only the three tones; label may override text, never the color semantics |
| `StatusIndicator` | connectivity dots | `active` prop drives up/down |
| `WorkspaceHeader` | the top bar | breadcrumb · sim controls (Start/Resume · Pause · Stop) · status |
| `AppIcon` | nav/panel icons | fixed name set; add to the union, don't inline svg |
| `Button` / `puffin-button` | actions | primary blue; screens size via the `--button-*` custom-property overrides, not new classes |
| `SceneViewport` | client-side 3D | dark canvas, corner hint + reset control |
| `SimViewport` | noVNC stream | full Gazebo only |
| `TeleopPad` | manual flight | hold-to-fly buttons + controller toggle |
| `TerminalConsole` | styled log panes | presentational; the real shell is the floating terminal |
| `LifecycleQuickPanel` | compact node control | rows with Activate/Kill |

## Interaction rules

- Disabled means *not available and here's why*: pair `disabled` with a
  `title` explaining (e.g. "Pause is not available yet", "offboard node
  in control"). Grayed nav items say "Not available yet".
- Focus is always visible: `--color-page-focus` outline with the
  `--graph-control-focus-*` geometry.
- Commands report back: every action surfaces its result (status strip
  ack, announcement region) — success and failure alike.
- Destructive actions (Kill, Stop-node) get the danger treatment and
  never sit adjacent to their opposite without spacing.

## Microcopy

Lowercase, terse, technical: "live telemetry render", "streaming @
10 Hz", "not valid from inactive". Hints tell the user what the system
needs, not what they did wrong. Machine identifiers are always verbatim
(`/offboard_demo`, `/fmu/in/trajectory_setpoint`) in mono.

## Enforcement

- stylelint: no raw hex/px outside `tokens.css`; shorthand `grid-template`;
  no duplicate selectors; selector-specificity ordering.
- Screens import from `components/` and `lib/`, never other screens.
- One css file per component/screen, classes prefixed by the component.
- Screenshot-verify layout changes against the running stack (the
  playwright sweep in the project scratchpad) — computed styles have
  betrayed the cascade before.
