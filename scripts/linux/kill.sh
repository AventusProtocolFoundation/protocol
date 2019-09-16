#!/bin/bash
set -e

process=$(ps -edafl | grep $1 | grep -v kill | grep -v grep | awk '{print $4}')
numLines=$(echo $process | wc -l)
if [ "$numLines" != "1" ]; then
  echo "Please be more specific: too many matches for '$1'"
  exit 1
fi
if [ "$process" != "" ]; then
  kill -9 $process
fi
