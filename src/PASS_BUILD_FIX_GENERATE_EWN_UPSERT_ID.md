Fixed generate-ewn production TypeScript build error where Supabase upsert response data was inferred as never. The response id now safely falls back to the generated row id.
