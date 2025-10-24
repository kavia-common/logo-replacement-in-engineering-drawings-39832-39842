#!/bin/bash
cd /home/kavia/workspace/code-generation/logo-replacement-in-engineering-drawings-39832-39842/logo_replacement_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

