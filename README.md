# Banking app for the Fixing CI demo

The Playwright tests live in `nikolarss0n/demo-fixing-tests`.

This fixture copies the runtime source of `fibank-demo-app`, the Aster banking
demo used by the Playwright `demo_fixing` project. `SOURCE-FILES.txt` lists the
copied files. Application behavior, package versions, and the dependency lock
are preserved; the Vite configuration runs locally without desktop Sites or
Cloudflare hosting plugins. No hosting configuration or environment files are
included.

Use Node.js 22.13 or newer:

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 4174
```

Readiness: `http://127.0.0.1:4174/api/bank` returns a JSON object containing `bank`.
The demo PIN is `2468`; tests reset their own baseline state through
`POST /api/bank/reset`. No external account or database is required.
