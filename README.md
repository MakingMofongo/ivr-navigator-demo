# IVR Navigator

An outbound voice agent that **calls insurer support lines, navigates their IVR
phone trees, tells a recorded menu apart from a live human, rides out hold
queues, answers the rep's verification questions, and bridges the call to your
staff** — firing a desktop alert the moment a real person is on the line.

> **Live demo:** https://makingmofongo.github.io/ivr-navigator-demo/

![IVR Navigator running a full call](docs/demo.gif)

*Full run (2× speed): dial → navigate a 4-step menu tree → ride out the hold
queue → detect the moment a live rep picks up → answer verification questions
from the case file → bridge to staff + desktop alert.*

This repo is a working demo of the navigation + detection logic. The telephony
layer is **simulated** (no real calls are placed), but every decision you watch —
which key to press, whether the far end is a menu/hold/human, how to answer a
verification question, when to bridge — is made by real, unit-tested code.

---

## What's actually working (not faked)

| Capability | Where | Real? |
|---|---|---|
| IVR menu navigation toward a goal | `src/engine/agent.ts` → `chooseOption()` | ✅ intent matching, returns full ranking |
| Live-human vs recording vs hold detection | `src/engine/detector.ts` → `detect()` | ✅ explainable feature scorer |
| Hold-queue recovery (no premature hang-up) | `src/engine/engine.ts` | ✅ rides out multi-stage holds |
| Answering rep questions from a case file | `src/engine/agent.ts` → `answerSlot()` | ✅ slot filling |
| Bridge to staff + **real push** + desktop alert | `CallConsole.tsx` | ✅ real ntfy.sh push + `Notification` API |
| Placing the actual phone call / audio | — | ❌ simulated (see below) |

The logic runs entirely client-side and is covered by **16 unit tests**
(`npm test`) that assert the agent navigates every scenario correctly, the
detector classifies menus/holds/humans, and a full call reaches the bridge.

**The bridge push is genuinely real.** When the call connects your staff, the app
POSTs to a free [ntfy.sh](https://ntfy.sh) topic — subscribe at
**https://ntfy.sh/ivr-nav-demo-rasheed-7f3a** (web or the phone app) and you'll
watch the notification land on your own device the moment the demo bridges. No
account or credentials required.

---

## The hard part: telling a human from a recording

The detector takes a transcript chunk (what you'd get from Deepgram/ASR on the
call audio) and scores it across `menu` / `hold` / `human` using weighted,
explainable features:

- **menu** — "press 1", "for claims, press…", "options have recently changed"
- **hold** — "all our representatives are busy", "estimated wait time", "please
  stay on the line"
- **human** — "thanks for calling, this is Carla", "how can I help you",
  "can I get your member ID", natural disfluencies ("one sec, let me pull that up")

Every classification exposes the exact phrases that drove it and a confidence,
so it's auditable rather than a black box. It's the rule-based bootstrap layer
you ship before you have enough labelled call audio to train an ML model — and
the agent treats `detect()` as a swappable interface, so a model drops in behind
it later without touching the navigation code.

---

## Three scenarios

1. **Meridian Health** — check a claim status (4-step menu → hold → rep verifies
   member ID + DOB → bridge).
2. **BlueStar Insurance** — confirm a prior authorization, with a **two-stage
   hold** (high-volume bounce, then the real queue) that the agent does *not*
   treat as a dead end.
3. **Allied Mutual Auto** — rental-coverage question on an auto claim (different
   vertical, different tree).

---

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 16 engine unit tests
npm run build    # static export to ./out
```

Stack: **Next.js 14 (App Router) · React · TypeScript**, no UI dependencies.
Deployed as a static export to GitHub Pages via the workflow in
`.github/workflows/deploy.yml`.

---

## Making it place real calls

Everything except the telephony is built. To go live you'd wire the engine to:

- **Twilio** — a SID + auth token and a voice-capable number to place the
  outbound call and stream audio (Media Streams).
- **Bland AI** (or **Deepgram + an LLM**) — speech-to-text/text-to-speech and
  turn-taking; `detect()` and the agent sit on top as the decision engine.

The `detect()` / `chooseOption()` / `answerSlot()` functions are pure and
side-effect free, so they plug straight into a live audio pipeline — the call
loop in `engine.ts` is the same shape you'd drive from Twilio webhooks.

---

*Built as a working proof-of-concept. Honest about what's simulated; the logic
that matters is real and tested.*
