import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  emptyState?: ReactNode;
  mobileCard?: (item: T) => ReactNode;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  emptyState,
  mobileCard,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // Mobile: Show as rounded dark glass cards
  if (isMobile && mobileCard) {
    return (
      <div className="space-y-3">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className="bg-[#191B26]/85 rounded-2xl p-4 space-y-2 border border-[rgba(225,225,255,0.08)]"
          >
            {mobileCard(item)}
          </div>
        ))}
      </div>
    );
  }

  // Desktop: Clean dark glass data table
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0 rounded-xl border border-white/[0.06] bg-[#151722]/70">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.07] bg-[#191B26]/70">
            {columns.filter((c) => !isMobile || !c.hideOnMobile).map((col) => (
              <th
                key={col.key}
                className="text-left text-[#74788F] font-semibold uppercase tracking-wider text-[11px] sm:text-xs px-3 py-3 sm:px-4"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {data.map((item) => (
            <tr key={keyExtractor(item)} className="hover:bg-white/[0.03] transition-colors">
              {columns.filter((c) => !isMobile || !c.hideOnMobile).map((col) => (
                <td key={col.key} className="px-3 py-3 sm:px-4 text-sm text-[#F0EFF8]">
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
