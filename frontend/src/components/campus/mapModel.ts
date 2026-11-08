import type { Snapshot } from "../../data/contracts";

type ExposureStatus =
  | "no_flagged"
  | "flagged"
  | "unavailable"
  | "recovery"
  | "warned"
  | "untouched";

export const EXPOSURE_LABELS: Record<ExposureStatus, string> = {
  no_flagged: "No flagged message observed",
  flagged: "Flagged",
  unavailable: "Unavailable",
  recovery: "Recovery guidance",
  warned: "Warned",
  untouched: "Untouched",
};

interface ResidentSignal {
  status: ExposureStatus;
  investigating: boolean;
}

export interface ResidentMapState extends ResidentSignal {
  id: string;
  displayName: string;
  persona: string;
}

/** Live red states follow recovery recipients; mock red states follow flagged message clusters. */
export function residentSignals(data: Snapshot): Map<string, ResidentSignal> {
  const recoveryRecipients = new Set(
    data.liveFeed?.notifications
      .filter((notification) => notification.kind === "recovery")
      .map((notification) => notification.recipientId) ?? [],
  );
  const signals = new Map<string, ResidentSignal>();
  for (const resident of data.residents) {
    let status: ExposureStatus = data.connection ? "unavailable" : "no_flagged";
    if (data.connection) {
      // Exposure can precede recovery guidance. Only actual recovery recipients turn red.
      status = recoveryRecipients.has(resident.id)
        ? "recovery"
        : !resident.liveState
          ? "unavailable"
          : resident.liveState.warned
            ? "warned"
            : "untouched";
    }
    signals.set(resident.id, {
      status,
      investigating: false,
    });
  }
  // Live recovery records identify recipients; incidents provide no per-resident membership.
  if (data.connection) return signals;
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
    if (
      message.detectedClusterId &&
      investigating.has(message.detectedClusterId)
    )
      signal.investigating = true;
    if (message.detectedClusterId && flagged.has(message.detectedClusterId)) {
      signal.status = "flagged";
    }
  }
  return signals;
}

/** Joins resident IDs to display signals without computing unused geographic positions. */
export function residentMapStates(data: Snapshot): ResidentMapState[] {
  const signals = residentSignals(data);
  return data.residents.map((resident) => ({
    id: resident.id,
    displayName: resident.displayName,
    persona: resident.persona,
    ...signals.get(resident.id)!,
  }));
}
