# Wedding Photo Booth

An iPad-first wedding photo booth built with Next.js, Safari camera APIs, Vercel, and Upstash Redis.

## Features

- Rear-facing iPad camera (`facingMode: environment`)
- Very large touch-first controls for guests
- Single-photo mode
- Three-photo strip mode with automatic countdowns
- Photo-strip composition rendered in the browser
- JPEG compression before upload
- Photos stored as binary chunks in Redis
- QR code generated in the browser for every saved photo
- QR destination serves the photo from Redis as a downloadable/viewable JPEG
- Automatic return to the welcome screen after 30 seconds
- No audio, no printer, no guest login

## Deployment

1. Create an Upstash Redis database. Vercel's Upstash integration can provision/connect the database, and the app can use `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables. See the Upstash Next.js and Vercel integration documentation.
2. Add the values from `.env.example` to the Vercel project's Environment Variables.
3. Deploy this repository as a Next.js application.
4. Open the deployment in Safari on the iPad and grant camera permission.
5. Add the site to the iPad Home Screen for a more app-like booth experience.

## Notes about Redis photo storage

The app stores photo bytes directly in Redis. Images are split into 2 MB chunks because Upstash limits individual requests and records. The default client compression target is below 4.0 MB, leaving room under Vercel's 4.5 MB Function request/response limit.

For a real wedding, choose an Upstash plan with enough storage/bandwidth for the expected number of guests. The app supports an optional `PHOTO_TTL_SECONDS` setting, but it is blank by default so photos do not expire automatically.

## Wedding branding

The current visual system is intentionally white and blue. Replace the `OUR WEDDING` footer in `components/PhotoBooth.tsx` and the title/subtitle strings in that file with the couple's names/date before deployment.
