import json
import os
import tempfile
import pytest

from infra.adapters.proxy.BlockEngine import BlockEngine
from infra.adapters.proxy.ReplaceEngine import ReplaceEngine
from infra.adapters.proxy.HtmlSanitizer import HtmlSanitizer
from infra.adapters.proxy.RulesJsonRepository import RulesJsonRepository
from domain.proxy.ProxyRules import MergedRules, ReplaceRule


def empty_rules(**kwargs) -> MergedRules:
    defaults = dict(blockUrls=[], blockPatterns=[], replace=[], stripHeaders=[])
    defaults.update(kwargs)
    return MergedRules(**defaults)


class TestBlockEngineExactUrl:
    def setup_method(self):
        self.engine = BlockEngine()

    def test_blocks_exact_substring_match(self):
        rules = empty_rules(blockUrls=["ads.tracker.com"])
        assert self.engine.is_blocked("https://ads.tracker.com/pixel", rules) is True

    def test_does_not_block_unrelated_url(self):
        rules = empty_rules(blockUrls=["ads.tracker.com"])
        assert self.engine.is_blocked("https://example.com/page", rules) is False

    def test_blocks_when_substring_appears_in_path(self):
        rules = empty_rules(blockUrls=["analytics"])
        assert self.engine.is_blocked("https://cdn.example.com/analytics.js", rules) is True

    def test_empty_block_urls_never_blocks(self):
        rules = empty_rules()
        assert self.engine.is_blocked("https://anything.com", rules) is False

    def test_multiple_block_urls_any_match(self):
        rules = empty_rules(blockUrls=["tracker.js", "pixel.gif"])
        assert self.engine.is_blocked("https://cdn.example.com/pixel.gif", rules) is True

    def test_block_url_is_case_sensitive(self):
        rules = empty_rules(blockUrls=["Tracker.js"])
        assert self.engine.is_blocked("https://cdn.example.com/tracker.js", rules) is False

    def test_block_url_matches_partial_domain(self):
        rules = empty_rules(blockUrls=["evil"])
        assert self.engine.is_blocked("https://evil-cdn.com/resource", rules) is True


class TestBlockEngineRegexPattern:
    def setup_method(self):
        self.engine = BlockEngine()

    def test_blocks_regex_pattern_match(self):
        rules = empty_rules(blockPatterns=[r"ga\(\s*'send'"])
        assert self.engine.is_blocked("ga( 'send', 'pageview')", rules) is True

    def test_does_not_block_non_matching_pattern(self):
        rules = empty_rules(blockPatterns=[r"^tracking_\d+$"])
        assert self.engine.is_blocked("normal_text", rules) is False

    def test_pattern_is_case_insensitive(self):
        rules = empty_rules(blockPatterns=[r"ANALYTICS"])
        assert self.engine.is_blocked("load analytics module", rules) is True

    def test_multiple_patterns_any_match(self):
        rules = empty_rules(blockPatterns=[r"fbq\(", r"gtag\("])
        assert self.engine.is_blocked("window.gtag('config')", rules) is True

    def test_empty_patterns_never_blocks(self):
        rules = empty_rules(blockPatterns=[])
        assert self.engine.is_blocked("anything", rules) is False

    def test_combined_urls_and_patterns(self):
        rules = empty_rules(blockUrls=["ad-server"], blockPatterns=[r"track_\w+"])
        assert self.engine.is_blocked("track_page_view()", rules) is True
        assert self.engine.is_blocked("https://ad-server.com/img", rules) is True

    def test_complex_regex_with_groups(self):
        rules = empty_rules(blockPatterns=[r"(doubleclick|adsense)\.net"])
        assert self.engine.is_blocked("https://pagead2.adsense.net/tag", rules) is True

    def test_regex_dot_matches_literal_dot(self):
        rules = empty_rules(blockPatterns=[r"google\.analytics"])
        assert self.engine.is_blocked("load google.analytics", rules) is True
        assert self.engine.is_blocked("load googleXanalytics", rules) is False


class TestReplaceEngineLiteral:
    def setup_method(self):
        self.engine = ReplaceEngine()

    def test_literal_replace_on_response(self):
        rules = [ReplaceRule(from_="secret", to="REDACTED")]
        result = self.engine.apply("the secret value", rules, "response")
        assert result == "the REDACTED value"

    def test_no_match_returns_original(self):
        rules = [ReplaceRule(from_="missing", to="X")]
        result = self.engine.apply("hello world", rules, "response")
        assert result == "hello world"

    def test_empty_rules_returns_original(self):
        result = self.engine.apply("some text", [], "response")
        assert result == "some text"

    def test_multiple_literal_rules_applied_sequentially(self):
        rules = [
            ReplaceRule(from_="foo", to="bar"),
            ReplaceRule(from_="bar", to="baz"),
        ]
        result = self.engine.apply("foo", rules, "response")
        assert result == "baz"

    def test_request_phase_rule_applies_on_request(self):
        rules = [ReplaceRule(from_="old", to="new", on="request")]
        result = self.engine.apply("old data", rules, "request")
        assert result == "new data"

    def test_request_phase_rule_skipped_on_response(self):
        rules = [ReplaceRule(from_="old", to="new", on="request")]
        result = self.engine.apply("old data", rules, "response")
        assert result == "old data"

    def test_both_phase_applies_on_request(self):
        rules = [ReplaceRule(from_="token", to="MASKED", on="both")]
        assert self.engine.apply("my token here", rules, "request") == "my MASKED here"

    def test_both_phase_applies_on_response(self):
        rules = [ReplaceRule(from_="token", to="MASKED", on="both")]
        assert self.engine.apply("my token here", rules, "response") == "my MASKED here"


class TestReplaceEngineRegex:
    def setup_method(self):
        self.engine = ReplaceEngine()

    def test_regex_replace_on_response(self):
        rules = [ReplaceRule(from_="regex:\\d{4}-\\d{4}", to="XXXX-XXXX")]
        result = self.engine.apply("card: 1234-5678", rules, "response")
        assert result == "card: XXXX-XXXX"

    def test_regex_replace_is_case_insensitive(self):
        rules = [ReplaceRule(from_="regex:SECRET_KEY", to="[HIDDEN]")]
        result = self.engine.apply("secret_key=abc", rules, "response")
        assert result == "[HIDDEN]=abc"

    def test_regex_replace_with_groups(self):
        rules = [ReplaceRule(from_="regex:(api_key=)\\w+", to="\\1REDACTED")]
        result = self.engine.apply("api_key=abc123", rules, "response")
        assert result == "api_key=REDACTED"

    def test_regex_replace_multiple_occurrences(self):
        rules = [ReplaceRule(from_="regex:\\b\\d{3}\\b", to="***")]
        result = self.engine.apply("codes: 123 and 456", rules, "response")
        assert result == "codes: *** and ***"

    def test_default_phase_is_response(self):
        rules = [ReplaceRule(from_="regex:test", to="X")]
        assert self.engine.apply("test", rules, "response") == "X"
        assert self.engine.apply("test", rules, "request") == "test"

    def test_regex_no_match_returns_original(self):
        rules = [ReplaceRule(from_="regex:^IMPOSSIBLE$", to="X")]
        assert self.engine.apply("normal text", rules, "response") == "normal text"

    def test_regex_replace_on_request_phase(self):
        rules = [ReplaceRule(from_="regex:password=\\w+", to="password=***", on="request")]
        result = self.engine.apply("password=hunter2", rules, "request")
        assert result == "password=***"


class TestHtmlSanitizerScripts:
    def setup_method(self):
        self.block = BlockEngine()
        self.sanitizer = HtmlSanitizer(self.block)

    def test_removes_script_with_blocked_src(self):
        rules = empty_rules(blockUrls=["tracker.js"])
        html = '<script src="https://cdn.tracker.js/v1"></script>'
        assert "<script" not in self.sanitizer.sanitize(html, rules)

    def test_keeps_script_with_safe_src(self):
        rules = empty_rules(blockUrls=["tracker.js"])
        html = '<script src="https://cdn.example.com/app.js"></script>'
        assert "<script" in self.sanitizer.sanitize(html, rules)

    def test_removes_script_with_blocked_inline_content(self):
        rules = empty_rules(blockUrls=["analytics"])
        html = '<script>loadAnalytics("analytics")</script>'
        result = self.sanitizer.sanitize(html, rules)
        assert "analytics" not in result.lower() or "<script" not in result

    def test_removes_iframe_with_blocked_src(self):
        rules = empty_rules(blockUrls=["ad-frame.com"])
        html = '<iframe src="https://ad-frame.com/banner"></iframe>'
        assert "<iframe" not in self.sanitizer.sanitize(html, rules)

    def test_keeps_iframe_with_safe_src(self):
        rules = empty_rules(blockUrls=["ad-frame.com"])
        html = '<iframe src="https://youtube.com/embed/123"></iframe>'
        assert "<iframe" in self.sanitizer.sanitize(html, rules)

    def test_removes_embed_with_blocked_src(self):
        rules = empty_rules(blockUrls=["malware.swf"])
        html = '<embed src="https://cdn.malware.swf/play">'
        assert "<embed" not in self.sanitizer.sanitize(html, rules)

    def test_removes_object_with_blocked_data(self):
        rules = empty_rules(blockUrls=["evil.swf"])
        html = '<object data="https://evil.swf/obj"></object>'
        assert "<object" not in self.sanitizer.sanitize(html, rules)

    def test_removes_img_with_blocked_src(self):
        rules = empty_rules(blockUrls=["pixel.gif"])
        html = '<img src="https://tracker.com/pixel.gif" />'
        assert "<img" not in self.sanitizer.sanitize(html, rules)

    def test_keeps_img_with_safe_src(self):
        rules = empty_rules(blockUrls=["pixel.gif"])
        html = '<img src="https://cdn.example.com/photo.jpg" />'
        assert "<img" in self.sanitizer.sanitize(html, rules)

    def test_removes_link_with_blocked_href(self):
        rules = empty_rules(blockUrls=["bad-style.css"])
        html = '<link rel="stylesheet" href="https://cdn.bad-style.css/v1" />'
        assert "<link" not in self.sanitizer.sanitize(html, rules)

    def test_keeps_safe_html_structure(self):
        rules = empty_rules(blockUrls=["evil"])
        html = "<div><p>Safe paragraph</p><span>Text</span></div>"
        assert self.sanitizer.sanitize(html, rules) == html

    def test_handles_multiple_scripts_mixed(self):
        rules = empty_rules(blockUrls=["tracker"])
        html = (
            '<script src="https://tracker.com/t.js"></script>'
            '<script src="https://safe.com/app.js"></script>'
        )
        result = self.sanitizer.sanitize(html, rules)
        assert "tracker" not in result
        assert "safe.com" in result

    def test_removes_source_tag_with_blocked_src(self):
        rules = empty_rules(blockUrls=["evil-video"])
        html = '<source src="https://evil-video.com/stream.mp4" />'
        assert "<source" not in self.sanitizer.sanitize(html, rules)

    def test_empty_rules_keeps_all_html(self):
        rules = empty_rules()
        html = '<script src="any.js"></script><iframe src="any.com"></iframe>'
        assert self.sanitizer.sanitize(html, rules) == html

    def test_handles_nested_blocked_elements(self):
        rules = empty_rules(blockUrls=["badhost"])
        html = '<div><iframe src="https://badhost.com/widget"><p>content</p></iframe></div>'
        result = self.sanitizer.sanitize(html, rules)
        assert "<iframe" not in result
        assert "<div>" in result


class TestRulesJsonRepository:
    def _write_rules(self, data: dict) -> str:
        fd, path = tempfile.mkstemp(suffix=".json")
        with os.fdopen(fd, "w") as f:
            json.dump(data, f)
        return path

    def test_loads_global_and_site_rules_merged(self):
        path = self._write_rules({
            "global": {"blockUrls": ["global-ad.js"], "stripHeaders": ["x-powered-by"]},
            "sites": {
                "example.com": {"blockUrls": ["site-tracker.js"]},
            },
        })
        repo = RulesJsonRepository(path)
        merged = repo.get_merged("example.com")
        assert "global-ad.js" in merged.blockUrls
        assert "site-tracker.js" in merged.blockUrls
        assert "x-powered-by" in merged.stripHeaders
        os.unlink(path)

    def test_returns_only_global_for_unknown_site(self):
        path = self._write_rules({
            "global": {"blockUrls": ["global-ad.js"]},
            "sites": {"other.com": {"blockUrls": ["other-tracker.js"]}},
        })
        repo = RulesJsonRepository(path)
        merged = repo.get_merged("unknown.com")
        assert merged.blockUrls == ["global-ad.js"]
        os.unlink(path)

    def test_file_not_found_returns_empty_rules(self):
        repo = RulesJsonRepository("/nonexistent/path/rules.json")
        merged = repo.get_merged("any.com")
        assert merged.blockUrls == []
        assert merged.blockPatterns == []
        assert merged.replace == []
        assert merged.stripHeaders == []

    def test_empty_file_returns_empty_rules(self):
        fd, path = tempfile.mkstemp(suffix=".json")
        os.close(fd)
        repo = RulesJsonRepository(path)
        merged = repo.get_merged("any.com")
        assert merged.blockUrls == []
        os.unlink(path)

    def test_parses_replace_rules_with_on_field(self):
        path = self._write_rules({
            "global": {
                "replace": [
                    {"from": "old_token", "to": "new_token", "on": "both"},
                    {"from": "secret", "to": "HIDDEN"},
                ],
            },
            "sites": {},
        })
        repo = RulesJsonRepository(path)
        merged = repo.get_merged("any.com")
        assert len(merged.replace) == 2
        assert merged.replace[0].from_ == "old_token"
        assert merged.replace[0].on == "both"
        assert merged.replace[1].on is None
        os.unlink(path)
