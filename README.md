# bun-react-tailwind-shadcn-template

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

Set `BUN_PUBLIC_API_BASE_URL` to the backend API base URL when the backend is
not available at `/api` on the same origin. For example:

```bash
BUN_PUBLIC_API_BASE_URL=http://localhost:3001/api bun dev
```

The value is read by the Bun server in development and written to
`api-config.json` during a production build.

For Vercel, use `frontend/` as the project root (or configure the equivalent
root directory in the project settings). `vercel.json` sets the build command
and tells Vercel to publish the generated `dist/` directory. Set
`BUN_PUBLIC_API_BASE_URL` in the Vercel project environment variables to the
deployed backend URL, including `/api`.

To type check:

```bash
bun check
```

Run `bun fmt` to format the code.

This project was created using `bun init` in bun v1.4.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
