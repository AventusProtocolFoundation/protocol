#!/bin/bash

set -e

clear

if [ "$1" == "coverage" ]; then
  scripts/linux/coverage.sh SKIP_ASSERTS
  exit 0
fi

if [ "$ETH_truffleNetwork" == "" ]; then
  export ETH_truffleNetwork="development"
fi
echo "** Using truffle network $ETH_truffleNetwork"

if [ "$ETH_truffleSkipMigrate" != "skip" ]; then
  if [ "$ETH_truffleNetwork" == "development" ]; then
    echo "** Killing old ganache"
    scripts/linux/kill.sh ganache-cli

    # Mnemonic is mandatory for testing with Scala; we may as well use it too.
    echo "** Starting new ganache"
    gnome-terminal -- ganache-cli -l 8000000 -m "provide indoor friend weasel side early tumble assist wrong afraid notice earth plug mad tip"
  fi

  rm -rf build

  echo "** Compiling"
  truffle compile

  export migrationLog=migrationLog-$ETH_truffleNetwork.txt
  if [ "$1" != "test" ]; then
    echo "** Migrating"
    date > $migrationLog
    truffle --network $ETH_truffleNetwork migrate --reset | tee -a $migrationLog
    date >> $migrationLog
  fi
fi

if [ "$1" == "test" ]; then
  truffle --network $ETH_truffleNetwork test $2
  exit 0
fi

if [ "$1" == "api" ]; then
  echo "** Running api tests"
  pushd api
    npm run test
  popd
  exit 0
fi

if [ "$1" == "aventus4s" ]; then
  echo "** Running aventus4s build"
  pushd ../scripts/protocol
    rm -rf ./out
    rm -rf ./protocol-tmp
    echo "*** generate-java-contracts..."
    bash ./generate-java-contracts.sh "../../protocol/" "./out"
    cp -r ./out/io ../../aventus4s/src/main/java
  popd
fi

if [ "$1" != "" ]; then
  echo "** Running $1 tests"
  pushd ../$1
    echo "*** Unit tests..."
    sbt test
    echo "*** Integration tests..."
    sbt it:test
  popd
  exit 0
fi
