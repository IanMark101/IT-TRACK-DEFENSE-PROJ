import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomId, guestName } = body ?? {};

    if (!roomId || !guestName) {
      return Response.json({ error: "Missing roomId or guestName" }, { status: 400 });
    }

    const booking = await prisma.booking.create({
      data: {
        roomId: Number(roomId),
        guestName: String(guestName),
      },
      select: { id: true, roomId: true, guestName: true, createdAt: true },
    });

    return Response.json({ booking });
  } catch (error) {
    return Response.json({ error: "Failed to create booking" }, { status: 500 });
  }
}