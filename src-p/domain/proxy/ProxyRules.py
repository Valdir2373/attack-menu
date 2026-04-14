from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ReplaceRule:
    from_: str
    to: str
    on: Optional[str] = None


@dataclass
class SiteRules:
    blockUrls: List[str] = field(default_factory=list)
    blockPatterns: List[str] = field(default_factory=list)
    replace: List[ReplaceRule] = field(default_factory=list)
    stripHeaders: List[str] = field(default_factory=list)


@dataclass
class ProxyRules:
    global_rules: SiteRules = field(default_factory=SiteRules)
    sites: Dict[str, SiteRules] = field(default_factory=dict)


@dataclass
class MergedRules:
    blockUrls: List[str] = field(default_factory=list)
    blockPatterns: List[str] = field(default_factory=list)
    replace: List[ReplaceRule] = field(default_factory=list)
    stripHeaders: List[str] = field(default_factory=list)
