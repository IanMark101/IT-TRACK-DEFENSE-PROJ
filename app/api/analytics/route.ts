import { prisma } from "@/lib/prisma";

// Cache data for 1 minute
let cache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 60000; // 60 seconds

export async function GET() {
  try {
    // If cache is fresh, use it
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return Response.json(cache.data);
    }

    const rooms = await prisma.room.findMany({
      include: {
        bookings: {
          select: { createdAt: true, guestName: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { id: "asc" },
    });

    const analytics = rooms.map((room) => {
      const bookingCountsByDate: Record<string, number> = {};
      room.bookings.forEach((b) => {
        const date = new Date(b.createdAt).toISOString().split("T")[0];
        bookingCountsByDate[date] = (bookingCountsByDate[date] || 0) + 1;
      });

      const bookingsOverTime = Object.entries(bookingCountsByDate)
        .map(([date, count], index) => ({ date, count, timeIndex: index }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const guestRecords = room.bookings
        .map((b) => ({
          guestName: b.guestName || "Guest",
          date: new Date(b.createdAt).toISOString().split("T")[0],
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      return { roomId: room.id, name: room.name, price: room.price, bookingsOverTime, guestRecords };
    });

    // Save to cache
    cache = { data: { analytics }, timestamp: Date.now() };
    
    return Response.json({ analytics });
  } catch (error) {
    return Response.json({ error: "Failed to fetch analytics", analytics: [] }, { status: 500 });
  }
}