#!/bin/bash
# ─── Setup 4GB Swap Space for VPS ─────────────────────────────────────────────
#
# Run this ONCE on VPS to create swap space.
# Swap prevents OOM killer from murdering Chromium during Remotion renders.
#
# Memory budget with swap:
#   4GB RAM + 4GB Swap = 8GB total addressable memory
#   Next.js: 1.5GB | Remotion CLI: 1GB | Chromium: 1-1.5GB | OS: 0.5GB
#   Swap catches any overflow → OOM killer stays away
#
# Usage:
#   chmod +x scripts/setup-swap.sh
#   sudo ./scripts/setup-swap.sh
#

set -e

echo "=== Setting up 4GB swap file ==="

# Check if swap already exists
if swapon --show | grep -q /swapfile; then
    echo "Swap already active:"
    swapon --show
    free -h
    exit 0
fi

# Create 4GB swap file
echo "Creating 4GB swap file..."
fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1G count=4
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Make permanent (survives reboot)
if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Set swappiness low — only use swap under pressure
sysctl vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf 2>/dev/null || true

echo ""
echo "=== Swap setup complete ==="
free -h
echo ""
echo "Swap is now active. Remotion renders should no longer OOM."
