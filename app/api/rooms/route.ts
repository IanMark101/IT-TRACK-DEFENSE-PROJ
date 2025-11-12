import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        bookings: {
          select: { id: true, guestName: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { id: "asc" },
    });
    return Response.json({ rooms });
  } catch (error) {
    return Response.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}