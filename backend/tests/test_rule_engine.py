import asyncio

from app.models.rule import (
    Rule,
    TRIGGER_DWELL,
    TRIGGER_ENTER,
    TRIGGER_EXIT,
    TRIGGER_OCCUPANCY,
)
from app.schemas.radar import RadarFrame, RadarTarget
from app.services import rule_engine as re_mod
from app.services.rule_engine import (
    RuleEngine,
    _DeviceRules,
    _RuleRuntime,
    point_in_polygon,
)

# A 2m x 2m box centred over the x axis, 0..2m forward.
SQUARE = [{"x": -1, "y": 0}, {"x": 1, "y": 0}, {"x": 1, "y": 2}, {"x": -1, "y": 2}]


def _frame(*pts):
    return RadarFrame(targets=[RadarTarget(x=x, y=y) for x, y in pts])


def _engine_with_rule(rule):
    """Engine pre-seeded so evaluate() runs without touching the DB, with _fire
    replaced by a recorder."""
    eng = RuleEngine()
    eng._version[1] = 0
    eng._cache[1] = _DeviceRules(
        version=0,
        zones={1: SQUARE},
        rules=[rule],
        runtime={rule.id: _RuleRuntime()},
    )
    fired: list = []

    async def fake_fire(r, dev, detail, session):
        fired.append((r.trigger_type, detail))

    eng._fire = fake_fire  # type: ignore[assignment]
    return eng, fired


def _run(coro):
    return asyncio.run(coro)


class TestPointInPolygon:
    def test_inside(self):
        assert point_in_polygon(0, 1, SQUARE) is True

    def test_outside(self):
        assert point_in_polygon(5, 5, SQUARE) is False
        assert point_in_polygon(0, -1, SQUARE) is False

    def test_degenerate_polygon(self):
        assert point_in_polygon(0, 0, [{"x": 0, "y": 0}, {"x": 1, "y": 1}]) is False


class TestTriggers:
    def test_enter_fires_on_transition_only(self):
        rule = Rule(id=1, zone_id=1, device_id=1, name="e", trigger_type=TRIGGER_ENTER, cooldown_seconds=0)
        eng, fired = _engine_with_rule(rule)
        _run(eng.evaluate(1, _frame(), None))          # empty
        assert fired == []
        _run(eng.evaluate(1, _frame((0, 1)), None))    # 0 -> 1: enter
        assert len(fired) == 1
        _run(eng.evaluate(1, _frame((0, 1)), None))    # still inside: no refire
        assert len(fired) == 1

    def test_exit_fires_when_zone_empties(self):
        rule = Rule(id=1, zone_id=1, device_id=1, name="x", trigger_type=TRIGGER_EXIT, cooldown_seconds=0)
        eng, fired = _engine_with_rule(rule)
        _run(eng.evaluate(1, _frame((0, 1)), None))    # occupied
        assert fired == []
        _run(eng.evaluate(1, _frame(), None))          # -> empty: exit
        assert len(fired) == 1

    def test_occupancy_fires_on_threshold_crossing(self):
        rule = Rule(
            id=1, zone_id=1, device_id=1, name="o",
            trigger_type=TRIGGER_OCCUPANCY, occupancy_threshold=2, cooldown_seconds=0,
        )
        eng, fired = _engine_with_rule(rule)
        _run(eng.evaluate(1, _frame((0, 1)), None))            # count 1 < 2
        assert fired == []
        _run(eng.evaluate(1, _frame((0, 1), (0.5, 1)), None))  # count 2: crosses
        assert len(fired) == 1
        _run(eng.evaluate(1, _frame((0, 1), (0.5, 1)), None))  # still 2: no refire
        assert len(fired) == 1

    def test_dwell_fires_after_threshold(self, monkeypatch):
        clock = [1000.0]
        monkeypatch.setattr(re_mod.time, "monotonic", lambda: clock[0])
        rule = Rule(
            id=1, zone_id=1, device_id=1, name="d",
            trigger_type=TRIGGER_DWELL, dwell_seconds=5, cooldown_seconds=0,
        )
        eng, fired = _engine_with_rule(rule)
        _run(eng.evaluate(1, _frame((0, 1)), None))    # occupied_since = 1000
        assert fired == []
        clock[0] = 1004
        _run(eng.evaluate(1, _frame((0, 1)), None))    # 4s < 5
        assert fired == []
        clock[0] = 1006
        _run(eng.evaluate(1, _frame((0, 1)), None))    # 6s >= 5: fire
        assert len(fired) == 1
        clock[0] = 1007
        _run(eng.evaluate(1, _frame((0, 1)), None))    # already fired this episode
        assert len(fired) == 1

    def test_cooldown_suppresses_rapid_refire(self, monkeypatch):
        clock = [0.0]
        monkeypatch.setattr(re_mod.time, "monotonic", lambda: clock[0])
        rule = Rule(id=1, zone_id=1, device_id=1, name="e", trigger_type=TRIGGER_ENTER, cooldown_seconds=100)
        eng, fired = _engine_with_rule(rule)
        clock[0] = 1
        _run(eng.evaluate(1, _frame((0, 1)), None))    # enter -> fire
        assert len(fired) == 1
        clock[0] = 2
        _run(eng.evaluate(1, _frame(), None))          # exit (no rule)
        clock[0] = 3
        _run(eng.evaluate(1, _frame((0, 1)), None))    # re-enter within cooldown: suppressed
        assert len(fired) == 1


class TestCacheReload:
    def test_invalidate_triggers_reload(self):
        eng = RuleEngine()
        calls: list = []

        def fake_load(dev, session):
            dr = _DeviceRules(version=eng._version.get(dev, 0), zones={}, rules=[], runtime={})
            eng._cache[dev] = dr
            calls.append(dev)
            return dr

        eng._load = fake_load  # type: ignore[assignment]
        _run(eng.evaluate(1, _frame(), None))  # cold: loads
        _run(eng.evaluate(1, _frame(), None))  # warm: cached
        eng.invalidate(1)
        _run(eng.evaluate(1, _frame(), None))  # version bumped: reloads
        assert calls == [1, 1]
