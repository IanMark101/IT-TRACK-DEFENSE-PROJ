// seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();

  // Add sample rooms
  await prisma.room.createMany({
    data: [
      { name: "Standard Room", description: "A cozy room", price: 1200 },
      { name: "Deluxe Room", description: "Spacious room", price: 2000 },
      { name: "Suite", description: "Luxury suite with sea view", price: 3500 },
    ],
  });

  // Fetch the actual rooms (including their auto-incremented IDs)
  const allRooms = await prisma.room.findMany();
  
  // Create bookings spread over 4 days (to keep total records low, ~12 to 36)
  const startDate = new Date("2025-10-25");
  const NUM_DAYS = 4; // Reduced to 4 days
  const MAX_BOOKINGS_PER_DAY = 3; // Reduced max bookings
  const bookingsData = [];
  
  for (const room of allRooms) {
    for (let day = 0; day < NUM_DAYS; day++) {
      // 1-3 bookings/day
      const bookingsPerDay = Math.floor(Math.random() * MAX_BOOKINGS_PER_DAY) + 1; 
      for (let b = 0; b < bookingsPerDay; b++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + day);
        
        bookingsData.push({
          roomId: room.id, 
          guestName: `Guest ${room.name}-${day}-${b}`,
          // Sets the createdAt date for time series analysis
          createdAt: new Date(date.getTime() + Math.floor(Math.random() * 86400000)), 
        });
      }
    }
  }

  await prisma.booking.createMany({
    data: bookingsData,
  });

  console.log("✅ Rooms and 4-day bookings added successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });