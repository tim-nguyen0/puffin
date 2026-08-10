# run with `python3 -m pytest` from sim/packages/offboard_demo. the executor
# needs ros, but the autokill timing — how long a forged node keeps feeding px4
# after its last waypoint, before it loiters and exits — is pure arithmetic.
import pytest
from offboard_demo.mission_node import GRACE_S, WARMUP_S, grace_ticks
from offboard_demo.mission_plan import MAX_RATE_HZ, MIN_RATE_HZ


@pytest.mark.parametrize("rate_hz", [MIN_RATE_HZ, 10.0, 20.0, 50.0, MAX_RATE_HZ])
def test_grace_is_the_same_wall_time_at_every_plan_rate(rate_hz: float) -> None:
    # the tick loop streams one setpoint per tick, so ticks / rate is the
    # seconds px4 stays fed after "done"
    assert grace_ticks(rate_hz) / rate_hz == pytest.approx(GRACE_S)


def test_grace_at_the_default_rate() -> None:
    assert grace_ticks(20.0) == 100


def test_grace_is_never_zero_ticks() -> None:
    # a rate this low can't come from a parsed plan, but cutting the stream on
    # the same tick that reports done would leave px4 with nothing between the
    # last setpoint and the loiter handover
    assert grace_ticks(0.1) == 1


def test_grace_outlasts_the_offboard_warmup() -> None:
    # px4 needs longer to settle on the final target than it needed to accept
    # OFFBOARD in the first place
    assert GRACE_S > WARMUP_S
