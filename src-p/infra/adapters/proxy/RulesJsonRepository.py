import json
import os
from domain.proxy.IRulesRepository import IRulesRepository
from domain.proxy.ProxyRules import MergedRules, SiteRules, ReplaceRule


class RulesJsonRepository(IRulesRepository):
    def __init__(self, file_path: str = "./rules.json"):
        self._file_path = file_path

    def get_merged(self, host: str) -> MergedRules:
        rules = self._load()
        g = rules.get("global", {})
        s = rules.get("sites", {}).get(host, {})
        return MergedRules(
            blockUrls=list(g.get("blockUrls", [])) + list(s.get("blockUrls", [])),
            blockPatterns=list(g.get("blockPatterns", [])) + list(s.get("blockPatterns", [])),
            replace=self._parse_rules(g.get("replace", [])) + self._parse_rules(s.get("replace", [])),
            stripHeaders=list(g.get("stripHeaders", [])) + list(s.get("stripHeaders", [])),
        )

    def _load(self) -> dict:
        try:
            with open(self._file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"global": {}, "sites": {}}

    def _parse_rules(self, raw: list) -> list:
        result = []
        for r in raw:
            result.append(ReplaceRule(from_=r["from"], to=r["to"], on=r.get("on")))
        return result
