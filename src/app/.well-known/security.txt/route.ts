export const dynamic = "force-static";

export function GET() {
  const body = [
    "Contact: https://www.commercialcopilot.co.uk/contact",
    "Policy: https://www.commercialcopilot.co.uk/terms",
    "Preferred-Languages: en",
    "Expires: 2027-07-23T23:59:59.000Z",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
