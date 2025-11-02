"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface GuestRecord {
  guestName: string;
  date: string;
}

interface BookingData {
  date: string;
  count: number;
  timeIndex: number;
  isForecast?: boolean;
}

interface Analytics {
  roomId: number;
  name: string;
  bookingsOverTime: BookingData[];
  price: number;
  guestRecords: GuestRecord[];
}

const MetricCard: React.FC<{ title: string; value: string; color: string }> = ({
  title,
  value,
  color,
}) => (
  <div className={`p-4 rounded-xl ${color} text-white shadow-md flex flex-col`}>
    <span className="text-sm opacity-80">{title}</span>
    <span className="text-2xl font-bold mt-1">{value}</span>
  </div>
);

const STANDARD_ROOM_DAYS = 8;
const OTHER_ROOM_DAYS = 7;

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"descriptive" | "predictive" | "prescriptive">(
    "descriptive"
  );

  const [selectedDates, setSelectedDates] = useState<{
    [roomId: number]: { start: string; end: string };
  }>({});

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics", { cache: "no-store" });
        const json = await res.json();

        const updated = json.analytics.map((room: Analytics) => ({
          ...room,
          bookingsOverTime: room.bookingsOverTime.slice(
            -(room.name === "Standard Room" ? STANDARD_ROOM_DAYS : OTHER_ROOM_DAYS)
          ),
        }));
        setData(updated);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const movingAverage = (values: number[], window = 3) => {
    const avg: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < window - 1) avg.push(null);
      else {
        const windowValues = values.slice(i - window + 1, i + 1);
        const sum = windowValues.reduce((a, b) => a + b, 0);
        avg.push(sum / windowValues.length);
      }
    }
    return avg;
  };

  const exponentialSmoothing = (values: number[], alpha = 0.3) => {
    const smooth: (number | null)[] = [];
    values.forEach((val, i) => {
      if (i === 0) smooth.push(null);
      else if (smooth[i - 1] == null) smooth.push(val);
      else smooth.push(alpha * val + (1 - alpha) * (smooth[i - 1] as number));
    });
    return smooth;
  };

  const linearRegression = (values: number[]) => {
    const n = values.length;
    if (n < 2) return values.map((v) => v);
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;
    let numerator = 0;
    let denominator = 0;
    values.forEach((y, i) => {
      numerator += (i - xMean) * (y - yMean);
      denominator += (i - xMean) ** 2;
    });
    if (denominator === 0) return values.map(() => yMean);
    const slope = numerator / denominator;
    const intercept = yMean - slope * xMean;
    return values.map((_, i) => slope * i + intercept);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <p className="text-xl text-gray-400">Loading hotel insights... 🏨</p>
      </div>
    );

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-gray-100 font-sans">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          Revenue Optimization Dashboard
        </h1>
        <p className="text-gray-400 mt-1">
          In-depth Booking Analytics for Hotel Room Types
        </p>
      </header>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-10 p-2 bg-gray-800 rounded-xl shadow-inner max-w-lg mx-auto">
        {["descriptive", "predictive", "prescriptive"].map((t) => (
          <button
            key={t}
            className={`flex-1 px-5 py-2 rounded-lg text-lg font-bold transition-all duration-300 ${
              tab === t
                ? "bg-blue-600 text-white shadow-lg"
                : "text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
            onClick={() => setTab(t as any)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* DESCRIPTIVE ANALYTICS */}
      {tab === "descriptive" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {data.map((room) => {
            const chartBookings = room.bookingsOverTime;
            const totalBookings = room.guestRecords.length;
            const totalSales = totalBookings * room.price;
            const numberOfDays = chartBookings.length || 1;
            const avgDailyBookings = totalBookings / numberOfDays;

            return (
              <div
                key={room.roomId}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl hover:shadow-blue-500/50 hover:scale-[1.01] flex flex-col"
              >
                <h2 className="text-2xl font-bold mb-4 text-blue-400">
                  {room.name}
                </h2>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <MetricCard
                    title="Current Price"
                    value={`₱${room.price.toLocaleString()}`}
                    color="bg-indigo-600"
                  />
                  <MetricCard
                    title="Total Bookings"
                    value={`${totalBookings}`}
                    color="bg-sky-600"
                  />
                  <MetricCard
                    title="Total Sales"
                    value={`₱${totalSales.toLocaleString()}`}
                    color="bg-emerald-600"
                  />
                  <MetricCard
                    title={`Avg Daily Bookings (${numberOfDays} Days)`}
                    value={avgDailyBookings.toFixed(1)}
                    color="bg-gray-700"
                  />
                </div>

                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartBookings}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #4b5563",
                        color: "#fff",
                      }}
                      formatter={(value: number) => [value, "Bookings"]}
                    />
                    <Bar
                      dataKey="count"
                      fill="#3b82f6"
                      name="Daily Bookings"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 bg-gray-900 p-3 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold mb-2 text-blue-300">
                    Guest Booking Records
                  </h3>
                  {room.guestRecords.length > 0 ? (
                    <table className="w-full text-sm text-gray-300">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="text-left py-2 px-1">#</th>
                          <th className="text-left py-2 px-1">Guest Name</th>
                          <th className="text-left py-2 px-1">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {room.guestRecords.map((record, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-gray-800 hover:bg-gray-800/50"
                          >
                            <td className="py-2 px-1">{idx + 1}</td>
                            <td className="py-2 px-1">{record.guestName}</td>
                            <td className="py-2 px-1">
                              {new Date(record.date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-500 italic text-sm">
                      No guest records found.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PREDICTIVE ANALYTICS */}
      {tab === "predictive" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {data.map((room) => {
            const start = selectedDates[room.roomId]?.start
              ? new Date(selectedDates[room.roomId].start)
              : null;
            const end = selectedDates[room.roomId]?.end
              ? new Date(selectedDates[room.roomId].end)
              : null;

            const filteredBookings = room.bookingsOverTime.filter((b) => {
              const date = new Date(b.date);
              if (start && date < start) return false;
              if (end && date > end) return false;
              return true;
            });

            const counts = filteredBookings.map((b) => b.count);
            const ma = movingAverage(counts, 3);
            const es = exponentialSmoothing(counts, 0.3);
            const lr = linearRegression(counts);

            const chartData = filteredBookings.map((b, i) => ({
              date: b.date,
              actual: counts[i],
              movingAverage: ma[i],
              expSmooth: es[i],
              regression: lr[i],
            }));

            return (
              <div
                key={room.roomId}
                className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl"
              >
                <h2 className="text-2xl font-bold mb-4 text-blue-400">
                  {room.name} Forecast 📈
                </h2>

                <div className="mb-6 grid grid-cols-2 gap-4 bg-gray-700 p-3 rounded-lg">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={selectedDates[room.roomId]?.start || ""}
                      onChange={(e) =>
                        setSelectedDates((prev) => ({
                          ...prev,
                          [room.roomId]: {
                            ...prev[room.roomId],
                            start: e.target.value,
                          },
                        }))
                      }
                      className="w-full border border-gray-500 bg-gray-900 text-white rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-300 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={selectedDates[room.roomId]?.end || ""}
                      onChange={(e) =>
                        setSelectedDates((prev) => ({
                          ...prev,
                          [room.roomId]: {
                            ...prev[room.roomId],
                            end: e.target.value,
                          },
                        }))
                      }
                      className="w-full border border-gray-500 bg-gray-900 text-white rounded px-3 py-2"
                    />
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #4b5563",
                        color: "#fff",
                      }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "10px" }} />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#3b82f6"
                      name="Actual Bookings"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="movingAverage"
                      stroke="#10b981"
                      strokeDasharray="5 5"
                      name="Moving Average"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expSmooth"
                      stroke="#f59e0b"
                      strokeDasharray="3 3"
                      name="Exp. Smoothing"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="regression"
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      name="Linear Regression"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}

      {/* PRESCRIPTIVE ANALYTICS */}
      {tab === "prescriptive" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {data.map((room) => {
            const totalBookings = room.bookingsOverTime.reduce((a, b) => a + b.count, 0);
            const avgBookings = totalBookings / (room.bookingsOverTime.length || 1);

            let recommendation = "";
            let optimalPrice = room.price;

            if (avgBookings < 3) {
              recommendation = "Low demand. Consider reducing price or offering promos.";
              optimalPrice = room.price * 0.9;
            } else if (avgBookings < 7) {
              recommendation = "Stable demand. Maintain current pricing strategy.";
            } else {
              recommendation = "High demand detected. Consider increasing price slightly.";
              optimalPrice = room.price * 1.1;
            }

            return (
              <div
                key={room.roomId}
                className="bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-blue-500/40 hover:scale-[1.01] transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-2xl font-bold text-blue-400 tracking-tight">
                      {room.name}
                    </h2>
                    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-700/30 text-blue-300 border border-blue-600/40">
                      Prescriptive Insight
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <MetricCard
                      title="Current Price"
                      value={`₱${room.price.toLocaleString()}`}
                      color="bg-indigo-600"
                    />
                    <MetricCard
                      title="Suggested Optimal Price"
                      value={`₱${optimalPrice.toLocaleString()}`}
                      color="bg-sky-600"
                    />
                  </div>

                  <div className="mt-6 bg-gray-900/60 backdrop-blur-sm p-5 rounded-xl border border-gray-700">
                    <div className="flex items-center mb-3">
                      <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2 animate-pulse" />
                      <h3 className="text-lg font-semibold text-yellow-400">
                        Recommendation 💡
                      </h3>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">{recommendation}</p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-700 text-xs text-gray-500 text-right">
                  <span>Last Updated: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
