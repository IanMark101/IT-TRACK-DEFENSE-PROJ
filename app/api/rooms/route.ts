// app/api/rooms/route.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        bookings: {
          select: {
            id: true,
            guestName: true,
            createdAt: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    return new Response(JSON.stringify({ rooms }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Rooms GET error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch rooms" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    // await prisma.$disconnect();
  }
}
