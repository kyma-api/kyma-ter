# Kyma Ter Frontend

This directory contains the React frontend for Kyma Ter.

For product, architecture, and release context, read the repo root README:

- `../README.md`

Frontend runtime entrypoints:

- `src/App.tsx`
- `src/main.tsx`

Run the frontend in development:

```bash
npm install
npm run dev
```

The frontend is only one part of the product. Kyma Ter behavior is defined jointly by:

- the Go server in `../cmd` and `../internal`
- the frontend in this directory
- the packaging flow in `kyma-api/packages/kyma-agent`
