import os
from pathlib import Path

import pytest


RUN_STUDIONET = os.getenv("ENABLE_STUDIONET_SMOKE_TEST", "").lower() == "true"
pytestmark = pytest.mark.skipif(
    not RUN_STUDIONET,
    reason="Studionet integration tests are disabled. Set ENABLE_STUDIONET_SMOKE_TEST=true after Studio/faucet setup.",
)


def _factory(path: str):
    from gltest import get_contract_factory

    return get_contract_factory(contract_file_path=Path(path))


def _succeeded(receipt) -> bool:
    from gltest.assertions import tx_execution_succeeded

    return tx_execution_succeeded(receipt)


def test_storage_test_deploy_and_read():
    factory = _factory("contracts/storage_test.py")
    contract = factory.deploy(args=["MissionMesh storage sanity"])

    assert contract.get_storage(args=[]).call() == "MissionMesh storage sanity"

    receipt = contract.set_storage(args=["MissionMesh storage updated"]).transact()
    assert _succeeded(receipt)
    assert contract.get_storage(args=[]).call() == "MissionMesh storage updated"


def test_mission_mesh_deploy_and_config_read():
    factory = _factory("contracts/mission_mesh.py")
    contract = factory.deploy(args=[1, 250])

    config_raw = contract.get_protocol_config(args=[]).call()
    assert '"minimum_mission_budget":1' in config_raw
    assert '"protocol_fee_bps":250' in config_raw


def test_live_mission_flow_requires_explicit_write_enable():
    if os.getenv("ENABLE_LIVE_MISSION_FLOW", "").lower() != "true":
        pytest.skip("Set ENABLE_LIVE_MISSION_FLOW=true before creating funded Studionet missions.")

    pytest.fail(
        "Use scripts/smoke-test-studionet.ts for the funded mission flow after deployment. "
        "This guard keeps gltest deployment/read coverage separate from live GEN writes."
    )
