import { CommandCenter } from './views/CommandCenter';
import { ResidentPhone } from './views/ResidentPhone';
import { AttackerConsole } from './views/AttackerConsole';
import { useState, useSyncExternalStore } from 'react';
import { dataAdapter } from './data';
import type { DataAdapter, Scenario } from './data/contracts';

const views = ['Command Center', 'Resident Phone', 'Attacker Console'] as const;
type View = (typeof views)[number];

/** Connects adapter updates to the views and preserves selections across navigation. */
export function App({ adapter = dataAdapter }: { adapter?: DataAdapter }) {
  const data = useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  const [view, setView] = useState<View>('Command Center');
  const [residentId, setResidentId] = useState('r1');
  const [scenario, setScenario] = useState<Scenario>('suspicious');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  /** Runs an adapter action with shared busy, success, and error feedback for the UI. */
  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Unable to update data. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
      <header>
        <p className="muted">PATIENT ZERO · AVON SIMULATION</p>
        <h1>Catching scams before they spread</h1>
      </header>
      <aside className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <strong>
          {adapter.mode === 'mock'
            ? 'MOCK DATA — local browser demo'
            : 'Connected data'}
        </strong>
        {adapter.mode === 'mock' && (
          <p>
            All residents, campaign flags, messages, and warnings are fixtures.
            No detector, SpacetimeDB connection, or NVIDIA Nemotron is running.
            Changes reset on reload and do not sync across browsers.
          </p>
        )}
      </aside>
      <nav aria-label="Main views" className="flex flex-wrap gap-2">
        {views.map((item) => (
          <button
            key={item}
            aria-current={view === item ? 'page' : undefined}
            className={view === item ? 'bg-blue-700' : ''}
            onClick={() => setView(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3">
          {error}
        </p>
      )}
      <p role="status" className="text-sm">
        {notice}
      </p>

      {view === 'Command Center' && <CommandCenter data={data} />}
      {view === 'Resident Phone' && (
        <ResidentPhone
          data={data}
          residentId={residentId}
          setResidentId={setResidentId}
          busy={busy}
          onAcknowledge={(warningId) =>
            void perform(
              () => adapter.acknowledgeWarning(warningId),
              'Warning acknowledged in this local mock session.',
            )
          }
        />
      )}
      {view === 'Attacker Console' && (
        <AttackerConsole
          scenario={scenario}
          setScenario={setScenario}
          busy={busy}
          onLoadScenario={() =>
            void perform(
              () => adapter.loadScenario(scenario),
              'Mock scenario loaded. Open Command Center or Resident Phone to inspect it.',
            )
          }
          onReset={() =>
            void perform(
              () => adapter.reset(),
              'Local mock session reset; residents retained.',
            )
          }
        />
      )}
    </main>
  );
}
