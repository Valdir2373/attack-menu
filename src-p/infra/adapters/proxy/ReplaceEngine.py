import re
from typing import List
from domain.proxy.IReplaceEngine import IReplaceEngine
from domain.proxy.ProxyRules import ReplaceRule


class ReplaceEngine(IReplaceEngine):
    def apply(self, text: str, rules: List[ReplaceRule], phase: str) -> str:
        for rule in rules:
            target = rule.on or "response"
            if target != phase and target != "both":
                continue

            if rule.from_.startswith("regex:"):
                pattern = rule.from_[6:]
                text = re.sub(pattern, rule.to, text, flags=re.IGNORECASE)
            else:
                text = text.replace(rule.from_, rule.to)

        return text
