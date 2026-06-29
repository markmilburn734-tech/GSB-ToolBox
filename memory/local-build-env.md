---
name: local-build-env
description: This machine has no Node/npm; the app builds via Firebase App Hosting CI, not locally
metadata:
  type: project
---

`node` and `npm` are NOT installed on this Windows machine, so `npm run build`/`npm run dev` cannot be run here. The app deploys via Firebase App Hosting (see `apphosting.yaml`, which runs `npm run start`), where the build actually happens.

Python 3.13 and `curl` ARE available — use them to verify logic. The data tabs are public Google Sheets CSVs (URLs in `src/constants.js`), so algorithm changes can be validated by replicating them in Python against the live CSV rather than running the app. After code changes, ask the user to run `npm run dev` for the real visual check.
