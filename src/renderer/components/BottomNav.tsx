import { HubIcon, type IconName } from "@/renderer/components/HubIcon";

export type HubTab = "home" | "assistant" | "classes" | "students" | "settings";

const tabs: Array<{ id: HubTab; label: string; icon: IconName }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "assistant", label: "Assistant", icon: "assistant" },
  { id: "classes", label: "Classes", icon: "classes" },
  { id: "students", label: "Students", icon: "students" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function BottomNav({ active, onChange }: { active: HubTab; onChange: (tab: HubTab) => void }) {
  return <nav className="bottom-nav" aria-label="Hub navigation">
    {tabs.map((tab) => <button key={tab.id} className={active === tab.id ? "active" : ""} aria-current={active === tab.id ? "page" : undefined} onClick={() => onChange(tab.id)}>
      <HubIcon name={tab.icon}/><span>{tab.label}</span>
    </button>)}
  </nav>;
}
