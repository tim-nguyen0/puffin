# Visual style

Puffin's interface has one organizing idea: **light chrome, dark
machines.** Cards, controls, and navigation live on a calm light page —
and wherever a live system renders (the 3D scene, the graph canvas, a
terminal), the surface goes dark. The contrast tells you at a glance
what is *interface* and what is *the running system*.

## The two worlds

<div class="pf-metric-row">
  <div class="pf-metric"><header>Altitude (m) <i></i></header><strong>4.98</strong></div>
  <div class="pf-metric"><header>Battery <i></i></header><strong>16.20 V</strong></div>
  <div class="pf-metric pf-dark"><header>Nodes <i></i></header><strong>3</strong></div>
  <div class="pf-metric pf-dark"><header>Telemetry <i></i></header><strong>LIVE</strong></div>
</div>

<div class="pf-console">
<b>$</b> make procs<br>
✓ gz-server · <b>RUNNING</b> · headless physics<br>
✓ px4 · <b>RUNNING</b> · SITL · lockstep<br>
✓ offboard-demo · <b>RUNNING</b> · <em>/fmu/in/trajectory_setpoint</em><br>
<b>puffin@sim:~$</b> <span class="pf-cursor">▋</span>
</div>

Consoles speak mono. If a machine said it — a topic name, a coordinate,
an uptime — it renders in JetBrains Mono. Prose stays in Inter.

## Page palette

<div class="pf-swatches">
  <div class="pf-swatch"><i style="background:#f3f6fa"></i><span><b>page-bg</b>#f3f6fa</span></div>
  <div class="pf-swatch"><i style="background:#fff;border-bottom:1px solid #dce3ec"></i><span><b>page-surface</b>#ffffff</span></div>
  <div class="pf-swatch"><i style="background:#17202b"></i><span><b>page-text</b>#17202b</span></div>
  <div class="pf-swatch"><i style="background:#667085"></i><span><b>page-muted</b>#667085</span></div>
  <div class="pf-swatch"><i style="background:#dce3ec"></i><span><b>page-border</b>#dce3ec</span></div>
  <div class="pf-swatch"><i style="background:#06c"></i><span><b>brand blue</b>#0066cc</span></div>
  <div class="pf-swatch"><i style="background:#036"></i><span><b>headings</b>#003366</span></div>
  <div class="pf-swatch"><i style="background:#74b6ff"></i><span><b>focus</b>#74b6ff</span></div>
</div>

## Console palette

<div class="pf-swatches">
  <div class="pf-swatch"><i style="background:#0d1726"></i><span><b>graph-bg</b>#0d1726</span></div>
  <div class="pf-swatch"><i style="background:#111e30"></i><span><b>graph-surface</b>#111e30</span></div>
  <div class="pf-swatch"><i style="background:#243a57"></i><span><b>graph-border</b>#243a57</span></div>
  <div class="pf-swatch"><i style="background:#f5f8ff;border-bottom:1px solid #dce3ec"></i><span><b>graph-text</b>#f5f8ff</span></div>
  <div class="pf-swatch"><i style="background:#8ea3bd"></i><span><b>graph-muted</b>#8ea3bd</span></div>
  <div class="pf-swatch"><i style="background:#20d49a"></i><span><b>command-accent</b>#20d49a</span></div>
  <div class="pf-swatch"><i style="background:#5ab5ff"></i><span><b>command-link</b>#5ab5ff</span></div>
  <div class="pf-swatch"><i style="background:#14243a"></i><span><b>surface-raised</b>#14243a</span></div>
  <div class="pf-swatch"><i style="background:#607894"></i><span><b>graph-subtle</b>#607894</span></div>
  <div class="pf-swatch"><i style="background:#526d8d"></i><span><b>graph-link</b>#526d8d</span></div>
  <div class="pf-swatch"><i style="background:#7190b4"></i><span><b>graph-provider</b>#7190b4</span></div>
</div>

The dark surfaces stack: `graph-bg` is the canvas floor, `graph-surface`
the card sitting on it, `surface-raised` anything lifted above that —
a hover, a selected row, a terminal header. Never skip a step.

## Status is a language

Three tones, fixed meanings, mapped straight onto the ROS 2 lifecycle —
never repurposed, never approximated:

<p>
  <span class="pf-tag pf-tag-running"><i></i>running</span>&nbsp;&nbsp;
  <span class="pf-tag pf-tag-armed"><i></i>armed</span>&nbsp;&nbsp;
  <span class="pf-tag pf-tag-stopped"><i></i>stopped</span>
</p>

- **running** `#0eb77a` — active, healthy, flying
- **armed** `#ed9707` — configured and ready; attention without alarm
- **stopped** `#93a4ba` — inactive, disabled, parked

Every tone travels with a **soft** background for tags and rows — text
in the tone, fill in its soft, never mixed across tones:

<div class="pf-swatches">
  <div class="pf-swatch"><i style="background:#e4f8f0"></i><span><b>running-soft</b>#e4f8f0</span></div>
  <div class="pf-swatch"><i style="background:#fff4dc"></i><span><b>armed-soft</b>#fff4dc</span></div>
  <div class="pf-swatch"><i style="background:#eaf0f7"></i><span><b>stopped-soft</b>#eaf0f7</span></div>
  <div class="pf-swatch"><i style="background:#def8ee"></i><span><b>discovery-soft</b>#def8ee</span></div>
</div>

Danger is its own family, reserved for destructive actions (Kill, Stop
in the inspector) and hard failures — not for "off", which is what
stopped-grey is for:

<div class="pf-swatches">
  <div class="pf-swatch"><i style="background:#e5242a"></i><span><b>danger-strong</b>#e5242a</span></div>
  <div class="pf-swatch"><i style="background:#cc1f25"></i><span><b>danger-hover</b>#cc1f25</span></div>
  <div class="pf-swatch"><i style="background:#f5c2c5"></i><span><b>danger-border</b>#f5c2c5</span></div>
  <div class="pf-swatch"><i style="background:#fff0f0"></i><span><b>danger-soft</b>#fff0f0</span></div>
</div>

Selection and discovery each get one voice and keep it: selected rows
wash `#f1f7ff` with a `#94c6ff` border and an 18% ring of the same;
live-connection dots glow discovery green `#28c98b`.

Entities in the graph carry service tones: <span class="pf-tag" style="background:#102c34;color:#16d9cf"><i></i>ros nodes</span>
<span class="pf-tag" style="background:#122746;color:#338eff"><i></i>px4 topics</span>
<span class="pf-tag" style="background:#332714;color:#ffad1f"><i></i>system</span>
<span class="pf-tag" style="background:#28213f;color:#a98cff"><i></i>other</span>

## Type & rhythm

<div class="pf-panel pf-type-specimen">
  <header>Specimen</header>
  <div>
    <p style="font-size:24px;font-weight:700;color:#036">Headline 24 — Inter Bold</p>
    <p style="font-size:14px">Body 14 — Inter. Calm, technical, lowercase where the app speaks.</p>
    <p style="font-size:12px;color:#667085">Label 12 — muted, does the quiet work.</p>
    <p style="font-family:'JetBrains Mono',monospace;font-size:12px">/fmu/in/trajectory_setpoint · mono 12 — machine truth, verbatim</p>
    <p style="font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#8a9bb2">KICKER · MONO MICRO UPPERCASE</p>
  </div>
</div>

## Radii

Rounding says what a thing is. Small radii mean *control*, large radii
mean *container*, and pills mean *launch* — the scale in the app's own
shapes:

<div class="pf-radii">
  <div class="pf-radius" style="border-radius:4px">4<br>inputs</div>
  <div class="pf-radius" style="border-radius:8px">8<br>buttons · chips</div>
  <div class="pf-radius" style="border-radius:10px">10<br>sidebar · rows</div>
  <div class="pf-radius pf-dark" style="border-radius:12px">12<br>metric cards</div>
  <div class="pf-radius" style="border-radius:16px">16<br>panels</div>
  <div class="pf-radius pf-dark" style="border-radius:18px">18<br>graph canvas</div>
  <div class="pf-radius" style="border-radius:24px 24px 0 24px">20–48<br>launch pills</div>
</div>

- `4px` (`--radius-1`) — inputs, selects, small controls, code chips
- `8px` (`--radius-2`) — buttons, status chips, filter controls
- `10px` — sidebar items, service rows, graph controls
- `12px` — metric cards, graph nodes, the simulation cards
- `16px` (`--dashboard-panel-radius`) — dashboard panels
- `18px` (`--graph-card-radius`) — the big dark canvases
- `20 / 40 / 48px` — recents, recent groups, and the launch pill;
  pills live **only** on the launch page

One in-between: the graph's top controls sit at `7px` and the filter
bar at `14px` — the odd numbers are deliberate optical tweaks, not
drift. Add new radii from this list, not from taste.

## Spacing

Five steps, no in-betweens. If a gap isn't on the scale, it's a bug:

<div class="pf-spacing">
  <div><i style="height:4px"></i>4</div>
  <div><i style="height:8px"></i>8</div>
  <div><i style="height:16px"></i>16</div>
  <div><i style="height:24px"></i>24</div>
  <div><i style="height:40px"></i>40</div>
</div>

- `4` — icon-to-label, dot-to-text, the tightest pairs
- `8` — between controls, inside chips, list-row padding
- `16` — panel padding, gaps between related blocks
- `24` — page padding, panel-to-panel breathing room
- `40` — launch-page drama; rarely appears inside the console

The page grid itself uses `20px` gaps (`--graph-page-gap`) — the one
deliberate exception, sized so three panels and two gutters fill a
laptop row exactly.

## Depth

Borders do almost all the work: `1px` everywhere, `2px` only on the
launch page's recents. Shadows are reserved for the few things that
genuinely float:

<div class="pf-shadows">
  <div class="pf-shadow" style="box-shadow:0 14px 40px rgb(20 31 46 / 12%)">graph cards<br>0 14 40 · 12%</div>
  <div class="pf-shadow" style="box-shadow:0 12px 32px #0008;background:#111e30;border-color:#243a57;color:#8ea3bd">terminal<br>0 12 32 · 50%</div>
  <div class="pf-shadow" style="box-shadow:0 10px 24px rgb(0 102 204 / 28%)">launch button<br>0 10 24 · brand 28%</div>
  <div class="pf-shadow" style="box-shadow:0 4px 8px rgb(28 40 53 / 12%)">recents<br>0 4 8 · 12%</div>
</div>

Flat things stay flat: panels sit on the page with a border, not a
shadow. If a new element wants elevation, ask whether it truly floats
above the page (terminal: yes; a card: no).

## Feeling

The app should feel like a **calm mission console**: dense but never
crowded, quiet until something changes, honest about state. Motion is
minimal — status pulses, a cursor blinks, the drone banks in the scene —
everything else holds still. Disabled things say why. Commands answer
back. Nothing pretends.

For the enforceable rules behind this feeling — tokens-only styling,
scoped grid areas, screenshot verification — see the
[architecture notes](/architecture).
