// app/api/analytics/route.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Fetch rooms + bookings (we only need guestName and createdAt from bookings)
    const rooms = await prisma.room.findMany({
      include: {
        bookings: {
          select: {
            createdAt: true,
            guestName: true,
          },
        },
      },
    });

    const analytics = rooms.map((room) => {
      // Count bookings per date
      const bookingCountsByDate: { [date: string]: number } = {};
      room.bookings.forEach((b) => {
        const date = b.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
        bookingCountsByDate[date] = (bookingCountsByDate[date] || 0) + 1;
      });

      // Convert to sorted array for charting
      const bookingsOverTime = Object.entries(bookingCountsByDate)
        .map(([date, count], index) => ({
          date,
          count,
          timeIndex: index,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Guest-level records for descriptive table (keep full list)
      const guestRecords = room.bookings
        .map((b) => ({
          guestName: b.guestName || "Guest",
          date: b.createdAt.toISOString().split("T")[0],
        }))
        // sort newest first (optional) — change as needed
        .sort((a, b) => b.date.localeCompare(a.date));

      return {
        roomId: room.id,
        name: room.name,
        price: room.price,
        bookingsOverTime,
        guestRecords,
      };
    });

    return new Response(JSON.stringify({ analytics }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Analytics GET error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch analytics" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    // keep Prisma connection cleanup optional here (serverless vs persistent)
    // await prisma.$disconnect();
  }
}
