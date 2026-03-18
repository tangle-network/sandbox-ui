/** Visual branding for a run group header — injected by consuming app. */
export interface AgentBranding {
  label: string;
  accentClass: string;
  bgClass: string;
  containerBgClass: string;
  borderClass: string;
  /** CSS class for the agent icon (legacy). Ignored when using lucide-react icons. */
  iconClass: string;
  textClass: string;
}
