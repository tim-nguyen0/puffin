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
</div>

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

Spacing walks a five-step scale (4 / 8 / 16 / 24 / 40). Panels round at
12–18px, controls at 4–8px, and only the launch page gets pills.

## Feeling

The app should feel like a **calm mission console**: dense but never
crowded, quiet until something changes, honest about state. Motion is
minimal — status pulses, a cursor blinks, the drone banks in the scene —
everything else holds still. Disabled things say why. Commands answer
back. Nothing pretends.

For the enforceable rules behind this feeling — tokens-only styling,
scoped grid areas, screenshot verification — see the
[architecture notes](/architecture).
