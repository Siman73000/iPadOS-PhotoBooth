# Wedding Photo Booth

An iPad-first wedding photo booth built with Next.js, Safari camera APIs, Vercel, and Redis Cloud using the official `node-redis` client.

## Features

- Rear-facing iPad camera (`facingMode: environment`)
- Very large touch-first controls for guests
- Single-photo mode
- Three-photo strip mode with automatic countdowns
- Photo-strip composition rendered in the browser
- JPEG compression before upload
- Photos stored directly in Redis as binary chunks
- QR code generated in the browser for every saved photo
- QR destination serves the photo from Redis as a downloadable/viewable JPEG
- Automatic return to the welcome screen after 30 seconds
- No audio, no printer, no guest login

## Redis Cloud + Vercel deployment

1. Create a Redis Cloud database. Redis provides a Vercel integration that can provision a Redis Cloud database and connect it to a Vercel project.
2. In Vercel, connect the Redis Cloud database to this project.
3. Add the Redis Cloud connection string as the Vercel environment variable `REDIS_URL`.
4. Deploy the repository as a Next.js application.
5. Open the deployment in Safari on the iPad and grant camera permission.
6. Add the site to the iPad Home Screen for a more app-like booth experience.

The application uses `node-redis` and expects a standard Redis connection URL. Prefer the TLS (`rediss://`) connection string supplied by Redis Cloud for production.

## Local development

Create `.env.local` using `.env.example`, then run:

```bash
npm install
npm run dev
```

## Notes about Redis photo storage

The app stores photo bytes directly in Redis. Images are split into 2 MB chunks to keep individual application operations manageable. Redis strings support binary data, so the application stores each chunk as raw bytes rather than base64-encoding the image in the database.

The default client compression target is below 4.0 MB, leaving room under Vercel's 4.5 MB Function request/response limit.

For a real wedding, choose a Redis Cloud plan with enough storage and bandwidth for the expected number of photos. `PHOTO_TTL_SECONDS` can be set to automatically expire photos after the wedding, such as `2592000` for 30 days.

## Wedding branding

The current visual system is intentionally white and blue. Replace the `OUR WEDDING` footer in `components/PhotoBooth.tsx` and the title/subtitle strings in that file with the couple's names/date before deployment.
