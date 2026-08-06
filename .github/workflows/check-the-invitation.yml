# Walks the live site after every deploy and reports what a guest would see.
# Runs on GitHub's machines — nothing to install, nothing to run yourself.
#
# One-time setup: Settings → Secrets and variables → Actions → New secret
#   name:  TEST_INVITE_LINK
#   value: a real invitation link, e.g. https://haykalelaine.com/i/abc123/test
#
# Use a link for a household you have created for testing, not a real guest's.
name: Check the invitation

on:
  workflow_dispatch:          # run it yourself from the Actions tab
  schedule:
    - cron: "0 1 * * *"       # and once a day

jobs:
  walk-the-journey:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install --no-save playwright@1.49.0
      - run: npx playwright install --with-deps chromium
      - name: Walk the guest journey
        env:
          INVITE_LINK: ${{ secrets.TEST_INVITE_LINK }}
        run: node tests/walk-the-journey.mjs
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: what-a-guest-sees
          path: tests/screens
