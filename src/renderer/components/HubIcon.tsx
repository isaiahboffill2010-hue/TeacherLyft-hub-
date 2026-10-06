import type { SVGProps } from "react";

export type IconName = "home" | "classes" | "assignments" | "curriculum" | "students" | "drafts" | "library" | "settings"
  | "more" | "microphone" | "clipboard" | "bell" | "arrow";

export function HubIcon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    assignments: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6"/></>,
    curriculum: <><path d="M4 4.5A3.5 3.5 0 0 1 7.5 3H12v17H7.5A3.5 3.5 0 0 0 4 21.5Z"/><path d="M20 4.5A3.5 3.5 0 0 0 16.5 3H12v17h4.5a3.5 3.5 0 0 1 3.5 1.5Z"/></>,
    drafts: <><path d="M4 3h11l5 5v13H4Z"/><path d="M14 3v6h6M8 14h8M8 18h5"/></>,
    library: <><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="16" rx="1"/><path d="m16 5 4-1 2 15-4 1Z"/></>,
    classes: <><path d="M4 5.5 12 3l8 2.5-8 2.6-8-2.6Z"/><path d="M6 7.5V13c0 1.7 2.7 3 6 3s6-1.3 6-3V7.5M20 6v7"/></>,
    students: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.3-4 2.3-6 6-6s5.7 2 6 6M15 15c3.4 0 5.3 1.7 5.5 5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    more: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    microphone: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M9 10h6M9 14h6"/></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common} {...props}>{paths[name]}</svg>;
}
