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

  // Mobile: Show as cards
  if (isMobile && mobileCard) {
    return (
      <div className="space-y-3">
        {data.map((item) => (
          <div key={keyExtractor(item)} className="bg-secondary/50 rounded-xl p-4 space-y-2 border border-border/50">
            {mobileCard(item)}
          </div>
        ))}
      </div>
    );
  }

  // Desktop: Standard table
  return (
    <div className="overflow-x-auto -mx-2 sm:mx-0">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {columns.filter(c => !isMobile || !c.hideOnMobile).map((col) => (
              <th
                key={col.key}
                className="text-left text-foreground font-bold text-xs sm:text-sm p-2 sm:p-3"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={keyExtractor(item)} className="border-b border-border/50 hover:bg-secondary/30">
              {columns.filter(c => !isMobile || !c.hideOnMobile).map((col) => (
                <td key={col.key} className="p-2 sm:p-3 text-sm">
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
