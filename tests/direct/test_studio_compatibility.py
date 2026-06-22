from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read_contract(name):
    return (ROOT / "contracts" / name).read_text(encoding="utf-8").splitlines()


def test_studio_headers_and_imports():
    for name in ("mission_mesh.py", "storage_test.py"):
        lines = read_contract(name)
        assert lines[0] == "# v0.2.16"
        assert lines[1].startswith('# { "Depends": "py-genlayer:')
        assert lines[2] == "from genlayer import *"
        text = "\n".join(lines)
        assert "import genlayer" not in text
        assert "import genlayer as gl" not in text
        assert "TreeMap()" not in text
        assert "DynArray()" not in text


def test_mission_mesh_contract_surface():
    text = "\n".join(read_contract("mission_mesh.py"))
    assert "class Contract(gl.Contract):" in text
    assert "def create_mission(" in text
    assert "def claim_task(" in text
    assert "def submit_work(" in text
    assert "def request_replan(" in text
    assert "def withdraw_earnings(" in text
    assert "float" not in text
    assert "strict_eq" not in text
