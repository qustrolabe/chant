import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { commands } from "../bindings";

export const Route = createFileRoute("/debug")({
  component: Debug,
});

const TABLES = ["collections", "artists", "albums", "tracks", "settings"];

function Debug() {
  const [selectedTable, setSelectedTable] = useState(TABLES[0]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await commands.debugQueryTable(selectedTable);
      if (res.status === "ok") {
        setRows(res.data);
      }
      setLoading(false);
    }
    fetchData();
  }, [selectedTable]);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-fg-primary">
          Database Debug View
        </h1>
        <select
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value)}
          className="bg-bg-surface border border-border-strong rounded-lg px-3 py-1.5 text-sm text-fg-secondary outline-none focus:border-accent"
        >
          {TABLES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto bg-bg-input border border-border-strong rounded-xl relative">
        {loading
          ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
              <span className="text-fg-muted">
                Loading {selectedTable}...
              </span>
            </div>
          )
          : rows.length === 0
          ? (
            <div className="p-8 text-center text-fg-muted">
              No rows found in this table.
            </div>
          )
          : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-bg-surface shadow-md">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 border-b border-border-strong font-bold uppercase tracking-wider text-fg-muted"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border hover:bg-bg-overlay transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-4 py-2 text-fg-secondary font-mono max-w-[300px] truncate"
                      >
                        {row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
