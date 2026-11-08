import type { Snapshot } from "../../data/contracts";

type ExposureStatus =
  "no_flagged" | "flagged" | "unavailable" | "exposed" | "warned" | "untouched";

export const EXPOSURE_COLORS: Record<ExposureStatus, string> = {
  no_flagged: "#55d99b",
  flagged: "#ff677d",
  unavailable: "#9aacbd",
  exposed: "#ff677d",
  warned: "#55d99b",
  untouched: "#9aacbd",
};

export const EXPOSURE_LABELS: Record<ExposureStatus, string> = {
  no_flagged: "No flagged message observed",
  flagged: "Flagged message received",
  unavailable: "Detection data unavailable",
  exposed: "Exposed · backend simulation",
  warned: "Warned · backend simulation",
  untouched: "Untouched · no exposure/warning",
};

interface ResidentSignal {
  status: ExposureStatus;
  investigating: boolean;
  messageCount: number;
  flaggedCount: number;
  warningCount: number;
  acknowledgedCount: number;
}

export interface ResidentMapState extends ResidentSignal {
  id: string;
}

/** Joins observed records in linear time; warnings and AI investigation never overwrite exposure. */
export function residentSignals(data: Snapshot): Map<string, ResidentSignal> {
  const signals = new Map<string, ResidentSignal>();
  for (const resident of data.residents) {
    let status: ExposureStatus = data.connection ? "unavailable" : "no_flagged";
    if (data.connection && resident.liveState) {
      // Backend exposure wins over warning; neither implies an AI verdict or avoided harm.
      status = resident.liveState.exposed
        ? "exposed"
        : resident.liveState.warned
          ? "warned"
          : "untouched";
    }
    signals.set(resident.id, {
      status,
      investigating: false,
      messageCount: 0,
      flaggedCount: 0,
      warningCount: 0,
      acknowledgedCount: 0,
    });
  }
  if (data.connection) {
    for (const notification of data.liveFeed?.notifications ?? []) {
      const signal = signals.get(notification.recipientId);
      if (signal) signal.warningCount++;
    }
    // Incidents contain no resident membership; do not infer per-resident investigation overlays.
    return signals;
  }
  const flagged = new Set(
    data.campaigns
      .filter((campaign) => campaign.detectionStatus === "flagged")
      .map((campaign) => campaign.clusterId),
  );
  // This overlay is currently a timed-mock capability, never inferred from live resident data.
  const investigating = new Set(
    data.mockSimulation
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

/** Joins resident IDs to display signals without computing unused geographic positions. */
export function residentMapStates(data: Snapshot): ResidentMapState[] {
  const signals = residentSignals(data);
  return data.residents.map((resident) => ({
    id: resident.id,
    ...signals.get(resident.id)!,
  }));
}
