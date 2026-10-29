import type { Night } from '../digest/types.js';

const dash = '—';

// Marked cells use <strong> as well as .warn, so the mark survives screenshots and plain text (ADR 0001).
export function DigestPage({ night }: { night: Night }) {
  const { rows, badLines } = night;
  return (
    <>
      <h1>digest {night.night}</h1>
      {badLines > 0 && (
        <p class="warn">
          <strong>{badLines === 1 ? "1 line didn't parse" : `${badLines} lines didn't parse`}</strong>
        </p>
      )}
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>fails</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>{r.job}</td>
                <td>{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td>{r.retries >= 3 ? <strong class="warn">{r.retries}</strong> : r.retries}</td>
                <td>{r.fails > 0 ? <strong class="warn">{r.fails}</strong> : r.fails}</td>
                <td>{r.lastStatus}</td>
                <td>{r.lastError ?? dash}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
