#!/bin/bash
grep -rh "import .* from " src/ src-server/ server.ts | awk '{print $4}' | grep -o "['\"][^'\"]*['\"]" | sed "s/['\"]//g" | grep -v "^\." | sort | uniq > deps.txt
cat deps.txt
