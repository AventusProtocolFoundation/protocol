The migration 2_libraries is split into three sub-migrations (2_librariesA-C).
This is due to a bug in truffle 5.0.0 which causes solidity-coverage to fail when migration files are too large.

The naming convention is to ensure the sub-migrations run in the correct order (ie. libraries deployed in B may depend on those deployed in A).