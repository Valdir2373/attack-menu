import re
from domain.proxy.IBlockEngine import IBlockEngine
from domain.proxy.ProxyRules import MergedRules


class BlockEngine(IBlockEngine):
    def is_blocked(self, text: str, rules: MergedRules) -> bool:
        for sub in rules.blockUrls:
            if sub in text:
                return True
        for pat in rules.blockPatterns:
            if re.search(pat, text, re.IGNORECASE):
                return True
        return False
