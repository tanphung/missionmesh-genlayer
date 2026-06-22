import os
import tempfile


def pytest_configure(config):
    from gltest.direct import loader
    from gltest.direct.vm import VMContext

    def windows_safe_inject_message_to_fd0(vm):
        try:
            from genlayer.py import calldata
            from genlayer.py.types import Address
        except ImportError:
            return

        sender_addr = vm.sender
        if isinstance(sender_addr, bytes):
            sender_addr = Address(sender_addr)

        contract_addr = vm._contract_address
        if isinstance(contract_addr, bytes):
            contract_addr = Address(contract_addr)

        origin_addr = vm.origin
        if isinstance(origin_addr, bytes):
            origin_addr = Address(origin_addr)

        message_data = {
            "contract_address": contract_addr,
            "sender_address": sender_addr,
            "origin_address": origin_addr,
            "stack": [],
            "value": vm._value,
            "datetime": vm._datetime,
            "is_init": False,
            "chain_id": vm._chain_id,
            "entry_kind": 0,
            "entry_data": b"",
            "entry_stage_data": None,
        }

        encoded = calldata.encode(message_data)
        fd, path = tempfile.mkstemp(prefix="missionmesh-gltest-")
        os.write(fd, encoded)
        os.lseek(fd, 0, os.SEEK_SET)
        vm._original_stdin_fd = os.dup(0)
        vm._missionmesh_stdin_path = path
        os.dup2(fd, 0)
        os.close(fd)

    loader._inject_message_to_fd0 = windows_safe_inject_message_to_fd0

    original_refresh = VMContext._refresh_gl_message

    def refresh_with_datetime(self):
        original_refresh(self)
        import sys

        if "genlayer.gl" in sys.modules:
            gl = sys.modules["genlayer.gl"]
            if hasattr(gl, "message_raw") and gl.message_raw is not None:
                gl.message_raw["datetime"] = self._datetime

    VMContext._refresh_gl_message = refresh_with_datetime
