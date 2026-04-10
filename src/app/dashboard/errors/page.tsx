"use client";

import { useEffect, useState } from "react";

type ErrorLog = {
  id: string;
  message: string;
  source: string;
  userId?: string;
  createdAt: string;
};

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/errors")
      .then((res) => res.json())
      .then(setErrors);
  }, []);

  const filtered = errors.filter((e) => {
    const matchSearch =
      e.message.toLowerCase().includes(search.toLowerCase()) ||
      e.source.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      filter === "ALL" || e.source.includes(filter);

    return matchSearch && matchFilter;
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📊 Error Monitoring</h1>

      {/* 🔍 Search */}
      <input
        type="text"
        placeholder="ابحث..."
        className="border p-2 mb-4 w-full"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* 🎯 Filter */}
      <div className="mb-4 flex gap-2">
        {["ALL", "DB", "AI", "ORDER", "WEBHOOK"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 border rounded ${
              filter === f ? "bg-black text-white" : ""
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 📋 Table */}
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Message</th>
            <th className="p-2">Source</th>
            <th className="p-2">User</th>
            <th className="p-2">Time</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="p-2">{e.message}</td>
              <td className="p-2">{e.source}</td>
              <td className="p-2">{e.userId || "-"}</td>
              <td className="p-2">
                {new Date(e.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}