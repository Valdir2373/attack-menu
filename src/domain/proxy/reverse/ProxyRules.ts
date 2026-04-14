export interface ReplaceRule {
  from: string;
  to: string;
  on?: "request" | "response" | "both";
}

export interface SiteRules {
  blockUrls?: string[];
  blockPatterns?: string[];
  replace?: ReplaceRule[];
  stripHeaders?: string[];
}

export interface ProxyRules {
  global: SiteRules;
  sites: Record<string, SiteRules>;
}

export interface MergedRules {
  blockUrls: string[];
  blockPatterns: string[];
  replace: ReplaceRule[];
  stripHeaders: string[];
}

