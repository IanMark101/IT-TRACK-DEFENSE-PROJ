"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  ScatterChart,
  Scatter,
} from "recharts";

interface GuestRecord {
  guestName: string;
  date: string;
}

interface BookingData {
  date: string;
  count: number;
  timeIndex: number;
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
  const router = useRouter();
  const [data, setData] = useState<Analytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"descriptive" | "predictive" | "prescriptive">("descriptive");
  const [selectedDates, setSelectedDates] = useState<{ [roomId: number]: { start: string; end: string } }>({});
  const [trendlineType, setTrendlineType] = useState<"linear" | "quadratic" | "cubic">("linear");

  // ---------- Math Functions ----------
  const movingAverage = (values: number[], window = 3) => {
    const avg: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < window - 1) avg.push(null);
      else {
        const windowValues = values.slice(i - window + 1, i + 1);
        avg.push(windowValues.reduce((a, b) => a + b, 0) / windowValues.length);
      }
    }
    return avg;
  };

  const exponentialSmoothing = (values: number[], alpha = 0.3) => {
    const smooth: (number | null)[] = [];
    if (values.length === 0) return [];
    smooth.push(null);
    if (values.length > 1) smooth.push(values[0]);
    for (let i = 2; i < values.length; i++) {
      const prevSmooth = smooth[i - 1];
      if (prevSmooth === null) smooth.push(null);
      else smooth.push(alpha * values[i - 1] + (1 - alpha) * prevSmooth);
    }
    return smooth;
  };

  const linearRegression = (values: number[]) => {
    const n = values.length;
    if (n < 2) return values.map((v) => v);
    const points = values.map((y, i) => ({ x: i, y: y }));
    const xMean = points.reduce((a, b) => a + b.x, 0) / n;
    const yMean = points.reduce((a, b) => a + b.y, 0) / n;
    let numerator = 0, denominator = 0;
    for (const p of points) {
      numerator += (p.x - xMean) * (p.y - yMean);
      denominator += (p.x - xMean) ** 2;
    }
    if (denominator === 0) return values.map(() => yMean);
    const slope = numerator / denominator;
    const intercept = yMean - slope * xMean;
    return points.map((p) => slope * p.x + intercept);
  };

  const calculateR2 = (actual: number[], predicted: (number | null)[]): number => {
    const validPairs = actual.map((y, i) => ({ y, f: predicted[i] }))
      .filter((p): p is { y: number; f: number } => p.f !== null);
    if (validPairs.length < 2) return 0;
    const yMean = validPairs.reduce((sum, p) => sum + p.y, 0) / validPairs.length;
    const ssRes = validPairs.reduce((sum, p) => sum + Math.pow(p.y - p.f, 2), 0);
    const ssTot = validPairs.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0);
    if (ssTot === 0) return 1;
    return Math.max(0, Math.min(1, 1 - (ssRes / ssTot)));
  };

  const solveLinearSystem = (A: number[][], B: number[]): number[] => {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, B[i]]);
    for (let i = 0; i < n; i++) {
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) maxRow = k;
      }
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      if (Math.abs(augmented[i][i]) < 1e-10) throw new Error("Singular matrix");
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) augmented[k][j] -= factor * augmented[i][j];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) x[i] -= augmented[i][j] * x[j];
      x[i] /= augmented[i][i];
    }
    return x;
  };

  const polynomialRegression = (x: number[], y: number[], degree: 2 | 3): number[] => {
    const n = x.length;
    if (n < 3) return linearRegression(y);
    if (degree === 2) {
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
      const sumX3 = x.reduce((sum, xi) => sum + xi * xi * xi, 0);
      const sumX4 = x.reduce((sum, xi) => sum + xi * xi * xi * xi, 0);
      const sumY = y.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
      const sumX2Y = x.reduce((sum, xi, i) => sum + xi * xi * y[i], 0);
      const A = [
        [n, sumX, sumX2],
        [sumX, sumX2, sumX3],
        [sumX2, sumX3, sumX4],
      ];
      const B = [sumY, sumXY, sumX2Y];
      try {
        const coefficients = solveLinearSystem(A, B);
        return x.map((xi) => coefficients[2] * xi * xi + coefficients[1] * xi + coefficients[0]);
      } catch {
        return linearRegression(y);
      }
    }
    return linearRegression(y);
  };

  // ---------- Fetch Analytics ----------
  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics", { cache: "no-store" });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        if (!json || !Array.isArray(json.analytics)) {
          console.error("Invalid API response format:", json);
          setData([]);
          setLoading(false);
          return;
        }

        // Keep full guestRecords and bookingsOverTime for all metrics
        const updated: Analytics[] = json.analytics.map((room: Analytics) => ({
          ...room,
          bookingsOverTime: room.bookingsOverTime,
          guestRecords: room.guestRecords,
        }));
        setData(updated);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <p className="text-xl text-gray-400">Loading hotel insights... 🏨</p>
      </div>
    );

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-gray-100 font-sans">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-lg font-semibold shadow-md transition-all duration-300"
        >
          ← Back to Landing Page
        </button>
      </div>

      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          Revenue Optimization Dashboard
        </h1>
        <p className="text-gray-400 mt-1">In-depth Booking Analytics for Hotel Room Types</p>
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

      {/* ---------- Descriptive Analytics ---------- */}
      {tab === "descriptive" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {data.map((room) => {
            const chartBookings = room.bookingsOverTime.slice(
              -(room.name === "Standard Room" ? STANDARD_ROOM_DAYS : OTHER_ROOM_DAYS)
            );
            const totalBookings = room.guestRecords.length;
            const totalSales = totalBookings * room.price;
            const avgDailyBookings = totalBookings / (room.bookingsOverTime.length || 1);

            return (
              <div key={room.roomId} className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl hover:shadow-blue-500/50 hover:scale-[1.01] flex flex-col">
                <h2 className="text-2xl font-bold mb-4 text-blue-400">{room.name}</h2>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <MetricCard title="Current Price" value={`₱${room.price.toLocaleString()}`} color="bg-indigo-600" />
                  <MetricCard title="Total Bookings" value={`${totalBookings}`} color="bg-sky-600" />
                  <MetricCard title="Total Sales" value={`₱${totalSales.toLocaleString()}`} color="bg-emerald-600" />
                  <MetricCard title={`Avg Daily Bookings (${room.bookingsOverTime.length} Days)`} value={avgDailyBookings.toFixed(1)} color="bg-gray-700" />
                </div>

                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartBookings}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #4b5563", color: "#fff" }} formatter={(value: number) => [value, "Bookings"]} />
                    <Bar dataKey="count" fill="#3b82f6" name="Daily Bookings" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-6 bg-gray-900 p-3 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold mb-2 text-blue-300">Guest Booking Records</h3>
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
                          <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="py-2 px-1">{idx + 1}</td>
                            <td className="py-2 px-1">{record.guestName}</td>
                            <td className="py-2 px-1">{new Date(record.date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-gray-500 italic text-sm">No guest records found.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- Predictive Analytics ---------- */}
      {tab === "predictive" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {data.map((room) => {
            const start = selectedDates[room.roomId]?.start ? new Date(selectedDates[room.roomId].start) : null;
            const end = selectedDates[room.roomId]?.end ? new Date(selectedDates[room.roomId].end) : null;

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
              <div key={room.roomId} className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl">
                <h2 className="text-2xl font-bold mb-4 text-blue-400">{room.name} Forecast 📈</h2>

                <div className="mb-6 grid grid-cols-2 gap-4 bg-gray-700 p-3 rounded-lg">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={selectedDates[room.roomId]?.start || ""}
                      onChange={(e) =>
                        setSelectedDates((prev) => ({ ...prev, [room.roomId]: { ...prev[room.roomId], start: e.target.value } }))
                      }
                      className="w-full border border-gray-500 bg-gray-900 text-white rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">End Date</label>
                    <input
                      type="date"
                      value={selectedDates[room.roomId]?.end || ""}
                      onChange={(e) =>
                        setSelectedDates((prev) => ({ ...prev, [room.roomId]: { ...prev[room.roomId], end: e.target.value } }))
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
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #4b5563", color: "#fff" }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "10px" }} />
                    <Line type="monotone" dataKey="actual" stroke="#3b82f6" name="Actual Bookings" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="movingAverage" stroke="#10b981" strokeDasharray="5 5" name="Moving Average" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="expSmooth" stroke="#f59e0b" strokeDasharray="3 3" name="Exponential Smoothing" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="regression" stroke="#ef4444" name="Linear Regression" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}

      {/* PRESCRIPTIVE ANALYTICS - FIXED DATA CONSISTENCY */}
      {tab === "prescriptive" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {data.map((room) => {
            const dailyCounts = room.bookingsOverTime.map((b) => b.count);
            const numberOfDays = room.bookingsOverTime.length || 1;
            const totalBookings = room.guestRecords.length; 
            const avgBookings = totalBookings / numberOfDays;

            let recommendation = "";
            let optimalPrice = room.price;

            //Define all theme variables upfront
            let titleClass = "text-blue-400";
            let hoverClass = "hover:shadow-blue-500/40";
            let badgeBgClass = "bg-blue-700/30";
            let badgeTextClass = "text-blue-300";
            let badgeBorderClass = "border-blue-600/40";
            let recIconClass = "bg-yellow-400";
            let recTextClass = "text-yellow-400";

            //Demand thresholds
            if (avgBookings < 3) {
              // LOW DEMAND - RED
              recommendation = "Low demand. Consider reducing price or offering promos.";
              optimalPrice = room.price * 0.9;
              titleClass = "text-red-400";
              hoverClass = "hover:shadow-red-500/40";
              badgeBgClass = "bg-red-700/30";
              badgeTextClass = "text-red-300";
              badgeBorderClass = "border-red-600/40";
              recIconClass = "bg-red-400";
              recTextClass = "text-red-400";
            } else if (avgBookings < 5) {
              // STABLE DEMAND - GREEN for Standard/Deluxe, BLUE for others
              recommendation = "Stable demand. Maintain current pricing strategy.";
              
              if (room.name === "Standard Room" || room.name === "Deluxe Room") {
                titleClass = "text-green-400";
                hoverClass = "hover:shadow-green-500/40";
                badgeBgClass = "bg-green-700/30";
                badgeTextClass = "text-green-300";
                badgeBorderClass = "border-green-600/40";
                recIconClass = "bg-green-400";
                recTextClass = "text-green-400";
              }
              // Other rooms keep default blue theme
            } else {
              // HIGH DEMAND - CYAN (threshold now 5)
              recommendation = "High demand detected. Consider increasing price slightly.";
              optimalPrice = room.price * 1.1;
              titleClass = "text-cyan-400";
              hoverClass = "hover:shadow-cyan-500/40";
              badgeBgClass = "bg-cyan-700/30";
              badgeTextClass = "text-cyan-300";
              badgeBorderClass = "border-cyan-600/40";
              recIconClass = "bg-cyan-400";
              recTextClass = "text-cyan-400";
            }

            // Scatter plot data
            const xValues = room.bookingsOverTime.map((_, i) => i);
            const scatterData = room.bookingsOverTime.map((b, i) => ({
              x: i,
              y: dailyCounts[i],
              date: b.date,
            }));

            // Trendline calculation
            let trendlineData: { x: number; y: number }[] = [];
            let r2 = 0;

            if (trendlineType === "linear") {
              const lr = linearRegression(dailyCounts);
              trendlineData = xValues.map((x, i) => ({ x, y: lr[i] }));
              r2 = calculateR2(dailyCounts, lr);
            } else {
              const pr = polynomialRegression(xValues, dailyCounts, trendlineType === "quadratic" ? 2 : 3);
              trendlineData = xValues.map((x, i) => ({ x, y: pr[i] }));
              r2 = calculateR2(dailyCounts, pr);
            }

            return (
              <div
                key={room.roomId}
                className={`bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 shadow-lg ${hoverClass} hover:scale-[1.01] transition-all duration-300 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className={`text-2xl font-bold ${titleClass} tracking-tight`}>
                      {room.name}
                    </h2>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badgeBgClass} ${badgeTextClass} border ${badgeBorderClass}`}>
                      Prescriptive Insight
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <MetricCard title="Current Price" value={`₱${room.price.toLocaleString()}`} color="bg-indigo-600" />
                    <MetricCard title="Suggested Optimal Price" value={`₱${optimalPrice.toLocaleString()}`} color="bg-sky-600" />
                  </div>

                  <div className="mt-6 bg-gray-900/60 backdrop-blur-sm p-5 rounded-xl border border-gray-700">
                    <div className="flex items-center mb-3">
                      <div className={`w-3 h-3 rounded-full ${recIconClass} mr-2 animate-pulse`} />
                      <h3 className={`text-lg font-semibold ${recTextClass}`}>Recommendation 💡</h3>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">{recommendation}</p>
                  </div>

                  {/* ENHANCED SCATTER PLOT WITH LABELS */}
                  <div className="mt-6 bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-blue-300">Demand Pattern Analysis</h3>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-300">Trendline:</label>
                        <select
                          value={trendlineType}
                          onChange={(e) => setTrendlineType(e.target.value as any)}
                          className="bg-gray-700 text-white text-sm rounded px-2 py-1"
                        >
                          <option value="linear">Linear</option>
                          <option value="quadratic">Quadratic</option>
                          <option value="cubic">Cubic</option>
                        </select>
                        <span className="text-sm text-gray-400 font-mono">R² = {r2.toFixed(3)}</span>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={280}>
                      <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        
                        {/* X-AXIS WITH DATE LABELS */}
                        <XAxis 
                          type="number" 
                          dataKey="x" 
                          name="Date" 
                          stroke="#9ca3af"
                          tickFormatter={(value) => {
                            const dataPoint = scatterData[value];
                            return dataPoint ? new Date(dataPoint.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            }) : value;
                          }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          label={{ 
                            value: "Date", 
                            position: "insideBottom", 
                            offset: -25, 
                            fill: "#9ca3af",
                            fontSize: 12
                          }}
                        />
                        
                        {/* Y-AXIS WITH LABEL */}
                        <YAxis 
                          type="number" 
                          dataKey="y" 
                          name="Bookings" 
                          stroke="#9ca3af"
                          label={{ 
                            value: "Number of Bookings", 
                            angle: -90, 
                            position: "insideLeft", 
                            fill: "#9ca3af",
                            fontSize: 12
                          }}
                          allowDecimals={false}
                        />
                        
                        {/* CUSTOM TOOLTIP */}
                        <Tooltip 
                          cursor={{ strokeDasharray: "3 3" }}
                          content={({ active, payload }) => {
                            if (active && payload && payload[0]) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-gray-800 border border-gray-600 text-white p-3 rounded shadow-lg">
                                  <div className="font-semibold text-blue-300 mb-1">Booking Details</div>
                                  <div className="text-sm">Date: {new Date(data.date).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}</div>
                                  <div className="text-sm">Bookings: <span className="font-bold text-blue-400">{data.y}</span></div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        
                        {/* LEGEND */}
                        <Legend 
                          verticalAlign="top"
                          wrapperStyle={{ paddingBottom: 10 }}
                        />
                        
                        {/* SCATTER POINTS */}
                        <Scatter 
                          name="Daily Bookings" 
                          data={scatterData} 
                          fill="#3b82f6"
                        />
                        
                        {/* TRENDLINE */}
                        <Line 
                          type="linear" 
                          dataKey="y" 
                          data={trendlineData} 
                          stroke="#ef4444" 
                          strokeWidth={3} 
                          dot={false} 
                          name={`${trendlineType.charAt(0).toUpperCase() + trendlineType.slice(1)} Trendline`}
                          strokeDasharray="5 5"
                        />
                      </ScatterChart>
                    </ResponsiveContainer>
                    
                    <p className="text-xs text-gray-500 mt-3 text-center">
                      R² close to 1.0 = strong predictable trend | Low R² = high variability, consider dynamic pricing
                    </p>
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