import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");
  
  try {
    await prisma.$connect();
    console.log("✅ Connected to database!");
    
    // Clear old data
    await prisma.booking.deleteMany();
    await prisma.room.deleteMany();

    // Create 20 rooms (exactly 20 rows)
    console.log("🏨 Creating 20 rooms...");
    
    const roomsData = [
      // 7 Budget Rooms ($800-$1300, capacity 1-2)
      { name: "Budget Single", description: "Compact economy room", price: 800, capacity: 1 },
      { name: "Standard Single", description: "Cozy single bed", price: 1000, capacity: 1 },
      { name: "Standard Twin", description: "Two twin beds", price: 1100, capacity: 2 },
      { name: "Standard Room 101", description: "Cozy room", price: 1200, capacity: 2 },
      { name: "Standard Room 102", description: "Cozy room", price: 1200, capacity: 2 },
      { name: "Standard Room 103", description: "Cozy room", price: 1200, capacity: 2 },
      { name: "Standard Queen", description: "Queen size bed", price: 1300, capacity: 2 },
      
      // 7 Mid-tier Rooms ($2000-$2500, capacity 2-4)
      { name: "Deluxe Room 201", description: "Spacious room", price: 2000, capacity: 2 },
      { name: "Deluxe Room 202", description: "Spacious room", price: 2000, capacity: 2 },
      { name: "Deluxe Twin", description: "Spacious twin", price: 2100, capacity: 2 },
      { name: "Deluxe Queen", description: "Spacious queen", price: 2200, capacity: 2 },
      { name: "Deluxe King", description: "King size bed", price: 2300, capacity: 2 },
      { name: "Deluxe Room 203", description: "Spacious room", price: 2000, capacity: 2 },
      { name: "Family Room", description: "Two bedrooms", price: 2500, capacity: 4 },
      
      // 6 Luxury Rooms ($3000-$5500, capacity 2-4)
      { name: "Junior Suite", description: "Suite with kitchenette", price: 3000, capacity: 2 },
      { name: "Executive Suite", description: "Luxury suite with office", price: 3300, capacity: 2 },
      { name: "Suite 301", description: "Luxury suite with sea view", price: 3500, capacity: 2 },
      { name: "Suite 302", description: "Luxury suite with sea view", price: 3500, capacity: 2 },
      { name: "Presidential Suite", description: "Top floor luxury", price: 5000, capacity: 4 },
      { name: "Penthouse Suite", description: "Private rooftop access", price: 5500, capacity: 4 },
    ];

    await prisma.room.createMany({
      data: roomsData,
    });

    const allRooms = await prisma.room.findMany();
    console.log(`✅ Created ${allRooms.length} rooms`);

    // Create 60+ bookings (3 per room average × 4 days)
    const startDate = new Date("2025-10-25");
    const bookingsData = [];
    
    for (const room of allRooms) {
      // Different booking rates per tier (1-4 per day)
      const avgBookings = room.price < 1500 ? 1.5 : room.price < 3000 ? 2.5 : 3.5;
      const bookingsPerDay = Array.from({ length: 4 }, () => 
        Math.max(1, Math.min(4, Math.round(avgBookings + (Math.random() - 0.5))))
      );

      for (let day = 0; day < 4; day++) {
        const count = bookingsPerDay[day];
        for (let b = 0; b < count; b++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + day);
          
          bookingsData.push({
            roomId: room.id, 
            guestName: `Guest_${room.name.replace(/\s/g, '')}_${day}_${b}`,
            guestEmail: `guest.room${room.id}.booking${b}@hotel.example.com`, // ✅ 5th variable
            createdAt: new Date(date.getTime() + Math.floor(Math.random() * 86400000)),
          });
        }
      }
    }

    await prisma.booking.createMany({
      data: bookingsData,
    });
    
    console.log(`✅ Created ${bookingsData.length} bookings successfully!`);
    console.log("📊 Summary:");
    console.log(`   - Rooms: ${allRooms.length} rooms (5 variables each)`);
    console.log(`   - Bookings: ${bookingsData.length} records (5 variables each)`);
    console.log("🎉 Seed completed!");

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ SEED FAILED:", errorMessage);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log("✅ All done! Exiting...");
    process.exit(0);
  })
  .catch((e) => {
    console.error("💥 Fatal error:", e);
    process.exit(1);
  });