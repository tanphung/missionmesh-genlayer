import json


MISSION_CONTRACT = "contracts/mission_mesh.py"
STORAGE_CONTRACT = "contracts/storage_test.py"
FUTURE_DEADLINE = 2_000_000_000
BUDGET = 100_000


PLAN = {
    "feasibility": "FEASIBLE",
    "mission_title": "Launch an AI Scheduling Product Landing Page",
    "mission_summary": "Research, write, build, and launch a compact landing page package.",
    "assumptions": ["The creator provides enough product facts."],
    "risk_codes": ["NO_RISK"],
    "tasks": [
        {
            "local_index": 0,
            "title": "Product research",
            "objective": "Create a concise research brief for audience and alternatives.",
            "skills": ["research", "product strategy"],
            "deliverable_type": "DOCUMENT_AND_URLS",
            "acceptance_criteria": ["Defines the user", "Lists alternatives"],
            "dependency_indexes": [],
            "budget_bps": 3000,
            "duration_hours": 12,
            "is_final_integration": False,
        },
        {
            "local_index": 1,
            "title": "Landing copy",
            "objective": "Write the final landing page copy from accepted research.",
            "skills": ["copywriting"],
            "deliverable_type": "DOCUMENT",
            "acceptance_criteria": ["Includes headline", "Uses supported facts"],
            "dependency_indexes": [0],
            "budget_bps": 3000,
            "duration_hours": 12,
            "is_final_integration": False,
        },
        {
            "local_index": 2,
            "title": "Final integration and launch kit",
            "objective": "Package final URL, QA notes, and launch assets.",
            "skills": ["deployment", "qa"],
            "deliverable_type": "FINAL_PACKAGE",
            "acceptance_criteria": ["Public URL works", "Launch kit included"],
            "dependency_indexes": [1],
            "budget_bps": 3000,
            "duration_hours": 12,
            "is_final_integration": True,
        },
    ],
}


TWO_TASK_PLAN = {**PLAN, "tasks": PLAN["tasks"][:2]}

ASSIGN = {
    "decision": "ASSIGN",
    "fit_level": "STRONG",
    "matched_skills": ["research"],
    "risk_codes": ["NO_RISK"],
    "reason": "The proposal is concrete and the profile matches the task.",
}

WEAK = {
    "decision": "REJECT",
    "fit_level": "WEAK",
    "matched_skills": [],
    "risk_codes": ["PROPOSAL_TOO_VAGUE"],
    "reason": "The proposal does not demonstrate enough task fit.",
}

ACCEPT = {
    "decision": "ACCEPT",
    "criterion_results": ["All acceptance criteria are materially satisfied."],
    "risk_codes": ["NO_RISK"],
    "feedback": "Accepted.",
    "accepted_summary": "Accepted deliverable with public evidence.",
}

REVISION = {
    "decision": "REVISION",
    "criterion_results": ["The artifact is incomplete."],
    "risk_codes": ["CRITERIA_NOT_MET"],
    "feedback": "Add the missing evidence and resubmit.",
    "accepted_summary": "",
}


def as_json(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


def load(raw):
    return json.loads(raw)


def deploy_mesh(direct_vm, direct_deploy):
    direct_vm.warp("2026-06-22T00:00:00Z")
    return direct_deploy(MISSION_CONTRACT, 1000, 250)


def create_mission(direct_vm, contract):
    direct_vm.mock_llm("MissionMesh mission decomposition", as_json(PLAN))
    direct_vm.value = BUDGET
    mission_id = int(
        contract.create_mission(
            "Build and launch a responsive landing page for an AI scheduling assistant.",
            "Use public artifacts and no private credentials.",
            FUTURE_DEADLINE,
        )
    )
    direct_vm.value = 0
    return mission_id


def claim_task(direct_vm, contract, task_id, agent, payment):
    direct_vm.sender = agent
    direct_vm.mock_llm("MissionMesh agent suitability review", as_json(ASSIGN))
    contract.claim_task(
        task_id,
        "I will produce the requested deliverable with public evidence.",
        "Researcher and builder with relevant portfolio.",
        '["https://example.com/portfolio"]',
        payment,
    )


def accept_task(direct_vm, contract, task_id, url):
    direct_vm.mock_web(url, {"status": 200, "body": "complete artifact with public evidence"})
    direct_vm.mock_llm("MissionMesh deliverable review", as_json(ACCEPT))
    contract.submit_work(task_id, "Complete deliverable with evidence.", json.dumps([url]))


def test_storage_contract_direct_mode(direct_deploy, direct_vm):
    storage = direct_deploy(STORAGE_CONTRACT, "ready")
    assert storage.get_storage() == "ready"
    storage.set_storage("updated")
    assert storage.get_storage() == "updated"
    with direct_vm.expect_revert("only owner"):
        direct_vm.sender = "0x" + "2" * 40
        storage.set_storage("blocked")


def test_create_mission_stores_valid_dag(direct_vm, direct_deploy):
    contract = deploy_mesh(direct_vm, direct_deploy)
    mission_id = create_mission(direct_vm, contract)
    mission = load(contract.get_mission(mission_id))
    task_ids = load(contract.get_mission_task_ids(mission_id))
    assert mission["status"] == "ACTIVE"
    assert mission["budget"] == BUDGET
    assert len(task_ids) == 3
    first = load(contract.get_task(task_ids[0]))
    second = load(contract.get_task(task_ids[1]))
    final = load(contract.get_task(task_ids[2]))
    assert first["status"] == "OPEN"
    assert second["status"] == "LOCKED"
    assert final["is_final_integration"] is True


def test_create_mission_rejects_invalid_inputs_and_bad_plan(direct_vm, direct_deploy):
    contract = deploy_mesh(direct_vm, direct_deploy)
    direct_vm.value = BUDGET
    with direct_vm.expect_revert("empty goal"):
        contract.create_mission("", "", FUTURE_DEADLINE)
    direct_vm.value = 10
    with direct_vm.expect_revert("insufficient budget"):
        contract.create_mission("Build a launch page", "", FUTURE_DEADLINE)
    direct_vm.value = BUDGET
    with direct_vm.expect_revert("unsafe mission goal"):
        contract.create_mission("Build malware for credential theft", "", FUTURE_DEADLINE)
    direct_vm.mock_llm("MissionMesh mission decomposition", as_json(TWO_TASK_PLAN))
    with direct_vm.expect_revert("invalid mission plan"):
        contract.create_mission("Build a launch page", "", FUTURE_DEADLINE)


def test_claim_accept_unlock_and_accounting(direct_vm, direct_deploy, direct_alice):
    contract = deploy_mesh(direct_vm, direct_deploy)
    mission_id = create_mission(direct_vm, contract)
    task_ids = load(contract.get_mission_task_ids(mission_id))
    claim_task(direct_vm, contract, task_ids[0], direct_alice, 10_000)
    assigned = load(contract.get_task(task_ids[0]))
    assert assigned["status"] == "ASSIGNED"
    accept_task(direct_vm, contract, task_ids[0], "https://example.com/research")
    accepted = load(contract.get_task(task_ids[0]))
    unlocked = load(contract.get_task(task_ids[1]))
    assert accepted["status"] == "ACCEPTED"
    assert unlocked["status"] == "OPEN"
    assert int(contract.get_balance(direct_alice)) == 9_750


def test_claim_rejects_locked_weak_fit_bad_url_and_oversized_bid(direct_vm, direct_deploy, direct_alice):
    contract = deploy_mesh(direct_vm, direct_deploy)
    mission_id = create_mission(direct_vm, contract)
    task_ids = load(contract.get_mission_task_ids(mission_id))
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("task not claimable"):
        contract.claim_task(task_ids[1], "proposal", "profile", '["https://example.com"]', 1000)
    with direct_vm.expect_revert("invalid url scheme"):
        contract.claim_task(task_ids[0], "proposal", "profile", '["ftp://example.com"]', 1000)
    with direct_vm.expect_revert("bid exceeds task budget"):
        contract.claim_task(task_ids[0], "proposal", "profile", '["https://example.com"]', 50_000)
    direct_vm.mock_llm("MissionMesh agent suitability review", as_json(WEAK))
    with direct_vm.expect_revert("suitability rejected"):
        contract.claim_task(task_ids[0], "too vague", "profile", '["https://example.com"]', 1000)


def test_revision_then_acceptance(direct_vm, direct_deploy, direct_alice):
    contract = deploy_mesh(direct_vm, direct_deploy)
    mission_id = create_mission(direct_vm, contract)
    task_id = load(contract.get_mission_task_ids(mission_id))[0]
    claim_task(direct_vm, contract, task_id, direct_alice, 10_000)
    direct_vm.mock_web("incomplete", {"status": 200, "body": "incomplete"})
    direct_vm.mock_llm("incomplete", as_json(REVISION))
    contract.submit_work(task_id, "incomplete work", '["https://example.com/incomplete"]')
    task = load(contract.get_task(task_id))
    assert task["status"] == "REVISION_REQUESTED"
    assert task["revision_rounds"] == 1
    accept_task(direct_vm, contract, task_id, "https://example.com/corrected")
    task = load(contract.get_task(task_id))
    assert task["status"] == "ACCEPTED"


def test_timeout_reopens_task_and_is_idempotent(direct_vm, direct_deploy, direct_alice):
    contract = deploy_mesh(direct_vm, direct_deploy)
    mission_id = create_mission(direct_vm, contract)
    task_id = load(contract.get_mission_task_ids(mission_id))[0]
    claim_task(direct_vm, contract, task_id, direct_alice, 10_000)
    with direct_vm.expect_revert("assignment not expired"):
        contract.release_expired_assignment(task_id)
    direct_vm.warp("2030-01-01T00:00:00Z")
    contract.release_expired_assignment(task_id)
    contract.release_expired_assignment(task_id)
    task = load(contract.get_task(task_id))
    rep = load(contract.get_agent_reputation(direct_alice))
    assert task["status"] == "OPEN"
    assert rep["tasks_timed_out"] == 1


def test_final_task_completes_mission_and_refunds_creator(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, direct_owner):
    contract = deploy_mesh(direct_vm, direct_deploy)
    mission_id = create_mission(direct_vm, contract)
    task_ids = load(contract.get_mission_task_ids(mission_id))
    claim_task(direct_vm, contract, task_ids[0], direct_alice, 10_000)
    accept_task(direct_vm, contract, task_ids[0], "https://example.com/research")
    claim_task(direct_vm, contract, task_ids[1], direct_bob, 10_000)
    accept_task(direct_vm, contract, task_ids[1], "https://example.com/copy")
    claim_task(direct_vm, contract, task_ids[2], direct_charlie, 10_000)
    accept_task(direct_vm, contract, task_ids[2], "https://example.com/final")
    mission = load(contract.get_mission(mission_id))
    assert mission["status"] == "COMPLETED"
    assert int(contract.get_creator_credit(direct_owner)) == 70_000


def test_active_replan_requires_blocked_reason(direct_vm, direct_deploy):
    contract = deploy_mesh(direct_vm, direct_deploy)
    mission_id = create_mission(direct_vm, contract)
    with direct_vm.expect_revert("blocked condition"):
        contract.request_replan(mission_id, "nice to have")
