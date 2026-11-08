import type { ComponentProps } from "react";

/** Shared phone chassis and screen chrome for resident inspection and notification previews. */
export function PhoneFrame({
  children,
  className = "",
  ...props
}: ComponentProps<"div">) {
  return (
    <div className={`phone-frame ${className}`} {...props}>
      <div className="resident-phone__screen">
        <div className="resident-phone__notch" aria-hidden="true" />
        <div className="resident-phone__topline" aria-hidden="true">
          <span>T-Mobile</span>
          <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
            <rect
              x="1"
              y="2"
              width="18"
              height="8"
              rx="2"
              stroke="currentColor"
            />
            <rect
              x="3"
              y="4"
              width="14"
              height="4"
              rx="1"
              fill="currentColor"
            />
            <path d="M21 4v4" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        {children}
        <div className="resident-phone__home" aria-hidden="true" />
      </div>
    </div>
  );
}
