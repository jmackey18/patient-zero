import type { Snapshot } from "../../data/contracts";
import { residentPosition, type GraphPoint } from "../../lib/networkLayout";

type ExposureStatus = "no_flagged" | "flagged" | "unavailable";

export const EXPOSURE_COLORS: Record<ExposureStatus, string> = {
  no_flagged: "#55d99b",
  flagged: "#ff677d",
  unavailable: "#9aacbd",
};

export const EXPOSURE_LABELS: Record<ExposureStatus, string> = {
  no_flagged: "No flagged message observed",
  flagged: "Flagged message received",
  unavailable: "Detection data unavailable",
};

interface ResidentSignal {
  status: ExposureStatus;
  investigating: boolean;
  messageCount: number;
  flaggedCount: number;
  warningCount: number;
  acknowledgedCount: number;
}

export interface ResidentNode extends GraphPoint, ResidentSignal {}

/** Joins observed records in linear time; warnings and AI investigation never overwrite exposure. */
export function residentSignals(data: Snapshot): Map<string, ResidentSignal> {
  const signals = new Map<string, ResidentSignal>();
  for (const resident of data.residents) {
    signals.set(resident.id, {
      // Current live snapshots have connection metadata but no detection subscriptions.
      // Replace this availability check when the adapter exposes explicit feed capabilities.
      status: data.connection ? "unavailable" : "no_flagged",
      investigating: false,
      messageCount: 0,
      flaggedCount: 0,
      warningCount: 0,
      acknowledgedCount: 0,
    });
  }
  const flagged = new Set(
    data.campaigns
      .filter((campaign) => campaign.detectionStatus === "flagged")
      .map((campaign) => campaign.clusterId),
  );
  // This overlay is currently a timed-mock capability, never inferred from live resident data.
  const investigating = new Set(
    data.mockSimulation && !data.connection
      ? data.campaigns
          .filter((campaign) => campaign.investigationStatus === "pending")
          .map((campaign) => campaign.clusterId)
      : [],
  );
  for (const message of data.messages) {
    const signal = signals.get(message.recipientId);
    if (!signal) continue;
    signal.messageCount++;
    if (
      message.detectedClusterId &&
      investigating.has(message.detectedClusterId)
    )
      signal.investigating = true;
    if (message.detectedClusterId && flagged.has(message.detectedClusterId)) {
      signal.flaggedCount++;
      signal.status = "flagged";
    }
  }
  for (const warning of data.warnings) {
    const signal = signals.get(warning.recipientId);
    if (!signal) continue;
    signal.warningCount++;
    if (warning.acknowledged) signal.acknowledgedCount++;
  }
  return signals;
}

/** One dot for every resident; no sampling or pagination of the WebGL population. */
export function constellationNodes(data: Snapshot): ResidentNode[] {
  const signals = residentSignals(data);
  return data.residents.map((resident) => ({
    ...residentPosition(resident.id),
    ...signals.get(resident.id)!,
  }));
}
