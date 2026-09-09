import Link from "next/link";

import DailyBandChart from "@/components/DailyBandChart";
import WeeklyColumns from "@/components/WeeklyColumns";
import StatTile from "@/components/StatTile";
import BandTable from "@/components/BandTable";
import Controls from "@/components/Controls";
import EverydayTerms from "@/components/EverydayTerms";
import PlainLead from "@/components/PlainLead";
import ShareBar from "@/components/ShareBar";
import { getSummary } from "@/lib/cache";
import { readOptions, readUnitId } from "@/lib/params";
import { unitById } from "@/lib/units";

/** Monday of the ISO week containing the given local date. */
function weekStartKey(todayKey: string): string {
  const d = new Date(`${todayKey}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
import { TOKEN_CLASSES } from "@/lib/constants";
import { fmtInt, fmtTokens } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const opts = readOptions(raw);
  const unit = unitById(readUnitId(raw));
  const data = await getSummary(opts);

  if ("error" in data) {
    return (
      <main className="shell">
        <h1>Carbon Credit</h1>
        <div className="err">
          <b>{data.error}</b>
          <p style={{ margin: "8px 0 0" }}>
            Claude Code writes one JSONL transcript per session under{" "}
            <code>{data.projectsDir}</code>. Check the path, or run a Claude
            Code session first so a transcript exists.
          </p>
        </div>
      </main>
    );
  }

  const coeff = TOKEN_CLASSES.map(
    (k) => `${k} ${data.coefficients[k].join("/")}`,
  ).join(" · ");

  const shareRows = TOKEN_CLASSES.map((k) => {
    const j = data.allTime.tokens[k] * data.coefficients[k][1];
    return { k, j };
  });
  const shareTotal = shareRows.reduce((s, r) => s + r.j, 0) || 1;
  const activeThisWeek = data.dailySeries.filter(
    (d) => d.requests > 0 && d.date >= weekStartKey(data.todayKey),
  ).length;
  const dominant = shareRows.slice().sort((a, b) => b.j - a.j)[0];

  return (
    <main className="shell">
      <div className="masthead">
        <div>
          <h1>Carbon Credit</h1>
          <p className="meta">
            Estimated electricity and carbon of Claude Code usage on this
            machine · days bucketed in <b>{data.timezone}</b> · grid{" "}
            <b>{data.grid} gCO2e/kWh</b> · output scale{" "}
            <b>{data.outputScale}×</b> · {data.transcripts} transcripts ·{" "}
            {fmtInt(data.requests)} requests
          </p>
        </div>
        <Link className="navlink" href="/methodology">
          How this is calculated →
        </Link>
      </div>

      <PlainLead
        today={data.today}
        allTime={data.allTime}
        unit={unit}
        requests={data.requests}
      />

      <div className="banner">
        <b>Every figure here is a range, not a measurement.</b> The token counts
        are read from your own transcripts and are exact. The joules-per-token
        coefficients are inferred from public sources, because Anthropic
        publishes no per-token energy figures for any Claude model. Read the
        band; the mid value is not the answer on its own, and none of this is
        suitable for regulatory or compliance reporting.{" "}
        <Link href="/methodology">Read the full methodology</Link>.
      </div>

      <Controls
        grid={data.grid}
        scale={data.outputScale}
        days={data.days}
        model={data.modelFilter}
        unit={unit.id}
      />

      <h2>Headline</h2>
      <div className="tiles">
        <StatTile
          label={`Today · ${data.todayKey}`}
          kwh={data.today.kwh}
          co2Kg={data.today.co2Kg}
          totalTokens={data.today.totalTokens}
          requests={data.today.requests}
          unit={unit}
        />
        <StatTile
          label={`This week · ${data.weekKey}`}
          kwh={data.thisWeek.kwh}
          co2Kg={data.thisWeek.co2Kg}
          totalTokens={data.thisWeek.totalTokens}
          requests={data.thisWeek.requests}
          unit={unit}
          extra={
            activeThisWeek <= 1
              ? "only today has activity so far"
              : `${activeThisWeek} active days`
          }
        />
        <StatTile
          label="All time"
          kwh={data.allTime.kwh}
          co2Kg={data.allTime.co2Kg}
          totalTokens={data.allTime.totalTokens}
          requests={data.allTime.requests}
          unit={unit}
          extra={
            data.undatedRequests
              ? `${fmtInt(data.undatedRequests)} undated`
              : undefined
          }
        />
      </div>

      <h2>
        Other ways to picture it{" "}
        <span className="h2note">· the same energy, different everyday things</span>
      </h2>
      <EverydayTerms
        periods={[
          { label: "Today", kwh: data.today.kwh, co2Kg: data.today.co2Kg },
          {
            label: "This week",
            kwh: data.thisWeek.kwh,
            co2Kg: data.thisWeek.co2Kg,
          },
          {
            label: "All time",
            kwh: data.allTime.kwh,
            co2Kg: data.allTime.co2Kg,
          },
        ]}
      />

      <h2>
        Per day{" "}
        <span className="h2note">
          · last {data.days} days, in {unit.label}
        </span>
      </h2>
      <DailyBandChart points={data.dailySeries} unit={unit} />

      <h2>
        Per week{" "}
        <span className="h2note">
          · ISO weeks, in {unit.label}
        </span>
      </h2>
      <WeeklyColumns points={data.weekly} unit={unit} />
      <div style={{ height: 12 }} />
      <BandTable
        rows={data.weekly
          .slice()
          .reverse()
          .map((w) => ({ ...w, name: w.week }))}
        firstHeader="ISO week"
        caption="Estimated energy and carbon per ISO week"
        unit={unit}
      />

      <h2>
        Where the energy goes{" "}
        <span className="h2note">· share of the middle estimate</span>
      </h2>
      <ShareBar
        shares={shareRows.map((r) => ({
          k: r.k,
          pct: (100 * r.j) / shareTotal,
        }))}
      />
      <div className="tablewrap">
        <table>
          <caption className="sr">
            Share of mid-band energy by token class, all time
          </caption>
          <thead>
            <tr>
              <th scope="col">Token class</th>
              <th scope="col">tokens</th>
              <th scope="col">share of tokens</th>
              <th scope="col">share of mid energy</th>
            </tr>
          </thead>
          <tbody>
            {shareRows.map((r) => {
              const tokTotal = data.allTime.totalTokens || 1;
              return (
                <tr key={r.k}>
                  <td className="name">{r.k.replace("_", " ")}</td>
                  <td>{fmtTokens(data.allTime.tokens[r.k])}</td>
                  <td>
                    {((100 * data.allTime.tokens[r.k]) / tokTotal).toFixed(1)}%
                  </td>
                  <td>{((100 * r.j) / shareTotal).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="meta" style={{ marginTop: 10 }}>
        <b>{dominant.k.replace("_", " ")}</b> accounts for{" "}
        {((100 * dominant.j) / shareTotal).toFixed(0)}% of the mid-band energy.
        In agentic coding cache reads usually dominate while output is a tiny
        fraction, so the lever that reduces this is tighter context and better
        cache hygiene, not shorter answers.
      </p>

      <h2>
        Per project <span className="h2note">· in {unit.label}</span>
      </h2>
      <BandTable
        rows={data.projects}
        firstHeader="Project"
        caption="Estimated energy and carbon per project"
        unit={unit}
      />

      <h2>
        Per model <span className="h2note">· in {unit.label}</span>
      </h2>
      <BandTable
        rows={data.models}
        firstHeader="Model"
        caption="Estimated energy and carbon per model"
        unit={unit}
      />

      <footer>
        <ul>
          <li>
            <b>Inference only.</b> Excludes model training, hardware
            manufacturing, cooling water, and this machine&rsquo;s own draw.
          </li>
          <li>
            <b>Not for regulatory or compliance reporting.</b> The coefficients
            are inferred, not measured.
          </li>
          <li>
            <b>Output tokens are undercounted</b> in the transcripts: the final
            message_stop event is not written
            (anthropics/claude-code#27361), so real output may be about 2×. Use
            the output scale control for the compensated view.
          </li>
          <li>
            <b>The grid factor should be the datacenter&rsquo;s, not yours.</b>{" "}
            The transcripts do not record which region served each request, so a
            local grid figure answers a different question.
          </li>
          <li>
            <b>Accounting.</b> One row per requestId, keeping the maximum per
            token class, deduplicated globally across transcripts so a resumed
            or forked session is not counted twice.
            {data.badLines > 0
              ? ` ${fmtInt(data.badLines)} unparseable lines were skipped.`
              : ""}
          </li>
          <li>Coefficients in J/token, low/mid/high: {coeff}</li>
          <li>
            <Link href="/methodology">Full methodology</Link>: how tokens are
            counted, where the coefficients come from, what each setting
            changes, and a worked example.
          </li>
        </ul>
      </footer>
    </main>
  );
}
