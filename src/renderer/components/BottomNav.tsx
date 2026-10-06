import { HubIcon, type IconName } from "@/renderer/components/HubIcon";

export type HubTab = "home" | "classes" | "assignments" | "curriculum" | "students" | "drafts" | "library" | "settings";

const tabs: Array<{ id: HubTab; label: string; icon: IconName }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "classes", label: "Classes", icon: "classes" },
  { id: "assignments", label: "Assignments", icon: "assignments" },
  { id: "curriculum", label: "Curriculum", icon: "curriculum" },
  { id: "students", label: "Student Progress", icon: "students" },
  { id: "drafts", label: "Drafts", icon: "drafts" },
  { id: "library", label: "Library", icon: "library" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function BottomNav({ active, onChange }: { active: HubTab; onChange: (tab: HubTab) => void }) {
  return <nav className="hub-sidebar" aria-label="Hub navigation">
    {tabs.map((tab) => <button key={tab.id} className={active === tab.id ? "active" : ""} aria-current={active === tab.id ? "page" : undefined} onClick={() => onChange(tab.id)}>
      <HubIcon name={tab.icon}/><span>{tab.label}</span>
    </button>)}
  </nav>;
}
