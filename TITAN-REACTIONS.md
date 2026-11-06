# Monolith regional impact system

Build: titan-head-stagger-v18.

The marked reference is partitioned into 53 full-surface regions: 28 front and 25 back. All visible geometry is eligible, including the unmarked space between anchors. Arm and leg anchors follow their joints; head anchors follow the head. The front includes three facial regions, paired collar/shoulder/upper-arm/forearm-hand/chest/rib/abdomen/waist/thigh/knee/shin-foot regions, central chest, waist and pelvis. The back substitutes scapula and lower-back regions, a continuous central spine, and central waist.

Each region has five directional variants (265 combinations), selected in Monolith's local frame from the incoming strike direction. They are procedural, authored pose profiles with contact, delayed body loading, counterbalance, and recovery phases—not imported animation clips. Normal hits use 27% of the serious reaction amplitude, quick hits 13%. Regular normal reactions last .72 seconds, quick .48 seconds, serious 1.35 seconds. Body parts lag the contact rather than rotating simultaneously. Successive reactions crossfade over .12 seconds.

## Contact selection

Visible Monolith meshes are raycast first, using the punch centerline. The nearest intersected surface is the direct contact. When the centerline misses, actual triangle contacts inside the widening punch volume are ranked by their perpendicular miss divided by the local punch width. The nearest anatomical region to that surface point wins. Only one region and one damage event are emitted per attack ID. A travelling serious wave retains the selected contact until reaching that distance, avoiding repeated mesh searches and zone hopping. Cache entries expire after ten seconds or on reset.

## Controlled exceptions

Serious head hits trigger a planted step and hand-to-head stun. Close, direct central chest/spine hits retain their heavier recovery. Ordinary hero serious-punch displacement against Monolith is doubled; ordinary victims and titan attackers retain their earlier knockback.

| Contact | Maximum range | Displacement | Recovery |
|---|---:|---:|---:|
| Any front/back head region | Any confirmed head hit | 28 m | 1.8 s |
| Central chest or spine (direct) | 10 m | 20 m | 2.8 s |

The trajectory is horizontal along the incoming strike direction, eased over .85 seconds for the planted head stagger, or .75 seconds for the central-body recovery. Head hits never lift the feet or activate ragdoll; the appropriate hand follows the head with inverse kinematics. It is clamped by the arena boundary. No generic launch impulse, momentum multiplier, ragdoll, or tumbling is applied. Ordinary hits cannot interrupt or restart an active special recovery; damage still applies. Inputs cannot bypass the recovery by jumping or entering flight. Other heroes retain their current launch/recovery rules. Titan-vs-titan balance remains future work.

## Integration and verification

Player, training character and remote replicas share the same region resolver and pose evaluator. Front/back geometry is used for punch, heat and ram contacts. Ordinary grab/tackle attempts are rejected for Monolith. His independent movement path remains in effect and uses undamaged base ground, including for the training character. Grounded reaction soles are planted without moving the physics root; the small special lift is intentionally visual.

Network combat events carry the surface contact; movement snapshots carry reaction timing as a top-level field, including through the compact peer codec. The room service accepts all three concept character IDs. Existing clients must refresh to receive new modules.

Run `node check-titan-reactions.mjs` for region/direction coverage, real geometry targeting, range boundaries, single-hit behavior, 30/60/144 Hz fixed displacement, reaction interruption, wire/compact transport, ragdoll exclusion and sole placement. Related regressions cover combat, momentum, training characters, titan scenery immunity, movement, feet, grabs, rooms and network motion. The hand-to-head stagger was rendered from the real rig for inspection; live browser gameplay tuning remains a separate verification step.
