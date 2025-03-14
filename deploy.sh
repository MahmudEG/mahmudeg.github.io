#!/bin/bash

# Check if a commit message is provided
if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh \"commit message\""
  exit 1
fi

# Replace Google Analytics code (adjust the sed command as needed)
# Example: Replace "UA-XXXXX-Y" with your new Google Analytics code
sed -i 's/UA-XXXXX-Y/UA-NEW-CODE/g' path/to/your/file.html

# Git commands
git add .
git config --global core.autocrlf true
git commit -m "$1"
git push

# Pull latest changes (optional, depending on your workflow)
git pull