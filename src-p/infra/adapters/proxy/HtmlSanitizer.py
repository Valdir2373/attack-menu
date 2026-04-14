import re
from domain.proxy.IHtmlSanitizer import IHtmlSanitizer
from domain.proxy.IBlockEngine import IBlockEngine
from domain.proxy.ProxyRules import MergedRules

_ATTR_RE = re.compile(r'(?:src|href|data|action|poster)=[\'"]([^\'"]*)[\'"]', re.IGNORECASE)


class HtmlSanitizer(IHtmlSanitizer):
    def __init__(self, block_engine: IBlockEngine):
        self._block = block_engine

    def sanitize(self, html: str, rules: MergedRules) -> str:
        html = re.sub(
            r"<script(\s[^>]*)?>[\s\S]*?</script>",
            lambda m: "" if self._is_blocked_attr(m.group(1) or "", rules) or self._block.is_blocked(m.group(0), rules) else m.group(0),
            html, flags=re.IGNORECASE,
        )
        html = re.sub(
            r"<script(\s[^>]*)>",
            lambda m: "" if self._is_blocked_attr(m.group(1) or "", rules) else m.group(0),
            html, flags=re.IGNORECASE,
        )

        for tag in ["iframe", "frame", "embed", "object"]:
            html = re.sub(
                rf"<{tag}(\s[^>]*)?>[\s\S]*?</{tag}>",
                lambda m, t=tag: "" if self._is_blocked_attr(m.group(1) or "", rules) else m.group(0),
                html, flags=re.IGNORECASE,
            )
            html = re.sub(
                rf"<{tag}(\s[^>]*)?>",
                lambda m: "" if self._is_blocked_attr(m.group(1) or "", rules) else m.group(0),
                html, flags=re.IGNORECASE,
            )

        for tag in ["link", "img", "source", "input"]:
            html = re.sub(
                rf"<{tag}(\s[^>]*)*/?>",
                lambda m: "" if self._is_blocked_attr(m.group(1) or "", rules) else m.group(0),
                html, flags=re.IGNORECASE,
            )

        return html

    def _is_blocked_attr(self, attrs: str, rules: MergedRules) -> bool:
        for m in _ATTR_RE.finditer(attrs):
            if self._block.is_blocked(m.group(1), rules):
                return True
        return False
