import Link from "next/link";
import type { Metadata } from "next";

import {
  COEFFICIENTS_J,
  GRID_REFERENCE,
  TOKEN_CLASSES,
  energyKwh,
  zeroTokens,
} from "@/lib/constants";
import { ANCHORS, countFor, fmtCount } from "@/lib/anchors";
import { CO2_ANCHOR_BASIS, CO2_PER_KM_KG, ENERGY_UNITS } from "@/lib/units";
import { getSummary } from "@/lib/cache";
import { fmtInt, fmtKwh, fmtTokens } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Methodology · Carbon Credit",
  description:
    "How the electricity and carbon estimates are calculated: token accounting, the low/mid/high coefficient bands and their sources, the grid factor, the output scale, and what is excluded.",
};

/**
 * The worked example is computed at render time from the SAME coefficient
 * table the dashboard uses. Hardcoding the arithmetic here would let the
 * documentation drift away from the code, which is the usual way a
 * methodology page becomes a lie.
 */
const EXAMPLE = { output: 1200, input: 5, cache_creation: 12000, cache_read: 320000 };

function j(n: number, band: 0 | 1 | 2, k: keyof typeof COEFFICIENTS_J) {
  return n * COEFFICIENTS_J[k][band];
}

const SECTIONS: [string, string][] = [
  ["data", "Where the numbers come from"],
  ["accounting", "How tokens are counted"],
  ["model", "Why the four classes differ"],
  ["bands", "The low, mid and high bands"],
  ["sources", "Where the coefficients come from"],
  ["spread", "What the band means"],
  ["worked", "A worked example"],
  ["grid", "The grid setting"],
  ["scale", "The output scale setting"],
  ["buckets", "Days, weeks and timezones"],
  ["anchors", "Everyday equivalents"],
  ["excluded", "What is excluded"],
  ["verify", "How to check this yourself"],
  ["revise", "Revising the coefficients"],
];

/** Hours restated as a span a person can picture. */
function asSpan(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours`;
  const days = hours / 24;
  if (days < 60) return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
  const months = days / 30.44;
  return `${months < 10 ? months.toFixed(1) : Math.round(months)} months`;
}

export default async function Methodology() {
  const live = await getSummary({ grid: 450, outputScale: 1, days: 30 });
  const real = "error" in live ? null : live;
  const ex = { ...zeroTokens(), ...EXAMPLE };
  const exKwh = energyKwh(ex, 1);
  const bulb = ANCHORS[0];

  return (
    <main className="shell">
      <Link className="crumb" href="/">
        ← Back to the dashboard
      </Link>
      <h1>Methodology</h1>
      <p className="meta">
        How the figures on this dashboard are produced, what each setting
        changes, and which parts are measured rather than inferred.
      </p>

      <div className="banner" style={{ borderLeftColor: "var(--accent-rule)" }}>
        <b>The one thing to understand.</b> The token counts are exact: they
        are read from session transcripts on this machine. The energy per token
        is <b>inferred from public sources</b>, because Anthropic publishes no
        per-token or per-query energy figures for any Claude model. Those two
        halves have very different standing, and the whole design of this tool
        exists to keep them visibly separate.
      </div>

      <nav className="toc">
        <span className="lab">On this page</span>
        <ol>
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`}>{title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="doc">
        <h3 id="data">1. Where the numbers come from</h3>
        <p>
          Claude Code writes one JSONL transcript per session. Each line is a
          message, and assistant messages carry a <code>usage</code> object
          with four token counts.
        </p>
        <pre>{`~/.claude/projects/<encoded-project-path>/<session-id>.jsonl

{"requestId": "req_...", "timestamp": "2026-09-08T13:04:11.512Z",
 "message": {"model": "claude-opus-5",
   "usage": {"input_tokens": 5,
             "output_tokens": 1200,
             "cache_creation_input_tokens": 12000,
             "cache_read_input_tokens": 320000}}}`}</pre>
        <p>
          Those four fields are the entire factual basis of this dashboard.
          Nothing is estimated at this stage and nothing leaves the machine.
          The <code>/cost</code> command covers only the current session, so
          for anything historical the transcripts are the only source of truth.
        </p>

        <h3 id="accounting">2. How tokens are counted</h3>
        <p>
          Two properties of these transcripts will produce badly wrong numbers
          if you read them naively. Both are handled.
        </p>
        <h4>A single API call writes many usage objects</h4>
        <p>
          Claude Code logs <code>usage</code> on many lines of one call, and{" "}
          <code>output_tokens</code> is a mid-stream snapshot rather than a
          final count. Accounting therefore keys on <code>requestId</code> and
          keeps the <b>maximum</b> value seen per token class. Summing every
          line would overcount severely; taking the first would undercount.
        </p>
        <h4>The same request can appear in two files</h4>
        <p>
          Resuming or forking a session copies earlier messages into a new
          transcript. Deduplication is therefore <b>global across all files</b>,
          not per file. Folding per file inflated the request count in an
          earlier version of this tool, which is how the problem was found.
        </p>
        <p>
          The result is exactly one row per API request, holding the highest
          value observed for each of the four classes.
        </p>

        <h3 id="model">3. Why the four classes differ</h3>
        <p>
          The four classes are priced separately here because they differ in
          energy cost by up to a hundredfold. Treating all tokens as equivalent
          would make the output meaningless.
        </p>
        <ul>
          <li>
            <b>Output, or decode.</b> Generated one token at a time. Each token
            needs a full forward pass, and the sequential dependency limits how
            far that work can be shared across a batch. This is the expensive
            part.
          </li>
          <li>
            <b>Input, or prefill.</b> The prompt is processed in parallel across
            its whole length, so the hardware runs near peak utilisation and
            the per-token cost lands roughly an order of magnitude below decode.
          </li>
          <li>
            <b>Cache creation.</b> Prefill, plus writing the key-value cache
            out. Modelled alongside input.
          </li>
          <li>
            <b>Cache read.</b> Skips most of the prefill compute, since the
            cached state is read back rather than recomputed. Roughly another
            order of magnitude cheaper again.
          </li>
        </ul>

        <h3 id="bands">4. The low, mid and high bands</h3>
        <p>
          There is no single defensible number, so three assumptions are
          carried instead. Joules per token:
        </p>
      </div>

      <div className="tablewrap doc wide">
        <table>
          <caption className="sr">
            Energy coefficients in joules per token, by band
          </caption>
          <thead>
            <tr>
              <th scope="col">Token class</th>
              <th scope="col">low</th>
              <th scope="col">mid</th>
              <th scope="col">high</th>
              <th scope="col">Ratio to cache read</th>
            </tr>
          </thead>
          <tbody>
            {TOKEN_CLASSES.map((k) => (
              <tr key={k}>
                <td className="name">{k.replace("_", " ")}</td>
                <td>{COEFFICIENTS_J[k][0]}</td>
                <td>{COEFFICIENTS_J[k][1]}</td>
                <td>{COEFFICIENTS_J[k][2]}</td>
                <td>
                  {Math.round(
                    COEFFICIENTS_J[k][1] / COEFFICIENTS_J.cache_read[1],
                  )}
                  ×
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="doc">
        <ul>
          <li>
            <b>Low</b> assumes efficient serving: large batches, high hardware
            utilisation, a recent accelerator generation, a well-run facility.
          </li>
          <li>
            <b>Mid</b> is the best-supported central estimate, anchored on the
            one piece of first-party published methodology that exists.
          </li>
          <li>
            <b>High</b> is pessimistic, and is pulled upward by a third-party
            figure whose methodology is not public.
          </li>
        </ul>

        <h3 id="sources">5. Where the coefficients come from</h3>
        <ol>
          <li>
            <b>Google&rsquo;s published methodology, August 2025.</b> It puts a
            median Gemini text prompt at about 0.24 Wh, which is roughly 864
            joules. If a median response is a few hundred output tokens, that
            implies <b>low single-digit joules per output token</b> once the
            prefill share is set aside. This is the best first-party,
            methodology-backed evidence available for any production model,
            which is why it anchors the mid band.
          </li>
          <li>
            <b>Independent arithmetic from serving hardware agrees.</b> An
            8-GPU inference node draws roughly 5 to 6 kW. With realistic
            batching it emits on the order of 10³ tokens per second in
            aggregate. That lands at low single-digit joules per token, then
            multiplied by a facility power overhead of about 1.1 to 1.2 to
            cover cooling and distribution. Two independent routes reaching the
            same order of magnitude is the main reason to trust it at all.
          </li>
          <li>
            <b>A widely-repeated third-party estimate for Claude 3 Opus</b> of
            about 4.05 Wh per query implies considerably more energy than
            either route above. It is <b>not company-disclosed</b> and its
            methodology is opaque, so it informs the <b>top of the high band</b>{" "}
            rather than the centre. It is the reason the high coefficient for
            output sits as far out as 15 J.
          </li>
          <li>
            <b>Opus-class models are larger</b> than the Gemini model Google
            measured. Parameter count drives per-token computation, so the mid
            value is set deliberately above the Gemini-implied figure rather
            than equal to it.
          </li>
          <li>
            <b>The ratios between classes track Anthropic&rsquo;s own relative
            pricing</b> of the four token types. Price is not cost, and margin
            structure is not published either, but relative price is a crude
            proxy for relative served compute and a useful check that the
            tenfold and hundredfold steps are not invented.
          </li>
        </ol>

        <h3 id="spread">6. What the band means</h3>
        <p>
          The spread from low to high is about fifteenfold. That is honest
          rather than careless. It reflects unknowns that no amount of
          arithmetic closes:
        </p>
        <ul>
          <li>which model served each request, and how large it is</li>
          <li>batch size and hardware utilisation at that moment</li>
          <li>the accelerator generation in the serving fleet</li>
          <li>facility power overhead in the specific region</li>
          <li>
            how much quantisation, speculative decoding or other inference
            optimisation was in play
          </li>
        </ul>
        <div className="callout">
          <b>This is a plausible-range bracket, not a statistical confidence
          interval.</b> There is no probability distribution behind it, so the
          mid is not &ldquo;most likely&rdquo; in any formal sense and low and
          high are not percentiles. Read it as: the honest answer sits somewhere
          in here, and any single figure overstates what is known. The
          uncertainty is about the serving hardware, not about you: your usage
          is identical in all three rows.
        </div>

        <h3 id="worked">7. A worked example</h3>
        <p>
          One realistic agentic turn: {EXAMPLE.output.toLocaleString("en-GB")}{" "}
          output tokens, {EXAMPLE.input} input,{" "}
          {EXAMPLE.cache_creation.toLocaleString("en-GB")} cache creation and{" "}
          {EXAMPLE.cache_read.toLocaleString("en-GB")} cache read. Every number
          below is computed from the table in section 4 as this page renders,
          so it cannot drift from the code.
        </p>
        <pre>{`low band, joules
  output          ${EXAMPLE.output.toLocaleString("en-GB")} × ${COEFFICIENTS_J.output[0]}    = ${j(EXAMPLE.output, 0, "output").toLocaleString("en-GB")}
  input               ${EXAMPLE.input} × ${COEFFICIENTS_J.input[0]}   = ${j(EXAMPLE.input, 0, "input")}
  cache_creation ${EXAMPLE.cache_creation.toLocaleString("en-GB")} × ${COEFFICIENTS_J.cache_creation[0]}   = ${j(EXAMPLE.cache_creation, 0, "cache_creation").toLocaleString("en-GB")}
  cache_read    ${EXAMPLE.cache_read.toLocaleString("en-GB")} × ${COEFFICIENTS_J.cache_read[0]}  = ${j(EXAMPLE.cache_read, 0, "cache_read").toLocaleString("en-GB")}
                                 ---------
  total                          ${(
    j(EXAMPLE.output, 0, "output") +
    j(EXAMPLE.input, 0, "input") +
    j(EXAMPLE.cache_creation, 0, "cache_creation") +
    j(EXAMPLE.cache_read, 0, "cache_read")
  ).toLocaleString("en-GB")} J

joules to kWh:  divide by 3,600,000
  low   ${exKwh.low.toFixed(6)} kWh  = ${(exKwh.low * 1000).toFixed(2)} Wh
  mid   ${exKwh.mid.toFixed(6)} kWh  = ${(exKwh.mid * 1000).toFixed(2)} Wh
  high  ${exKwh.high.toFixed(6)} kWh  = ${(exKwh.high * 1000).toFixed(2)} Wh

kWh to grams CO2e:  multiply by the grid factor, divide by 1,000
  at 450 gCO2e/kWh   ${(exKwh.low * 450).toFixed(2)} – ${(exKwh.high * 450).toFixed(2)} g

in everyday terms
  a 10 W LED bulb for ${fmtCount(countFor(exKwh.low, bulb), bulb)} – ${fmtCount(countFor(exKwh.high, bulb), bulb)} hours`}</pre>
        <p>
          Note what that example shows: output is{" "}
          {(
            (100 * EXAMPLE.output) /
            (EXAMPLE.output +
              EXAMPLE.input +
              EXAMPLE.cache_creation +
              EXAMPLE.cache_read)
          ).toFixed(1)}
          % of the tokens but{" "}
          {(
            (100 * j(EXAMPLE.output, 1, "output")) /
            (j(EXAMPLE.output, 1, "output") +
              j(EXAMPLE.input, 1, "input") +
              j(EXAMPLE.cache_creation, 1, "cache_creation") +
              j(EXAMPLE.cache_read, 1, "cache_read"))
          ).toFixed(0)}
          % of the mid-band energy, while cache reads are the bulk of both
          counts. This is why shorter answers barely move the total, and why
          tighter context and better cache hygiene do.
        </p>

        {real && (
          <>
            <h4>The same steps applied to your usage so far</h4>
            <div className="callout">
              <p style={{ margin: "0 0 10px" }}>
                That single turn is one of{" "}
                <b>{fmtInt(real.requests)} requests</b> recorded on this
                machine, across {real.transcripts} transcripts and{" "}
                <b>{fmtTokens(real.allTime.totalTokens)} tokens</b>. Run
                through exactly the arithmetic above, the total to date is{" "}
                <b>
                  {fmtKwh(real.allTime.kwh.low)}–
                  {fmtKwh(real.allTime.kwh.high)} kWh
                </b>
                .
              </p>
              <p style={{ margin: "0 0 10px" }}>
                In bulb terms, that is a <b>10 W LED bulb</b> left burning for{" "}
                <b>
                  {fmtCount(countFor(real.allTime.kwh.low, bulb), bulb)}–
                  {fmtCount(countFor(real.allTime.kwh.high, bulb), bulb)} hours
                </b>
                , or continuously for{" "}
                <b>
                  {asSpan(countFor(real.allTime.kwh.low, bulb))} to{" "}
                  {asSpan(countFor(real.allTime.kwh.high, bulb))}
                </b>
                . On a 60 W filament bulb the same energy lasts{" "}
                <b>
                  {asSpan(countFor(real.allTime.kwh.low, ANCHORS[1]))} to{" "}
                  {asSpan(countFor(real.allTime.kwh.high, ANCHORS[1]))}
                </b>
                , because it draws six times the power for the same light.
              </p>
              <p style={{ margin: 0 }}>
                Averaged over those requests, one request is about{" "}
                <b>
                  {((real.allTime.kwh.low * 1000) / real.requests).toFixed(1)}–
                  {((real.allTime.kwh.high * 1000) / real.requests).toFixed(1)}{" "}
                  Wh
                </b>
                , which is the bulb for roughly{" "}
                <b>
                  {asSpan(
                    countFor(real.allTime.kwh.low / real.requests, bulb),
                  )}{" "}
                  to{" "}
                  {asSpan(
                    countFor(real.allTime.kwh.high / real.requests, bulb),
                  )}
                </b>
                . An average is a poor summary here, since a handful of long
                agentic turns dominate the total, but it gives the order of
                magnitude of a single exchange.
              </p>
            </div>
            <p>
              Today alone is{" "}
              <b>
                {fmtKwh(real.today.kwh.low)}–{fmtKwh(real.today.kwh.high)} kWh
              </b>
              , or the same bulb for{" "}
              <b>
                {asSpan(countFor(real.today.kwh.low, bulb))} to{" "}
                {asSpan(countFor(real.today.kwh.high, bulb))}
              </b>
              . These figures move as you work; the dashboard recomputes them
              on every load.
            </p>
          </>
        )}

        <h3 id="grid">8. The grid setting</h3>
        <p>
          Energy becomes carbon by multiplying kWh by a grid carbon intensity
          in grams of CO2 equivalent per kWh. The control offers these
          reference values:
        </p>
      </div>

      <div className="tablewrap doc">
        <table>
          <caption className="sr">Grid carbon intensity reference values</caption>
          <thead>
            <tr>
              <th scope="col">Region</th>
              <th scope="col">gCO2e/kWh</th>
            </tr>
          </thead>
          <tbody>
            {GRID_REFERENCE.map((g) => (
              <tr key={g.value}>
                <td className="name">{g.label}</td>
                <td>{g.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="doc">
        <div className="callout warn">
          <b>The grid that matters is the datacenter&rsquo;s, not yours.</b> The
          transcripts do not record which region served each request, and there
          is no way to recover it. Setting your own country&rsquo;s factor
          produces a number that looks local and specific but answers a
          different question: &ldquo;what if this had run on my grid&rdquo;. The
          carbon row is the most uncertain output here, because it multiplies an
          inferred energy figure by a grid factor for an unknown region. The
          default of 450 is a rough global mean and is labelled as such.
        </div>

        <h3 id="scale">9. The output scale setting</h3>
        <p>
          Output tokens are undercounted in the transcripts. A known open issue,{" "}
          <code>anthropics/claude-code#27361</code>, reports that the final{" "}
          <code>message_stop</code> event is never written, so the last
          snapshot recorded is short of the true total. Real output may be
          roughly <b>twice</b> what the JSONL shows.
        </p>
        <p>
          Input and cache counts are <b>not</b> affected, because they are
          fixed when the request starts rather than accumulated as it streams.
        </p>
        <p>
          The control multiplies output tokens only. It defaults to{" "}
          <b>1×, the raw transcript figure</b>, so the default view never
          silently inflates anything. Selecting 2× applies the correction.
          Because output is usually a small share of total tokens in agentic
          use, doubling it often moves the total surprisingly little, which is
          itself a useful finding.
        </p>

        <h3 id="buckets">10. Days, weeks and timezones</h3>
        <p>
          Each request is placed in a day using its timestamp converted to{" "}
          <b>this machine&rsquo;s local timezone</b>, not UTC. A UTC day
          boundary cuts the working day in half everywhere outside Europe and
          Africa, which would move a morning&rsquo;s work into the previous
          day. The dashboard header states the zone in use.
        </p>
        <p>
          Weeks are ISO-8601 weeks, starting Monday. The daily series is dense:
          a day with no activity is shown as a genuine zero rather than skipped,
          because a quiet day is real information and a gap would misrepresent
          the shape.
        </p>
        <p>
          Requests whose transcript line carries no usable timestamp cannot be
          placed in a day. They are still counted in the all-time total and are
          reported separately as &ldquo;undated&rdquo; so the daily and
          all-time figures can be reconciled.
        </p>

        <h3 id="anchors">11. Everyday equivalents</h3>
        <p>
          kWh is not a unit most people hold intuitions about, so the dashboard
          <b> leads with a physical equivalent and keeps kWh underneath</b> as
          the auditable figure. These conversions add no precision; they only
          re-express the same range. Every equivalent is shown with the
          assumption it rests on so the arithmetic can be checked.
        </p>
        <h4>The display unit</h4>
        <p>
          The <b>Show energy as</b> control changes the unit everywhere at
          once: the headline, the chart axes, the tooltips and the tables. Each
          option is a straight linear rescaling of kWh, so the charts keep{" "}
          <b>one axis and one scale</b>. Nothing is plotted against a second
          y-axis, which would be misleading.
        </p>
        <div className="tablewrap">
          <table>
            <caption className="sr">Display units and their ratings</caption>
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col">kWh each</th>
                <th scope="col">Based on</th>
              </tr>
            </thead>
            <tbody>
              {ENERGY_UNITS.map((u) => (
                <tr key={u.id}>
                  <td className="name">{u.short}</td>
                  <td>{u.kwhPer}</td>
                  <td
                    style={{
                      textAlign: "left",
                      color: "var(--text-muted)",
                      fontSize: 12,
                      whiteSpace: "normal",
                    }}
                  >
                    {u.basis}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4>Carbon as distance driven</h4>
        <p>
          Kilograms of CO2 equivalent are even less intuitive than kWh, so
          carbon is also shown as <b>kilometres in a petrol car</b>, at{" "}
          {CO2_PER_KM_KG * 1000} g per km. That is{" "}
          {CO2_ANCHOR_BASIS.replace("an average petrol car at about ", "")}.
          Efficient small cars sit nearer 110 g and large ones exceed 200, so
          treat it as a middle-of-the-road figure rather than a precise one.
          The comparison inherits every uncertainty in the carbon figure,
          including the unknown serving region, so it is a sense of scale and
          nothing more.
        </p>
        <h4>Other equivalents</h4>
      </div>

      <div className="tablewrap doc wide">
        <table>
          <caption className="sr">Everyday equivalents and their bases</caption>
          <thead>
            <tr>
              <th scope="col">Equivalent</th>
              <th scope="col">kWh per unit</th>
              <th scope="col">Basis</th>
            </tr>
          </thead>
          <tbody>
            {ANCHORS.map((a) => (
              <tr key={a.label}>
                <td className="name">{a.label}</td>
                <td>{a.kwhPerUnit}</td>
                <td
                  style={{
                    textAlign: "left",
                    color: "var(--text-muted)",
                    fontSize: 12,
                    whiteSpace: "normal",
                  }}
                >
                  {a.basis}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="doc">
        <p>
          Two of these were wrong in earlier versions and were corrected by
          checking the physics rather than the code. Kettle boils had been
          listed at 1.4 kWh each, about thirteen times too high: heating one
          litre from 20 to 100 °C takes 0.093 kWh of heat, or about 0.105 kWh
          at the wall. Phone charges had been listed at 7.5 Wh, which
          corresponds to a 2,000 mAh battery from around a decade ago rather
          than a current one.
        </p>

        <h3 id="excluded">12. What is excluded</h3>
        <ul>
          <li>
            <b>Model training.</b> Only inference is counted. Training energy is
            large, amortised across all users, and not attributable to your
            sessions in any defensible way.
          </li>
          <li>
            <b>Hardware manufacturing and embodied carbon</b> of the servers,
            accelerators and networking.
          </li>
          <li>
            <b>Cooling water</b> and other non-electricity resource use.
          </li>
          <li>
            <b>Your own device.</b> The laptop or desktop running Claude Code,
            its display, and your network equipment are not included.
          </li>
          <li>
            <b>Network transport</b> between you and the datacenter.
          </li>
        </ul>
        <div className="callout warn">
          <b>Not suitable for regulatory, compliance, ESG or contractual
          reporting.</b> The coefficients are inferred rather than measured, the
          serving region is unknown, and the scope is inference only. This is a
          tool for understanding the shape and rough scale of your own usage,
          and for seeing which behaviour actually moves it.
        </div>

        <h3 id="verify">13. How to check this yourself</h3>
        <p>
          Every figure on the dashboard is available as JSON at{" "}
          <Link href="/api/summary">/api/summary</Link>, including the raw token
          counts, so you can redo the arithmetic independently. The same query
          parameters apply: <code>grid</code>, <code>scale</code>,{" "}
          <code>days</code> and <code>model</code>.
        </p>
        <p>
          The aggregation has also been cross-checked against an entirely
          separate implementation, written in Python, on a frozen copy of the
          same transcripts. Both agree exactly on the request count, all four
          token classes and all three energy bands, including under varied grid
          and scale settings and with a model filter. That check is what caught
          two real defects during development: a per-file deduplication error,
          and a query-parameter bug that silently understated output energy
          tenfold and reported carbon as zero.
        </p>

        <h3 id="revise">14. Revising the coefficients</h3>
        <p>
          If Anthropic ever publishes real per-token energy figures, updating
          this should be a <b>four-row table edit and nothing else</b>. The
          coefficients live in a single exported constant,{" "}
          <code>COEFFICIENTS_J</code> in <code>lib/constants.ts</code>. No other
          code hardcodes them, and this page reads them at render time, so the
          documentation and the worked example update themselves.
        </p>
        <p>
          If disclosed figures narrow the uncertainty, narrow the band, but do
          not remove it unless the disclosure itself carries zero uncertainty,
          which no real measurement does. If figures arrive per model rather
          than per token class, that is the one foreseeable change that touches
          more than the table: the aggregation would need a per-model
          coefficient lookup keyed on the model string it already records.
        </p>
      </div>

      <footer>
        <Link className="crumb" href="/">
          ← Back to the dashboard
        </Link>
      </footer>
    </main>
  );
}
