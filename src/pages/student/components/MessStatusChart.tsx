import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export interface ChartEntry {
  name: string;
  value: number;
  color: string;
}

export interface MessStatusChartProps {
  chartData: ChartEntry[];
}

export default function MessStatusChart({ chartData }: MessStatusChartProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={5}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(222 47% 10%)',
            border: '1px solid hsl(222 47% 18%)',
            borderRadius: '8px',
            color: '#ffffff',
          }}
          itemStyle={{ color: '#ffffff' }}
        />
        <Legend formatter={(value) => <span style={{ color: '#ffffff', fontWeight: 500 }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}
