import type { PointerEvent } from "react";
import { startDesktopResizeDrag } from "../domain/desktopWindow";
import type { ResizeDirection } from "../domain/desktopWindow";

type ResizeZone = {
  direction: ResizeDirection;
  className: string;
};

const zones: ResizeZone[] = [
  { direction: "NorthWest", className: "desktop-resize-zone nw" },
  { direction: "North", className: "desktop-resize-zone n" },
  { direction: "NorthEast", className: "desktop-resize-zone ne" },
  { direction: "West", className: "desktop-resize-zone w" },
  { direction: "East", className: "desktop-resize-zone e" },
  { direction: "SouthWest", className: "desktop-resize-zone sw" },
  { direction: "South", className: "desktop-resize-zone s" },
  { direction: "SouthEast", className: "desktop-resize-zone se" }
];

export function DesktopResizeZones() {
  function handlePointerDown(direction: ResizeDirection, event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    void startDesktopResizeDrag(direction).catch((error) => {
      console.warn("ClipFlow resize drag failed", error);
    });
  }

  return (
    <div className="desktop-resize-zones" aria-hidden="true">
      {zones.map((zone) => (
        <div
          key={zone.direction}
          className={zone.className}
          role="presentation"
          onPointerDown={(event) => handlePointerDown(zone.direction, event)}
        />
      ))}
    </div>
  );
}
