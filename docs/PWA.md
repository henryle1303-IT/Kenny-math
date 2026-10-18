# TuanLeUp PWA

## Implementation

Next.js 15 App Router generates `/manifest.webmanifest` from `src/app/manifest.ts`.
`src/app/layout.tsx` supplies the application name, Apple standalone metadata,
Apple touch icon, favicon and theme colour. Existing page titles and all learning,
admin and authentication flows are retained.

- Name and short name: **TuanLeUp**.
- Display: `standalone`; identity, start URL and scope: `/`.
- Opening the installed app uses the normal application session. If the installed
  window has no valid session, it redirects to `/login`; no account ID or credentials
  appear in the manifest. Some devices keep installed-app sessions separate from Safari.
- PNG icons: 192, 512, dedicated maskable 512, Apple touch 180 and favicon 32.
  The editable source is `public/icons/tuanleup.svg`. Maskable artwork stays within
  the central safe area and the Apple icon has an opaque background.
- No service worker, push notification permission or offline cache is introduced.
  Pages, personal data, attempts and auth APIs are not cached by any PWA layer.
  Normal browser HTTP caching of static assets remains unchanged. Internet access
  is required to sign in, load questions and save answers; full offline use is not supported.
- This change needs no package, environment variable, database migration or Vercel
  setting change. No install banner or browser-specific install button is added.

## Review and deploy to Vercel

Changes are on `codex/tuanleup-pwa`; do not push directly to `main`.

1. Run `npm ci`, `npm run build` and the PWA browser checks below locally. These
   browser checks create a separate SQLite E2E database, never production data.
2. Push the feature branch: `git push -u origin codex/tuanleup-pwa`.
3. Open a pull request targeting `main`. Review the diff and let Vercel build a
   Preview deployment. Preview must use its existing separate database configuration.
4. In the preview, inspect `/manifest.webmanifest`, icon responses and page metadata;
   verify login, logout, account names and normal learning flows. Preview protection
   may require signing into Vercel; keep existing protection in place.
5. **Only after the owner's approval**, merge the PR. The existing Git integration
   builds `main` with `npm run build:vercel`. Wait for **Ready**, then check that
   `https://luyentoankids.vercel.app` points to that deployment. This PWA change
   adds no migration; the existing build still runs its normal migration checks.
6. Visit the public production `/login` and `/manifest.webmanifest` without a Vercel
   session. Inspect Chrome DevTools → Application → Manifest for icon/manifest issues.
   Test adding to the home screen on real iPhone/iPad and Android hardware.

Browser checks (after a production build):

```powershell
npm run build
npx playwright test tests/e2e/pwa.spec.ts tests/e2e/student.spec.ts tests/e2e/profile-navigation.spec.ts
```

If Chromium is not installed, run `npx playwright install chromium`, or set
`PW_CHROMIUM` to an existing Chrome executable before running the checks.

To roll back this release, promote the previous verified production deployment
in Vercel. Data is unaffected by the PWA files. Do not reset or rewrite `main`.

## Install

- **iPhone/iPad:** open `https://luyentoankids.vercel.app` in Safari → Share →
  **Add to Home Screen** → keep **Open as Web App** enabled if shown → Add.
- **Android:** open the same address in Chrome → menu → **Install app** or
  **Add to Home screen** (wording depends on browser/version) → confirm.
- The launcher name is **TuanLeUp**. Launching it should open a standalone window;
  authentication still uses the application's existing login.
- Use the production address for installation. A protected preview is for review,
  not the permanent installed app. Old installed names/icons can require removing
  an old shortcut and adding the app again after the deployment.

## References

- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Next.js manifest file convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)

Automated viewport checks emulate screen sizes; they do not prove that native
installation works on a physical iPhone/iPad/Android device. Record those manual
device checks after the approved production deployment.

## Verification — 18 October 2026

- Production build completed successfully, including TypeScript and ESLint.
- Final browser run: **6/6 tests passed** (34.4 seconds), using installed Chrome against a production Next.js build and a separate SQLite E2E database.
- Browser manifest parser reported no errors; all required PNGs returned 200 with verified dimensions. Both Apple legacy and standard standalone metadata are present.
- Responsive checks: 375×812, 390×844, 844×390 and 768×1024. Login, logout, personalized title, test answering, refresh/persistence, submission, review, progress and admin separation passed.
- Fresh browser contexts had no registered service worker and no Cache Storage entries. No production database, website or deployment setting was changed.
- Physical-device installation and standalone launch on iOS/Android remain manual checks after an approved deployment.
