# Build Fix - Event Evidence Title TypeScript Error

This pass fixes the production TypeScript build error in:

`src/app/app/event/[id]/evidence/page.tsx`

The build error was:

`Property 'title' does not exist on type 'never'.`

The evidence page now reads the event through `getOwnedEventOrThrow(...)` and safely accesses the returned title via a type-safe compatibility cast:

`setEventTitle((ev as { title?: string | null }).title ?? "");`

If the build output still points to:

`const ev = await supabase.from("events").select("id,title")...`

then the build is running against an older local folder, not this fixed source.
