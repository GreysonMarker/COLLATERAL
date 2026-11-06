# Titan powers

Monolith is tagged `combatClass: 'titan'`. The shared power controllers use that tag (and recognize Monolith for legacy/network IDs). Player, training NPC and replicated poses share the new attack definitions.

- Leap replaces jump/flight: 0.55 s crouch, 2.5 s travel, 180 m horizontal range, 38 m apex, 10 s cooldown from activation. Uses undamaged ground and arena confinement; scenery cannot stop him. No powered flight, hovering, flight recovery, or flight clash participation.
- Each punch input starts a heavy strike with a shared 3.2 s cooldown, 1.25 s windup and 2.6 s total animation. An opponent below the waist selects a low forward kick; otherwise an articulated fist aims toward them. Aim turns at up to 1.5 rad/s early and 0.35 rad/s late, and stops tracking on release. Movement is planted during attacks.
- Heavy attacks deal 200 damage (the final double-damage request applied to both kick and punch). Reach is 337.5 m, initial radius 26.25 m, widening to 56.25 m: 2.5 times the ordinary serious-punch cone. The pressure wave releases at extension. Targets are hit once, held for 0.16 s, then launched with the serious hero launch / full-flight-clash magnitude. Titan receivers retain their dedicated sectional reactions.
- Hand beam: 1.2 s raise/charge, 10.5 m radius, 337.5 m maximum length, 0.32 rad/s aiming limit, 100 damage/s, 3 s firing budget, 10 s recharge. Releasing interrupts the channel. Blue layered core, charging orb and 160 reusable particle slots. One widened building cut per 0.1 s; no five-laser approximation. Terrain clips the beam centerline. Replica beam effects are visual-only.
- All ordinary hero flight, punches, lasers and damage stay on their previous paths. Block/parry rules remain in effect.

Validation: `node check-titan-powers.mjs` covers multi-rate leap endpoints, cooldown, aiming limits, kick selection, attack exclusivity, damage deduplication, delayed launch, beam budget, NPC flight exclusion, finite poses, and network metadata. Existing combat, health, AI, momentum, training, multiplayer, network, terrain, titan-reaction and sole-plant checks pass. Offscreen renders inspect actual game geometry for kick, punch and raised-hand poses. Full interactive gameplay/performance has not been verified on the user's devices.

Known baseline test issues: `check-punches.mjs` normal-building-collapse assertion and `check-heat.mjs` imported heat-tunnel assertion fail identically on pre-change commit b63db16. These destruction fixtures were not changed to hide the failures.
