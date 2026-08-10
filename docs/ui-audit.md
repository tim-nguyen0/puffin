# ui-audit.md — Puffin web

A pass over every screen in `apps/web/src` against Nielsen's 10 heuristics plus
the usual Gestalt/design checks (proximity, similarity, common region,
figure-ground, alignment, hierarchy, consistent spacing and type scale).

Method: dev server on MSW mocks, every route screenshotted at 1600×1000 before
and after, source read alongside. Fixes stayed inside what an audit can safely
touch — copy, spacing, grouping, ordering, missing states, titles, aria, and
outright layout bugs. Anything needing a design decision, new artwork, backend
work, or a cross-screen convention is recorded as **not fixed** with the
reason.

`screens/mission-planner/**` is being rewritten by another agent. It is audited
here but **no planner file was edited**.

Routes covered: `/`, `/signup`, `/dashboard`, `/dashboard/console`,
`/vehicles`, `/sensors`, `/mission-planner`, `/ros-services`, `/ros-graph`,
`/settings`, plus the shared shell (sidebar, top bar, floating terminal).

---

## Shell — sidebar, top bar, floating terminal

### S1 · "Resume" offered while the sim is already running — high
*Visibility of system status; error prevention.*
The primary top-bar button read `simRunning ? "Resume" : "Start"`, so a healthy
running stack showed "Resume" — a word that promises to undo a pause that
cannot happen (Pause is permanently disabled). Pressing it re-posts
`/sim/start` at a supervisor that has nothing to start.
**Fixed:** the button now reports `Running` and disables itself while the sim is
up, shows `Working…` while a start/stop is in flight, and the control group
carries `aria-busy`. `WorkspaceHeader.tsx`.

### S2 · Disabled Pause was indistinguishable from live Stop — high
*Error prevention; affordance.*
`.workspace-command-button` had no `:disabled` styling, so the permanently
disabled Pause rendered identically to the working Stop next to it, and
`:hover` even lit its border. Its explanatory `title` never appeared either:
disabled controls swallow the hover that would show one.
**Fixed:** `:disabled` gets the same dimming the primary button uses, hover is
scoped to `:not(:disabled)`, and the title moved to a wrapper span so it
actually shows. Same wrapper trick applied to the console's Pause, the vehicles
"+ Add Vehicle", and the sensor editor's Save.

### S3 · Truncated account email with no way to read it — med
*Recognition over recall.*
`.sidebar-user` clipped the signed-in address (`tim+audit17863…@puffin….`) with
no `title` and no `white-space: nowrap`, so the ellipsis was really just a
clip. On a tool where you switch accounts to switch workspaces, the answer to
"who am I" was unreachable.
**Fixed:** `title` on the element and a proper single-line ellipsis.

### S4 · Workspace chip parked under "Log out" — med
*Common region / proximity.*
Footer order was email → Log out → workspace chip, which reads as "log out of
rospackage-4" and separates the workspace identity from nothing at all.
**Fixed:** the workspace chip moves above its own group, the email and Log out
become a `sidebar-account` block, and the gap between the two groups widens to
`--space-4` so the grouping is legible.

### S5 · Nav items had no hover and no focus ring — med
*Affordance; accessibility.*
`.nav-item` styled only `.active`. Nothing responded to hover, and keyboard
focus fell back to the browser default ring, which is close to invisible on the
navy sidebar.
**Fixed:** a 45% wash of the active blue on hover (distinct from the solid
active state so it never reads as "you are here"), and an explicit
`:focus-visible` ring on nav items and the logout button.

### S6 · Terminal opens over the page content on every screen — med
**Not fixed (needs a product call).** The floating terminal mounts unminimized
at the bottom-right on every route, covering the Lifecycle Nodes panel on the
dashboard, the vehicle inspector's topic list, and the mission planner's action
row. It offers minimize but no close, so the only escape is to shrink it and
leave a stub. It is draggable and the position persists per user, so this is
recoverable — but the default state hides content on first run. Fixing properly
means changing the `terminal_minimized` default (contract + backend) or adding
a close affordance.
**Partly mitigated:** the drag handle and the minimize button now carry titles,
so the affordances are discoverable rather than guessed at.

---

## `/` launcher (login)

### L1 · Login and sign-up look like different products — high
**Not fixed (screen owner's call).** `/` is a white, pill-shaped, oversized
Figma layout; `/signup` — one link away — is a dark card with square inputs and
a normal-sized heading. Nothing carries across the boundary except the button.
This is the single loudest consistency violation in the app, but reconciling it
is a redesign of one of the two screens, not an audit fix.

### L2 · No autocomplete, no autofocus — med
*Flexibility and efficiency of use; error prevention.*
Neither field declared `autoComplete`, so password managers had to guess, and
the cursor started nowhere.
**Fixed:** `autoComplete="username"` / `"current-password"`, and autofocus on
the email field.

### L3 · A panel of dead controls with no explanation — med
*Visibility of system status; help.*
"Recents" renders three folder buttons that are disabled because the launcher
passes no `onFolderSelect`. Each carried a "Not available yet" title, but
titles on disabled buttons never fire, so the panel looked broken rather than
unfinished.
**Fixed:** `RecentFolders` prints one honest line — "reopening a recent package
isn't wired up yet" — when nothing is wired, instead of leaving a dashed box of
inert chips unexplained.

### L4 · A drone glyph on the Login button — low
**Not fixed (Figma fidelity).** The submit button reuses the "New Simulation"
component wholesale, including its icon and its 80 px pill height, so "Login"
ships with a drone rotor mark and is twice the height of the fields above it.
Harmless, but the hierarchy reads as "launch a sim", not "sign in".

---

## `/signup`

### A1 · An 8-character rule that only appeared after failing — med
*Error prevention.*
`minLength={8}` was enforced on submit with nothing on screen saying so.
**Fixed:** an `at least 8 characters` hint wired via `aria-describedby`, plus
`autoComplete="username"` / `"new-password"` and autofocus.

### A2 · Pure-white inputs punched holes in the dark card — med
*Figure-ground; consistency.*
`.auth-card input` set no background, so the browser default white glared out
of the near-black card — the brightest thing on the screen was two empty boxes.
**Fixed:** inputs take `--color-bg` / `--color-text` and get a visible
focus ring, matching every other input in the app.

---

## `/dashboard`

### D1 · Four telemetry cards on a three-up grid — med
*Gestalt: alignment, grouping.*
`.telemetry-metrics` used `auto-fit / minmax(150px)`, which resolved to three
columns in that panel and stranded Battery alone on a second row.
**Fixed:** an explicit two-up grid (one column under 54rem). Four readouts now
sit as a balanced 2×2.

### D2 · The teleop hint shattered into fragments — med
*Consistency; typography.*
`.teleop-hint` was a flex row, so every text node became its own flex item and
the sentence broke as "Hold to fly — needs / `/teleop` / active and the vehicle
/ armed" at arbitrary points.
**Fixed:** the hint is prose again; the status dot is an inline-block that
rides the text baseline.

### D3 · Arrow keys that mean north, not up — med
*Match between system and the real world; recognition over recall.*
The pad mixes glyphs (`↑ ← ↓ →`) with words (`Up`, `Down`). On screen `↑` reads
as "climb", but it sends `forward`; the climb control is the button labelled
`Up` in a separate column. Only the aria-label knew the difference.
**Fixed:** every pad button gets a `title` — "hold to fly forward (north)",
"…climb", and so on.

### D4 · The QGC panel declared a stream dead while it was connecting — high
*Visibility of system status.*
`SimViewport`'s hint renders unconditionally, so "stream offline — is the qgc
container up?" sat under the frame no matter what the stream was doing. The
after-shot proves the point: the panel now shows a live QGroundControl session
under what used to be a permanent "offline" notice.
**Fixed:** the copy asks instead of asserting — "frame stays blank? the qgc
container may be down — docker compose up -d qgc". A genuinely conditional
message needs load/error detection on a cross-origin iframe, which is a
separate change.

### D5 · The command-result chip sat a row below its siblings — low
*Alignment.*
A failed vehicle command reused `.dashboard-error`, which carries
`margin-top` and a smaller font size for its block-paragraph use, so the chip
dropped out of line with the chips beside it.
**Fixed:** the chip variant resets both.

### D6 · Decorative dots that read as status LEDs — med
**Not fixed (design call).** `MetricCard` renders a coloured dot per card,
`aria-hidden` and purely decorative from Figma. On a flight dashboard where
every other coloured dot means "live" or "armed", a blue dot beside an altitude
reading implies a signal state it does not have. Either drop the indicator on
the telemetry cards (`showIndicator={false}`) or give it meaning — both are the
screen owner's decision.

### D7 · Destructive controls carry no confirmation — med
**Not fixed (needs a pattern, not a patch).** Stop (top bar), Stop/Reset
(Simulation Processes) and Disarm all fire on a single click, mid-flight, with
no confirm and no undo. `Reset` sits in the same row and with the same weight
as `Start`. The app has no confirmation pattern to reuse; inventing one here
would be a design decision.
**Partly mitigated:** the top-bar Stop now spells out its blast radius in a
title ("stops gz-server, gz-gui, xrce-agent and px4").

### D8 · The flight sequence is split across the panel — low
**Not fixed (judgment).** Arm / Disarm / Land sit in one row, with the takeoff
altitude field and Takeoff button below them, so the real-world order (arm →
take off → land → disarm) is not the reading order. Reordering is easy, but
Land is deliberately grouped with the manual controls as the always-live escape
hatch, so the current grouping is defensible.

---

## `/dashboard/console` (immersive)

### C1 · The only exit was almost invisible — high
*User control and freedom; contrast.*
The breadcrumb's `exit` link had no colour rule, so it fell back to the
browser's default dark blue on a near-black bar. On a screen that hides the
sidebar, the one way out was effectively hidden.
**Fixed:** the link takes `--color-command-link`, underlines on hover/focus,
reads `exit ↩`, and says "back to the dashboard (Esc)".

### C2 · No keyboard escape from a full-screen mode — med
*User control and freedom.*
Immersive mode trapped you into finding that link with the mouse.
**Fixed:** Escape returns to `/dashboard`.

### C3 · ARMED badge collided with the flight mode — high
*Alignment; figure-ground.*
`.console-flight-mode` was a flex row with no `gap`, inside a right-aligned
grid cell, so the ARMED tag overlapped the mode text — legibly broken, not just
tight.
**Fixed:** `gap` plus `justify-content: flex-end`; the badge and
`AUTO_LOITER` now sit apart cleanly.

### C4 · Every service row said "up" twice — low
*Minimalist design.*
Rows rendered `up 00:08:32` beside a state column that also read `up`.
**Fixed:** the middle column is just the duration; the state stays at the end.

### C5 · Icon-only transport controls — low
*Recognition over recall.*
`Ⅱ` and `■` had aria-labels but no titles, so sighted mouse users got nothing.
**Fixed:** titles on both (Pause's on a wrapper, since it is disabled).

---

## `/vehicles`

### V1 · Every airframe wears the same quadcopter icon — med
**Not fixed (needs artwork).** Fixed-wing, Rover, VTOL and Multirotor cards all
render `AppIcon name="drone"`. Similarity says "these are the same kind of
thing" while the category chip says otherwise, and the icon is the largest
element on each card. `AppIcon` has no plane or rover glyph to map to; adding
one is design work.

### V2 · "Available" wears the warning colour — med
**Not fixed (tone system is closed).** `STATUS_TONES` maps `available` to the
`armed` tone, so a perfectly ready airframe gets the same amber the app uses
for an armed vehicle. `StatusTag` only offers running / armed / stopped, so
fixing this means adding a neutral tone to the shared component.

### V3 · Sensor icons said what they were, not whether they were there — low
*Recognition over recall.*
Dimming meant "absent", but all three icons had the same title (`camera`,
`lidar`, `gps`) whether present or not.
**Fixed:** titles now read "carries a camera" or "no camera".

### V4 · A greyed-out primary action with no reason — med
*Help and documentation.*
"+ Add Vehicle" is disabled by design (the stack boots one x500) and carried an
explanatory title that never showed, because it was on the disabled button.
**Fixed:** title moved to a wrapper span; hovering the greyed button now
explains itself.

---

## `/sensors`

### N1 · Empty sparklines rendered as solid black bars — high
*Figure-ground; visibility of system status.*
`.sensor-sparkline svg` keeps a dark canvas background. With telemetry offline
the polyline is skipped and the card is left showing three black rectangles on
a white panel — indistinguishable from a rendering failure.
**Fixed:** with fewer than two samples the plot is replaced by a dashed
placeholder reading "no samples yet"; the value column still shows `—`.

### N2 · "Not installed" and "offline" share one grey — med
**Not fixed (tone system is closed).** Camera/LiDAR (permanently absent on this
airframe) and IMU/GPS/Battery/Baro (present, currently silent) both use the
`stopped` tone. Same colour, two very different meanings. Same root cause as
V2: `StatusTag` has no fourth tone.

### N3 · A whole editor panel that cannot be used — low
*Minimalist design.*
"Add / Edit Sensor" is a fully rendered form parked behind `<fieldset
disabled>`. Its header does say the feature is on the roadmap, which is honest,
so this is noted rather than changed.
**Fixed (adjacent):** the Save button's "sdf editing is not wired up yet" title
now sits on a wrapper so it actually appears on hover.

---

## `/ros-services` (ROS Nodes)

### R1 · "Armed: 2" beside two chips reading "inactive" — med
*Consistency; match with the real world.*
The footer counts speak Puffin's vocabulary (Running / Armed / Stopped) while
the rows print raw ROS lifecycle states (`inactive`). Read together they look
like a contradiction. The inspector's lifecycle flow does explain the mapping,
but only if you look at it.
**Fixed:** each count carries a title naming the lifecycle state it counts
("lifecycle state: inactive (configured)").

### R2 · "Arm" means two different things in one app — med
**Not fixed (cross-cutting vocabulary).** On this screen Arm is a *lifecycle
configure* transition; on the dashboard Arm *arms the vehicle*. Same word, same
product, two unrelated and safety-relevant meanings. Renaming touches
`components/lifecycle`, both screens and the shared tone map — a deliberate
product decision, not an audit fix.

### R3 · The same command, two visual weights — med
**Not fixed (two deliberate treatments).** In the list, Run is a filled green
button and Stop is a red outline; in the inspector, Run is a plain white button
and Stop is a solid red slab — the heaviest element on the screen, drawing the
eye straight to the destructive action. One of the two treatments should win;
picking which is the screen owner's call.

### R4 · Page title disagrees with the nav — low
**Not fixed (Figma title).** Sidebar and breadcrumb say "ROS Nodes"; the page
heading says "Nodes & Launch".

---

## `/ros-graph`

### G1 · Heading disagreed with the nav and breadcrumb — low
*Consistency and standards.*
Both said "ROS2 Graph"; the `h1` said "ROS Graph".
**Fixed:** the heading matches.

### G2 · The legend explained the edges but not the shapes — med
*Recognition over recall.*
Ellipses are nodes and slabs are topics — the graph's most basic distinction —
while the legend covered only publish/subscribe colours.
**Fixed:** the legend leads with a node swatch and a topic swatch that echo the
canvas styling, then the two edge colours.

### G3 · No sense of scale or freshness — low
*Visibility of system status.*
The view polls every 5 s and the checkbox silently hides part of the graph,
with no count either way.
**Fixed:** the toolbar reports "n nodes · n topics · refreshed every 5s",
counted off the laid-out graph so it reflects the filter.

### G4 · A full filter bar exists but ships nowhere — low
**Not fixed (dead code, out of audit scope).** `components/graph-filter`
(search, status filter, layout toggle) and `components/lifecycle/
LifecycleQuickPanel` are complete, tested, and imported by no screen. The
shipped graph has a single checkbox. Worth a decision: wire them up or delete
them.

---

## `/settings`

### T1 · Save changes floated between two cards — med
*Common region; proximity.*
The button sat outside every section with the read-only "System" card directly
below it at a near-identical gap, so it read as saving System too.
**Fixed:** the editable sections, their messages and the button are wrapped in
one `<form>`, and the System card is pushed further down so proximity groups
correctly. The form also submits on Enter, and the button is a real submit.

### T2 · A validation range nobody could see — med
*Error prevention.*
"Telemetry history length" is validated to 10–5000 samples, with no `min`,
no `max`, and no units on screen — you learned the rule by failing.
**Fixed:** `min`/`max` on the input and a "10–5000 samples kept for the
sparklines" hint via `aria-describedby`.

### T3 · Saving without a token failed silently — med
*Visibility of system status; error recovery.*
`if (!token) return;` — the button did nothing, said nothing.
**Fixed:** an explicit "Your session expired — log in again to save settings."
The "Saved." confirmation also became `role="status"`.

### T4 · Units label undersold what it changes — low
*Match with the real world.*
"Metric (m/s)" also switches lengths to feet.
**Fixed:** "Metric (m, m/s)" / "Imperial (ft, ft/s)".

### T5 · No unsaved-changes signal — low
**Not fixed (judgment).** Editing a field clears the "Saved." flag but nothing
indicates pending changes, and navigating away loses them without warning.

---

## `/mission-planner` — audited, not edited

Another agent is rewriting this screen. Recorded for them:

### M1 · "streaming @ 20 Hz" beside an INACTIVE badge — high
*Visibility of system status.* The header claims a live setpoint stream while
the status chip says the node is inactive. One of the two is lying; on the
mocks, it is the header.

### M2 · Step numbers conflate configuration with waypoints — med
*Gestalt: similarity, grouping.* The right rail numbers "1 Prime Mission"
(a settings block: name, rate, takeoff Z) and "2 Setpoint SP1", "3 Setpoint
SP2"… identically, so the list reads as a five-step sequence where step 1 is a
different kind of thing entirely. It also makes SP1 the second item, so every
setpoint's badge is off by one from its name.

### M3 · Destructive actions with no undo — med
*User control and freedom.* "Clear All" wipes every setpoint on one click, and
each setpoint's unlabelled `×` deletes it, with no undo anywhere.

### M4 · Action row cramped and wrapping — low
*Hierarchy; consistency.* Clear All / Preflight Check / Prime Mission / Create
Node share one row at equal weight, wrapping onto two lines at 1600 px wide.
The destructive action and the primary action are indistinguishable.

### M5 · The rail clips its own content — med
*Visibility.* Setpoint SP4 is cut off mid-card at the bottom of the panel with
no scroll affordance, and the mission summary strip below the scene is one of
the areas the floating terminal covers.

### M6 · NED sign convention leans on the reader — low
*Match with the real world.* "Takeoff Z (down) −3" and "Z · Down −5" ask the
user to think in negative-up. The subtitle does say "ned waypoints", and the
convention is correct for the domain, but a metres-above-ground input with the
conversion done underneath would remove a class of error.

---

## Counts

| Severity | Fixed | Not fixed | Total |
|---|---|---|---|
| high | 6 | 2 | 8 |
| med | 17 | 11 | 28 |
| low | 7 | 8 | 15 |
| **total** | **30** | **21** | **51** |

The 21 not-fixed split as:

| Reason | Count | Findings |
|---|---|---|
| design or product decision | 10 | L1, L4, D6, D7, D8, N3, R2, R3, R4, T5 |
| mission-planner rewrite (not editable) | 6 | M1–M6 |
| blocked on `StatusTag`'s closed tone set | 2 | V2, N2 |
| needs new icon artwork | 1 | V1 |
| needs a contract/backend default change | 1 | S6 |
| dead code — wire up or delete | 1 | G4 |

## Files changed

```
apps/web/src/components/floating-terminal/FloatingTerminal.tsx
apps/web/src/components/recent-folders/RecentFolders.tsx
apps/web/src/components/recent-folders/recent-folders.css
apps/web/src/components/sidebar/Sidebar.tsx
apps/web/src/components/sidebar/sidebar.css
apps/web/src/components/teleop/TeleopPad.tsx
apps/web/src/components/teleop/teleop-pad.css
apps/web/src/components/workspace-header/WorkspaceHeader.tsx
apps/web/src/components/workspace-header/workspace-header.css
apps/web/src/screens/auth/SignupScreen.tsx
apps/web/src/screens/auth/auth.css
apps/web/src/screens/console-dashboard/ConsoleDashboardScreen.tsx
apps/web/src/screens/console-dashboard/console-dashboard.css
apps/web/src/screens/dashboard/DashboardScreen.tsx
apps/web/src/screens/dashboard/dashboard.css
apps/web/src/screens/launcher/LauncherScreen.tsx
apps/web/src/screens/ros-graph/RosGraphScreen.tsx
apps/web/src/screens/ros-graph/ros-graph.css
apps/web/src/screens/ros-services/RosServicesScreen.tsx
apps/web/src/screens/sensors/SensorsScreen.tsx
apps/web/src/screens/sensors/sensors.css
apps/web/src/screens/settings/SettingsScreen.tsx
apps/web/src/screens/settings/settings.css
apps/web/src/screens/vehicles/VehiclesScreen.tsx
apps/web/src/screens/vehicles/vehicles.css
```

No token was added or changed; every new rule consumes existing `var(--…)`.
No file under `screens/mission-planner/` was touched.

`pnpm typecheck && pnpm lint && pnpm test` — clean, 85 tests passing.
