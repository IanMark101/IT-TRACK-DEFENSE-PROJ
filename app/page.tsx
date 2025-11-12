"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Room {
  id: number;
  name: string;
  description: string;
  price: number;
  createdAt: string;
}

const RoomMetricCard: React.FC<{ title: string; value: string; color: string }> = ({
  title,
  value,
  color,
}) => (
  <div className={`p-3 rounded-lg ${color} text-white shadow-md mb-4`}>
    <p className="text-xs opacity-80">{title}</p>
    <p className="text-lg font-bold">{value}</p>
  </div>
);

export default function HomePage() {
  const [rooms, setRooms] = useState<Room[]>([]); // ✅ Start as empty array
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch rooms
  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        const data = await res.json();
        
        // ✅ SAFE: Fallback to empty array if API fails
        setRooms(data.rooms || []);
      } catch (error) {
        console.error("Failed to fetch rooms:", error);
        setRooms([]); // ✅ Set to empty on error
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, []);

  // Handle booking
  async function handleBookNow(roomId: number) {
    const guestName = prompt("Enter your name for booking:");
    if (!guestName) return;

    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, guestName }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse JSON:", e);
        alert("API returned invalid JSON. Check console.");
        return;
      }

      if (res.ok) {
        alert(`Booking successful! Booking ID: ${data.booking.id}`);
      } else {
        alert(`Booking failed: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong while booking.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Header */}
      <header className="bg-gray-800 shadow-xl py-4 sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">H</div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Hotel LuxStay</h1>
          </div>
          <nav className="flex gap-6 text-gray-400 font-semibold">
            <a href="#" className="hover:text-blue-400 transition">Home</a>
            <a href="#rooms" className="hover:text-blue-400 transition">Rooms</a>
            <a href="#" className="hover:text-blue-400 transition">Contact</a>
            <a href="#" className="hover:text-blue-400 transition">About</a>
            <button onClick={() => router.push("/analytics")} className="text-blue-400 hover:text-blue-300 font-bold transition">View Analytics</button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gray-800 border-b border-gray-700 py-20">
        <div className="container mx-auto text-center px-6">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">Welcome to Hotel LuxStay</h2>
          <p className="text-lg md:text-xl text-gray-300 mb-6">Experience comfort, luxury, and elegance. Book your stay today!</p>
          <a href="#rooms" className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition shadow-lg">View Available Rooms</a>
        </div>
      </section>

      {/* Rooms */}
      <section id="rooms" className="py-16 px-6">
        <div className="container mx-auto">
          <h3 className="text-3xl font-extrabold text-white text-center mb-12 tracking-tight">Available Rooms</h3>

          {loading ? (
            <p className="text-center text-gray-400 text-lg">Loading rooms...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* ✅ SAFE RENDER: rooms?.map with fallback */}
              {rooms?.length > 0 ? rooms.map((room) => (
                <div key={room.id} className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl transition-transform duration-300 hover:shadow-blue-500/50 hover:scale-[1.01] flex flex-col">
                  <div className="flex flex-col flex-1">
                    <h4 className="text-2xl font-bold text-blue-400 mb-3">{room.name}</h4>
                    <p className="text-gray-400 mb-5 flex-1">{room.description}</p>

                    <RoomMetricCard title="Current Price" value={`₱${room.price.toLocaleString()}`} color="bg-emerald-600" />

                    <div className="flex gap-3 mt-auto border-t border-gray-700 pt-4">
                      <button onClick={() => handleBookNow(room.id)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transform transition shadow-md">Book Now</button>
                      <button onClick={() => router.push("/analytics")} className="flex-1 bg-gray-700 text-gray-200 py-2 rounded-lg hover:bg-gray-600 transition shadow-md">View Analytics</button>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-center text-gray-400 col-span-3">No rooms available.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 py-8 mt-16 border-t border-gray-700">
        <div className="container mx-auto text-center">
          <p>© {new Date().getFullYear()} Hotel LuxStay. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}