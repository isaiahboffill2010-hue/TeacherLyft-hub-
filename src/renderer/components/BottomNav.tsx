import { HubIcon, type IconName } from "@/renderer/components/HubIcon";

export type HubTab = "home" | "classes" | "assignments" | "progress" | "more";

const tabs: Array<{ id: HubTab; label: string; icon: IconName }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "classes", label: "Classes", icon: "classes" },
  { id: "assignments", label: "Assignments", icon: "assignments" },
  { id: "progress", label: "Progress", icon: "students" },
  { id: "more", label: "More", icon: "more" },
];

export function BottomNav({ active, onChange }: { active: HubTab; onChange: (tab: HubTab) => void }) {
  return <nav className="bottom-nav" aria-label="Hub navigation">
    {tabs.map((tab) => <button key={tab.id} className={active === tab.id ? "active" : ""} aria-current={active === tab.id ? "page" : undefined} onClick={() => onChange(tab.id)}>
      <HubIcon name={tab.icon}/><span>{tab.label}</span>
    </button>)}
  </nav>;
}
