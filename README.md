# Carbon Credit

[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green.svg)](package.json)

A local dashboard that estimates the electricity and carbon associated with
your own [Claude Code](https://claude.com/claude-code) usage, broken down per
day and per week, and expressed in units you can actually picture.

It reads the session transcripts Claude Code already writes to your machine.
Nothing is uploaded, and it needs no API key.

> **The one thing to understand before you use this.** The token counts are
> exact. The energy per token is **inferred from public sources**, because
> Anthropic publishes no per-token or per-query energy figures for any Claude
> model. So every figure is a **range**, never a single number, and it is not
> suitable for regulatory or compliance reporting. The app says so on every
> screen, and the `/methodology` page explains exactly how each number is
> produced.

---

## Why it exists

`/cost` tells you what the current session cost in money. Nothing tells you
what your accumulated usage cost in energy, and the naive answers are wrong in
both directions: summing every usage record in the transcripts double-counts
badly, and taking the first record undercounts.

This does the token accounting carefully, applies per-token energy
coefficients with an explicit uncertainty band, and then translates the result
out of kilowatt-hours into things people have intuitions about.

## Quick start

Requirements: **Node.js 20 or newer** and a machine that has run Claude Code
at least once.

```bash
git clone https://github.com/rahulsavaria/Carbon-credit.git
cd Carbon-credit
npm install
npm run dev          # http://localhost:3000
```

For a production build:

```bash
npm run build && npm run start
```

If your Claude Code data lives somewhere other than `~/.claude`, set
`CLAUDE_CONFIG_DIR`:

```bash
CLAUDE_CONFIG_DIR=/path/to/.claude npm run start
```

## What you get

- **A plain-English headline.** "Everything you have asked Claude Code to do
  on this machine has used about as much electricity as running a 10 W LED
  bulb for 16 days to 7.9 months."
- **Per-day and per-week charts** showing the full uncertainty band, not a
  single line pretending to precision.
- **A unit switch.** Show energy as LED bulb hours, ceiling fan hours, air
  conditioner hours, phone charges, or raw kWh. It changes the headline, the
  chart axes, the tooltips and the tables together.
- **Carbon as distance driven**, because kilograms of CO2 equivalent are even
  harder to picture than kilowatt-hours.
- **Breakdowns** per project and per model, and a share bar showing which
  token class the energy actually goes to.
- **A methodology page** at `/methodology` documenting every step, with a
  worked example computed from the same constants the dashboard uses.

## The finding most people do not expect

In agentic coding, **cache reads dominate the token count and output is a tiny
fraction of it**. Output tokens carry roughly a hundred times the per-token
energy cost, but there are so few of them that cache reads still usually win
on total energy.

So the lever that reduces your footprint is **not asking for shorter
answers**. It is tighter context, better cache hygiene, fewer redundant tool
round-trips, and using a smaller model for routine turns.

The dashboard shows you the actual split rather than asserting this, because
the balance shifts with how you work.

## How the numbers are produced

Full detail lives at `/methodology` in the running app. In short:

### Where the data comes from

Claude Code writes one JSONL transcript per session:

```
~/.claude/projects/<encoded-project-path>/<session-id>.jsonl
```

Assistant messages carry a `usage` object with four token counts:
`input_tokens`, `output_tokens`, `cache_creation_input_tokens` and
`cache_read_input_tokens`. Those four fields are the entire factual basis of
this app.

### Two parsing pitfalls, both handled

1. **A single API call writes many usage objects**, and `output_tokens` is a
   mid-stream snapshot rather than a final count. Accounting keys on
   `requestId` and keeps the **maximum** per token class. Summing every line
   overcounts severely; taking the first undercounts.
2. **The same request can appear in two files.** Resuming or forking a session
   copies earlier messages into a new transcript, so deduplication is
   **global across all files**, not per file.

Output is still undercounted regardless: the final `message_stop` event is
never written to the transcript
([anthropics/claude-code#27361](https://github.com/anthropics/claude-code/issues/27361)),
so real output may be about 2x what the JSONL shows. Input and cache counts
are unaffected, being fixed at request start. Use the **output scale** control
for the compensated view.

### The coefficients

Joules per token, as low / mid / high. **This four-row table in
`lib/constants.ts` is the only thing to change** if Anthropic ever publishes
real figures.

| token class | low | mid | high |
|---|---|---|---|
| output | 1.0 | 4.0 | 15.0 |
| input | 0.10 | 0.40 | 1.50 |
| cache_creation | 0.10 | 0.40 | 1.50 |
| cache_read | 0.01 | 0.04 | 0.15 |

The four classes are separated because they differ in energy cost by up to a
hundredfold. Output is sequential decode and is the expensive part. Input is
prefill, processed in parallel, so roughly an order of magnitude cheaper per
token. Cache reads skip most of that work again.

The magnitudes are anchored on two independent routes that agree:

- Google's published methodology (August 2025) puts a median Gemini text
  prompt at about 0.24 Wh, which implies low single-digit joules per output
  token.
- Serving-hardware arithmetic: an 8-GPU node draws roughly 5 to 6 kW and,
  batched, emits on the order of 10³ tokens per second, times a facility
  power overhead of about 1.1 to 1.2.

A widely-repeated third-party estimate for Claude 3 Opus of about 4.05 Wh per
query implies considerably more. It is not company-disclosed and its
methodology is opaque, so it informs the **top of the high band** rather than
the centre.

### Why the band is wide

The low-to-high spread is roughly fifteenfold, and that is honest. It reflects
the model that served each request, batch size and hardware utilisation at
that moment, the accelerator generation, facility power overhead, and how much
inference optimisation was in play. None of that is knowable from a
transcript.

It is a **plausible-range bracket, not a statistical confidence interval**.
The mid is not "most likely" in any formal sense, and low and high are not
percentiles.

### Conversions and settings

Joules to kWh: divide by 3,600,000. kWh to grams CO2e: multiply by a grid
intensity factor.

| Setting | What it does |
|---|---|
| **Show energy as** | switches the display unit everywhere at once |
| **Grid gCO2e/kWh** | carbon intensity; default 450, a rough global mean |
| **Output scale** | multiplier on output tokens only; default 1x |
| **Days shown** | length of the daily series |
| **Model contains** | substring filter on the model name |
| **Theme** | light, dark, or follow the system |

Every setting is a query parameter, so any view is a shareable URL.

**The grid factor should be the datacenter's, not yours.** The transcripts do
not record which region served each request, so setting your own country's
factor answers a different question: "what if this had run on my grid". The
carbon row is the most uncertain output here, because it multiplies an
inferred energy figure by a grid factor for an unknown region.

### Days are bucketed in local time

Not UTC. A UTC day boundary cuts the working day in half everywhere outside
Europe and Africa. The header states the timezone in use. Weeks are ISO-8601,
starting Monday.

## What is excluded

Inference only. It does **not** include model training, hardware
manufacturing or embodied carbon, cooling water, your own device's
electricity, or network transport.

## Privacy

- Everything runs locally. The app makes no outbound requests.
- It binds to `localhost` by default.
- Your transcripts are read, never copied, modified or transmitted.
- There is nothing to log in to and no API key to supply.

Your transcripts contain your prompts and your code. If you expose this app on
a network interface, anyone who can reach it can see your project names, token
volumes and activity pattern. Keep it on localhost unless you have a reason
not to.

## Routes

| path | purpose |
|---|---|
| `/` | the dashboard |
| `/methodology` | how every number is produced |
| `/api/summary` | the same aggregate as JSON, for your own arithmetic |

## Verification

The aggregation was cross-checked against an independent second
implementation, written in Python against the same transcripts. Both agree
exactly on request count, all four token classes and all three energy bands,
including under varied grid and output-scale settings and with a model filter
applied.

That cross-check earned its keep: it caught a per-file deduplication error and
a query-parameter bug that silently understated output energy tenfold and
reported carbon as zero. If you change the accounting, check it against
`/api/summary` and redo the arithmetic by hand.

## Accessibility

- Charts carry text alternatives, and every chart is backed by a table
  containing the exact figures.
- Series identity never depends on colour alone; percentages and labels are
  printed.
- The colour ramps were validated for lightness, chroma and contrast against
  both the light and dark surfaces rather than chosen by eye.
- Light and dark are both deliberate palettes, not an automatic inversion.
- Numeric columns use tabular figures so they align for scanning.

## Contributing

Issues and pull requests are welcome. Two things to know:

1. **Do not attach your transcripts** to an issue. They contain your prompts
   and your code. Describe the shape of the problem instead, or attach the
   relevant part of `/api/summary` with anything sensitive removed.
2. **If you change the coefficients**, update the table in `lib/constants.ts`,
   say what evidence moved them, and keep the band. Narrowing the uncertainty
   requires better evidence, not better presentation.

Useful commands:

```bash
npm run build     # production build
npm run lint      # eslint
npx tsc --noEmit  # typecheck
```

## Stack

Next.js with the App Router, React and TypeScript. No CSS framework and no
charting library: the charts are hand-written SVG, so there is nothing to keep
up to date. The only runtime dependencies are Next, React and React DOM.

## Licence

MIT. See [LICENSE](LICENSE).

## A note on what this is for

This is a tool for understanding the rough scale and, more usefully, the
*shape* of your own AI usage: which token class the energy goes to, and which
of your habits actually moves it. The absolute numbers carry real uncertainty.
The ratios are far more robust, because they survive every coefficient being
wrong by the same factor.

If you need a defensible footprint figure for reporting, this is not that
tool, and honestly no tool can be one until the providers publish real
per-token energy data.
