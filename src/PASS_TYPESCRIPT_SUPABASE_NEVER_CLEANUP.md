# TypeScript Supabase `never` cleanup

This pass addresses the production-build errors caused by Supabase response data being inferred as `never` when the generated database types are unavailable/incomplete.

Changed:
- Replaced direct `.data.foo` and `.data?.foo` property access with safe `(response.data as any)?.foo` access across app/lib files.
- Confirmed the previously failing `generate-ewn` `projectRes.data.id` and `upsertRes.data.id` accesses are no longer direct `never` accesses.
- Confirmed the previous `evidence/page.tsx` event title access no longer uses the direct failing `ev.data?.title` pattern.

Note:
- The uploaded zip only contains the `src` folder and does not include `package.json`, `tsconfig.json`, or project dependencies, so a full `npm run build` could not be executed inside this sandbox from the uploaded archive alone.
- After copying this `src` folder into the actual project parent that contains `package.json`, run `npm run build` again.
