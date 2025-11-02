// app/api/booking/route.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { roomId, guestName } = body ?? {};

    if (!roomId || !guestName) {
      return new Response(JSON.stringify({ error: "Missing roomId or guestName" }), { status: 400 });
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        roomId: Number(roomId),
        guestName: String(guestName),
      },
      select: {
        id: true,
        roomId: true,
        guestName: true,
        createdAt: true,
      },
    });

    return new Response(JSON.stringify({ booking }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Booking POST error:", error);
    return new Response(JSON.stringify({ error: "Failed to create booking" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    // await prisma.$disconnect();
  }
}
