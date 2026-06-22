# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *


class Contract(gl.Contract):
    owner: Address
    stored_value: str
    writes: u256

    def __init__(self, initial_value: str = "missionmesh-storage-ok"):
        self.owner = gl.message.sender_address
        self.stored_value = initial_value
        self.writes = u256(0)

    @gl.public.view
    def get_storage(self) -> str:
        return self.stored_value

    @gl.public.view
    def get_complete_storage(self) -> str:
        return self.stored_value + "|" + str(int(self.writes)) + "|" + str(self.owner)

    @gl.public.write
    def set_storage(self, new_value: str) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("[EXPECTED] only owner")
        if len(new_value) > 256:
            raise gl.vm.UserError("[EXPECTED] value too large")
        self.stored_value = new_value
        self.writes = u256(int(self.writes) + 1)


StorageTestContract = Contract
