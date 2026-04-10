import { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
}

export function DataTable<T>({ columns, rows, emptyMessage = 'No records found.' }: DataTableProps<T>) {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/70 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3.5">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-muted-foreground" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={index}
                className="border-b border-border/80 transition-colors last:border-0 hover:bg-muted/40"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 text-foreground">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
