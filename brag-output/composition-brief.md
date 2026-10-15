# Hyperframes Composition Brief: Namah Trace

## Objective
Create a short 20-second polished brag video for Namah Trace — an internal manufacturing traceability app for Namah Ropes.

## Output
- Composition directory: brag-output/composition/
- Rendered video: brag-output/brag.mp4
- Format: landscape — 1280x720
- Duration: 20 seconds

## Source Material
- Project root: c:/Users/rohan/Desktop/Namah_Trace
- Primary files read: index.html, src/style.css, src/App.jsx, src/components/Dashboard.jsx, src/components/EntityDetail.jsx, package.json
- Product name: Namah Trace
- Tagline / strongest claim: "Every rope has a family tree."
- Key UI or visual moment to recreate:
  1. Dashboard hero with Traceability Matrix title + 3 color-coded KPI metric cards (amber/blue/navy)
  2. Rope batch detail panel: batch ID 5417, Completed status, quality parameters, source yarn link
  3. Audit trail log rows: timestamped records
- Copy that must appear verbatim:
  - "Every rope has a family tree."
  - "Traceability Matrix"
  - "Flat Yarn → Yarn Batch → Rope Batch. Fully traced."

## Creative Direction
- Tone preset: polished
- Creative direction: Quiet industrial precision — the software equivalent of a rope that doesn't break.
- Interpretation: Fewer scenes, longer holds. Confidence through restraint. Typography is the hero. No flash. Motion enters fast then holds long enough to read. One SFX per major moment.
- Angle: The hook is the product's own claim — "Every rope has a family tree." The video proves it by walking through the app: the 3-tier matrix, a batch drill-down, an audit record.
- Hook: Navy background, large white type, types in character by character: "Every rope has a family tree."
- Outro / punchline: "Namah Trace / by Namah Ropes" on navy. Tagline: "Flat Yarn → Yarn Batch → Rope Batch. Fully traced."
- Avoid:
  - Generic SaaS language ("streamline your workflow")
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #f8fafc (light scenes) / #004282 (navy scenes — hook and outro)
- Text: #0f172a (main on light) / #ffffff (on navy)
- Accent: #f96c30 (Namah orange — use sparingly, e.g. as highlight dot or eyebrow accent)
- Tier colors: amber #b46b10 (flat yarn), blue #026aa7 (yarn batch), navy #004282 (rope batch)
- Display font: DM Sans (Google Fonts — load via @import or <link>)
- Mono font: DM Mono (for batch IDs, codes)
- Visual references from the project: 3-tier colored metric cards, navy sidebar, status pill (green "Completed"), navy batch ID badge

## Storyboard

Scene summary:
1. Hook — 3.0s — White type types in on navy: "Every rope has a family tree." Hold 0.8s settled.
2. Dashboard Reveal — 4.5s — Bright page. "Traceability Matrix" H1. 3 metric cards arrive one by one (amber, blue, navy). Must see all 3 hold on screen together.
3. Batch Drill-Down — 5.0s — App shell with navy sidebar. Batch 5417 detail slides in. Parameters appear. Simulated click at scene start.
4. Audit Trail — 3.5s — Two audit log rows arrive one by one. "AUDIT TRAIL" header.
5. Logo / Outro — 4.0s — Navy bg. "Namah Trace" large. "by Namah Ropes" below. Tagline slides up. Bell hit on logo. Fade out.

## Audio
- Audio role: Warm, steady corporate bed; restrained SFX at key arrivals
- Audio arc: Vol-12 fades in under hook, builds through dashboard reveal, stays steady through drill-down and audit, fades out under logo with single bell hit as final punctuation
- Music: assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3
- Music treatment: data-start="0", volume 0.30, fade to 0 over final 1.5s (t=18.5s to t=20.0s)
- Music cue guidance: bundled preset at .agents/skills/brag/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json. Strong cue locks: 8.74s (Scene 3 slide-in), 13.11s (Scene 4 first row), 17.47s (Scene 5 logo hit). Beat-grid: Scene 2 cards at 6.00s, 6.56s, 7.09s.
- Audio-reactive treatment: subtle — use music RMS/bass to make dashboard hero title glow softly and metric cards breathe with the music bed. No waveform bars, no pulsing text.
- Audio-coupled moments:
  - Scene 1 (t=0.0s) — typing animation — randomized keyboard/keypress-00[1-5].wav per character, thinned (every 2-3 chars), vol 0.60
  - Scene 2 (t=6.00s, 6.56s, 7.09s) — metric card arrivals — assets/sfx/interface/drop_001.ogg x3, vol 0.70 // beat-grid
  - Scene 3 (t=7.70s) — simulated click — assets/sfx/ui/mouseclick1.ogg, vol 0.60
  - Scene 5 (t=17.47s) — logo settle — assets/sfx/impact/impactBell_heavy_000.ogg, vol 0.80 // beat-locked
- SFX selection guidance: polish and restraint throughout. No overlapping SFX. Space cues out.
- SFX analysis guidance: .agents/skills/brag/assets/sfx/sfx-analysis.md if present.
- Exact SFX choice: Hyperframes should choose exact timestamps and density based on the implemented animation.
- Audio files: music and SFX are already copied into brag-output/composition/assets/

## Hyperframes Instructions
Build the composition following the Hyperframes domain skills (hyperframes-core, hyperframes-animation, hyperframes-creative, hyperframes-keyframes, hyperframes-cli). This is a /brag workflow — do not enter the generic promo/launch-video workflow.

Requirements:
- Show at least one real UI element from the source project (the 3-tier metric cards, batch detail, audit trail).
- Keep all text readable — every line holds long enough to read before exiting.
- Keep total duration exactly 20 seconds.
- Include the music and SFX layer as specified.
- Treat music cue metadata as optional timing hints — product clarity and readability come first.
- 3 strong cue locks: 8.74s, 13.11s, 17.47s (marked // beat-locked in the implementation).
- Beat-grid: 3 metric cards snap to 6.00s, 6.56s, 7.09s (marked // beat-grid).
- Use audio-reactive treatment (subtle RMS/bass) on the dashboard hero and metric cards.
- Run npx hyperframes check before render — fix all errors.
