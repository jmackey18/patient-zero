import type { Snapshot } from "../data/contracts";
import { useLiveFeed } from "../data/useLiveFeed";

/** Shows server-reported investigation progress; pending/failed reports never imply a verdict. */
export function LiveInvestigation({ data }: { data: Snapshot }) {
  const feed = useLiveFeed(data);
  return (
    <div className="min-w-0 space-y-3">
      <h3>Nemotron investigation</h3>
      <p role="status" aria-atomic="true" className="muted">
        {!feed.available
          ? "Investigation feed unavailable until the live subscription syncs."
          : !feed.latestIncident
            ? "No investigations reported yet. Waiting for backend detection."
            : `Latest investigation: ${feed.latestIncident.campaignId} · ${investigationLabel(feed.latestIncident.status)}`}
      </p>
      {feed.incidents.length > 10 && (
        <p className="muted">
          Showing the latest 10 of {feed.incidents.length} investigations.
        </p>
      )}
      {feed.incidents.slice(0, 10).map((incident) => (
        <article
          key={incident.campaignId}
          className="space-y-3 break-words rounded-lg border border-border bg-background/40 p-3"
        >
          <h4 className="font-medium">Campaign {incident.campaignId}</h4>
          <span
            className={`badge ${incident.status === "investigating" ? "border-blue-400/50 text-blue-400" : ""}`}
          >
            {investigationLabel(incident.status)}
          </span>
          {incident.status === "complete" && (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted">AI assessment</dt>
                <dd>
                  {incident.isCoordinated
                    ? "Suspected coordinated campaign"
                    : "Coordination not indicated by the model"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Model-reported confidence</dt>
                <dd>
                  {Number.isFinite(incident.confidence) &&
                  incident.confidence >= 0 &&
                  incident.confidence <= 100
                    ? `${incident.confidence}%`
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Reported variants</dt>
                <dd>{incident.numVariants}</dd>
              </div>
            </dl>
          )}
          {incident.status === "investigating" && (
            <p className="muted">
              Analyzing campaign metadata. No assessment available yet.
            </p>
          )}
          {incident.status === "failed" && (
            <p className="text-warning">
              Investigation unavailable. Resident states and notifications
              remain independent.
            </p>
          )}
          {incident.reasoning && (
            <div>
              <h5 className="eyebrow">
                {incident.status === "complete"
                  ? "Reasoning"
                  : "Investigation details"}
              </h5>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {incident.reasoning}
              </p>
            </div>
          )}
          {incident.status === "complete" && incident.warningText && (
            <div>
              <h5 className="eyebrow">Suggested warning</h5>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {incident.warningText}
              </p>
            </div>
          )}
        </article>
      ))}
      <p className="muted">
        AI findings are assessments, not proof or confirmation that spread has
        stopped. Per-resident investigation membership is not provided by this
        feed.
      </p>
    </div>
  );
}

function investigationLabel(status: string) {
  switch (status) {
    case "investigating":
      return "In progress";
    case "complete":
      return "Complete";
    case "failed":
      return "Failed";
    default:
      return "Unknown status";
  }
}
