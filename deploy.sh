#!/bin/bash

# Check if a commit message is provided
if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh \"commit message\""de
  exit 1
fi


# Git commands
git add .
git config --global core.autocrlf true
git commit -m "$1"
git push

# Pull latest changes (optional, depending on your workflow)
git pull