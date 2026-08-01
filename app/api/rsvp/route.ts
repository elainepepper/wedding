export async function POST() {
  return Response.json(
    { error: "RSVPs are accepted only through a valid personalised invitation link." },
    { status: 403 },
  );
}
