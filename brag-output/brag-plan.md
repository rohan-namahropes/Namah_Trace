# Brag Plan: Namah Trace

## What is this app?
Namah Trace is an internal manufacturing traceability system for Namah Ropes — it tracks every batch of flat yarn, processed yarn, and finished rope with full genealogy, quality parameters, test records, and audit evidence, so every rope has a verifiable chain of custody.

## The angle
**"Every rope has a family tree."**
The product is genuinely impressive in a quiet, industrial way — it does something real and unglamorous (factory traceability) with precision. The video leans into that: clean, confident, no hype. The hook is the product's own claim, stated plainly. The video is the software equivalent of a rope that doesn't break.

## Hook (first 2-3 seconds)
Deep navy background. A single line types in — large, clean, DM Sans:
> "Every rope has a family tree."
Character-by-character with subtle key tick sounds. Hold ~1.0s after complete. Then hard-cut to the dashboard.

## Key moments (the middle)
- **The Traceability Matrix** — dashboard title card appears, then three KPI metric cards arrive one by one: amber "Flat Yarn", blue "Yarn Batch", navy "Rope Batch". Each card arrives with a soft drop sound. Conveys the 3-tier manufacturing chain.
- **Batch Drill-Down** — a batch detail card appears: Batch ID "5417", status "Completed", quantity, parameters listed. Simulates clicking into a rope batch from the dashboard. Shows the product in use.
- **Audit Trail** — a clean audit log row slides in: "Batch Created · Rope Batch 5417 · 02 Sep 2025". Emphasizes the immutable record — every action logged.

## Outro / punchline
The Namah Navy sidebar with the "Namah Trace" wordmark holds for ~2 seconds. Below it, the tagline appears:
> "Flat Yarn → Yarn Batch → Rope Batch. Fully traced."
One resonant bell hit on the logo hold. Fade out.

## User flow worth showing
1. **Entry**: Dashboard loads — see the Traceability Matrix with 3 color-coded tier stats.
2. **Key action**: Click into a rope batch — batch ID, status, parameters, source yarn links visible.
3. **Result**: Audit log confirms the record — timestamped, actor-attributed, immutable.

## Tone
- **Preset:** polished
- **Creative direction:** Quiet industrial precision — the software equivalent of a rope that doesn't break.
- **Interpretation:** Fewer scenes, longer holds. Confidence through restraint. Typography is the hero. No flash. Motion enters fast and then holds long enough to read. One SFX per major moment, not a dense layer.

## Format: landscape — 1280x720
## Duration: 20 seconds

## Visual identity (from the project)
- **Background:** #f8fafc (page bg) / deep navy #004282 (sidebar, hero)
- **Accent / brand:** #f96c30 (Namah orange — use sparingly as highlight only)
- **Text:** #0f172a (main) / #ffffff (on navy)
- **Display font:** DM Sans (from Google Fonts, loaded in style.css)
- **Body / mono:** DM Mono (used for batch IDs and code)
- **Strongest visual element:** The three color-coded tier cards (amber/blue/navy) side-by-side — a visual metaphor for the production chain.

## Share copy (draft)
Built Namah Trace — a manufacturing traceability system for Namah Ropes that gives every rope a verifiable family tree, from raw flat yarn to finished batch.

## Audio direction
- **Role:** Warm, steady corporate bed; restrained SFX at key arrivals
- **Music:** happy-beats-business-moves-vol-12-by-ende-dot-app.mp3 — steady and clean, 109.96 BPM
- **Music treatment:** Start at t=0, volume 0.30, fade out gently over the final 2 seconds. No abrupt cut.
- **Music cue guidance:** Bundled preset available. Strong cues in window: 8.74s, 13.11s, 17.47s, 22.93s. Target the Batch Detail reveal near 8.74s, the Audit Trail reveal near 13.11s, and the logo hold near 17.47s. Beat grid ~0.55s spacing at 110 BPM.
- **Audio-reactive treatment:** Subtle — use music RMS/bass to make the dashboard hero glow and metric cards breathe slightly. No waveform bars, no pulsing text.
- **SFX posture:** Sparse/minimal — 3 SFX total max. Professional restraint throughout.
- **Audio-coupled moments:**
  - Hook (t=0): key ticks for typed text (randomized keypress-*.wav per character, ~0.06s apart, thinned to every 2-3 chars)
  - Metric cards (t~5.0-7.0s): interface/drop_001.ogg x3 (one per card arrival, staggered ~0.65s), vol 0.70
  - Logo hold (t~17.5s): impact/impactBell_heavy_000.ogg — one resonant hit as logo settles, vol 0.80
- **Restraint rule:** Music must not overpower the type. No SFX after the logo hit. Nothing on the outro fade.

---

## Storyboard

### Scene 1 — Hook — 3.0s
**Background:** Deep navy #004282 (full bleed)
**Content:** Large display text, white, center-aligned. Types in character by character:
> "Every rope has a family tree."
Text settles fully by t=2.2s. Hold 0.8s settled, then hard-cut.
Sequential/interaction: yes — character-by-character type animation, ~22 chars at 0.06s/char ≈ 1.3s to complete. Hold completed text for 0.8s before cut.
Audio intent: tense anticipation, quiet — the music is just warming up
Audio-coupled idea: randomized keyboard/keypress-*.wav per character, at 0.55-0.65 volume, thinned (every 2-3 chars to avoid clutter)
Music: vol-12, starts at t=0, soft fade in over 0.5s
Transition mood: hard cut → Scene 2

### Scene 2 — Dashboard Reveal — 4.5s
**Background:** #f8fafc (page bg) — suddenly bright after navy
**Content:** Recreate the dashboard hero section:
- Eyebrow text: NAMAH TRACE · INTERNAL MANUFACTURING WORKSPACE (muted, small caps)
- H1: Traceability Matrix (large, DM Sans 700, navy #004282)
- Subtitle: "Flat Yarn to Yarn Batch to Rope Batch. Every lot, parameter, and genealogical link recorded."
Then three KPI metric cards arrive one by one (staggered 0.65s):
1. Amber card: "FLAT YARN BATCHES · 06 · Raw sources"
2. Blue card: "DERIVED YARN BATCHES · 04 · Processed strands"
3. Navy card: "FINISHED ROPE BATCHES · 03 · Manufactured ropes"
Each card slides up softly and settles.
Sequential/interaction: yes — 3 metric cards arrive one by one at ~0.65s intervals starting at t~1.0s into scene. Hold all three visible for ~1.5s.
Audio intent: bright, confident — the product reveals itself
Audio-coupled idea: interface/drop_001.ogg on each card arrival (3x staggered), vol 0.70
Music: warm and building
Transition mood: soft slide → Scene 3
Beat-grid: card 1 at 6.00s, card 2 at 6.56s, card 3 at 7.09s (consecutive vol-12 beats)

### Scene 3 — Batch Drill-Down — 5.0s
**Background:** #f8fafc page bg with sidebar nav strip on left (navy #004282)
**Content:** Recreate a batch detail panel — simulate clicking into Rope Batch "5417":
- Header: breadcrumb Traceability > Rope Batches > Batch 5417, back arrow visible
- Batch ID badge: 5417 (navy pill, DM Mono)
- Status pill: Completed (green)
- Two info rows: Quantity: 1200 m / Created: 02 Sep 2025
- Parameters section header: QUALITY PARAMETERS with 2 parameter chips: Tensile Strength: 18 kN and Break Load: 22 kN
- Linked sources section: SOURCE YARN: 523 TA chip (blue)
Simulate cursor click: mouseclick1.ogg fires at t~0.3s into scene.
Sequential/interaction: yes — detail panel slides in from right, then parameter chips appear one by one (~0.4s each)
Audio intent: precise, methodical — something real is being shown
Audio-coupled idea: ui/mouseclick1.ogg at scene start (vol 0.60), then silent as parameters appear
Music: steady
Transition mood: crossfade → Scene 4
Beat-locked: 8.74s (strong cue — slide-in animation lands here)

### Scene 4 — Audit Trail — 3.5s
**Background:** Clean white / light surface
**Content:** Audit trail rows appear — simulating the immutable log:
- Section header: AUDIT TRAIL (small caps eyebrow, navy)
- Row 1: GitBranch icon · Batch Created · Rope Batch 5417 · 02 Sep 2025, 09:14 · System
- Row 2 (slides in 0.8s later): Status Updated · In Progress → Completed · 15 Sep 2025
Sequential/interaction: yes — two log rows arrive one by one, ~0.8s apart
Audio intent: calm, conclusive — the record is sealed
Audio-coupled idea: interface/drop_001.ogg on each row (very soft, vol 0.45) — or silent if edit is busy
Music: gentle steady bed
Transition mood: soft crossfade → Scene 5
Beat-locked: 13.11s (strong cue — first row arrives here)

### Scene 5 — Logo / Outro — 4.0s
**Background:** Deep navy #004282 (full bleed — bookend with Scene 1)
**Content:**
- Center: "Namah Trace" in white DM Sans 700, large
- Below: "by Namah Ropes" smaller, muted white
- Below that: tagline slides up: "Flat Yarn → Yarn Batch → Rope Batch. Fully traced."
Logo text scales in from 0.92 to 1.0 over 0.4s, then holds.
Tagline fades up at t~1.2s into scene.
Music fades out over the final 1.5s.
Sequential/interaction: none — one composed hold
Audio intent: resonant, final
Audio-coupled idea: impact/impactBell_heavy_000.ogg at logo settle (t~0.4s into scene), vol 0.80
Music: fades to 0 over last 1.5s
Transition mood: fade to black
Beat-locked: 17.47s (strong cue — logo hit lands here)

---

**Total duration:** 3.0 + 4.5 + 5.0 + 3.5 + 4.0 = 20.0 seconds (within 15-25s)

**Music mood for this video:** Warm and steady — corporate precision without aggression
**Audio summary:** Vol-12 enters softly under the hook type, builds through the dashboard reveal, stays steady through the drill-down and audit scenes, then fades out cleanly under the logo hold with a single resonant bell hit as the final punctuation.

## Music cue guidance
- Track: happy-beats-business-moves-vol-12-by-ende-dot-app.mp3 (109.96 BPM, bundled preset)
- Preset path: .agents/skills/brag/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json
- Strong cue locks (3 total):
  - 8.74s → Scene 3 slide-in (batch detail reveal) // beat-locked: 8.74s
  - 13.11s → Scene 4 first audit row // beat-locked: 13.11s
  - 17.47s → Scene 5 logo settle + bell hit // beat-locked: 17.47s
- Beat-grid: Scene 2 metric cards at 6.00s, 6.56s, 7.09s (consecutive beats, ~0.55s grid)
- Restraint: tone is polished — do not use more than 3 strong cue locks. Ignore cues that hurt card readability or force text off-screen too early.
