# Chain-impact performance — v23

Debris and dust previously doubled their InstancedMesh capacity whenever full. A rapid sequence of building impacts could allocate new GPU buffers repeatedly and simulate/upload tens of thousands of temporary pieces per frame.

The update keeps fixed reusable capacities (desktop 2,048 fragments / 192 dust sprites; mobile 1,536 / 128). Once full, new effects replace existing cosmetic particles. Spawns are capped at 320 desktop / 192 mobile fragments and 24 dust clouds per simulation frame. Building cuts, structural support evaluation, collapse sections and collision openings remain separate and unchanged. These limits affect temporary particles, not the building's damage state. Road chunks handle exhausted particle budgets safely.

Nearby-building preparation now selects eight candidates in one pass instead of allocating a record for every building and sorting the entire local list. A pre-existing undefined variable in cold top-impact debris emission was also corrected.

## Measurement

A Node simulation of 40 frames, eight 95-fragment bursts per frame (30,400 requested pieces), compared the pre-change destruction module against the updated module in the same process:

| Metric | Before | After |
| --- | ---: | ---: |
| Mean burst + update CPU time | 6.95 ms | 1.15 ms |
| P95 | 13.61 ms | 2.72 ms |
| Live cosmetic fragments | 30,400 | 2,048 |
| Fragment GPU-buffer capacity | 32,768 | 2,048 |
| Dust capacity | 768 | 192 |

This isolates particle work. It is not a rendered MacBook benchmark or a guarantee of total game FPS.

## Mega beam

HeatVision now passes its combat-state callback to the Titan beam. Outside combat, charge is unlimited and existing recharge clears. Combat still consumes three seconds of charge at 100 damage/second, followed by ten seconds of recharge. Active NPC combat counts regardless of opponent distance; nearby hero detection uses the Titan beam's full range. The HUD says UNLIMITED outside combat. Windup and slow aiming remain.

## Verification

- New stress test checks fixed buffer identities/capacities, per-frame limits, road debris and reset.
- Beam transition tests at 30/60/120 FPS check unlimited free-roam firing, entering combat, exact combat budget and leaving combat during cooldown.
- Titan powers, health/normal eye-beam, Titan aiming and asynchronous destruction scheduling checks pass.
- check-performance-work.mjs still fails its old 'beam holes open before queued collapse' assertion. Running that test against the unchanged pre-patch destruction module produces the identical failure; this patch does not claim to fix that separate issue.
- check-destruction.mjs also retains its prior synchronous-collapse assertion failure (expected 1, actual 0); reproduced with the unchanged pre-patch module. The async scheduling suite passes.
