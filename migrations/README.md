The migration 2_libraries is split into multiple sub-migrations.
This is due to a bug in truffle 5.0.0 which causes solidity-coverage to fail when migration files are too large.

The naming convention is to ensure the sub-migrations run in the correct order (ie. libraries deployed in 21 may depend on those deployed in 20).

TODO: Check if this has been fixed in subsequent Solidity versions.