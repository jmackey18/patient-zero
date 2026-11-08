import { useEffect, useState } from "react";
import { EXPOSURE_LABELS, type ResidentMapState } from "./mapModel";

interface Props {
  resident: ResidentMapState | null;
  onClose: () => void;
  reducedMotion: boolean;
}

/** Retains the last selected profile for the exit fade; all displayed information is current adapter data. */
export function ResidentPhoneOverlay({
  resident,
  onClose,
  reducedMotion,
}: Props) {
  const [retained, setRetained] = useState(resident);
  useEffect(() => {
    if (resident) {
      setRetained(resident);
      return;
    }
    const timeout = setTimeout(
      () => setRetained(null),
      reducedMotion ? 0 : 220,
    );
    return () => clearTimeout(timeout);
  }, [resident, reducedMotion]);
  const profile = resident ?? (reducedMotion ? null : retained);
  if (!profile) return null;
  const tone =
    profile.status === "recovery" || profile.status === "flagged"
      ? "red"
      : profile.status === "warned" || profile.status === "no_flagged"
        ? "green"
        : "neutral";
  return (
    <aside
      key={profile.id}
      aria-label="Resident information"
      aria-hidden={!resident}
      inert={!resident}
      className={`resident-phone ${!resident ? "resident-phone--closing" : ""}`}
    >
      <div className="resident-phone__screen">
        <div className="resident-phone__notch" aria-hidden="true" />
        <div className="resident-phone__topline" aria-hidden="true">
          <span>Mobile</span>
          <span>▰</span>
        </div>
        <button
          className="resident-phone__close"
          onClick={onClose}
          aria-label="Close resident details"
        >
          ×
        </button>
        <div className="resident-phone__content">
          <p className="resident-phone__eyebrow">Resident profile</p>
          <h3 className="resident-phone__name">{profile.displayName}</h3>
          <p className="resident-phone__persona">{profile.persona}</p>
          <div
            className={`resident-phone__notification resident-phone__notification--${tone}`}
            role="status"
            aria-atomic="true"
          >
            <div className="resident-phone__app">
              <span aria-hidden="true">PZ</span> PATIENT ZERO
            </div>
            <p className="resident-phone__status">
              Status: {EXPOSURE_LABELS[profile.status]}
            </p>
            {profile.investigating && (
              <p className="resident-phone__assessment">
                Campaign investigation in progress
              </p>
            )}
          </div>
        </div>
        <div className="resident-phone__home" aria-hidden="true" />
      </div>
    </aside>
  );
}
