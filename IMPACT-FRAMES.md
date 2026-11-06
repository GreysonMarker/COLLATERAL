# Monolith impact treatment — v19

## Reading the references

The first recording stretches the contact through a torso impact, facial strain and a wide shot before release. The fist is already connected, but the victim has not yet travelled: this separates **damage/contact** from **momentum/release**. Pressure rings and debris become the release cue. The dramatic pause is partly editing; reproducing its full multi-second duration in interactive combat would feel unresponsive.

The second recording uses extremely short graphic substitutions: dark silhouettes against white, negative silhouettes against black, red inserts, sharply directed wedges and fractures. The shape of the victim remains legible while background detail drops away. Its repeated edit/player overlay is not evidence of a sustained in-world hit pause.

The game adaptation uses one contact exposure, a stable graphic hold, then release. It deliberately does not alternate full-screen black and white rapidly. Twelve authored procedural compositions vary topology, contrast, palette and hold length; they are not twelve particle-color swaps. The actual victim is rendered into a silhouette mask, so poses, character choices and camera angles remain correct.

## Strike sequence

- Damage resolves once at contact: still 200 for a Titan strike.
- A confirmed unblocked hit holds the victim in place and adds a direction-aware compressed torso/head/arm pose. Airborne knees bend; the root does not move.
- The attacking Titan holds the extended attack pose. Whiffs and locally resolved blocks/parries do not trigger that hold.
- Holds range from 0.31 to 0.44 seconds. At release, the stored launch velocity is applied, the pressure ring expands and the heavy sound lands.
- Graphic release trails fade over 0.32 seconds. The world is not globally paused.
- The existing collision-strength launch distance is unchanged; the separate v18 doubling applies only to ordinary heroes' serious punches hitting Monolith.

| Composition | Hold | Graphic structure |
| --- | ---: | --- |
| Whiteout fracture | 0.32 s | Pale field, dark angular fractures |
| Black sun | 0.38 s | Negative silhouette, pressure disc |
| Crimson cross | 0.34 s | Cross-shaped contact slash |
| Cyan pressure | 0.36 s | Cyan wave rings |
| Split lightning | 0.31 s | Jagged diagonal split |
| Concentric crush | 0.40 s | Dense concentric compression |
| Diagonal shear | 0.33 s | Parallel slanted cuts |
| Ink eruption | 0.37 s | Irregular radial wedges |
| Gold compression | 0.42 s | Narrow gold pressure band |
| Broken halo | 0.35 s | Fragmented angular halo |
| Scarlet fault | 0.39 s | Paired red fault lines |
| Terminal star | 0.44 s | Broad starburst and outer ring |

## Sustained laser

Actual unblocked beam hits refresh one continuous blue/white treatment. Damage ticks do not restart its age. It persists through a full three-second contact and fades within 0.24 seconds after the last hit. The white victim silhouette, directional blue energy band and slow electric edges replace strike-style flash/release beats. Laser damage, charge, cooldown and steering are unchanged. Parried/blocked beams do not create the hit treatment.

## Cost and networking

Only active, on-screen contacts use the compositor. The inactive path adds zero rendering passes. Active effects use one scene render, one victim-only mask and one full-screen composition, replacing the regular bloom chain. Reused RGBA8 targets are capped at 1440 pixels on their longest desktop side and 900 on mobile. Shadow rendering is disabled for the mask. Geometry, textures and materials are reused. HUD stays readable outside the WebGL canvas. Reduced-motion preference cuts effect strength to 28% and the camera is not snapped or spun.

Strike variants travel with combat packets; confirmed strike/beam events replicate the visual treatment. Multiplayer recipient authority still determines damage and launch. Remote attacker animation timing can differ by network latency; there is no global synchronized time freeze.

## Validation and limits

- 12 profiles, each checked for exactly one damage event and delayed launch at 30/60/144 FPS.
- Laser timeline remains continuous for three seconds and clears after contact loss/reset.
- Renderer state restoration tested on success and render exceptions; inactive path renders no extra passes.
- Production fragment shader compiled and all 13 compositions rendered through EGL with the game's actual hero mesh and silhouette mask.
- Titan powers, head stagger, 53 regional reactions, combat/momentum, AI, health, multiplayer/codec, ordinary character physics and Titan planted-foot checks passed.
- Live browser execution was unavailable in this environment. These are offscreen shader and simulation checks, not a MacBook frame-time benchmark. In-fight feel and performance still need device feedback.
